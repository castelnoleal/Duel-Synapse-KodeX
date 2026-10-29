// Web Worker that runs the rules engine for whoever is hosting the duel
// (solo playtest, or the host of an online room). The UI talks to it with postMessage.
import { OcgCore } from "./engine/core.js";
import { CardDB, ScriptStore } from "./engine/data.js";
import { DuelHost } from "./engine/host.js";
import { botAnswer } from "./engine/bot.js";
import { observe } from "./engine/smart.js";
import { Book, Recorder, comboHints } from "./engine/learn.js";
import { practice } from "./engine/trainer.js";

let core, db, store, host, bots = {}, mems = {}, retries = {};
// Synapse AI learning: the play book for this duel's decks, card-text combo links, and a recorder for people's plays.
let book = new Book(), hints = new Map(), rec = null, training = false;
const hasRows = (r) => r && (r.seq.length || r.pick.length || r.resp.length);
const post = (m) => self.postMessage(m);

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} returned ${r.status}`);
  return r.json();
}

// When the Arena is bundled inside the KodeX app, every card script ships with it in one compressed file
// (data/scripts.pack.bin, gzip) with an index (data/scripts.pack.json). It is unpacked once, on the first script a
// duel needs, so the Arena works with no connection at all. On the website the files don't exist and this is skipped.
async function scriptPack(base, commit) {
  if (typeof DecompressionStream === "undefined") return null;
  let idx;
  try { const r = await fetch(base + "data/scripts.pack.json"); if (!r.ok) return null; idx = await r.json(); } catch (e) { return null; }
  if (!idx || idx.commit !== commit || !idx.files) return null;
  let bytes = null, loading = null;
  const load = () => loading || (loading = (async () => {
    const r = await fetch(base + "data/scripts.pack.bin");
    if (!r.ok) throw new Error("script pack " + r.status);
    bytes = new Uint8Array(await new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
  })().catch((e) => { loading = null; throw e; }));
  const dec = new TextDecoder();
  return async (p) => {
    const e = idx.files[p];
    if (!e) return undefined;
    try { await load(); } catch (err) { return undefined; }
    return dec.decode(bytes.subarray(e[0], e[0] + e[1]));
  };
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
  const pack = await scriptPack(base, index.commit);
  store = new ScriptStore(index, async (p) => {
    if (pack) { const t = await pack(p); if (t !== undefined) return t; }
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
  if (rec && viewer < 2 && !bot) rec.observe(viewer, packet);          // a person's seat (solo player, or either player online)
  if (rec && viewer === 2) {                                           // once per update: hand finished turns to the page
    const rows = packet.ended ? rec.flush() : rec.take();
    if (hasRows(rows)) { book.mergeRows(rows); post({ t: "learn", rows, source: "play" }); }
    if (packet.ended) rec = null;
  }
  if (bot) {
    const mem = mems[viewer] || (mems[viewer] = {});
    observe(packet, mem);
    retries[viewer] = packet.events.some((e) => e.type === 1) ? (retries[viewer] || 0) + 1 : 0; // MSG_RETRY: last answer was rejected
  }
  if (bot && packet.prompt && !packet.ended) {
    // Let the UI paint before the bot answers.
    setTimeout(() => {
      if (!host || !host.pending || host.pending.player !== viewer) return;
      const ans = botAnswer(host.pending.msg, { mode: bot, db, view: packet, hint: packet.prompt.hint, mem: mems[viewer], retry: retries[viewer] || 0, book, hints });
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
      book = new Book().mergeRows(m.book || null);
      hints = comboHints(db, codes);
      rec = m.learn === false ? null : new Recorder();
      core.missing.clear();
      await store.preload(codes, (done, total) => post({ t: "progress", done, total }));
      host = new DuelHost({ core, db, scripts: store, decks: m.decks, names: m.names, options: m.options, emit });
      host.start();
    } else if (m.cmd === "respond") {
      if (!host) return;
      // Record a person's choice against the board it was made on.
      if (rec && !bots[m.team] && host.pending && host.pending.player === m.team && m.resp && m.resp.t === host.pending.msg.type)
        rec.answer(m.team, host.pending.msg, m.resp, host.pending.hint);
      const err = host.respond(m.team, m.resp);
      if (err) post({ t: "error", team: m.team, error: err });
    } else if (m.cmd === "surrender") {
      if (host) host.surrender(m.team);
    } else if (m.cmd === "train") {
      // Practice games for a deck (run in a separate worker so they never slow down a real duel).
      if (training) return;
      training = true;
      const pbook = new Book().mergeRows(m.book || null);
      const rows = await practice({ core, db, scripts: store, deck: m.deck, book: pbook, duels: m.duels || 3,
        onDuel: (n, all) => post({ t: "progress", done: n, total: m.duels || 3 }) });
      if (hasRows(rows)) post({ t: "learn", rows, source: "practice" });
      post({ t: "trained", lines: rows.seq.length + rows.pick.length + rows.resp.length });
      training = false;
    } else if (m.cmd === "stop") {
      if (rec) { const rows = rec.flush(); if (hasRows(rows)) post({ t: "learn", rows, source: "play" }); rec = null; }
      if (host) host.destroy();
      host = null;
    }
  } catch (e) {
    post({ t: "fatal", error: String(e && e.stack || e) });
  }
};
