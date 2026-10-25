// Synapse AI learning: turns real plays into a "play book" the AI can follow.
//
// A play is a token: action letter + card code (+ effect index for activations)
//   S = Normal Summon, P = Special Summon (procedure), M = set monster, T = set Spell/Trap,
//   A = activate from the idle menu, C = activate in a chain (triggers, quick effects).
// The book keeps three kinds of counts:
//   seq  : after plays (p2, p1) in the same turn, the player made play `next`  (combo lines)
//   pick : when card `src` asked for a choice with hint `hint` and card `code` was offered, how often it was chosen
//   resp : when the opponent played card `trig` (0 = declared an attack), the player answered with `code`
// Plays from people count 1, the AI's own practice games count less, so people's lines win.
import { MSG, IDLE, BATTLE_ACT, LOCATION_MZONE, LOCATION_SZONE, LOCATION_HAND, POS_FACEUP, POS_DEFENSE } from "./constants.js";

export const WEIGHT = { human: 1, selfplay: 0.35 };
const MAX_KEYS = 30000;

export function effectIndex(code, desc) {
  if (desc == null) return 0;
  try { const v = BigInt(desc); return Number(v >> 20n) === Number(code) ? Number(v & 0xfffffn) : 0; } catch { return 0; }
}
export const codeOf = (token) => (token ? Number(String(token).slice(1).split(".")[0]) : 0);

/** Token for an answer to SELECT_IDLECMD, or null for phase moves and repositions. */
export function idleToken(msg, ans) {
  const pickFrom = (arr, letter, withDesc) => { const c = arr[ans.index]; return c ? letter + c.code + (withDesc ? "." + effectIndex(c.code, c.description) : "") : null; };
  switch (ans.action) {
    case IDLE.SUMMON: return pickFrom(msg.summons, "S");
    case IDLE.SPSUMMON: return pickFrom(msg.special_summons, "P");
    case IDLE.MSET: return pickFrom(msg.monster_sets, "M");
    case IDLE.SSET: return pickFrom(msg.spell_sets, "T");
    case IDLE.ACTIVATE: return pickFrom(msg.activates, "A", true);
  }
  return null;
}
export function chainToken(sel) { return sel ? "C" + sel.code + "." + effectIndex(sel.code, sel.description) : null; }

export class Book {
  constructor(data) {
    this.seq = (data && data.seq) || {};   // key "p2|p1" -> { next: n }
    this.pick = (data && data.pick) || {}; // key "src:hint" -> { code: [chosen, offered] }
    this.resp = (data && data.resp) || {}; // key trig -> { code: n }
  }
  static key2(p2, p1) { return (p2 || "") + "|" + (p1 || ""); }
  addSeq(p2, p1, next, w) {
    bump(this.seq, Book.key2(p2, p1), next, w);
    if (p2) bump(this.seq, Book.key2("", p1), next, w * 0.6);   // shorter context, so lines still match when the turn starts differently
  }
  addPick(src, hint, code, chosen, offered) { bump2(this.pick, `${src}:${hint || 0}`, String(code), chosen, offered); }
  addResp(trig, code, w) { bump(this.resp, String(trig || 0), String(code), w); }
  /** How strongly the book suggests `token` after (p2, p1). 0 = never seen. */
  seqScore(p2, p1, token) {
    const tri = p2 ? get(this.seq, Book.key2(p2, p1), token) : 0;
    const bi = get(this.seq, Book.key2("", p1), token);
    return tri * 2 + bi;
  }
  /** Does the book know how players choose for this card's effect? */
  knowsPick(src, hint) {
    // Enough evidence to override the AI's own judgement: about one choice by a person, or several practice results.
    const m = this.pick[`${src}:${hint || 0}`];
    if (!m) return false;
    let offered = 0; for (const v of Object.values(m)) offered = Math.max(offered, v[1]);
    return offered >= 0.9;
  }
  /** How often players chose `code` when it was offered (0..1), or null if it was never offered. */
  pickRate(src, hint, code) {
    const r = (this.pick[`${src}:${hint || 0}`] || {})[String(code)];
    return r && r[1] > 0 ? (r[0] + 0.05) / (r[1] + 0.3) : null;
  }
  respScore(trig, code) { return get(this.resp, String(trig || 0), String(code)); }
  /** Merge rows in the shared format: { seq:[[p2,p1,next,n]], pick:[[src,hint,code,n]], resp:[[trig,code,n]] }. */
  mergeRows(rows, scale = 1) {
    if (!rows) return this;
    for (const [p2, p1, nx, n] of rows.seq || []) bump(this.seq, Book.key2(p2, p1), nx, n * scale);
    for (const [src, hint, code, c, o] of rows.pick || []) bump2(this.pick, `${src}:${hint}`, String(code), c * scale, (o == null ? 1 : o) * scale);
    for (const [trig, code, n] of rows.resp || []) bump(this.resp, String(trig), String(code), n * scale);
    return this;
  }
  rows() {
    const seq = [], pick = [], resp = [];
    for (const [k, m] of Object.entries(this.seq)) { const [p2, p1] = k.split("|"); for (const [nx, n] of Object.entries(m)) seq.push([p2, p1, nx, round(n)]); }
    for (const [k, m] of Object.entries(this.pick)) { const [src, hint] = k.split(":").map(Number); for (const [c, [ch, of]] of Object.entries(m)) pick.push([src, hint, Number(c), round(ch), round(of)]); }
    for (const [k, m] of Object.entries(this.resp)) for (const [c, n] of Object.entries(m)) resp.push([Number(k), Number(c), round(n)]);
    return { seq, pick, resp };
  }
  /** Only the lines that involve these cards (what a duel with these decks can use). */
  subset(codes) {
    const has = new Set([...codes].map(Number));
    const okTok = (t) => !t || has.has(codeOf(t));
    const out = new Book();
    for (const [k, m] of Object.entries(this.seq)) { const [p2, p1] = k.split("|"); if (!okTok(p2) || !okTok(p1)) continue; for (const [nx, n] of Object.entries(m)) if (okTok(nx)) bump(out.seq, k, nx, n); }
    for (const [k, m] of Object.entries(this.pick)) if (has.has(Number(k.split(":")[0]))) out.pick[k] = Object.fromEntries(Object.entries(m).map(([c, v]) => [c, [...v]]));
    for (const [k, m] of Object.entries(this.resp)) for (const [c, n] of Object.entries(m)) if (has.has(Number(c))) bump(out.resp, k, c, n);
    return out;
  }
  size() { let n = 0; for (const t of [this.seq, this.pick, this.resp]) for (const m of Object.values(t)) n += Object.keys(m).length; return n; }
  /** Lines the book knows for these cards (shown to the player). */
  linesFor(codes) { return this.subset(codes).size(); }
  prune(max = MAX_KEYS) {
    if (this.size() <= max) return this;
    const all = [];
    for (const [name, t] of [["seq", this.seq], ["pick", this.pick], ["resp", this.resp]]) for (const [k, m] of Object.entries(t)) for (const [c, n] of Object.entries(m)) all.push([Array.isArray(n) ? n[1] : n, name, k, c]);
    all.sort((a, b) => a[0] - b[0]);
    for (const [, name, k, c] of all.slice(0, all.length - max)) { delete this[name][k][c]; if (!Object.keys(this[name][k]).length) delete this[name][k]; }
    return this;
  }
  toJSON() { return { v: 1, seq: this.seq, pick: this.pick, resp: this.resp }; }
}
function bump(t, k, c, w) { if (!w || !Number.isFinite(w)) return; const m = t[k] || (t[k] = {}); m[c] = (m[c] || 0) + w; if (Math.abs(m[c]) < 1e-6) delete m[c]; }
function bump2(t, k, c, a, b) { if (!(b > 0) || !Number.isFinite(a)) return; const m = t[k] || (t[k] = {}); const v = m[c] || (m[c] = [0, 0]); v[0] += a; v[1] += b; }
function get(t, k, c) { const m = t[k]; return m && m[c] ? m[c] : 0; }
const round = (n) => Math.round(n * 1000) / 1000;

/**
 * Watches one duel and turns each seat's plays into book rows.
 * Plays are held until the seat's turn ends, so self-play can keep only turns that improved the board.
 */
export class Recorder {
  constructor() { this.seats = [this.fresh(), this.fresh()]; this.out = { seq: [], pick: [], resp: [] }; }
  fresh() { return { turn: -1, seq: [], last: 0, pending: { seq: [], pick: [], resp: [] }, start: null }; }
  /** Call with every packet a seat receives (keeps turn boundaries and attack state). */
  observe(seat, packet, weightForTurn) {
    if (!packet) return;
    const s = this.seats[seat];
    if (packet.turn !== s.turn) { this.commit(seat, weightForTurn ? weightForTurn(seat, s, packet) : 1); s.turn = packet.turn; s.seq = []; s.start = boardValue(packet, seat); }
    for (const e of packet.events || []) {
      if (e.type === MSG.ATTACK) s.attackBy = e.card ? e.card.controller : -1;
      else if (e.type === MSG.ATTACK_DISABLED || e.type === MSG.DAMAGE_STEP_END || e.type === MSG.NEW_PHASE) s.attackBy = null;
    }
    s.view = packet;
  }
  /** Record a seat's answer to a prompt. */
  answer(seat, msg, ans, hint) {
    const s = this.seats[seat], v = s.view, P = s.pending;
    const myTurn = v ? v.turnPlayer === seat : false;
    const push = (tok) => { if (!tok) return; const n = s.seq.length; P.seq.push([n > 1 ? s.seq[n - 2] : "", n ? s.seq[n - 1] : "", tok]); s.seq.push(tok); s.last = codeOf(tok); };
    switch (msg.type) {
      case MSG.SELECT_IDLECMD: push(idleToken(msg, ans)); break;
      case MSG.SELECT_BATTLECMD: if (ans.action === BATTLE_ACT.ACTIVATE && msg.chains[ans.index]) push(chainToken(msg.chains[ans.index])); break;
      case MSG.SELECT_CHAIN: {
        if (ans.index == null || !msg.selects[ans.index]) break;
        const sel = msg.selects[ans.index], ch = v && v.state ? v.state.chain || [] : [], top = ch.length ? ch[ch.length - 1] : null;
        if (top && top.controller !== seat) P.resp.push([top.code, sel.code]);
        else if (!top && s.attackBy != null && s.attackBy !== seat) P.resp.push([0, sel.code]);
        if (myTurn) push(chainToken(sel)); else s.last = sel.code;
        break;
      }
      case MSG.SELECT_EFFECTYN: if (ans.yes && msg.code) { if (myTurn) push("C" + msg.code + "." + effectIndex(msg.code, msg.description)); else s.last = msg.code; } break;
      case MSG.SELECT_CARD: case MSG.SELECT_TRIBUTE: case MSG.SELECT_SUM: {
        const chosen = new Set(ans.indices || []);
        this.prefer(seat, Number(hint || 0), msg.selects, (_, i) => chosen.has(i));
        break;
      }
      case MSG.SELECT_UNSELECT_CARD: {
        if (ans.index >= 0) this.prefer(seat, Number(hint || 0), msg.select_cards, (_, i) => i === ans.index);
        break;
      }
    }
  }
  /** "Chose these over those": chosen cards gain, the cards passed over lose a little (so it learns preferences, not popularity). */
  prefer(seat, hint, cards, isChosen) {
    const src = this.source(seat), P = this.seats[seat].pending;
    if (!src || !cards || !cards.length) return;
    const pick = new Set(), offered = new Set();
    cards.forEach((c, i) => { if (c && c.code) { offered.add(c.code); if (isChosen(c, i)) pick.add(c.code); } });
    if (!pick.size) return;
    for (const c of offered) P.pick.push([src, hint, c, pick.has(c) ? 1 : 0]);
  }
  source(seat) {
    const s = this.seats[seat], v = s.view, ch = v && v.state ? v.state.chain || [] : [];
    const top = ch.length ? ch[ch.length - 1] : null;
    return top && top.controller === seat && top.code ? top.code : s.last;
  }
  commit(seat, w) {
    const s = this.seats[seat], P = s.pending;
    if (w > 0) {
      for (const [p2, p1, nx] of P.seq) this.out.seq.push([p2, p1, nx, w]);
      for (const [src, hint, code, chosen] of P.pick) this.out.pick.push([src, hint, code, round(w * chosen), round(w)]);
      for (const [trig, code] of P.resp) this.out.resp.push([trig, code, w]);
    }
    s.pending = { seq: [], pick: [], resp: [] };
  }
  /** Finish the duel and return everything learned (rows in the shared format). */
  flush(weightForTurn) {
    for (let seat = 0; seat < 2; seat++) this.commit(seat, weightForTurn ? weightForTurn(seat, this.seats[seat], this.seats[seat].view) : 1);
    const out = this.out; this.out = { seq: [], pick: [], resp: [] };
    return out;
  }
  take() { const out = this.out; this.out = { seq: [], pick: [], resp: [] }; return out; }
}

/** Rough board strength for a seat (used to reward practice turns that improved the position). */
export function boardValue(packet, seat) {
  if (!packet || !packet.state) return 0;
  const side = (t) => {
    let v = (t.lp || 0) / 4;
    for (const c of t.mzone || []) if (c) v += c.hidden ? 1400 : 600 + Math.max(c.attack || 0, (c.position & POS_DEFENSE ? c.defense || 0 : 0));
    v += (t.szone || []).filter(Boolean).length * 450 + (t.hand || []).filter(Boolean).length * 350;
    return v;
  };
  const t = packet.state.teams;
  return side(t[seat]) - side(t[1 - seat]);
}

/**
 * Card-text combo hints: which cards in the deck each card's text names, in quotes
 * ("add 1 \"Dark Magician\" from your Deck", "Special Summon 1 \"Blue-Eyes\" monster").
 * Returns Map(srcCode -> Set(codes it fetches or works with)).
 */
export function comboHints(db, codes) {
  const uniq = [...new Set(codes.map(Number))].filter((c) => db.get(c));
  const cards = uniq.map((c) => db.get(c));
  const out = new Map();
  for (const c of cards) {
    const names = [...String(c.desc || "").matchAll(/"([^"]{2,60})"/g)].map((m) => m[1].toLowerCase());
    if (!names.length) continue;
    const set = new Set();
    for (const d of cards) {
      if (d.code === c.code) continue;
      const n = String(d.name || "").toLowerCase();
      if (names.some((x) => n === x || n.includes(x))) set.add(d.code);
    }
    if (set.size) out.set(c.code, set);
  }
  return out;
}
