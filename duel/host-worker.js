// Web Worker that runs the rules engine for whoever is hosting the duel
// (solo playtest, or the host of an online room). The UI talks to it with postMessage.
import { OcgCore } from "./engine/core.js";
import { CardDB, ScriptStore } from "./engine/data.js";
import { DuelHost } from "./engine/host.js";
import { botAnswer } from "./engine/bot.js";
import { observe } from "./engine/smart.js";
import { Recorder, Advisor, deckProfile, mergeBooks } from "./engine/learn.js";
import { playbookFor, saveLocal, shareOnline } from "./ai-book.js";

let core, db, store, host, bots = {}, mems = {}, retries = {};
// Learning: recorders watch human seats; advisors hold Synapse AI's playbook per seat.
let recorders = {}, advisors = {}, learnOpt = { learn: true, share: true }, finished = false;
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
  if (recorders[viewer]) recorders[viewer].observe(packet);
  if (packet.ended && !finished && viewer === 2) { finished = true; learnFrom(packet.ended).catch(() => {}); }
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
      const ans = botAnswer(host.pending.msg, { mode: bot, db, view: packet, hint: packet.prompt.hint, mem: mems[viewer], retry: retries[viewer] || 0, advisor: advisors[viewer] || null });
      const err = ans ? host.respond(viewer, ans) : "bot could not answer";
      if (err) post({ t: "error", team: viewer, error: "Bot: " + err });
    }, bot === "passive" ? 30 : bot === "smart" ? 260 : 120);
  }
}

/** Saves what the human seats taught Synapse AI this duel (on this device, and online if allowed). */
async function learnFrom(ended) {
  const all = [];
  for (const [team, rec] of Object.entries(recorders)) {
    const book = rec.finish(ended.winner === Number(team));
    if (!book) continue;
    await saveLocal(book);
    if (learnOpt.share) shareOnline(book);
    all.push({ team: Number(team), lines: book.lines.length, picks: Object.keys(book.picks).length, chains: Object.keys(book.chains).length });
  }
  recorders = {};
  if (all.length) post({ t: "learned", learned: all });
}
/** Loads the playbook for each Synapse AI seat (device + online), within a short time limit. */
async function loadPlaybooks(decks) {
  advisors = {};
  const seats = Object.entries(bots).filter(([, mode]) => mode === "smart").map(([t]) => Number(t));
  await Promise.all(seats.map(async (team) => {
    const profile = deckProfile(decks[team], db);
    const r = await Promise.race([playbookFor(profile, { online: learnOpt.share }), new Promise((res) => setTimeout(() => res(null), 3500))]);
    if (r && r.book.lines.length + Object.keys(r.book.picks).length + Object.keys(r.book.chains).length > 0) {
      advisors[team] = new Advisor(r.book, { similarity: r.similarity });
      post({ t: "playbook", team, lines: r.book.lines.length, fromYou: r.fromYou, similarity: r.similarity, online: r.online,
        searched: r.book.lines.filter((l) => l.src === "search").length });
    } else post({ t: "playbook", team, lines: 0, fromYou: 0, similarity: 0, online: !!(r && r.online), searched: 0 });
  }));
}

self.onmessage = async (ev) => {
  const m = ev.data;
  try {
    if (m.cmd === "init") await init(m.base);
    else if (m.cmd === "start") {
      if (host) { host.destroy(); host = null; }
      bots = m.bots || {}; mems = {}; retries = {}; finished = false;
      learnOpt = { learn: m.learn ? m.learn.learn !== false : true, share: m.learn ? m.learn.share !== false : true };
      recorders = {};
      if (learnOpt.learn) for (let t = 0; t < 2; t++) if (!bots[t] && m.decks[t] && m.decks[t].main.length) recorders[t] = new Recorder({ db, team: t, deck: m.decks[t] });
      const codes = m.decks.flatMap((d) => [...d.main, ...d.extra]);
      core.missing.clear();
      await store.preload(codes, (done, total) => post({ t: "progress", done, total }));
      await loadPlaybooks(m.decks);
      host = new DuelHost({ core, db, scripts: store, decks: m.decks, names: m.names, options: m.options, emit });
      host.start();
    } else if (m.cmd === "respond") {
      if (!host) return;
      const pending = host.pending && host.pending.player === m.team ? host.pending : null;
      // Record before the engine moves on, so the line starts from the hand the player saw.
      if (pending && recorders[m.team] && m.resp && m.resp.t === pending.msg.type) recorders[m.team].answer(pending.msg, m.resp, pending.hint);
      const err = host.respond(m.team, m.resp);
      if (err) post({ t: "error", team: m.team, error: err });
    } else if (m.cmd === "surrender") {
      if (host) host.surrender(m.team);
    } else if (m.cmd === "playbook") {
      // New lines (e.g. from the combo search) for a Synapse AI seat in the running duel.
      if (advisors[m.team] && m.book) mergeBooks(advisors[m.team].book, m.book);
      else if (m.book && bots[m.team] === "smart") advisors[m.team] = new Advisor(m.book);
    } else if (m.cmd === "stop") {
      if (host) host.destroy();
      host = null;
    }
  } catch (e) {
    post({ t: "fatal", error: String(e && e.stack || e) });
  }
};
