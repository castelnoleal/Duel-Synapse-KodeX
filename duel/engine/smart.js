// Synapse AI: a heuristic opponent for solo play.
// It sees exactly what a human in its seat would see (its own hand and field, public cards,
// life points, the chain) and plays to win: it develops its board, attacks when the math
// is good, sets defenders when it is behind, keeps traps for the opponent's turn and
// answers the opponent's plays with negation and removal.
//
// smartAnswer(msg, ctx) returns an answer object, or null to let the caller fall back.
//   ctx: { db, view, hint, mem }
//     view: the packet DuelHost.broadcast() built for this seat ({ state, turn, turnPlayer, phase, events })
//     hint: the selection hint for this prompt (HINTMSG_* number as a string), if any
//     mem:  a plain object kept for the whole duel (the bot's memory)
import { MSG, IDLE, BATTLE_ACT, TYPE, PHASE, LOCATION_HAND, LOCATION_MZONE, LOCATION_SZONE, LOCATION_GRAVE, LOCATION_REMOVED,
  LOCATION_EXTRA, LOCATION_DECK, POS_FACEUP_ATTACK, POS_FACEUP_DEFENSE, POS_FACEDOWN_DEFENSE, POS_FACEDOWN_ATTACK, POS_FACEUP,
  POS_FACEDOWN, POS_DEFENSE } from "./constants.js";
import { placesFromMask, findSum } from "./rules.js";

// Selection hints (HINTMSG_* in CardScripts/constant.lua)
const H = { RELEASE: 500, DISCARD: 501, DESTROY: 502, REMOVE: 503, TOGRAVE: 504, RTOHAND: 505, ATOHAND: 506, TODECK: 507, SUMMON: 508,
  SPSUMMON: 509, SET: 510, FMATERIAL: 511, SMATERIAL: 512, XMATERIAL: 513, FACEUP: 514, FACEDOWN: 515, ATTACK: 516, DEFENSE: 517, EQUIP: 518,
  REMOVEXYZ: 519, CONTROL: 520, DESREPLACE: 521, POSCHANGE: 528, SELF: 529, OPPO: 530, TRIBUTE: 531, DEATTACHFROM: 532, LMATERIAL: 533,
  ATTACKTARGET: 549, EFFECT: 550, TARGET: 551, TOFIELD: 527, NEGATE: 575, ATTACH: 578, RTOGRAVE: 579 };
// "Pick the least valuable of my own cards": costs and materials.
const COST = new Set([H.RELEASE, H.DISCARD, H.FMATERIAL, H.SMATERIAL, H.XMATERIAL, H.LMATERIAL, H.TRIBUTE, H.DEATTACHFROM, H.REMOVEXYZ, H.DESREPLACE]);
// "Hurt the opponent": removal, takeover, targeting.
const HARM = new Set([H.DESTROY, H.REMOVE, H.TOGRAVE, H.RTOHAND, H.TODECK, H.CONTROL, H.POSCHANGE, H.NEGATE, H.ATTACKTARGET, H.TARGET, H.FACEDOWN, H.RTOGRAVE]);
// "Get the best one": searches, summons, equips.
const GAIN = new Set([H.ATOHAND, H.SPSUMMON, H.SUMMON, H.SET, H.EQUIP, H.TOFIELD, H.FACEUP, H.ATTACH, H.SELF, H.EFFECT]);

const isMonster = (c) => !!c && !!(c.type & TYPE.MONSTER);
const isSpell = (c) => !!c && !!(c.type & TYPE.SPELL);
const isTrap = (c) => !!c && !!(c.type & TYPE.TRAP);
const isExtraType = (c) => !!c && !!(c.type & (TYPE.FUSION | TYPE.SYNCHRO | TYPE.XYZ | TYPE.LINK));
const text = (c) => (c && c.desc ? String(c.desc) : "");
const RX = {
  negate: /\bnegate\b/i,
  respond: /\b(when|if) (your )?opponent (activates|would|normal summons|special summons|summons|declares an attack)|\bin response\b|when an opponent'?s monster declares an attack|when a monster declares an attack|when your opponent'?s monster declares/i,
  attackTrap: /declares an attack/i,
  handTrap: /\(quick effect\)[^.]*discard this card|discard this card[^.]*\(quick effect\)|you can discard this card[^;]*;/i,
  destroyAllMonsters: /destroy all monsters on the field/i,
  destroyOpp: /destroy (up to \w+ |1 |one |all )?(card|cards|monster|monsters|spell|trap|face-up|face-down|target)s?[^.]*(opponent|on the field)|your opponent controls/i,
  revive: /special summon[^.]*from (either player's |your |your opponent's )?(gy|graveyard)|target[^.]*in (either|your|a) (gy|graveyard)[^.]*special summon/i,
  search: /add[^.]*from your deck to your hand|draw \d|draw (1|2|3|one|two|three) card/i,
  spsummon: /special summon/i,
  mill: /send[^.]*from your deck to the (gy|graveyard)/i,
};

// ---------------------------------------------------------------------------
// Reading the board
function sides(ctx, me) {
  const t = ctx.view && ctx.view.state ? ctx.view.state.teams : null;
  const empty = { lp: 8000, hand: [], mzone: [], szone: [], grave: [], banished: [], extra: [], deck: 0 };
  return { mine: t ? t[me] : empty, theirs: t ? t[1 - me] : empty };
}
const monsters = (side) => (side.mzone || []).filter(Boolean);
const faceUp = (c) => c && !c.hidden && c.position != null && (c.position & POS_FACEUP);
const atkOf = (c) => (c && c.attack != null ? c.attack : 0);
const defOf = (c) => (c && c.defense != null ? c.defense : 0);

/** The strongest attack an opponent's monster can block or punish with. */
function oppThreat(theirs) {
  let best = 0;
  for (const c of monsters(theirs)) {
    if (faceUp(c)) best = Math.max(best, c.position & POS_DEFENSE ? defOf(c) : atkOf(c));
    else best = Math.max(best, 1500); // face-down: assume an average body
  }
  return best;
}
function oppBestAttack(theirs) {
  let best = 0;
  for (const c of monsters(theirs)) best = Math.max(best, faceUp(c) && !(c.position & POS_DEFENSE) ? atkOf(c) : faceUp(c) ? 0 : 1200);
  return best;
}

/** How much a card is worth to its controller (bigger = more valuable). */
function value(db, sel, ctx) {
  if (!sel) return 0;
  if (!sel.code) return 1500; // hidden card
  const c = db.get(sel.code);
  if (!c) return 800;
  let v;
  if (isMonster(c)) {
    let atk = c.atk > 0 ? c.atk : 0, def = c.def > 0 ? c.def : 0;
    const live = fieldCard(ctx, sel);
    if (live && live.attack != null) { atk = live.attack; def = live.defense != null ? live.defense : def; }
    v = Math.max(atk, def * 0.8) + (c.level || 0) * 60 + (c.type & TYPE.EFFECT ? 250 : 0) + (isExtraType(c) ? 400 : 0);
    if (c.type & TYPE.TOKEN) v = Math.min(v, 300);
    if (RX.handTrap.test(text(c)) && sel.location === LOCATION_HAND) v += 900; // hand traps are precious in hand
    if (live && live.overlays && live.overlays.length) v += 150 * live.overlays.length;
  } else if (isTrap(c)) v = c.type & TYPE.COUNTER ? 1700 : 1300;
  else v = c.type & (TYPE.FIELD | TYPE.CONTINUOUS | TYPE.EQUIP) ? 1300 : 1100;
  return v;
}
function fieldCard(ctx, sel) {
  if (!ctx.view || !ctx.view.state || sel.controller == null) return null;
  const side = ctx.view.state.teams[sel.controller];
  if (!side) return null;
  if (sel.location === LOCATION_MZONE) return side.mzone[sel.sequence] || null;
  if (sel.location === LOCATION_SZONE) return side.szone[sel.sequence] || null;
  return null;
}

function turnMem(ctx) {
  const m = ctx.mem;
  const t = ctx.view ? ctx.view.turn : 0;
  if (m.turn !== t) { m.turn = t; m.used = new Map(); m.idle = 0; m.plan = null; }
  return m;
}
const keyOf = (a) => `${a.code}:${a.location}:${a.sequence}:${a.description || ""}`;
const once = (m, k, n = 1) => { const c = m.used.get(k) || 0; if (c >= n) return false; m.used.set(k, c + 1); return true; };

// ---------------------------------------------------------------------------
// Main phase
function idle(msg, ctx) {
  const { db } = ctx, me = msg.player, m = turnMem(ctx);
  const { mine, theirs } = sides(ctx, me);
  const phase = ctx.view ? ctx.view.phase : 0;
  const main1 = !!(phase & PHASE.MAIN1);
  const myMons = monsters(mine), theirMons = monsters(theirs);
  const myBest = Math.max(0, ...myMons.filter(faceUp).map(atkOf));
  const threat = oppThreat(theirs);
  const oppField = theirMons.length + (theirs.szone || []).filter(Boolean).length;
  if (++m.idle > 80) return { action: msg.to_ep ? IDLE.TO_EP : IDLE.TO_BP };
  const pick = (action, index) => ({ action, index });

  // 1) Useful activations (searches, draws, field spells, removal when there is something to remove).
  const acts = msg.activates.map((a, index) => ({ a, index, c: db.get(a.code) })).filter(({ a, c }) => c && worthActivating(a, c, { me, mine, theirs, myMons, theirMons, oppField, myBest, deck: mine.deck || 0 }));
  acts.sort((x, y) => actPriority(y.c) - actPriority(x.c));
  for (const { a, index } of acts) if (once(m, "act:" + keyOf(a))) return pick(IDLE.ACTIVATE, index);

  // 2) Special Summons: strong Extra Deck plays and free summons from the hand.
  const sps = msg.special_summons.map((s, index) => ({ s, index, c: db.get(s.code) })).filter(({ c }) => c);
  sps.sort((x, y) => (y.c.atk || 0) - (x.c.atk || 0));
  for (const { s, index, c } of sps) {
    const fromExtra = s.location === LOCATION_EXTRA;
    const good = !fromExtra || (c.atk || 0) >= Math.max(1500, myBest) || (c.type & TYPE.LINK && myMons.length >= 2 && (c.atk || 0) >= 1200);
    if (good && once(m, "sp:" + keyOf(s), 2)) return pick(IDLE.SPSUMMON, index);
  }

  // 3) Normal Summon the monster that wins fights; set a wall when we can't.
  const summons = msg.summons.map((s, index) => ({ s, index, c: db.get(s.code) })).filter(({ c }) => c && !(RX.handTrap.test(text(c)) && (c.atk || 0) <= 1500));
  summons.sort((x, y) => (y.c.atk || 0) - (x.c.atk || 0));
  const sets = msg.monster_sets.map((s, index) => ({ s, index, c: db.get(s.code) })).filter(({ c }) => c && !(RX.handTrap.test(text(c)) && (c.def || 0) <= 1500));
  sets.sort((x, y) => ((y.c.type & TYPE.FLIP ? 800 : 0) + (y.c.def || 0)) - ((x.c.type & TYPE.FLIP ? 800 : 0) + (x.c.def || 0)));
  const bestSummon = summons[0];
  if (bestSummon) {
    const atk = bestSummon.c.atk || 0;
    const tributes = (bestSummon.c.level || 0) >= 7 ? 2 : (bestSummon.c.level || 0) >= 5 ? 1 : 0;
    const fodder = myMons.filter((x) => faceUp(x) ? atkOf(x) < atk : true).length;
    const tributeOk = tributes === 0 || fodder >= tributes;
    const flip = !!(bestSummon.c.type & TYPE.FLIP);
    const canSwing = (ctx.view ? ctx.view.turn : 0) > 1;      // nobody attacks on the first turn
    const strong = atk >= 1600 && (atk > threat || !theirMons.length);
    if (tributeOk && !flip && (strong || (canSwing && atk > threat && theirMons.length) || (!sets.length && atk >= 1000)))
      return pick(IDLE.SUMMON, bestSummon.index);
  }
  if (sets.length && (!bestSummon || (sets[0].c.def || 0) >= (bestSummon.c.atk || 0) - 300 || threat > (bestSummon ? bestSummon.c.atk || 0 : 0)))
    return pick(IDLE.MSET, sets[0].index);
  if (bestSummon && !sets.length) return pick(IDLE.SUMMON, bestSummon.index);

  // 4) Flip defenders into attack when they now win, and pull weak attackers back in Main Phase 2.
  for (let i = 0; i < msg.pos_changes.length; i++) {
    const p = msg.pos_changes[i], card = mine.mzone[p.sequence];
    if (!card || !once(m, "pos:" + p.sequence)) continue;
    const isDef = !!(card.position & POS_DEFENSE);
    const atk = card.attack != null ? card.attack : (db.get(p.code) || {}).atk || 0;
    if (main1 && isDef && (atk > threat || !theirMons.length) && atk >= 1000) return pick(IDLE.REPOS, i);
    if (!main1 && !isDef && atk < oppBestAttack(theirs) && defOf(card) > atk) return pick(IDLE.REPOS, i);
  }

  // 5) Set traps and quick effects for the opponent's turn (keep the field spell zone out of it).
  const stFree = (mine.szone || []).slice(0, 5).filter((x) => !x).length;
  const ssets = msg.spell_sets.map((s, index) => ({ s, index, c: db.get(s.code) })).filter(({ c }) => c && (isTrap(c) || (c.type & TYPE.QUICKPLAY) || (isSpell(c) && RX.respond.test(text(c)))));
  ssets.sort((x, y) => (isTrap(y.c) ? 1 : 0) - (isTrap(x.c) ? 1 : 0));
  if (ssets.length && stFree > (main1 ? 0 : 0) && (!main1 || !msg.to_bp || ctx.view.turn <= 1 || !canAttackNow(mine)))
    return pick(IDLE.SSET, ssets[0].index);

  // 6) Battle if anything can attack, otherwise end the turn.
  if (main1 && msg.to_bp && canAttackNow(mine)) return { action: IDLE.TO_BP };
  if (ssets.length && stFree) return pick(IDLE.SSET, ssets[0].index);
  if (msg.to_ep) return { action: IDLE.TO_EP };
  if (msg.to_bp) return { action: IDLE.TO_BP };
  return null;
}
const canAttackNow = (mine) => monsters(mine).some((c) => faceUp(c) && !(c.position & POS_DEFENSE) && atkOf(c) > 0);

function actPriority(c) {
  const t = text(c);
  if (c.type & TYPE.FIELD) return 9;
  if (RX.search.test(t)) return 8;
  if (RX.spsummon.test(t) && isMonster(c)) return 7;
  if (RX.spsummon.test(t)) return 6;
  if (RX.destroyAllMonsters.test(t) || RX.destroyOpp.test(t)) return 5;
  if (c.type & TYPE.EQUIP) return 3;
  return 4;
}
function worthActivating(a, c, s) {
  const t = text(c);
  if (s.deck <= 6 && (RX.mill.test(t) || /draw \d|draw (1|2|3|one|two|three) card/i.test(t))) return false; // don't deck ourselves out
  if (isTrap(c) && !(c.type & TYPE.CONTINUOUS)) return false;            // traps wait for the opponent's turn
  if (isSpell(c) && c.type & TYPE.QUICKPLAY && RX.respond.test(t) && a.location !== LOCATION_GRAVE) return false;
  if (isSpell(c) && RX.negate.test(t) && !RX.search.test(t) && !RX.spsummon.test(t)) return false; // hold negation
  if (RX.handTrap.test(t) && a.location === LOCATION_HAND) return false;   // hand traps are for the opponent's turn
  if (RX.destroyAllMonsters.test(t)) {
    const mine = s.myMons.reduce((v, x) => v + (faceUp(x) ? atkOf(x) : 1200), 0), theirs = s.theirMons.reduce((v, x) => v + (faceUp(x) ? atkOf(x) : 1200), 0);
    return s.theirMons.length > 0 && theirs > mine + 500;
  }
  if (isSpell(c) && RX.destroyOpp.test(t) && !RX.search.test(t) && !RX.spsummon.test(t)) return s.oppField > 0;
  if (c.type & TYPE.EQUIP) return s.myMons.some(faceUp);
  if (isSpell(c) && RX.revive.test(t)) return true;
  return true;
}

// ---------------------------------------------------------------------------
// Battle phase
function battle(msg, ctx) {
  const me = msg.player, m = turnMem(ctx), { db } = ctx;
  const { mine, theirs } = sides(ctx, me);
  const theirMons = (theirs.mzone || []).map((c, i) => (c ? { c, i } : null)).filter(Boolean);
  const attackers = msg.attacks.map((a, index) => ({ a, index, card: mine.mzone[a.sequence] }))
    .map((x) => ({ ...x, atk: x.card && x.card.attack != null ? x.card.attack : (db.get(x.a.code) || {}).atk || 0 }))
    .sort((x, y) => y.atk - x.atk);
  // Lethal through direct attacks?
  const directDmg = attackers.filter((x) => x.a.can_direct).reduce((s, x) => s + x.atk, 0);
  const lethal = directDmg >= (theirs.lp || 8000) && directDmg > 0;
  for (const x of attackers) {
    if (x.atk <= 0) continue;
    if (x.a.can_direct && (lethal || !theirMons.length)) { m.plan = { direct: true }; return { action: BATTLE_ACT.ATTACK, index: x.index }; }
    // Best profitable target.
    let best = null, bestGain = 0;
    for (const { c, i } of theirMons) {
      if (m.used.get(`hit:${i}`) && !faceUp(c)) continue;
      let gain = 0;
      if (faceUp(c)) {
        const def = !!(c.position & POS_DEFENSE);
        const v = value(db, { code: c.code, controller: 1 - me, location: LOCATION_MZONE, sequence: i }, ctx);
        if (!def && x.atk > atkOf(c)) gain = v + (x.atk - atkOf(c));
        else if (!def && x.atk === atkOf(c) && v > value(db, { code: x.a.code, controller: me, location: LOCATION_MZONE, sequence: x.a.sequence }, ctx)) gain = 1;
        else if (def && x.atk > defOf(c)) gain = v * 0.9;
      } else if (x.atk >= 1900) gain = 900; // probe a face-down monster with a big body
      if (gain > bestGain) { bestGain = gain; best = i; }
    }
    if (best != null) { m.plan = { target: best }; m.used.set(`hit:${best}`, 1); return { action: BATTLE_ACT.ATTACK, index: x.index }; }
    if (x.a.can_direct) { m.plan = { direct: true }; return { action: BATTLE_ACT.ATTACK, index: x.index }; }
  }
  // Nothing worth attacking into: go to Main Phase 2 to set up, or end.
  if (msg.to_m2) return { action: BATTLE_ACT.TO_M2 };
  if (msg.to_ep) return { action: BATTLE_ACT.TO_EP };
  return null;
}

// ---------------------------------------------------------------------------
// Chains: respond to the opponent, use our own triggers.
function chain(msg, ctx) {
  if (msg.forced) return { index: 0 };
  if (!msg.selects.length) return { index: null };
  const me = msg.player, m = turnMem(ctx), { db } = ctx;
  const ch = ctx.view && ctx.view.state ? ctx.view.state.chain || [] : [];
  const last = ch.length ? ch[ch.length - 1] : null;
  const myTurn = ctx.view && ctx.view.turnPlayer === me;
  const oppActing = last && last.controller !== me;
  const attacked = ctx.mem.attack && ctx.mem.attack.by !== me && ctx.mem.attack.turn === (ctx.view ? ctx.view.turn : 0);
  const opts = msg.selects.map((s, index) => ({ s, index, c: db.get(s.code) })).filter((x) => x.c);
  const score = ({ s, c }) => {
    const t = text(c);
    let v = 0;
    if (RX.negate.test(t)) v += oppActing ? 50 : -20;
    if (RX.handTrap.test(t)) v += oppActing ? 40 : -30;
    if (RX.attackTrap.test(t)) v += attacked ? 45 : -10;
    if (RX.destroyOpp.test(t)) v += !myTurn ? 20 : 5;
    if (isMonster(c) && s.location !== LOCATION_HAND) v += myTurn ? 25 : 10; // on-field / GY monster effects
    if (RX.search.test(t) || RX.spsummon.test(t)) v += 15;
    return v;
  };
  opts.sort((x, y) => score(y) - score(x));
  const best = opts[0];
  if (!best) return { index: null };
  const s = score(best);
  // Don't chain to our own chain links with responses, and don't fire free traps into nothing.
  if (last && last.controller === me && !(isMonster(best.c) && best.s.location !== LOCATION_HAND)) return { index: null };
  if (s >= 20 && once(m, "chain:" + keyOf(best.s) + ":" + ch.length, 1)) return { index: best.index };
  // Our own optional monster triggers in our turn.
  if (myTurn && isMonster(best.c) && best.s.location !== LOCATION_HAND && once(m, "trig:" + keyOf(best.s), 2)) return { index: best.index };
  // End of the opponent's turn: use free-chain draw/search effects rather than wasting them.
  if (!myTurn && ctx.view && ctx.view.phase & PHASE.END && (RX.search.test(text(best.c))) && once(m, "eot:" + keyOf(best.s))) return { index: best.index };
  return { index: null };
}

// ---------------------------------------------------------------------------
// Picking cards
function polarity(hint, sels, me) {
  const h = Number(hint || 0);
  if (COST.has(h)) return "cost";
  if (HARM.has(h)) return "harm";
  if (GAIN.has(h)) return "gain";
  // Unknown hint: removal if any opponent card is offered, otherwise grab the best.
  return sels.some((s) => s.controller !== me) ? "harm" : sels.every((s) => s.location === LOCATION_MZONE || s.location === LOCATION_SZONE) ? "cost" : "gain";
}
function rank(sels, mode, me, ctx) {
  const { db } = ctx;
  const plan = ctx.mem.plan;
  return sels.map((s, i) => {
    const v = value(db, s, ctx);
    let score;
    if (mode === "cost") score = s.controller === me ? -v : -v - 5000; // never pay with the opponent's... (rare) prefer own cheapest
    else if (mode === "harm") score = s.controller !== me ? v + 10000 : -v;
    else score = s.controller === me || s.location === LOCATION_GRAVE || s.location === LOCATION_REMOVED ? v : v - 3000; // reviving their best monster is as good as ours
    if (plan && plan.target != null && s.location === LOCATION_MZONE && s.controller !== me && s.sequence === plan.target) score += 1e6;
    return { i, score };
  }).sort((a, b) => b.score - a.score).map((x) => x.i);
}
function selectCard(msg, ctx) {
  const me = msg.player;
  const mode = polarity(ctx.hint, msg.selects, me);
  const order = rank(msg.selects, mode, me, ctx);
  let n = Math.max(1, msg.min);
  if (mode === "harm" && msg.selects.filter((s) => s.controller !== me).length >= msg.max) n = Math.max(n, msg.max);
  else if (mode === "gain") n = Math.max(n, Math.min(msg.max, order.length));
  if (mode === "harm") { const opp = order.filter((i) => msg.selects[i].controller !== me); if (opp.length >= n) return { indices: opp.slice(0, n) }; }
  return { indices: order.slice(0, Math.min(n, order.length)) };
}
function unselect(msg, ctx) {
  const me = msg.player, chosen = msg.unselect_cards.length;
  const mode = polarity(ctx.hint, msg.select_cards.length ? msg.select_cards : msg.unselect_cards, me);
  if (msg.can_finish && (chosen >= Math.max(1, msg.min)) && (mode === "cost" || chosen >= msg.max || !msg.select_cards.length)) return { index: -1 };
  if (!msg.select_cards.length) return msg.can_finish ? { index: -1 } : null;
  const order = rank(msg.select_cards, mode, me, ctx);
  return { index: order[0] };
}
function tribute(msg, ctx) {
  const order = rank(msg.selects, "cost", msg.player, ctx);
  const out = []; let sum = 0;
  for (const i of order) { if (sum >= msg.min) break; out.push(i); sum += msg.selects[i].release_param || 1; }
  return { indices: out };
}
function position(msg, ctx) {
  const { db } = ctx, c = db.get(msg.code) || {};
  const { theirs } = sides(ctx, msg.player);
  const atk = c.atk > 0 ? c.atk : 0, def = c.def > 0 ? c.def : 0;
  const threat = oppBestAttack(theirs);
  const wantAttack = !monsters(theirs).length || atk > threat || (atk >= def && atk >= threat);
  const order = wantAttack ? [POS_FACEUP_ATTACK, POS_FACEUP_DEFENSE, POS_FACEDOWN_DEFENSE, POS_FACEDOWN_ATTACK]
    : [POS_FACEUP_DEFENSE, POS_FACEDOWN_DEFENSE, POS_FACEUP_ATTACK, POS_FACEDOWN_ATTACK];
  for (const p of order) if (msg.positions & p) return { position: p };
  return { position: msg.positions };
}
function place(msg, ctx) {
  const free = placesFromMask(msg.field_mask, msg.player);
  const own = free.filter((p) => p.player === msg.player), opp = free.filter((p) => p.player !== msg.player);
  let pool = msg.type === MSG.SELECT_DISFIELD ? (opp.length ? opp : free) : (own.length ? own : free);
  // Prefer the middle Main Monster Zones; they connect to more Link arrows.
  pool = pool.slice().sort((a, b) => Math.abs(2 - (a.sequence ?? 2)) - Math.abs(2 - (b.sequence ?? 2)));
  return { places: pool.slice(0, msg.count) };
}

// ---------------------------------------------------------------------------
/** Keep track of what just happened (attacks), from every update the bot's seat receives. */
export function observe(packet, mem) {
  if (!packet || !packet.events) return;
  for (const e of packet.events) {
    if (e.type === MSG.ATTACK) mem.attack = { by: e.card ? e.card.controller : -1, turn: packet.turn };
    else if (e.type === MSG.ATTACK_DISABLED || e.type === MSG.DAMAGE_STEP_END || e.type === MSG.NEW_PHASE || e.type === MSG.NEW_TURN) mem.attack = null;
  }
}

export function smartAnswer(msg, ctx) {
  ctx.mem = ctx.mem || {};
  let r = null;
  switch (msg.type) {
    case MSG.SELECT_IDLECMD: r = idle(msg, ctx); break;
    case MSG.SELECT_BATTLECMD: r = battle(msg, ctx); break;
    case MSG.SELECT_CHAIN: r = chain(msg, ctx); break;
    case MSG.SELECT_EFFECTYN: r = { yes: true }; break;
    case MSG.SELECT_YESNO: r = { yes: true }; break;
    case MSG.SELECT_OPTION: r = { index: 0 }; break;
    case MSG.SELECT_CARD: r = selectCard(msg, ctx); break;
    case MSG.SELECT_UNSELECT_CARD: r = unselect(msg, ctx); break;
    case MSG.SELECT_TRIBUTE: r = tribute(msg, ctx); break;
    case MSG.SELECT_POSITION: r = position(msg, ctx); break;
    case MSG.SELECT_PLACE: case MSG.SELECT_DISFIELD: r = place(msg, ctx); break;
    case MSG.SELECT_SUM: r = { indices: findSum(msg) || [] }; break;
    default: return null;
  }
  return r ? { t: msg.type, ...r } : null;
}
