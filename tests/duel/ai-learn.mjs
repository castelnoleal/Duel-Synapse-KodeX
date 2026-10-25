// Synapse AI learning test.
// 1) Imitation: a "teacher" with a distinctive style plays while the Recorder watches; on fresh duels
//    the AI with the learned book must copy the teacher's choices far more often than without it.
// 2) Practice games: self-play produces lines and the AI with them still beats the random bot.
// 3) Card-text hints link a searcher to the card it names.
// usage: node tests/duel/ai-learn.mjs <CardScripts dir> [learnDuels] [testDuels]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OcgCore } from "../../duel/engine/core.js";
import { CardDB, ScriptStore } from "../../duel/engine/data.js";
import { DuelHost } from "../../duel/engine/host.js";
import { botAnswer } from "../../duel/engine/bot.js";
import { observe } from "../../duel/engine/smart.js";
import { Book, Recorder, idleToken, comboHints, WEIGHT } from "../../duel/engine/learn.js";
import { practice } from "../../duel/engine/trainer.js";
import { MSG, IDLE } from "../../duel/engine/constants.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const [scriptsDir, learnArg, testArg] = process.argv.slice(2);
const LEARN = Number(learnArg || 40), TEST = Number(testArg || 30);
const db = new CardDB(JSON.parse(fs.readFileSync(path.join(root, "duel/data/cards.json"))), JSON.parse(fs.readFileSync(path.join(root, "duel/data/strings.json"))));
const index = JSON.parse(fs.readFileSync(path.join(root, "duel/data/scripts.json")));
const scripts = new ScriptStore(index, async (p) => { try { return fs.readFileSync(path.join(scriptsDir, p), "utf8"); } catch { return null; } });
const core = await OcgCore.load(fs.readFileSync(path.join(root, "duel/engine/ocgcore.wasm")));
let seed = 99; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const deck = {
  main: [46986414, 46986414, 89631139, 89631139, 12580477, 5318639, 83764718, 14558127, 14558127, 44095762, 26202165, 53129443,
    70781052, 91152256, 6368038, 40640057, 54652250, 31560081, 72302403, 4206964, 97077563, 24094653, 24094653, 70781052,
    91152256, 6368038, 40640057, 54652250, 31560081, 4206964, 97077563, 26202165, 46986414, 89631139, 5318639, 44095762,
    14558127, 53129443, 12580477, 83764718],
  extra: [11901678, 66889139, 1861629, 84013237, 44508094],
};
await scripts.preload([...deck.main, ...deck.extra]);
const fail = (m) => { console.error("FAIL:", m); process.exit(1); };

// The teacher plays like Synapse AI, except: it sets its lowest-DEF monster instead of summoning,
// and when an effect lets it pick a card from its own Deck/GY it takes the weakest one.
function teacher(msg, ctx) {
  if (msg.type === MSG.SELECT_IDLECMD && msg.monster_sets.length) {
    const i = msg.monster_sets.map((c, i) => [i, (db.get(c.code) || {}).def || 0]).sort((a, b) => a[1] - b[1])[0][0];
    return { t: msg.type, action: IDLE.MSET, index: i };
  }
  if (msg.type === MSG.SELECT_CARD && msg.selects.every((s) => s.controller === msg.player) && msg.min === 1 && msg.max === 1 && msg.selects.length > 1) {
    const i = msg.selects.map((c, i) => [i, (db.get(c.code) || {}).atk || 0]).sort((a, b) => a[1] - b[1])[0][0];
    return { t: msg.type, indices: [i] };
  }
  return botAnswer(msg, { mode: "smart", db, ...ctx });
}
const same = (msg, a, b) => {
  if (!a || !b) return false;
  if (msg.type === MSG.SELECT_IDLECMD) return a.action === b.action && (a.index ?? -1) === (b.index ?? -1);
  if (msg.type === MSG.SELECT_CARD) return JSON.stringify([...a.indices].sort()) === JSON.stringify([...b.indices].sort());
  return false;
};

async function duel({ seed: s, players, record, evaluate }) {
  const rec = record ? new Recorder() : null, views = [null, null], mems = [{}, {}], tmems = [{}, {}], retry = [0, 0];
  const host = new DuelHost({ core, db, scripts, decks: [deck, deck], names: ["A", "B"], seed: [BigInt(s), 5n, 7n, 9n],
    emit: (v, p) => { if (v < 2) { views[v] = p; observe(p, mems[v]); observe(p, tmems[v]); if (rec) rec.observe(v, p); retry[v] = p.events.some((e) => e.type === 1) ? retry[v] + 1 : 0; } } });
  host.start();
  let steps = 0;
  while (!host.ended && host.pending) {
    const { player, msg, hint } = host.pending;
    const ctx = { db, rnd, view: views[player], hint, mem: mems[player], retry: retry[player] };
    if (evaluate && evaluate.seat === player && (msg.type === MSG.SELECT_IDLECMD || msg.type === MSG.SELECT_CARD)) {
      const t = teacher(msg, { rnd, view: views[player], hint, mem: structuredClone(tmems[player]) });
      const plain = botAnswer(msg, { mode: "smart", db, rnd, view: views[player], hint, mem: structuredClone(tmems[player]) });
      const ans = players[player](msg, ctx);
      // Only the choices where the teacher's style differs from Synapse AI's default say anything about learning.
      if (!same(msg, plain, t)) {
        evaluate.total[msg.type] = (evaluate.total[msg.type] || 0) + 1;
        if (same(msg, ans, t)) evaluate.agree[msg.type] = (evaluate.agree[msg.type] || 0) + 1;
      }
      if (process.env.DEBUG && msg.type === MSG.SELECT_CARD && !same(msg, plain, t) && !same(msg, ans, t))
        console.log("pick differs: hint", hint, "src", db.name(mems[player].lastSrc), "options", msg.selects.map((x) => db.name(x.code)).join(", "), "ai", ans.indices, "teacher", t.indices);
      tmems[player] = structuredClone(mems[player]);
      if (rec) rec.answer(player, msg, ans, hint);
      if (host.respond(player, ans)) break;
    } else {
      const ans = players[player](msg, ctx);
      if (rec && record.seat === player) rec.answer(player, msg, ans, hint);
      if (host.respond(player, ans)) break;
      tmems[player] = structuredClone(mems[player]);
    }
    if (++steps > 8000 || host.turn > 30) break;
  }
  host.destroy();
  return rec ? rec.flush() : null;
}

// ---- 1) imitation ----
const book = new Book();
for (let d = 0; d < LEARN; d++) {
  const seat = d % 2;
  const players = []; players[seat] = (m, c) => teacher(m, c); players[1 - seat] = (m, c) => botAnswer(m, { mode: "smart", ...c });
  book.mergeRows(await duel({ seed: 1000 + d, players, record: { seat } }), WEIGHT.human);
}
console.log("learned", book.size(), "lines from", LEARN, "teacher duels");
const score = async (useBook) => {
  const ev = { agree: {}, total: {} };
  for (let d = 0; d < TEST; d++) {
    const seat = d % 2;
    const players = []; players[seat] = (m, c) => botAnswer(m, { mode: "smart", ...c, book: useBook ? book : null });
    players[1 - seat] = (m, c) => botAnswer(m, { mode: "smart", ...c });
    ev.seat = seat; await duel({ seed: 5000 + d, players, evaluate: ev });
  }
  const pct = (t) => (ev.total[t] ? ev.agree[t] / ev.total[t] : 0);
  return { idle: pct(MSG.SELECT_IDLECMD), pick: pct(MSG.SELECT_CARD), n: ev.total };
};
const taught = await score(true);
const pc = (x) => (x * 100).toFixed(0) + "%";
// Only choices where the teacher differs from Synapse AI's default are counted, so without the book the match rate is 0%.
console.log(`copied the teacher's distinctive choices: main phase ${pc(taught.idle)} of ${taught.n[MSG.SELECT_IDLECMD] || 0}, card picks ${pc(taught.pick)} of ${taught.n[MSG.SELECT_CARD] || 0} (0% without the book)`);
if (taught.idle < 0.6) fail(`the AI copied the teacher's main-phase style only ${(taught.idle * 100).toFixed(0)}% of the time`);
if (taught.pick < 0.5) fail(`the AI copied the teacher's card picks only ${(taught.pick * 100).toFixed(0)}% of the time`);

// ---- 2) practice games ----
const pbook = new Book();
const rows = await practice({ core, db, scripts, deck, book: pbook, duels: 6, rnd });
console.log("practice games learned", rows.seq.length + rows.pick.length + rows.resp.length, "plays;", pbook.size(), "lines");
if (!pbook.size()) fail("practice games learned nothing");
let wins = 0;
for (let d = 0; d < 10; d++) {
  const seat = d % 2;
  const players = []; players[seat] = (m, c) => botAnswer(m, { mode: "smart", ...c, book: pbook }); players[1 - seat] = (m, c) => botAnswer(m, { mode: "random", ...c });
  const rec = null; let w = -1;
  const views = [null, null], mems = [{}, {}];
  const host = new DuelHost({ core, db, scripts, decks: [deck, deck], names: ["A", "B"], seed: [BigInt(9000 + d), 1n, 2n, 3n],
    emit: (v, p) => { if (v < 2) { views[v] = p; observe(p, mems[v]); } } });
  host.start();
  let steps = 0;
  while (!host.ended && host.pending && ++steps < 20000) { const { player, msg, hint } = host.pending; host.respond(player, players[player](msg, { db, rnd, view: views[player], hint, mem: mems[player] })); }
  w = host.ended ? host.ended.winner : -1; if (w === seat) wins++; host.destroy();
}
console.log("with practice lines, Synapse AI beat the random bot", wins, "of 10");
if (wins < 8) fail("practice lines made the AI weaker");

// ---- 3) card-text hints ----
const byName = (n) => Number(Object.keys(db.raw).find((c) => db.get(c).name === n));
const dm = byName("Dark Magician"), circle = byName("Dark Magical Circle");
const hints = comboHints(db, [dm, circle]);
console.log("card-text hint: Dark Magical Circle ->", [...(hints.get(circle) || [])].map((c) => db.name(c)));
if (!hints.get(circle) || !hints.get(circle).has(dm)) fail("card-text hints did not link Dark Magical Circle to Dark Magician");
console.log("OK");
