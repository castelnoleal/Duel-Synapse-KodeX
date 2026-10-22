// Headless engine soak test: bot-vs-bot duels with real card scripts.
// usage: node tests/duel/engine-sim.mjs <CardScripts dir> [duels] [mode] [randomDecks]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OcgCore } from "../../duel/engine/core.js";
import { CardDB, ScriptStore } from "../../duel/engine/data.js";
import { DuelHost } from "../../duel/engine/host.js";
import { botAnswer } from "../../duel/engine/bot.js";
import { MSG_NAME, TYPE } from "../../duel/engine/constants.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scriptsDir = process.argv[2];
const N = Number(process.argv[3] || 5);
const mode = process.argv[4] || "random";
const randomDecks = process.argv[5] === "1";
const db = new CardDB(JSON.parse(fs.readFileSync(path.join(root, "duel/data/cards.json"))), JSON.parse(fs.readFileSync(path.join(root, "duel/data/strings.json"))));
const index = JSON.parse(fs.readFileSync(path.join(root, "duel/data/scripts.json")));
const store = new ScriptStore(index, async (p) => { try { return fs.readFileSync(path.join(scriptsDir, p), "utf8"); } catch { return null; } });
const core = await OcgCore.load(fs.readFileSync(path.join(root, "duel/engine/ocgcore.wasm")));
console.log("ocgcore", core.version.join("."));

let s = 12345;
const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const classic = {
  main: [46986414, 46986414, 89631139, 89631139, 12580477, 5318639, 83764718, 14558127, 14558127, 44095762, 26202165, 53129443,
    70781052, 91152256, 6368038, 40640057, 54652250, 31560081, 72302403, 4206964, 97077563, 24094653, 24094653, 70781052,
    91152256, 6368038, 40640057, 54652250, 31560081, 4206964, 97077563, 26202165, 46986414, 89631139, 5318639, 44095762,
    14558127, 53129443, 12580477, 83764718],
  extra: [11901678, 66889139, 1861629, 84013237, 44508094],
};
const pool = Object.keys(db.raw).map(Number).filter((c) => { const x = db.get(c); return !x.alias && !(x.type & TYPE.TOKEN) && store.where.has(c); });
const randomDeck = () => {
  const main = [], extra = [];
  while (main.length < 40) { const c = pool[Math.floor(rnd() * pool.length)]; if (db.isExtra(c)) { if (extra.length < 15) extra.push(c); } else main.push(c); }
  return { main, extra };
};

let totalTurns = 0, prompts = 0;
for (let d = 0; d < N; d++) {
  const decks = randomDecks ? [randomDeck(), randomDeck()] : [classic, classic];
  await store.preload([...decks[0].main, ...decks[0].extra, ...decks[1].main, ...decks[1].extra]);
  let last = null;
  const host = new DuelHost({ core, db, scripts: store, decks, names: ["A", "B"], emit: (v, p) => { if (v === 0) last = p; }, seed: [BigInt(d + 1), 2n, 3n, 4n] });
  host.start();
  let steps = 0, retries = 0;
  const t0 = Date.now();
  while (!host.ended) {
    if (!host.pending) throw new Error("No pending prompt and duel not ended");
    const { player, msg } = host.pending;
    const ans = botAnswer(msg, { mode, db, rnd });
    if (!ans) throw new Error("Bot could not answer " + MSG_NAME[msg.type]);
    const before = host.seq;
    const err = host.respond(player, ans);
    if (err) throw new Error(err);
    if (last && last.events.some((e) => e.type === 1)) { retries++; if (retries > 200) { console.log(JSON.stringify(msg, null, 0).slice(0, 2000), ans); throw new Error("Retry loop on " + MSG_NAME[msg.type]); } }
    else retries = 0;
    prompts++;
    if (++steps > 20000 || host.turn > 60) { host.surrender(0); break; }
  }
  totalTurns += host.turn;
  const unknown = core.missing.size;
  console.log(`duel ${d + 1}: winner=${host.ended.winner} reason="${host.ended.reason}" turns=${host.turn} prompts=${steps} ${Date.now() - t0}ms lp=${last.state.teams.map((t) => t.lp)} missingScripts=${unknown}`);
  host.destroy();
}
console.log("OK", { duels: N, totalTurns, prompts, missing: [...core.missing].slice(0, 10) });
