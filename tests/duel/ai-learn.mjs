// Learning test: does Synapse AI pick up a deck's lines from the combo search and from watching a player?
// usage: node tests/duel/ai-learn.mjs <CardScripts dir> [archetype name] [hands]
// 1) Combo search on the deck -> book A.   2) A "teacher" (Synapse AI using book A) plays recorded duels,
// exactly like a human seat is recorded in the Arena -> book B.   3) Compares opening boards (turn 1, going first)
// of plain Synapse AI, AI + book A, and a fresh AI that only has book B (what it learned by watching).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OcgCore } from "../../duel/engine/core.js";
import { CardDB, ScriptStore } from "../../duel/engine/data.js";
import { DuelHost } from "../../duel/engine/host.js";
import { botAnswer } from "../../duel/engine/bot.js";
import { observe } from "../../duel/engine/smart.js";
import { exploreDeck } from "../../duel/engine/explore.js";
import { Recorder, Advisor, boardScore, sanitizeBook } from "../../duel/engine/learn.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const [scriptsDir, arch = "Swordsoul", handsArg = "10"] = process.argv.slice(2);
const db = new CardDB(JSON.parse(fs.readFileSync(path.join(root, "duel/data/cards.json"))), JSON.parse(fs.readFileSync(path.join(root, "duel/data/strings.json"))));
const index = JSON.parse(fs.readFileSync(path.join(root, "duel/data/scripts.json")));
const store = new ScriptStore(index, async (p) => { try { return fs.readFileSync(path.join(scriptsDir, p), "utf8"); } catch { return null; } });
const core = await OcgCore.load(fs.readFileSync(path.join(root, "duel/engine/ocgcore.wasm")));
const FILLER = 15025844;

const cards = Object.keys(db.raw).map(Number).filter((c) => { const x = db.get(c); return !x.alias && x.name.includes(arch) && store.where.has(c); });
const main = [], extra = [];
for (const c of cards) { if (db.isExtra(c)) extra.push(c); else for (let i = 0; i < 3 && main.length < 40; i++) main.push(c); }
while (main.length < 40) main.push(14558127);
const deck = { main, extra };
console.log(`${arch}: ${main.length} main / ${extra.length} extra`);

const t0 = Date.now();
const { book: searchBook, sims } = await exploreDeck({ core, db, store, deck, hands: 5, budget: 90 });
console.log(`combo search: ${sims} practice duels, ${searchBook ? searchBook.lines.length : 0} lines, ${Date.now() - t0} ms`);
if (!searchBook) { console.error("FAIL: the combo search found nothing"); process.exit(1); }

function shuffled(seedN) { let s = seedN >>> 0 || 1; const r = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 2 ** 32; };
  const m = main.slice(); for (let i = m.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [m[i], m[j]] = [m[j], m[i]]; } return m; }

/** Plays seat 0 (going first) on a given hand until its first turn ends; returns the board score and how many learned steps it followed. */
function openingTurn(seedN, advisor, recorder) {
  const decks = [{ main: shuffled(seedN), extra: extra.slice() }, { main: Array(40).fill(FILLER), extra: [] }];
  let last = null;
  const host = new DuelHost({ core, db, scripts: store, decks, names: ["AI", "Dummy"], options: { noShuffle: true }, seed: [BigInt(seedN), 9n, 9n, 9n],
    emit: (v, p) => { if (v === 0) { last = p; if (recorder) recorder.observe(p); } } });
  const mem = {};
  host.start();
  let guard = 0;
  while (!host.ended && host.pending && guard++ < 3000) {
    if (host.turn > 1) break;
    const { player, msg, hint } = host.pending;
    if (player === 0) observe(last, mem);
    const ans = botAnswer(msg, { mode: player === 0 ? "smart" : "passive", db, view: player === 0 ? last : null, hint, mem, advisor: player === 0 ? advisor : null });
    if (player === 0 && recorder) recorder.answer(msg, ans, hint);
    if (host.respond(player, ans)) break;
  }
  const score = boardScore(last, 0, db);
  host.destroy();
  return { score, followed: mem.followed || 0 };
}

const H = Number(handsArg);
// Teacher sessions are recorded on different hands from the ones used for the comparison.
const recorder = new Recorder({ db, team: 0, deck });
for (let i = 0; i < H; i++) openingTurn(5000 + i, new Advisor(searchBook), recorder);
const learned = sanitizeBook(JSON.parse(JSON.stringify(recorder.finish(true)))); // round-trip like storage/network
console.log(`watched ${H} teacher turns: learned ${learned ? learned.lines.length : 0} lines, ${learned ? Object.keys(learned.picks).length : 0} picks`);
if (!learned || !learned.lines.length) { console.error("FAIL: nothing learned from the teacher"); process.exit(1); }

const avg = (a) => Math.round(a.reduce((s, x) => s + x, 0) / a.length);
const res = { plain: [], search: [], watched: [] }, followed = { search: 0, watched: 0 };
for (let i = 0; i < H; i++) {
  const seedN = 100 + i;
  res.plain.push(openingTurn(seedN, null).score);
  const a = openingTurn(seedN, new Advisor(searchBook)); res.search.push(a.score); if (a.followed) followed.search++;
  const b = openingTurn(seedN, new Advisor(learned)); res.watched.push(b.score); if (b.followed) followed.watched++;
}
const out = { hands: H, plain: avg(res.plain), withComboSearch: avg(res.search), learnedByWatching: avg(res.watched), handsFollowingLines: followed };
console.log(JSON.stringify(out));
if (out.withComboSearch < out.plain) { console.error("FAIL: the combo search made openings worse"); process.exit(1); }
if (followed.watched === 0) { console.error("FAIL: the AI never used what it learned by watching"); process.exit(1); }
console.log("learning OK");
