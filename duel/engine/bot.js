// Simple automatic opponents for solo playtesting.
//  - "passive": never acts unless forced (goldfish testing; you see your combos uninterrupted)
//  - "random":  plays legal moves at random (useful for stress-testing decks and the engine)
import { MSG, IDLE, BATTLE_ACT, POS_FACEUP_ATTACK, POS_FACEUP_DEFENSE, POS_FACEDOWN_DEFENSE, POS_FACEDOWN_ATTACK } from "./constants.js";
import { isDeclarable, placesFromMask, findSum } from "./rules.js";

const pick = (a, rnd) => a[Math.floor(rnd() * a.length)];

export function botAnswer(msg, { mode = "passive", db, rnd = Math.random } = {}) {
  const passive = mode === "passive";
  switch (msg.type) {
    case MSG.SELECT_IDLECMD: {
      if (!passive) {
        const opts = [];
        msg.summons.forEach((_, i) => opts.push({ action: IDLE.SUMMON, index: i }));
        msg.special_summons.forEach((_, i) => opts.push({ action: IDLE.SPSUMMON, index: i }));
        msg.monster_sets.forEach((_, i) => opts.push({ action: IDLE.MSET, index: i }));
        msg.spell_sets.forEach((_, i) => opts.push({ action: IDLE.SSET, index: i }));
        msg.activates.forEach((_, i) => opts.push({ action: IDLE.ACTIVATE, index: i }));
        if (opts.length && rnd() < 0.8) return { t: msg.type, ...pick(opts, rnd) };
        if (msg.to_bp && rnd() < 0.7) return { t: msg.type, action: IDLE.TO_BP };
      }
      if (msg.to_ep) return { t: msg.type, action: IDLE.TO_EP };
      if (msg.to_bp) return { t: msg.type, action: IDLE.TO_BP };
      if (msg.activates.length) return { t: msg.type, action: IDLE.ACTIVATE, index: 0 };
      return { t: msg.type, action: IDLE.TO_EP };
    }
    case MSG.SELECT_BATTLECMD: {
      if (!passive && msg.attacks.length && rnd() < 0.85) return { t: msg.type, action: BATTLE_ACT.ATTACK, index: Math.floor(rnd() * msg.attacks.length) };
      if (!passive && msg.chains.length && rnd() < 0.3) return { t: msg.type, action: BATTLE_ACT.ACTIVATE, index: 0 };
      if (msg.to_ep) return { t: msg.type, action: BATTLE_ACT.TO_EP };
      if (msg.to_m2) return { t: msg.type, action: BATTLE_ACT.TO_M2 };
      return { t: msg.type, action: BATTLE_ACT.ACTIVATE, index: 0 };
    }
    case MSG.SELECT_EFFECTYN:
    case MSG.SELECT_YESNO: return { t: msg.type, yes: passive ? false : rnd() < 0.6 };
    case MSG.SELECT_OPTION: return { t: msg.type, index: passive ? 0 : Math.floor(rnd() * msg.options.length) };
    case MSG.SELECT_CARD: {
      const n = Math.max(1, msg.min);
      const idx = [...msg.selects.keys()];
      if (!passive) idx.sort(() => rnd() - 0.5);
      return { t: msg.type, indices: idx.slice(0, Math.min(n, idx.length)) };
    }
    case MSG.SELECT_TRIBUTE: {
      const idx = [...msg.selects.keys()];
      if (!passive) idx.sort(() => rnd() - 0.5);
      const out = []; let sum = 0;
      for (const i of idx) { if (sum >= msg.min) break; out.push(i); sum += msg.selects[i].release_param || 1; }
      return { t: msg.type, indices: out };
    }
    case MSG.SELECT_UNSELECT_CARD: {
      if (msg.can_finish && (passive || rnd() < 0.5)) return { t: msg.type, index: -1 };
      if (msg.select_cards.length) return { t: msg.type, index: passive ? 0 : Math.floor(rnd() * msg.select_cards.length) };
      return { t: msg.type, index: msg.select_cards.length + 0 };
    }
    case MSG.SELECT_CHAIN: {
      if (msg.forced) return { t: msg.type, index: 0 };
      if (!passive && msg.selects.length && rnd() < 0.5) return { t: msg.type, index: Math.floor(rnd() * msg.selects.length) };
      return { t: msg.type, index: null };
    }
    case MSG.SELECT_PLACE:
    case MSG.SELECT_DISFIELD: {
      const free = placesFromMask(msg.field_mask, msg.player);
      const own = free.filter((p) => p.player === msg.player);
      const pool = msg.type === MSG.SELECT_DISFIELD ? (free.filter((p) => p.player !== msg.player).length ? free.filter((p) => p.player !== msg.player) : free) : (own.length ? own : free);
      const out = [];
      for (let i = 0; i < msg.count && pool.length; i++) out.push(pool.splice(passive ? 0 : Math.floor(rnd() * pool.length), 1)[0]);
      return { t: msg.type, places: out };
    }
    case MSG.SELECT_POSITION: {
      for (const p of [POS_FACEUP_ATTACK, POS_FACEUP_DEFENSE, POS_FACEDOWN_DEFENSE, POS_FACEDOWN_ATTACK]) if (msg.positions & p) return { t: msg.type, position: p };
      return { t: msg.type, position: msg.positions };
    }
    case MSG.SORT_CHAIN:
    case MSG.SORT_CARD: return { t: msg.type, order: null };
    case MSG.SELECT_COUNTER: {
      let left = msg.count;
      const counters = msg.cards.map((c) => { const n = Math.min(c.count, left); left -= n; return n; });
      return { t: msg.type, counters };
    }
    case MSG.SELECT_SUM: return { t: msg.type, indices: findSum(msg) || [] };
    case MSG.ANNOUNCE_RACE:
    case MSG.ANNOUNCE_ATTRIB: {
      const avail = BigInt(msg.available);
      let v = 0n, n = 0;
      for (let i = 0n; i < 64n && n < msg.count; i++) if (avail & (1n << i)) { v |= 1n << i; n++; }
      return { t: msg.type, value: msg.type === MSG.ANNOUNCE_ATTRIB ? Number(v) : v.toString() };
    }
    case MSG.ANNOUNCE_CARD: {
      if (db) for (const code of Object.keys(db.raw)) { const c = db.get(code); if (isDeclarable(c, msg.opcodes)) return { t: msg.type, code: c.code }; }
      return { t: msg.type, code: 0 };
    }
    case MSG.ANNOUNCE_NUMBER: return { t: msg.type, index: 0 };
    case MSG.ROCK_PAPER_SCISSORS: return { t: msg.type, value: 1 + Math.floor(rnd() * 3) };
  }
  return null;
}
