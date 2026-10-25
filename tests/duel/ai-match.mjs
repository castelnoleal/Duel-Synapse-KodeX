// Bot-vs-bot match: measures how often one opponent mode beats another with real card scripts.
// usage: node tests/duel/ai-match.mjs <CardScripts dir> [duels] [modeA] [modeB] [decks: classic|random] [minWinRate]
// Seats alternate every duel so neither side always goes first. Exits 1 if modeA's win rate is below minWinRate.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OcgCore } from "../../duel/engine/core.js";
import { CardDB, ScriptStore } from "../../duel/engine/data.js";
import { DuelHost } from "../../duel/engine/host.js";
import { botAnswer } from "../../duel/engine/bot.js";
import { observe } from "../../duel/engine/smart.js";
import { MSG_NAME, TYPE } from "../../duel/engine/constants.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const [scriptsDir, nArg, modeA = "smart", modeB = "random", deckKind = "classic", minArg] = process.argv.slice(2);
const TRACE = (process.env.TRACE || "").split(",").filter(Boolean).map(Number);
const N = Number(nArg || 20), minRate = minArg != null ? Number(minArg) : null;
const db = new CardDB(JSON.parse(fs.readFileSync(path.join(root, "duel/data/cards.json"))), JSON.parse(fs.readFileSync(path.join(root, "duel/data/strings.json"))));
const index = JSON.parse(fs.readFileSync(path.join(root, "duel/data/scripts.json")));
const store = new ScriptStore(index, async (p) => { try { return fs.readFileSync(path.join(scriptsDir, p), "utf8"); } catch { return null; } });
const core = await OcgCore.load(fs.readFileSync(path.join(root, "duel/engine/ocgcore.wasm")));

let s = 4242;
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

const wins = { [modeA]: 0, [modeB]: 0, draw: 0 };
const rejected = {};
if (modeA === modeB) { wins.seat0 = 0; wins.seat1 = 0; }
let turns = 0;
for (let d = 0; d < N; d++) {
  const pair = deckKind === "random" ? [randomDeck(), randomDeck()] : [classic, classic];
  const swap = d % 2 === 1;                       // seat 0 goes first; alternate who sits there
  const modes = swap ? [modeB, modeA] : [modeA, modeB];
  const decks = swap ? [pair[1], pair[0]] : pair;
  await store.preload([...decks[0].main, ...decks[0].extra, ...decks[1].main, ...decks[1].extra]);
  const views = [null, null], mems = [{}, {}], retry = [0, 0];
  const host = new DuelHost({ core, db, scripts: store, decks, names: modes, seed: [BigInt(d + 7), 11n, 13n, 17n],
    emit: (v, p) => { if (v < 2) { views[v] = p; observe(p, mems[v]); retry[v] = p.events.some((e) => e.type === 1) ? retry[v] + 1 : 0; } } });
  host.start();
  let steps = 0;
  while (!host.ended) {
    if (!host.pending) throw new Error("No pending prompt and duel not ended");
    const { player, msg, hint } = host.pending;
    const ans = botAnswer(msg, { mode: modes[player], db, rnd, view: views[player], hint, mem: mems[player], retry: retry[player] });
    if (!ans) throw new Error(`${modes[player]} could not answer ${MSG_NAME[msg.type]}`);
    if (TRACE.includes(d + 1)) {
      const v = views[player], st = v && v.state ? v.state.teams : null;
      const nm = (c) => (c ? db.name(c) : "?");
      let what = "";
      if (msg.type === 11) what = ["SUMMON", "SPSUMMON", "REPOS", "MSET", "SSET", "ACTIVATE", "TO_BP", "TO_EP"][ans.action] + (ans.index != null ? " " + nm(([msg.summons, msg.special_summons, msg.pos_changes, msg.monster_sets, msg.spell_sets, msg.activates][ans.action] || [])[ans.index]?.code) : "");
      else if (msg.type === 10) what = ["ACTIVATE", "ATTACK", "TO_M2", "TO_EP"][ans.action] + (ans.action === 1 ? " with " + nm(msg.attacks[ans.index].code) : "");
      else if (msg.type === 16) what = ans.index == null ? "pass (" + msg.selects.map((x) => nm(x.code)).join(", ") + ")" : "chain " + nm(msg.selects[ans.index].code);
      else if (msg.type === 15) what = "pick " + ans.indices.map((i) => nm(msg.selects[i].code) + "@" + msg.selects[i].controller).join(", ") + " hint " + hint;
      else what = JSON.stringify(ans).slice(0, 80);
      const fld = st ? st.map((t) => t.mzone.filter(Boolean).map((c) => c.hidden ? "??" : nm(c.code) + "(" + c.attack + ")").join(" ") || "-").join(" | ") : "";
      const hand = st && msg.type === 11 ? " hand{" + st[player].hand.filter(Boolean).map((c) => c.hidden ? "?" : nm(c.code)).join(", ") + "} sum=" + msg.summons.length + " set=" + msg.monster_sets.length : "";
      console.log(`  T${host.turn} ${modes[player].padEnd(6)} ${MSG_NAME[msg.type].padEnd(20)} ${what}${hand}   [LP ${st ? st.map((t) => t.lp).join("/") : ""}] [${fld}]`);
    }
    const err = host.respond(player, ans);
    if (err) throw new Error(err);
    if (retry[player] > 0) { const k = modes[player] + ":" + MSG_NAME[msg.type]; rejected[k] = (rejected[k] || 0) + 1; }
    if (retry[player] > 50) throw new Error(`Retry loop for ${modes[player]} on ${MSG_NAME[msg.type]}: ${JSON.stringify(msg).slice(0, 600)}`);
    if (++steps > 30000 || host.turn > 80) { host.finish(-1, "turn limit", []); break; }
  }
  const w = host.ended.winner;
  if (w < 0) wins.draw++;
  else if (modeA === modeB) wins[w === 0 ? "seat0" : "seat1"]++;
  else wins[modes[w]]++;
  turns += host.turn;
  const lp = views[0] && views[0].state ? views[0].state.teams.map((t) => t.lp) : [];
  console.log(`duel ${String(d + 1).padStart(2)}: ${modes[0]} (first) vs ${modes[1]} -> ${w < 0 ? "draw" : modes[w]} | ${host.ended.reason} | turns ${host.turn} | LP ${lp.join("/")}`);
  host.destroy();
}
const rate = modeA === modeB ? null : wins[modeA] / N;
console.log(JSON.stringify({ duels: N, decks: deckKind, wins, rejected, avgTurns: +(turns / N).toFixed(1), [`${modeA}WinRate`]: rate }));
if (minRate != null && rate != null && rate < minRate) { console.error(`${modeA} won ${(rate * 100).toFixed(0)}% (< ${(minRate * 100).toFixed(0)}% required)`); process.exit(1); }
