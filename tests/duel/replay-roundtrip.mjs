// EDOPro replay check: plays bot duels, writes each as an EDOPro .yrp (DuelHost.replayFile), reads the file back the
// way EDOPro does (gframe/replay.cpp: header, names, params, decks, rule cards, responses) and re-runs it on a fresh
// engine the way EDOPro's old-replay mode does (old_replay_mode.cpp). The re-run must end the same way.
// usage: node tests/duel/replay-roundtrip.mjs <CardScripts dir> [duels]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OcgCore } from "../../duel/engine/core.js";
import { CardDB, ScriptStore } from "../../duel/engine/data.js";
import { DuelHost } from "../../duel/engine/host.js";
import { botAnswer } from "../../duel/engine/bot.js";
import * as C from "../../duel/engine/constants.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scriptsDir = process.argv[2], N = Number(process.argv[3] || 3);
const db = new CardDB(JSON.parse(fs.readFileSync(path.join(root, "duel/data/cards.json"))), JSON.parse(fs.readFileSync(path.join(root, "duel/data/strings.json"))));
const index = JSON.parse(fs.readFileSync(path.join(root, "duel/data/scripts.json")));
const store = new ScriptStore(index, async (p) => { try { return fs.readFileSync(path.join(scriptsDir, p), "utf8"); } catch { return null; } });
const core = await OcgCore.load(fs.readFileSync(path.join(root, "duel/engine/ocgcore.wasm")));
const M = C.MSG;
let s = 777; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const deck = { main: [46986414, 46986414, 89631139, 89631139, 12580477, 5318639, 83764718, 14558127, 14558127, 44095762, 26202165, 53129443,
  70781052, 91152256, 6368038, 40640057, 54652250, 31560081, 72302403, 4206964, 97077563, 24094653, 24094653, 70781052,
  91152256, 6368038, 40640057, 54652250, 31560081, 4206964, 97077563, 26202165, 46986414, 89631139, 5318639, 44095762,
  14558127, 53129443, 12580477, 83764718], extra: [11901678, 66889139, 1861629, 84013237, 44508094] };

/** Reads a .yrp like EDOPro's Replay::OpenReplayFromBuffer + ParseNames/ParseParams/ParseDecks/ParseResponses. */
function readYrp(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength); let o = 0;
  const u8 = () => dv.getUint8(o++), u16 = () => { const v = dv.getUint16(o, true); o += 2; return v; };
  const u32 = () => { const v = dv.getUint32(o, true); o += 4; return v; }, u64 = () => { const v = dv.getBigUint64(o, true); o += 8; return v; };
  const h = { id: u32(), version: u32(), flag: u32(), timestamp: u32(), datasize: u32(), hash: u32() }; o += 8;
  if (h.id !== 0x31707279) throw new Error("not YRP1");
  if (!(h.flag & 0x200)) throw new Error("no extended header");
  if (h.flag & 0x1) throw new Error("compressed");
  h.header_version = u64(); h.seed = [u64(), u64(), u64(), u64()];
  if (h.header_version !== 1n) throw new Error("header_version must be 1 to play in old mode");
  if (o !== 72) throw new Error("header size " + o);
  if (h.datasize !== buf.length - 72) throw new Error("datasize");
  const names = [], name = () => { let t = ""; for (let i = 0; i < 20; i++) { const c = u16(); if (c && t.length === i) t += String.fromCharCode(c); } return t; };
  const home = u32(); for (let i = 0; i < home; i++) names.push(name());
  const opp = u32(); for (let i = 0; i < opp; i++) names.push(name());
  const params = { lp: u32(), start: u32(), draw: u32(), flags: u64() };
  const decks = [];
  for (let i = 0; i < home + opp; i++) { const main = []; for (let n = u32(); n--;) main.push(u32()); const extra = []; for (let n = u32(); n--;) extra.push(u32()); decks.push({ main, extra }); }
  const rules = []; for (let n = u32(); n--;) rules.push(u32());
  const responses = []; while (o < buf.length) { const len = u8(); if (!len) break; responses.push(buf.slice(o, o + len)); o += len; }
  return { h, names, params, decks, rules, responses };
}

/** Re-runs a parsed replay on a fresh engine, as EDOPro's ReplayMode::StartDuel/OldReplayThread does. */
function rerun(r) {
  const p = { lp: r.params.lp, start: r.params.start, draw: r.params.draw };
  const d = core.createDuel({ seed: r.h.seed, flags: r.params.flags, players: [p, p] });
  core.loadScript(d, "constant.lua"); core.loadScript(d, "utility.lua");
  r.decks.forEach((dk, team) => {
    for (const code of dk.main) core.newCard(d, { team, code, location: C.LOCATION_DECK, position: C.POS_FACEDOWN_DEFENSE });
    for (const code of dk.extra) core.newCard(d, { team, code, location: C.LOCATION_EXTRA, position: C.POS_FACEDOWN_DEFENSE });
  });
  core.startDuel(d);
  let i = 0, win = null, turns = 0;
  for (let guard = 0; guard < 200000 && !win; guard++) {
    const status = core.process(d);
    for (const m of core.getMessages(d)) { if (m.type === M.WIN) win = m; if (m.type === M.NEW_TURN) turns++; }
    if (win || status === 0) break;
    if (status === 1) { if (i >= r.responses.length) break; core.setResponse(d, r.responses[i++]); }
  }
  core.destroyDuel(d);
  return { win, turns, used: i };
}

let fails = 0;
for (let n = 0; n < N; n++) {
  await store.preload([...deck.main, ...deck.extra]);
  core.cards = (code) => db.engine(code); core.scripts = (name) => store.get(name);
  let win = null, turns = 0;
  const host = new DuelHost({ core, db, scripts: store, decks: [deck, deck], names: ["Kodex", "Synapse AI"], seed: [BigInt(n + 11), 5n, 9n, 13n],
    emit: (v, pk) => { if (v === 2) for (const e of pk.events) { if (e.type === M.NEW_TURN) turns++; } } });
  host.start();
  for (let steps = 0; !host.ended && steps < 20000; steps++) {
    const { player, msg } = host.pending; const err = host.respond(player, botAnswer(msg, { mode: n % 2 ? "random" : "smart", db, rnd })); if (err) throw new Error(err);
    if (host.turn > 60) break;
  }
  const finished = host.ended, origTurn = host.turn; const file = host.replayFile(); host.destroy();
  const r = readYrp(file);
  const again = rerun(r);
  const ok = r.names[0] === "Kodex" && r.names[1] === "Synapse AI" && r.decks[0].main.length === 40 && r.decks[1].extra.length === 5 &&
    (finished ? (again.win && again.win.player === finished.winner) : !again.win) && again.used === r.responses.length && again.turns === origTurn;
  console.log(`${ok ? "PASS" : "FAIL"} duel ${n + 1}: ${file.length} bytes, ${r.responses.length} answers, original ${finished ? "winner " + finished.winner : "unfinished"} / replay ${again.win ? "winner " + again.win.player : "no winner"} after ${again.turns} turns (original ${origTurn})`);
  if (!ok) fails++;
}
if (fails) process.exit(1);
