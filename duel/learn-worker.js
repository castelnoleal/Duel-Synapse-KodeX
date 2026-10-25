// Web Worker for Synapse AI's combo search: practises a deck's opening turns in the background
// (its own rules engine, so a running duel is never slowed down) and saves the lines it finds.
import { OcgCore } from "./engine/core.js";
import { CardDB, ScriptStore } from "./engine/data.js";
import { exploreDeck } from "./engine/explore.js";
import { saveLocal, shareOnline } from "./ai-book.js";

let ready = null, core, db, store, stop = false;
const post = (m) => self.postMessage(m);

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} returned ${r.status}`);
  return r.json();
}
function init(base) {
  if (ready) return ready;
  ready = (async () => {
    const [cards, strings, index] = await Promise.all([getJSON(base + "data/cards.json"), getJSON(base + "data/strings.json"), getJSON(base + "data/scripts.json")]);
    db = new CardDB(cards, strings);
    const sources = [(p) => `${base}scripts/${index.commit}/${p}`, (p) => `https://cdn.jsdelivr.net/gh/${index.repo}@${index.commit}/${p}`];
    store = new ScriptStore(index, async (p) => {
      for (const src of sources) {
        try { const r = await fetch(src(p)); if (r.ok) return await r.text(); if (r.status === 404) return null; } catch (e) { /* next */ }
      }
      return null;
    });
    core = await OcgCore.load(base + "engine/ocgcore.wasm");
  })();
  return ready;
}

self.onmessage = async (ev) => {
  const m = ev.data;
  try {
    if (m.cmd === "explore") {
      stop = false;
      await init(m.base);
      const t0 = Date.now();
      const { book, sims } = await exploreDeck({ core, db, store, deck: m.deck, hands: m.hands || 6, budget: m.budget || 110,
        onProgress: (p) => post({ t: "progress", ...p }), shouldStop: () => stop });
      if (book) { await saveLocal(book); if (m.share !== false) shareOnline(book); }
      post({ t: "done", book, sims, ms: Date.now() - t0, lines: book ? book.lines.length : 0 });
    } else if (m.cmd === "stop") stop = true;
  } catch (e) {
    post({ t: "fail", error: String(e && e.message || e) });
  }
};
