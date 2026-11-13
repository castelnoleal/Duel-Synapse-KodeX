// The status probe (what is affecting each card) must not change a duel: the same seed, decks and answers give the
// same messages with it on and off; and it must report real statuses with the card they come from.
// usage: node tests/duel/status-probe.mjs <CardScripts dir>
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { OcgCore } from "../../duel/engine/core.js";
import { CardDB, ScriptStore } from "../../duel/engine/data.js";
import { DuelHost } from "../../duel/engine/host.js";
import { botAnswer } from "../../duel/engine/bot.js";
import { TYPE } from "../../duel/engine/constants.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."), dir = process.argv[2];
const db = new CardDB(JSON.parse(fs.readFileSync(path.join(root, "duel/data/cards.json"))), JSON.parse(fs.readFileSync(path.join(root, "duel/data/strings.json"))));
const store = new ScriptStore(JSON.parse(fs.readFileSync(path.join(root, "duel/data/scripts.json"))), async (p) => { try { return fs.readFileSync(path.join(dir, p), "utf8"); } catch { return null; } });
const core = await OcgCore.load(fs.readFileSync(path.join(root, "duel/engine/ocgcore.wasm")));
let s = 99; const r0 = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
const pool = Object.keys(db.raw).map(Number).filter((c) => { const x = db.get(c); return !x.alias && !(x.type & TYPE.TOKEN) && store.where.has(c); });
const deck = () => { const main = [], extra = []; while (main.length < 40) { const c = pool[Math.floor(r0() * pool.length)]; if (db.isExtra(c)) { if (extra.length < 15) extra.push(c); } else main.push(c); } return { main, extra }; };
function play(decks, seed, noStatus) {
  let t = 7; const rnd = () => { t = (t * 1103515245 + 12345) & 0x7fffffff; return t / 0x7fffffff; };
  const h = crypto.createHash("sha1"); let seen = 0, withBy = 0, steps = 0, retries = 0, last = null;
  const host = new DuelHost({ core, db, scripts: store, decks, names: ["A", "B"], options: { noShuffle: true, noStatus }, seed,
    emit: (v, p) => { if (v !== 0) return; last = p; h.update(JSON.stringify(p.events, (k, x) => (typeof x === "bigint" ? String(x) : x)));
      for (const z of p.state.teams) for (const c of [...z.mzone, ...z.szone]) if (c) { h.update(String(c.code) + ":" + c.attack + ":" + c.position); for (const x of c.fx || []) { seen++; if (x.by) withBy++; } } } });
  host.start();
  while (!host.ended && steps++ < 6000 && host.turn <= 40) {
    const { player, msg } = host.pending; const ans = botAnswer(msg, { mode: "random", db, rnd, retry: retries });
    host.respond(player, ans); retries = last && last.events.some((e) => e.type === 1) ? retries + 1 : 0; if (retries > 200) break;
  }
  return { hash: h.digest("hex"), seen, withBy, turns: host.turn };
}
let total = 0, by = 0;
for (let d = 0; d < 6; d++) {
  const decks = [deck(), deck()]; await store.preload([...decks[0].main, ...decks[0].extra, ...decks[1].main, ...decks[1].extra]);
  const seed = [BigInt(d + 11), 5n, 6n, 7n], a = play(decks, seed, false), b = play(decks, seed, true);
  if (a.hash !== b.hash) { console.error(`FAIL: duel ${d} differs with the probe on (${a.turns} vs ${b.turns} turns)`); process.exit(1); }
  if (b.seen) { console.error("FAIL: statuses reported with the probe off"); process.exit(1); }
  total += a.seen; by += a.withBy;
}
if (total < 50 || by < total * 0.9) { console.error("FAIL: too few statuses " + total + " / with a source " + by); process.exit(1); }
console.log(`OK: status probe leaves duels unchanged (6 duels), ${total} statuses reported, ${by} with their source card`);
