// Desktop-client replays (.yrpX) are played as recorded: StreamHost shows the messages the duel server wrote down,
// without running the duel again. This makes such a file the way the desktop server does (every core message, plus
// the zone refreshes it sends after them: gframe/generic_duel.cpp Analyze / Refresh*), plays it back and checks that
// every card ends in the same place as in the duel itself. Then the classic answers inside are made useless (as if the
// card scripts had changed) and the recorded playback must still match.
// usage: node tests/duel/stream-replay.mjs <CardScripts dir> [duels]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OcgCore, Reader, parseMessage, parseMessages } from "../../duel/engine/core.js";
import { CardDB, ScriptStore } from "../../duel/engine/data.js";
import { DuelHost } from "../../duel/engine/host.js";
import { botAnswer } from "../../duel/engine/bot.js";
import { readReplay } from "../../duel/engine/replayfile.js";
import { StreamHost, streamUsable } from "../../duel/engine/stream.js";
import * as C from "../../duel/engine/constants.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scriptsDir = process.argv[2], N = Number(process.argv[3] || 4);
const db = new CardDB(JSON.parse(fs.readFileSync(path.join(root, "duel/data/cards.json"))), JSON.parse(fs.readFileSync(path.join(root, "duel/data/strings.json"))));
const index = JSON.parse(fs.readFileSync(path.join(root, "duel/data/scripts.json")));
const store = new ScriptStore(index, async (p) => { try { return fs.readFileSync(path.join(scriptsDir, p), "utf8"); } catch { return null; } });
const core = await OcgCore.load(fs.readFileSync(path.join(root, "duel/engine/ocgcore.wasm")));
const M = C.MSG;
// Pendulum, Xyz, Link and Fusion: cards that stand in Pendulum Zones, have material attached, use the Extra Monster Zones
const decks = [
  { main: [14558127, 14558127, 14558127, 23434538, 23434538, 97268402, 97268402, 73628505, 24094653, 24094653, 12580477, 83764718,
    // Pendulum: Performapal / Odd-Eyes / Dragonpit
    16178681, 16178681, 94415058, 94415058, 20409757, 20409757, 72656408, 72656408, 15146890, 15146890, 47075569, 47075569,
    53208660, 53208660, 9341993, 9341993, 70095154, 70095154, 46986414, 46986414, 89631139, 89631139, 5318639, 44095762, 26202165, 53129443],
    extra: [16195942, 84013237, 1861629, 11901678, 66889139, 44508094, 63767246, 50954680, 86066372, 2857636] },
  { main: [46986414, 46986414, 89631139, 89631139, 12580477, 5318639, 83764718, 14558127, 14558127, 44095762, 26202165, 53129443,
    70781052, 91152256, 6368038, 40640057, 54652250, 31560081, 72302403, 4206964, 97077563, 24094653, 24094653, 70781052,
    91152256, 6368038, 40640057, 54652250, 31560081, 4206964, 97077563, 26202165, 46986414, 89631139, 5318639, 44095762,
    14558127, 53129443, 12580477, 83764718], extra: [11901678, 66889139, 1861629, 84013237, 44508094] },
];
for (const d of decks) { d.main = d.main.filter((c) => db.has(c)); d.extra = d.extra.filter((c) => db.has(c)); }
await store.preload(decks.flatMap((d) => [...d.main, ...d.extra]));

// ---- record like the desktop server
const QF = 0x3f81fff;                                  // the flags its Refresh* calls use (QUERY_* up to IS_HIDDEN | COVER)
function recorder(duelOf) {
  const pk = [];
  const raw = (fn) => core._buf(fn);
  const loc = (p, l, flag = QF) => { const u = raw((lp) => core.x.kx_query_location(duelOf(), lp, flag, p, l)); if (u.length) pk.push({ msg: M.UPDATE_DATA, data: Uint8Array.from([p, l, ...u]) }); };
  const one = (p, l, s) => { const u = raw((lp) => core.x.kx_query(duelOf(), lp, QF, p, l, s, 0)); if (u.length) pk.push({ msg: M.UPDATE_CARD, data: Uint8Array.from([p, l, s, ...u]) }); };
  const all = () => { if (process.env.NOREFRESH) return; for (const p of [0, 1]) loc(p, C.LOCATION_MZONE); for (const p of [0, 1]) loc(p, C.LOCATION_SZONE); for (const p of [0, 1]) loc(p, C.LOCATION_HAND); };
  let started = false;
  return {
    pk,
    begin() {
      const d = duelOf();
      if (!started) {
        started = true;
        const s = [0]; const w32 = (v) => s.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255); const w16 = (v) => s.push(v & 255, (v >> 8) & 255);
        w32(8000); w32(8000);
        for (const p of [0, 1]) { w16(core.queryCount(d, p, C.LOCATION_DECK)); w16(core.queryCount(d, p, C.LOCATION_EXTRA)); }
        pk.push({ msg: M.START, data: Uint8Array.from(s) });
        for (const p of [0, 1]) loc(p, C.LOCATION_DECK); for (const p of [0, 1]) loc(p, C.LOCATION_EXTRA);
      }
    },
    onMessages(u8) {
      const r = new Reader(u8);
      while (r.avail >= 4) {
        const len = r.u32(); if (!len || len > r.avail) break;
        const body = r.bytes(len); const type = body[0];
        let m; try { m = parseMessage(new Reader(body)); } catch { m = { type }; }
        if (type === M.SELECT_IDLECMD || type === M.SELECT_BATTLECMD || type === M.SELECT_CHAIN) { all(); continue; }
        if (C.PROMPTS.has(type) || type === M.RETRY) continue;
        if (type === M.HINT && m.hint_type === C.HINT.SELECTMSG) continue;
        pk.push({ msg: type, data: body.slice(1) });
        if (process.env.NOREFRESH) continue;            // (a check of the table kept from the messages alone)
        switch (type) {
          case M.DRAW: case M.SHUFFLE_HAND: loc(m.player, C.LOCATION_HAND); break;
          case M.SHUFFLE_EXTRA: loc(m.player, C.LOCATION_EXTRA); break;
          case M.NEW_TURN: case M.NEW_PHASE: case M.SUMMONED: case M.SPSUMMONED: case M.FLIPSUMMONED: case M.CHAINED: case M.CHAIN_SOLVED: case M.CHAIN_END:
          case M.DAMAGE_STEP_START: case M.DAMAGE_STEP_END: all(); break;
          case M.MOVE: if (m.to && m.to.location & (C.LOCATION_MZONE | C.LOCATION_SZONE) && m.to.overlay == null) one(m.to.controller, m.to.location, m.to.sequence); break;
          case M.POS_CHANGE: one(m.controller, m.location, m.sequence); break;
          case M.SWAP: one(m.card1.controller, m.card1.location, m.card1.sequence); one(m.card2.controller, m.card2.location, m.card2.sequence); break;
        }
      }
    },
  };
}
function yrpx(inner, names, packets) {
  const out = [];
  const u32 = (v) => { for (let k = 0; k < 4; k++) out.push((v >>> (8 * k)) & 0xff); };
  const name = (s) => { for (let k = 0; k < 20; k++) { const c = k < s.length ? s.charCodeAt(k) : 0; out.push(c & 0xff, c >> 8); } };
  u32(1); name(names[0]); u32(1); name(names[1]);
  for (let k = 0; k < 8; k++) out.push(0);
  for (const p of packets) { out.push(p.msg); u32(p.data.length); for (const b of p.data) out.push(b); }
  out.push(231); u32(inner.length); out.push(...inner);
  const h = new Uint8Array(72); const hv = new DataView(h.buffer);
  hv.setUint32(0, 0x58707279, true); hv.setUint32(4, 41 | (11 << 16), true); hv.setUint32(8, 0x10 | 0x20 | 0x100 | 0x200, true);
  hv.setUint32(16, out.length, true); hv.setBigUint64(32, 1n, true);
  return Uint8Array.from([...h, ...out]);
}
const sig = (st) => st.teams.map((t) => ({
  lp: t.lp, deck: t.deck,
  hand: t.hand.map((c) => c.code).join(","),
  mzone: t.mzone.map((c) => (c ? `${c.code}/${c.position}/${(c.overlays || []).join("+")}` : "-")).join(" "),
  szone: t.szone.map((c) => (c ? `${c.code}/${c.position}` : "-")).join(" "),
  grave: t.grave.map((c) => c.code).join(","),
  banished: t.banished.map((c) => `${c.code}/${c.position}`).join(","),
  extra: t.extra.map((c) => `${c.code}/${c.position & C.POS_FACEUP ? "u" : "d"}`).sort().join(","),
}));

let ok = 0, checks = 0, pend = 0, xyz = 0;
for (let n = 0; n < N; n++) {
  let file = null, result = null, host = null, snaps = [];
  const rec = recorder(() => host.duel);
  const keep = core.getMessages, keepStart = core.startDuel;
  core.startDuel = (d) => { rec.begin(); return keepStart.call(core, d); };
  core.getMessages = (d) => { const u = core._buf((lp) => core.x.kx_get_message(d, lp)); rec.onMessages(u); return parseMessages(u); };
  await new Promise((done) => {
    host = new DuelHost({ core, db, scripts: store, decks: [structuredClone(decks[n % 2]), structuredClone(decks[(n + 1) % 2])], names: ["Alpha", "Beta"], options: { noStatus: true }, emit: (v, p) => {
      if (v === 2 && p.state) snaps.push({ at: rec.pk.length, sig: sig(p.state), ended: !!p.ended });
      if (p.ended) { if (!result) { result = p.ended; file = host.replayFile(); done(); } return; }
      if (p.prompt && v === p.waitingFor) setTimeout(() => { if (!host.ended && host.pending && host.pending.player === v) host.respond(v, botAnswer(host.pending.msg, { mode: n % 2 ? "smart" : "random", db, view: p, hint: p.prompt.hint, mem: {} })); }, 0);
    } });
    host.start();
    setTimeout(() => { if (!result) { result = { winner: -2 }; file = host.replayFile(); host.finish(-2, "time", []); done(); } }, 40000);
  });
  // what a spectator saw (viewer 2 hides hands and face-down cards): compare the real table instead
  const truth = sig(host.viewFor(host.snapshotRaw(), 3));
  host.destroy();
  core.getMessages = keep; core.startDuel = keepStart;
  for (const tamper of [false, true]) {
    let inner = file.slice();
    if (tamper) for (let i = inner.length - 1, k = 0; i > 72 && k < 400; i--, k++) inner[i] = (inner[i] * 7 + 3) & 255;   // answers garbled
    const bytes = yrpx(inner, ["Alpha", "Beta"], rec.pk);
    if (process.env.OUT) fs.writeFileSync(path.join(process.env.OUT, `stream${n + 1}${tamper ? "-garbled" : ""}.yrpX`), bytes);
    let r; try { r = readReplay(bytes); } catch (e) { console.log(`duel ${n + 1}${tamper ? " (garbled answers)" : ""}: could not read: ${e.message}`); checks++; continue; }
    if (!streamUsable(r)) { console.log(`duel ${n + 1}: stream not usable`); checks++; continue; }
    let last = null, steps = 0;
    const h = new StreamHost({ r, db, emit: (v, p) => { steps++; last = p; if (p.state) for (const t of p.state.teams) { if (t.szone[0] && t.szone[0].type & C.TYPE.PENDULUM) pend++; if (t.mzone.some((c) => c && c.overlays && c.overlays.length)) xyz++; } } });
    h.start();
    let guard = 0; while (!h.ended && guard++ < 100000) h.respondRaw();
    const got = sig(last.state);
    const same = JSON.stringify(got) === JSON.stringify(truth);
    checks++;
    if (same) ok++;
    else for (let t = 0; t < 2; t++) for (const k of Object.keys(truth[t])) if (String(truth[t][k]) !== String(got[t][k])) console.log(`  side ${t} ${k}:\n    duel   ${truth[t][k]}\n    replay ${got[t][k]}`);
    console.log(`duel ${n + 1}${tamper ? " (garbled answers)" : ""}: ${result.reason || result.winner}, ${steps} steps, end table ${same ? "matches" : "DIFFERS"}`);
  }
}
console.log(`${ok}/${checks} recorded replays ended on the same table (Pendulum Zones used ${pend}×, Xyz with material ${xyz}×)`);
process.exit(ok === checks ? 0 : 1);
