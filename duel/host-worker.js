// Web Worker that runs the rules engine for whoever is hosting the duel
// (solo playtest, or the host of an online room). The UI talks to it with postMessage.
import { OcgCore } from "./engine/core.js";
import { CardDB, ScriptStore } from "./engine/data.js";
import { DuelHost } from "./engine/host.js";
import { botAnswer } from "./engine/bot.js";
import { observe } from "./engine/smart.js";

let core, db, store, host, bots = {}, mems = {}, retries = {};
const post = (m) => self.postMessage(m);

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} returned ${r.status}`);
  return r.json();
}

async function init(base) {
  const [cards, strings, index] = await Promise.all([
    getJSON(base + "data/cards.json"), getJSON(base + "data/strings.json"), getJSON(base + "data/scripts.json")]);
  db = new CardDB(cards, strings);
  const sources = [
    (p) => `${base}scripts/${index.commit}/${p}`,
    (p) => `https://cdn.jsdelivr.net/gh/${index.repo}@${index.commit}/${p}`,
  ];
  let preferred = 0;
  store = new ScriptStore(index, async (p) => {
    for (let k = 0; k < sources.length; k++) {
      const i = (preferred + k) % sources.length;
      try {
        const r = await fetch(sources[i](p));
        if (r.ok) { preferred = i; return await r.text(); }
        if (r.status === 404) return null;
      } catch (e) { /* try next source */ }
    }
    return null;
  });
  core = await OcgCore.load(base + "engine/ocgcore.wasm");
  post({ t: "ready", version: core.version.join(".") });
}

function emit(viewer, packet) {
  post({ t: "packet", viewer, packet });
  const bot = bots[viewer];
  if (bot) {
    const mem = mems[viewer] || (mems[viewer] = {});
    observe(packet, mem);
    retries[viewer] = packet.events.some((e) => e.type === 1) ? (retries[viewer] || 0) + 1 : 0; // MSG_RETRY: last answer was rejected
  }
  if (bot && packet.prompt && !packet.ended) {
    // Let the UI paint before the bot answers.
    setTimeout(() => {
      if (!host || !host.pending || host.pending.player !== viewer) return;
      const ans = botAnswer(host.pending.msg, { mode: bot, db, view: packet, hint: packet.prompt.hint, mem: mems[viewer], retry: retries[viewer] || 0 });
      const err = ans ? host.respond(viewer, ans) : "bot could not answer";
      if (err) post({ t: "error", team: viewer, error: "Bot: " + err });
    }, bot === "passive" ? 30 : bot === "smart" ? 260 : 120);
  }
}

self.onmessage = async (ev) => {
  const m = ev.data;
  try {
    if (m.cmd === "init") await init(m.base);
    else if (m.cmd === "start") {
      if (host) { host.destroy(); host = null; }
      bots = m.bots || {}; mems = {}; retries = {};
      const codes = m.decks.flatMap((d) => [...d.main, ...d.extra]);
      core.missing.clear();
      await store.preload(codes, (done, total) => post({ t: "progress", done, total }));
      host = new DuelHost({ core, db, scripts: store, decks: m.decks, names: m.names, options: m.options, emit });
      host.start();
    } else if (m.cmd === "respond") {
      if (!host) return;
      const err = host.respond(m.team, m.resp);
      if (err) post({ t: "error", team: m.team, error: err });
    } else if (m.cmd === "surrender") {
      if (host) host.surrender(m.team);
    } else if (m.cmd === "stop") {
      if (host) host.destroy();
      host = null;
    }
  } catch (e) {
    post({ t: "fatal", error: String(e && e.stack || e) });
  }
};
