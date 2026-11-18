// A replay read back as a combo keeps every card where it really went: a scanned turn (the engine's own events) is
// turned into a combo, the combo is played back, and the table at the end must match the duel's.
// Usage: node tests/duel/combo-replay.mjs
import * as C from "../../duel/engine/constants.js";
import { comboFromReplay, comboPackets, replayTurns, cleanCombo } from "../../duel/combo.js";
const M = C.MSG, T = C.TYPE, R = C.REASON;
let bad = 0; const ok = (c, m) => { console.log((c ? "ok: " : "FAIL: ") + m); if (!c) bad++; };
// cards: two copies of a Pendulum tuner (1), a Normal Spell (2), a Link-2 (3), an Xyz (4), a plain monster (5), a Continuous Spell (6)
const DB = new Map([[1, { type: T.MONSTER | T.EFFECT | T.PENDULUM, atk: 100, def: 400, level: 4 }], [2, { type: T.SPELL }], [3, { type: T.MONSTER | T.LINK | T.EFFECT, atk: 1800, def: 0, level: 2 }],
  [4, { type: T.MONSTER | T.XYZ | T.EFFECT, atk: 2000, def: 2000, level: 4 }], [5, { type: T.MONSTER | T.EFFECT, atk: 1500, def: 1200, level: 4 }], [6, { type: T.SPELL | T.CONTINUOUS }], [7, { type: T.MONSTER | T.EFFECT, atk: 0, def: 0, level: 1 }]]);
const db = { get: (c) => DB.get(c), name: (c) => "Card " + c };
const L = (location, sequence, position = C.POS_FACEUP_ATTACK, controller = 0) => ({ controller, location, sequence, position });
const mv = (code, from, to, reason = 0) => ({ type: M.MOVE, code, from, to, reason });
const H = C.LOCATION_HAND, MZ = C.LOCATION_MZONE, SZ = C.LOCATION_SZONE, GY = C.LOCATION_GRAVE, EX = C.LOCATION_EXTRA, DK = C.LOCATION_DECK, RM = C.LOCATION_REMOVED;
const events = [
  { type: M.NEW_TURN, player: 0 },
  // Normal Summon the first copy of 1 to zone 4 (not the default zone), its effect adds 5 from the Deck
  mv(1, L(H, 0), L(MZ, 4)), { type: M.SUMMONING, code: 1, controller: 0 },
  { type: M.CHAINING, code: 1, controller: 0, location: MZ, sequence: 4, chain_size: 1 }, { type: M.CHAIN_SOLVING, chain_size: 1 }, mv(5, L(DK, 0), L(H, 3), R.EFFECT), { type: M.CHAIN_SOLVED }, { type: M.CHAIN_END },
  // activate Spell 2 in zone 0: Special Summon the second copy of 1 from the Deck in Defense to zone 0, then 2 goes to the GY
  mv(2, L(H, 0), L(SZ, 0)), { type: M.CHAINING, code: 2, controller: 0, location: SZ, sequence: 0, chain_size: 1 }, { type: M.CHAIN_SOLVING, chain_size: 1 },
  mv(1, L(DK, 0), L(MZ, 0, C.POS_FACEUP_DEFENSE), R.EFFECT), { type: M.SPSUMMONING, code: 1, controller: 0 }, { type: M.CHAIN_SOLVED }, { type: M.CHAIN_END }, mv(2, L(SZ, 0), L(GY, 0), R.RULE),
  // Special Summon 5 from the hand to zone 1 (its own procedure)
  mv(5, L(H, 2), L(MZ, 1)), { type: M.SPSUMMONING, code: 5, controller: 0 },
  // Link Summon 3 to the right Extra Monster Zone using the copy of 1 in zone 0 (goes face-up to the Extra Deck) and 5 (GY)
  mv(1, L(MZ, 0, C.POS_FACEUP_DEFENSE), L(EX, 0), R.MATERIAL | R.LINK), mv(5, L(MZ, 1), L(GY, 1), R.MATERIAL | R.LINK), mv(3, L(EX, 0, C.POS_FACEDOWN_DEFENSE), L(MZ, 6)), { type: M.SPSUMMONING, code: 3, controller: 0 },
  // 3's effect: place 6 from the Deck face-up in zone 3, banish 5 from the GY, return 7 from the hand to the Deck
  { type: M.CHAINING, code: 3, controller: 0, location: MZ, sequence: 6, chain_size: 1 }, { type: M.CHAIN_SOLVING, chain_size: 1 },
  mv(6, L(DK, 0), L(SZ, 3), R.EFFECT), mv(5, L(GY, 1), L(RM, 0), R.EFFECT), mv(7, L(H, 1), L(DK, 0), R.EFFECT), { type: M.CHAIN_SOLVED }, { type: M.CHAIN_END },
  // set the remaining copy... (a monster set from the hand)
  { type: M.NEW_TURN, player: 1 }, mv(9, L(H, 0, 1, 1), L(MZ, 2, 1, 1)), { type: M.SUMMONING, code: 9, controller: 1 },
];
const scan = { names: ["Mei", "Opp"], decks: [{ main: 40, extra: [3, 4] }, { main: 40, extra: [] }], steps: [{ turn: 1, tp: 0, events: events.slice(0, 1), hands: [[1, 2, 7, 5].slice(0, 3).concat([]), []] }, { turn: 1, tp: 0, events: events.slice(1), hands: [[], []] }] };
scan.steps[0].hands = [[1, 2, 7], []];
const turns = replayTurns(scan);
ok(turns.length === 2 && turns[0].tp === 0 && turns[0].plays === 7 && turns[1].plays === 1, "turns and plays " + JSON.stringify(turns));
const c = comboFromReplay(scan, 1, db);
ok(c && c.hand.join() === "1,2,7", "starting hand " + (c && c.hand));
const txt = c.lines.map((l) => l.map((n) => n.cards.map((x) => `${x.c}:${x.a}`).join("+")).join(">"));
console.log(txt);
ok(txt.join("|") === "1:ns|1:eff>5:add|2:act>1:ss|5:ss|1:mat+5:mat>3:ss|3:eff>6:put+5:ban+7:deck", "every play is its own step, with what it used and what it led to");
const ns = c.lines[0][0].cards[0], ss = c.lines[2][1].cards[0], lk = c.lines[4][1].cards[0], mat = c.lines[4][0].cards[0];
ok(ns.z === 4 && ss.z === 0 && ss.p === 2 && ss.f === 2 && lk.z === 6 && lk.f === 3 && mat.f === 6 && mat.s === 0, "zones, positions and sources are kept " + JSON.stringify([ns, ss, lk, mat]));
ok(JSON.stringify(cleanCombo(JSON.parse(JSON.stringify(c))).lines) === JSON.stringify(c.lines), "the placement survives being stored and sent");
const pk = comboPackets(c, db), end = pk[pk.length - 1].state.teams[0];
const at = (z) => z.map((x) => (x ? x.code : 0)).join(",");
ok(at(end.mzone) === "0,0,0,0,1,0,3", "monsters end where they were in the duel: " + at(end.mzone));
ok(at(end.szone) === "0,0,0,6,0,0,0,0", "Spells end where they were: " + at(end.szone));
ok(end.grave.map((x) => x.code).join() === "2" && end.banished.map((x) => x.code).join() === "5" && end.extra.some((x) => x.code === 1 && x.position === C.POS_FACEUP_ATTACK) && !end.extra.some((x) => x.code === 3), "GY, banished and Extra Deck match (the Pendulum material is face-up in the Extra Deck)");
ok(end.hand.length === 0 && end.deck === 40 - 3 - 3 + 1, "hand and Deck count match: hand " + end.hand.length + ", deck " + end.deck);
// the Defense Position summon is shown in Defense
const def = pk.find((p) => p.state.teams[0].mzone[0] && p.state.teams[0].mzone[0].code === 1);
ok(def && def.state.teams[0].mzone[0].position === C.POS_FACEUP_DEFENSE, "a Defense Position summon stays in Defense");
// an old combo (no placement) still plays
const old = cleanCombo({ title: "old", hand: [1, 2], lines: [[{ cards: [{ c: 1, a: "ns" }] }, { cards: [{ c: 5, a: "add" }] }]] });
ok(comboPackets(old, db).length === 3, "combos without placement still play");
// cards placed in the Spell & Trap Zones by an effect: a Pendulum Monster into the right Pendulum Zone, and a monster
// placed as a Continuous Spell; the real table at the end of the turn travels with the combo
{
  const ev2 = [{ type: M.NEW_TURN, player: 0 }, mv(5, L(H, 0), L(MZ, 2)), { type: M.SUMMONING, code: 5, controller: 0 },
    { type: M.CHAINING, code: 5, controller: 0, location: MZ, sequence: 2, chain_size: 1 }, { type: M.CHAIN_SOLVING, chain_size: 1 },
    mv(1, L(DK, 0), L(SZ, 4), R.EFFECT), mv(7, L(DK, 0), L(SZ, 1), R.EFFECT), { type: M.CHAIN_SOLVED }, { type: M.CHAIN_END }, { type: M.NEW_TURN, player: 1 }];
  const card = (code, position = C.POS_FACEUP_ATTACK) => ({ code, position });
  const board = [{ m: [null, null, card(5), null, null, null, null], s: [null, card(7), null, null, card(1), null, null, null] }, { m: [null, null, null, null, null, card(9, C.POS_FACEDOWN_DEFENSE), null], s: Array(8).fill(null) }];
  const scan2 = { names: ["Mei", "Opp"], decks: [{ main: 40, extra: [] }, { main: 40, extra: [] }], steps: [{ turn: 1, tp: 0, events: ev2.slice(0, 1), hands: [[5], []], board }, { turn: 1, tp: 0, events: ev2.slice(1, -1), hands: [[], []], board }, { turn: 2, tp: 1, events: ev2.slice(-1), hands: [[], []], board: null }] };
  const c2 = comboFromReplay(scan2, 1, db);
  const put = c2.lines.flat().flatMap((n) => n.cards).filter((x) => x.a === "put");
  ok(put.length === 2 && put.every((x) => x.r === "s") && put[0].z === 4 && put[1].z === 1, "placed cards keep their row and zone " + JSON.stringify(put));
  const e2 = comboPackets(cleanCombo(JSON.parse(JSON.stringify(c2))), db).pop().state.teams[0];
  ok(at(e2.szone) === "0,7,0,0,1,0,0,0" && at(e2.mzone) === "0,0,5,0,0,0,0", "the Pendulum Monster stands in its Pendulum Zone, the placed monster in a Spell & Trap Zone: " + at(e2.szone) + " / " + at(e2.mzone));
  const eb = cleanCombo(JSON.parse(JSON.stringify(c2))).endBoard;
  ok(eb && eb[0].s[4] && eb[0].s[4].id === "1" && eb[0].s[1].id === "7" && eb[0].m[2].id === "5" && eb[1].m[6] && eb[1].m[6].pos === "down", "the real end board comes with it (the opponent's Extra Monster Zone seen from our side) " + JSON.stringify(eb));
}
if (bad) { console.log(bad + " failed"); process.exit(1); }
console.log("OK: replay to combo keeps the table");
