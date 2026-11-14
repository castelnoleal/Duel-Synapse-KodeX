// Web Worker that runs the rules engine for whoever is hosting the duel
// (solo playtest, or the host of an online room). The UI talks to it with postMessage.
import { OcgCore } from "./engine/core.js";
import { CardDB, ScriptStore } from "./engine/data.js";
import { DuelHost } from "./engine/host.js";
import { botAnswer } from "./engine/bot.js";
import { observe } from "./engine/smart.js";
import { Book, Recorder, comboHints } from "./engine/learn.js";
import { practice } from "./engine/trainer.js";
import { readReplay } from "./engine/replayfile.js";

let core, db, store, host, bots = {}, mems = {}, retries = {}, lastReplay = null, lastNames = null;
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

// Replay files: the recorded answers are fed back one at a time, at the chosen speed.
const soon = (f) => { const ch = new MessageChannel(); ch.port1.onmessage = () => { ch.port1.close(); f(); }; ch.port2.postMessage(0); };   // next task, without the 4 ms timer floor
let rp = null;
function replayStep() {
  if (!rp || !host || host.ended) return;
  clearTimeout(rp.timer);
  if (rp.paused) return;
  if (!host.pending) return;
  rp.timer = setTimeout(() => {
    if (!rp || !host || host.ended || rp.paused || !host.pending) return;
    if (rp.i >= rp.r.responses.length) { host.finish(-1, "End of the replay", []); return; }
    host.respondRaw(rp.r.responses[rp.i++]);
  }, rp.once ? 0 : Math.round((C_PROMPT_DELAY[host.pending.msg.type] || 520) / rp.speed));
  rp.once = false;
}
const C_PROMPT_DELAY = { 11: 900, 10: 800, 16: 380, 12: 420, 13: 420 };   // idle and battle commands linger a little longer

function emit(viewer, packet) {
  // replays: while seeking (going back, or skipping ahead) nothing is shown until the target move
  if (rp && rp.seek != null) {
    if (viewer !== 3) return;
    if (packet.events.some((e) => e.type === 40)) rp.turnSeen++;               // MSG_NEW_TURN
    const there = packet.ended || (rp.seek === "turn" ? rp.turnSeen >= rp.seekTurn : rp.i >= rp.seek);
    if (!there && host && host.pending && !host.ended && rp.i < rp.r.responses.length) { soon(() => { if (rp && host && host.pending && !host.ended && rp.seek != null) host.respondRaw(rp.r.responses[rp.i++]); }); return; }
    rp.seek = null; rp.paused = rp.pauseAfter; rp.turnSeenNow = rp.turnSeen;
    post({ t: "packet", viewer, packet: { ...packet, seek: true } });
    post({ t: "replaypos", i: rp.i, n: rp.r.responses.length, turns: rp.turnAt });
    replayStep();
    return;
  }
  post({ t: "packet", viewer, packet });
  if (rp && viewer === 3) {
    if (packet.events.some((e) => e.type === 40)) { rp.turnSeenNow = (rp.turnSeenNow || 0) + 1; if (!rp.turnAt.includes(rp.i)) rp.turnAt.push(rp.i); }
    // a rejected answer in an older replay: the engine asks again and the next recorded answer is the one it took
    if (packet.events.some((e) => e.type === 1)) {
      rp.retries = (rp.retries || 0) + 1;
      if (rp.retries > 8) { host.finish(-1, "The replay went out of step here: it was recorded with different card scripts.", []); return; }
    } else rp.retries = 0;
    post({ t: "replaypos", i: rp.i, n: rp.r.responses.length, turns: rp.turnAt });
    replayStep();
    return;
  }
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
      if (host) { lastReplay = host.replayFile(); lastNames = host.names; host.destroy(); host = null; }
      bots = m.bots || {}; mems = {}; retries = {};
      m.decks = m.decks.map((d) => ({ ...d, main: (d.main || []).map((c) => db.main(c)), extra: (d.extra || []).map((c) => db.main(c)), side: (d.side || []).map((c) => db.main(c)) }));
      const codes = m.decks.flatMap((d) => [...d.main, ...d.extra]);
      book = new Book().mergeRows(m.book || null);
      hints = comboHints(db, codes);
      rec = m.learn === false ? null : new Recorder();
      core.missing.clear();
      await store.preload(codes, (done, total) => post({ t: "progress", done, total }));
      host = new DuelHost({ core, db, scripts: store, decks: m.decks, names: m.names, options: m.options, emit });
      host.start();
    } else if (m.cmd === "playReplay") {
      if (host) { host.destroy(); host = null; }
      bots = {}; mems = {}; retries = {}; rec = null;
      let r;
      try { r = readReplay(new Uint8Array(m.bytes)); } catch (e) { post({ t: "replayerr", error: String(e.message || e) }); return; }
      r.decks = r.decks.map((d) => ({ main: d.main, extra: d.extra }));
      const codes = [...r.rules, ...r.decks.flatMap((d) => [...d.main, ...d.extra])];
      const unknown = [...new Set(codes)].filter((c) => !db.has(c));
      core.missing.clear();
      await store.preload(codes.filter((c) => db.has(c)), (done, total) => post({ t: "progress", done, total }));
      rp = { r, i: 0, speed: m.speed || 1, paused: false, timer: 0, turnAt: [], turnSeen: 0, seek: null };
      post({ t: "replayinfo", names: r.names, kind: r.kind, turns: r.turns || 0, answers: r.responses.length, unknown: unknown.length, time: r.time });
      host = new DuelHost({ core, db, scripts: store, decks: r.decks, names: r.names, options: { replay: r }, emit });
      host.start();
    } else if (m.cmd === "replayScan") {
      // run a replay from start to end without showing it and hand back what happened, step by step (the Arena
      // turns that into a combo). Nothing is running on the table while this happens.
      if (host && !host.ended && !rp) { post({ t: "replayscan", id: m.id, error: "Finish the duel first." }); return; }
      if (host) { host.destroy(); host = null; } if (rp) { clearTimeout(rp.timer); rp = null; }
      let r;
      try { r = readReplay(new Uint8Array(m.bytes)); } catch (e) { post({ t: "replayscan", id: m.id, error: String(e.message || e) }); return; }
      r.decks = r.decks.map((d) => ({ main: d.main, extra: d.extra }));
      const codes = [...r.rules, ...r.decks.flatMap((d) => [...d.main, ...d.extra])];
      core.missing.clear();
      await store.preload(codes.filter((c) => db.has(c)), () => {});
      const steps = [];
      let h = null, i = 0, guard = 0, bad = 0;
      try {
        h = new DuelHost({ core, db, scripts: store, decks: r.decks, names: r.names, options: { replay: r }, emit: (viewer, p) => {
          if (viewer !== 3 || !p.state) return;
          if (p.events.some((e) => e.type === 1)) bad++; else bad = 0;
          steps.push({ turn: p.turn, tp: p.turnPlayer, events: p.events, hands: p.state.teams.map((t) => t.hand.map((c) => c.code || 0)) });
        } });
        h.start();
        while (h.pending && !h.ended && i < r.responses.length && guard++ < 40000 && bad <= 8) h.respondRaw(r.responses[i++]);
      } catch (e) { /* what was read so far is still useful */ }
      try { if (h) h.destroy(); } catch { /* already gone */ }
      post({ t: "replayscan", id: m.id, names: r.names, decks: r.decks.map((d) => ({ main: d.main.length, extra: d.extra })), steps });
    } else if (m.cmd === "replaySeek") {
      // go to a move (an answer number) or the start of a turn: back means re-running the duel from the start, fast
      if (!rp || !host) return;
      clearTimeout(rp.timer);
      const target = m.turn != null ? null : Math.max(0, Math.min(rp.r.responses.length, m.to | 0));
      const back = m.turn != null ? m.turn <= rp.turnSeenNow : target < rp.i;
      rp.pauseAfter = m.paused !== false;
      if (m.turn != null) { rp.seek = "turn"; rp.seekTurn = m.turn; } else rp.seek = target;
      if (back || host.ended) {
        host.destroy();
        rp.i = 0; rp.turnSeen = 0; rp.retries = 0;
        host = new DuelHost({ core, db, scripts: store, decks: rp.r.decks, names: rp.r.names, options: { replay: rp.r }, emit });
        host.start();
      } else if (host.pending && !host.ended) {
        rp.turnSeen = rp.turnSeenNow || 0;
        if (rp.seek !== "turn" && rp.i >= rp.seek) { rp.seek = null; rp.paused = rp.pauseAfter; post({ t: "replaypos", i: rp.i, n: rp.r.responses.length, turns: rp.turnAt }); return; }
        host.respondRaw(rp.r.responses[rp.i++]);
      }
    } else if (m.cmd === "replayCtl") {
      if (!rp) return;
      if (m.speed) rp.speed = m.speed;
      if (typeof m.paused === "boolean") rp.paused = m.paused;
      if (m.step) { rp.paused = true; rp.once = true; clearTimeout(rp.timer); if (host && host.pending && !host.ended) { if (rp.i >= rp.r.responses.length) host.finish(-1, "End of the replay", []); else host.respondRaw(rp.r.responses[rp.i++]); } return; }
      replayStep();
    } else if (m.cmd === "respond") {
      if (!host) return;
      // Record a person's choice against the board it was made on.
      if (rec && !bots[m.team] && host.pending && host.pending.player === m.team && m.resp && m.resp.t === host.pending.msg.type)
        rec.answer(m.team, host.pending.msg, m.resp, host.pending.hint);
      const err = host.respond(m.team, m.resp);
      if (err) post({ t: "error", team: m.team, error: err });
    } else if (m.cmd === "surrender") {
      if (host) host.surrender(m.team);
    } else if (m.cmd === "timeout") {
      if (host) host.timeout(m.team);
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
    } else if (m.cmd === "replay") {
      const bytes = host ? host.replayFile() : lastReplay;
      post({ t: "replay", bytes, names: host ? host.names : lastNames });
    } else if (m.cmd === "stop") {
      if (rp) { clearTimeout(rp.timer); rp = null; }
      if (rec) { const rows = rec.flush(); if (hasRows(rows)) post({ t: "learn", rows, source: "play" }); rec = null; }
      if (host) { lastReplay = host.replayFile(); lastNames = host.names; host.destroy(); }
      host = null;
    }
  } catch (e) {
    post({ t: "fatal", error: String(e && e.stack || e) });
  }
};
