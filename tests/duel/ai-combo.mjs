// Combo memory: a person plays a turn of 3+ plays; on the same opening (same seed and deck) Synapse AI with the
// learned book must replay that turn play by play. Also checks reinforcement (a better-scored line wins).
// usage: node tests/duel/ai-combo.mjs <CardScripts dir> [cases]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OcgCore } from "../../duel/engine/core.js";
import { CardDB, ScriptStore } from "../../duel/engine/data.js";
import { DuelHost } from "../../duel/engine/host.js";
import { botAnswer } from "../../duel/engine/bot.js";
import { observe } from "../../duel/engine/smart.js";
import { Book, Recorder, idleToken, chainToken, effectIndex } from "../../duel/engine/learn.js";
import { MSG } from "../../duel/engine/constants.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scriptsDir = process.argv[2], CASES = Number(process.argv[3] || 4);
const db = new CardDB(JSON.parse(fs.readFileSync(path.join(root, "duel/data/cards.json"))), JSON.parse(fs.readFileSync(path.join(root, "duel/data/strings.json"))));
const index = JSON.parse(fs.readFileSync(path.join(root, "duel/data/scripts.json")));
const scripts = new ScriptStore(index, async (p) => { try { return fs.readFileSync(path.join(scriptsDir, p), "utf8"); } catch { return null; } });
const core = await OcgCore.load(fs.readFileSync(path.join(root, "duel/engine/ocgcore.wasm")));
const deck = { main: [46986414, 46986414, 89631139, 89631139, 12580477, 5318639, 83764718, 14558127, 14558127, 44095762, 26202165, 53129443,
  70781052, 91152256, 6368038, 40640057, 54652250, 31560081, 72302403, 4206964, 97077563, 24094653, 24094653, 70781052,
  91152256, 6368038, 40640057, 54652250, 31560081, 4206964, 97077563, 26202165, 46986414, 89631139, 5318639, 44095762,
  14558127, 53129443, 12580477, 83764718], extra: [11901678, 66889139, 1861629, 84013237, 44508094] };
await scripts.preload([...deck.main, ...deck.extra]);
const fail = (m) => { console.error("FAIL:", m); process.exit(1); };

const tokenOf = (msg, ans) => msg.type === MSG.SELECT_IDLECMD ? idleToken(msg, ans)
  : msg.type === MSG.SELECT_CHAIN && ans.index != null ? chainToken(msg.selects[ans.index]) : null;

/** Plays turn 1 for seat 0 with `chooser`; returns seat 0's tokens in that turn and the recorder rows. */
function turnOne(seed, chooser, decks) {
  let view = [null, null];
  const rec = new Recorder(), mem = {};
  const host = new DuelHost({ core, db, scripts, decks, names: ["P", "Q"], seed, options: { noShuffle: true },
    emit: (v, p) => { if (v < 2) { view[v] = p; if (v === 0) { rec.observe(0, p); observe(p, mem); } } } });
  host.start();
  const toks = [];
  let s = 4242; const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let steps = 0; steps < 3000 && !host.ended && host.turn <= 1; steps++) {
    const { player, msg } = host.pending;
    const ans = player === 0 ? chooser(msg, { view: view[0], mem, rnd }) : botAnswer(msg, { mode: "passive", db });
    if (player === 0 && host.turn === 1) { const t = tokenOf(msg, ans) || (msg.type === MSG.SELECT_EFFECTYN && ans.yes && msg.code && view[0] && view[0].turnPlayer === 0 ? "C" + msg.code + "." + effectIndex(msg.code, msg.description) : null); if (t) toks.push(t); rec.answer(0, msg, ans, null); }
    const err = host.respond(player, ans); if (err) throw new Error(err);
  }
  host.destroy();
  return { toks, rows: rec.flush() };
}

let tested = 0;
for (let i = 1; i <= 40 && tested < CASES; i++) {
  const seed = [BigInt(i * 7 + 1), 3n, 5n, 7n];
  // The same dealt hands in both duels: shuffle once here, then keep that order.
  let q = i * 131; const qr = () => { q = (q * 1103515245 + 12345) & 0x7fffffff; return q / 0x7fffffff; };
  const main = [...deck.main]; for (let k = main.length - 1; k > 0; k--) { const j = Math.floor(qr() * (k + 1)); [main[k], main[j]] = [main[j], main[k]]; }
  const decks = [{ main, extra: deck.extra }, { main: [...main].reverse(), extra: deck.extra }];
  // The "person": random legal plays (a line the AI would not find on its own), up to 6 per turn.
  let made = 0, r = i * 977;
  const prnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
  const person = turnOne(seed, (msg, ctx) => {
    if (msg.type === MSG.SELECT_IDLECMD && made < 6) {
      const opts = [];
      [[1, msg.special_summons], [0, msg.summons], [5, msg.activates], [4, msg.spell_sets], [3, msg.monster_sets]].forEach(([action, arr]) => arr.forEach((_, index) => opts.push({ t: msg.type, action, index })));
      if (opts.length) { made++; return opts[Math.floor(prnd() * opts.length)]; }
    }
    return botAnswer(msg, { mode: "random", db, rnd: prnd });
  }, decks);
  if (person.toks.length < 3) continue;
  const book = new Book().mergeRows(person.rows);
  person.toks = Object.keys(book.lines)[0] ? Object.keys(book.lines)[0].split(">") : person.toks;
  if (!Object.keys(book.lines).length) fail("the turn was not remembered as a line");
  const ai = turnOne(seed, (msg, ctx) => botAnswer(msg, { mode: "smart", db, view: ctx.view, mem: ctx.mem, book }), decks);
  const n = person.toks.length, same = ai.toks.slice(0, n).filter((t, k) => t === person.toks[k]).length;
  console.log(`seed ${i}: person ${person.toks.join(" ")}\n        AI     ${ai.toks.slice(0, n + 2).join(" ")}  (${same}/${n} same)`);
  // Choices inside an effect (what to search, what to discard) can change the hand, so later plays may not exist:
  // the opening of the combo must always be replayed, and most of the turn.
  if (same < 3 || same < n * 0.75) fail(`AI did not replay the remembered turn for seed ${i}`);
  tested++;
}
if (!tested) fail("no person turn with 3+ plays found");

// Reinforcement: two lines from the same start, the better-scored one is followed.
const b = new Book();
b.addLine(["A1.0", "P2", "S3"], 1); b.addLine(["A1.0", "P4", "S5"], 3);
const nx = b.lineNext(["A1.0"], (t) => t === "P2" || t === "P4");
if (!nx || nx.tok !== "P4") fail("reinforced line not preferred");
const back = new Book().mergeRows(b.rows());
if (back.lineNext(["A1.0"], (t) => t === "P2" || t === "P4").tok !== "P4") fail("lines lost in rows()/mergeRows()");
console.log(`OK combo memory: ${tested} turns replayed; reinforcement and storage work`);
