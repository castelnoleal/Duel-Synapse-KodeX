// Helpers shared by the UI and the bot for building valid answers.
import { OPCODE, TYPE, LOCATION_MZONE, LOCATION_SZONE } from "./constants.js";

const CARD_MARINE_DOLPHIN = 78734254, CARD_TWINKLE_MOSS = 13857930;

/** Port of ygopro-core's is_declarable(): does card `c` satisfy the ANNOUNCE_CARD filter? */
export function isDeclarable(c, opcodes) {
  if (!c) return false;
  const st = [];
  let alias = false, token = false;
  const b = (f) => { if (st.length >= 2) { const r = st.pop(), l = st.pop(); st.push(f(l, r)); } };
  const u = (f) => { if (st.length >= 1) st.push(f(st.pop())); };
  const I = (x) => BigInt.asIntN(64, BigInt(x));
  for (const raw of opcodes) {
    const op = BigInt(raw);
    switch (op) {
      case OPCODE.ADD: b((l, r) => l + r); break;
      case OPCODE.SUB: b((l, r) => l - r); break;
      case OPCODE.MUL: b((l, r) => l * r); break;
      case OPCODE.DIV: b((l, r) => (r === 0n ? 0n : l / r)); break;
      case OPCODE.AND: b((l, r) => (l && r ? 1n : 0n)); break;
      case OPCODE.OR: b((l, r) => (l || r ? 1n : 0n)); break;
      case OPCODE.NEG: u((v) => -v); break;
      case OPCODE.NOT: u((v) => (v ? 0n : 1n)); break;
      case OPCODE.BAND: b((l, r) => l & r); break;
      case OPCODE.BOR: b((l, r) => l | r); break;
      case OPCODE.BXOR: b((l, r) => l ^ r); break;
      case OPCODE.BNOT: u((v) => ~v); break;
      case OPCODE.LSHIFT: b((l, r) => I(l << r)); break;
      case OPCODE.RSHIFT: b((l, r) => l >> r); break;
      case OPCODE.ISCODE: u((v) => (BigInt(c.code) === BigInt.asUintN(32, v) ? 1n : 0n)); break;
      case OPCODE.ISTYPE: u((v) => BigInt(c.type) & v); break;
      case OPCODE.ISRACE: u((v) => BigInt(c.race) & v); break;
      case OPCODE.ISATTRIBUTE: u((v) => BigInt(c.attribute) & v); break;
      case OPCODE.GETCODE: st.push(BigInt(c.code)); break;
      case OPCODE.GETTYPE: st.push(BigInt(c.type)); break;
      case OPCODE.GETRACE: st.push(BigInt(c.race)); break;
      case OPCODE.GETATTRIBUTE: st.push(BigInt(c.attribute)); break;
      case OPCODE.ISSETCARD: if (st.length >= 1) {
        const sc = Number(BigInt.asIntN(32, st.pop()));
        const t = sc & 0xfff, sub = sc & 0xf000;
        st.push((c.setcodes || []).some((s) => (s & 0xfff) === t && (s & 0xf000 & sub) === sub) ? 1n : 0n);
      } break;
      case OPCODE.ALLOW_ALIASES: alias = true; break;
      case OPCODE.ALLOW_TOKENS: token = true; break;
      default: st.push(I(op));
    }
  }
  if (st.length !== 1 || st[0] === 0n) return false;
  return c.code === CARD_MARINE_DOLPHIN || c.code === CARD_TWINKLE_MOSS ||
    ((alias || !c.alias) && (token || (c.type & (TYPE.MONSTER | TYPE.TOKEN)) !== (TYPE.MONSTER | TYPE.TOKEN)));
}

/** Free zones in a SELECT_PLACE/DISFIELD mask, as {player, location, sequence} (absolute player). */
export function placesFromMask(mask, player) {
  const out = [];
  for (const [rel, shift] of [[0, 0], [1, 16]]) {
    const p = rel === 0 ? player : 1 - player;
    for (let s = 0; s < 7; s++) if (!(mask & (1 << (shift + s)))) out.push({ player: p, location: LOCATION_MZONE, sequence: s });
    for (let s = 0; s < 8; s++) if (!((mask >>> 0) & ((1 << (shift + 8 + s)) >>> 0))) out.push({ player: p, location: LOCATION_SZONE, sequence: s });
  }
  return out;
}

/** Possible values contributed by a SELECT_SUM card (two encodings packed in 16-bit halves). */
export function sumValues(amount) {
  const lo = amount & 0xffff, hi = (amount >>> 16) & 0xffff;
  return hi && hi !== lo ? [lo, hi] : [lo];
}

/** Check a SELECT_SUM choice (indices into msg.selects), mirroring ygopro-core exactly. */
export function sumValid(msg, idx) {
  if (new Set(idx).size !== idx.length) return false;
  const params = [...msg.selects_must.map((c) => c.amount), ...idx.map((i) => msg.selects[i].amount)];
  const acc = msg.amount;
  if (!msg.select_max) {
    if (idx.length < msg.min || idx.length > msg.max) return false;
    const check = (k, left) => {
      if (left === 0 || k === params.length) return false;
      const o1 = params[k] & 0xffff, o2 = params[k] >>> 16;
      if (k === params.length - 1) return left === o1 || left === o2;
      return (left > o1 && check(k + 1, left - o1)) || (o2 > 0 && left > o2 && check(k + 1, left - o2));
    };
    return check(0, acc);
  }
  if (!params.length) return false;
  let sum = 0, mx = 0, mn = 0x7fffffff;
  for (const op of params) {
    const o1 = op & 0xffff, o2 = op >>> 16;
    const ms = o2 && o2 < o1 ? o2 : o1;
    sum += ms; mx += o2 > o1 ? o2 : o1; if (ms < mn) mn = ms;
  }
  return !(mx < acc || sum - mn >= acc);
}

/** Find any valid SELECT_SUM subset (for the bot / auto-pick). */
export function findSum(msg) {
  const n = msg.selects.length;
  const pick = [];
  const dfs = (i) => {
    if (sumValid(msg, pick)) return true;
    if (i >= n || pick.length >= Math.max(msg.max || n, 1)) return false;
    pick.push(i);
    if (dfs(i + 1)) return true;
    pick.pop();
    return dfs(i + 1);
  };
  return dfs(0) ? pick : null;
}
