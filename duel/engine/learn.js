// Synapse AI learning: playbooks of lines (turn plans), picks and responses, learned from players' duels,
// from the deck itself (explore.js) and shared online. Environment-agnostic: used by the duel worker,
// the learning worker, the Cloudflare Worker (server/duel-book.js) and the tests.
//
// A playbook ("book") belongs to a deck profile and looks like:
//   { v, key, codes:[unique card codes], arche:[archetype ids],
//     lines:  [{ steps:[{a,c,l,d}], start:[codes], first:bool, score, n, w, src:"you"|"online"|"search" }],
//     picks:  { "<card resolving>|<hint>": { "<code picked>": count } },
//     chains: { "<what the opponent did>": { "<code chained>": count } } }
// Steps are main-phase actions: a = IDLE action, c = card code, l = location, d = effect description.
import { MSG, IDLE, TYPE, LOCATION_MZONE, LOCATION_SZONE, LOCATION_HAND, POS_FACEUP, POS_DEFENSE } from "./constants.js";

export const BOOK_VERSION = 1;
export const LIMITS = { lines: 60, steps: 32, start: 12, picks: 500, chains: 250, perKey: 12, codes: 120 };
const ACTION_LIST = { [IDLE.SUMMON]: "summons", [IDLE.SPSUMMON]: "special_summons", [IDLE.REPOS]: "pos_changes", [IDLE.MSET]: "monster_sets",
  [IDLE.SSET]: "spell_sets", [IDLE.ACTIVATE]: "activates" };

// ---------------------------------------------------------------------------
// Deck profiles and similarity
function hashCodes(codes) {
  let h = 2166136261 >>> 0;
  for (const c of codes) { h ^= c; h = Math.imul(h, 16777619) >>> 0; h ^= c >>> 16; h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}
/** Unique card list, main archetypes and a stable key for a deck ({main, extra}). */
export function deckProfile(deck, db) {
  const all = [...(deck.main || []), ...(deck.extra || [])].map(Number).filter(Boolean);
  const codes = [...new Set(all)].sort((a, b) => a - b).slice(0, LIMITS.codes);
  const count = new Map();
  if (db) for (const code of deck.main || []) {
    const c = db.get(code);
    for (const s of (c && c.setcodes) || []) { const base = s & 0xfff; count.set(base, (count.get(base) || 0) + 1); }
  }
  const arche = [...count.entries()].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);
  return { key: hashCodes(codes), codes, arche };
}
/** 0..1: how alike two decks are (shared cards, plus a bonus for the same main archetype). */
export function similarity(a, b) {
  if (!a || !b) return 0;
  if (a.key && a.key === b.key) return 1;
  const A = new Set(a.codes || []), B = b.codes || [];
  let inter = 0; for (const c of B) if (A.has(c)) inter++;
  const union = A.size + B.length - inter;
  let s = union ? inter / union : 0;
  if ((a.arche || [])[0] != null && (a.arche || [])[0] === (b.arche || [])[0]) s = Math.min(1, s + 0.25);
  return s;
}
/** Shard name for the online store: the deck's main archetype. */
export const shardOf = (profile) => (profile.arche && profile.arche.length ? "a" + profile.arche[0].toString(16) : "misc");

// ---------------------------------------------------------------------------
// Board evaluation (how good a position is for `me`), shared by line scoring and the combo search.
export function boardScore(view, me, db) {
  if (!view || !view.state) return 0;
  const T = view.state.teams, mine = T[me], theirs = T[1 - me];
  const side = (t, own) => {
    let v = 0;
    (t.mzone || []).forEach((c) => {
      if (!c) return;
      if (c.hidden || !(c.position & POS_FACEUP)) { v += 900; return; }
      const d = db ? db.get(c.code) : null, txt = d && d.desc ? d.desc : "";
      v += Math.max(c.attack || 0, (c.position & POS_DEFENSE ? c.defense || 0 : 0)) + 300;
      if (d && d.type & (TYPE.FUSION | TYPE.SYNCHRO | TYPE.XYZ | TYPE.LINK)) v += 500;
      if (/\bnegate\b/i.test(txt)) v += 1200;
      if (/\(quick effect\)/i.test(txt)) v += 400;
      if (c.overlays && c.overlays.length) v += 200 * c.overlays.length;
    });
    (t.szone || []).forEach((c, i) => {
      if (!c) return;
      if (c.hidden || !(c.position & POS_FACEUP)) {
        // Own set cards are known: only traps and Quick-Play spells threaten anything face-down.
        const d = own && c.code && db ? db.get(c.code) : null;
        v += d ? (d.type & TYPE.TRAP || d.type & TYPE.QUICKPLAY ? 650 : 150) : 650;
      } else v += i === 5 ? 700 : 500;
    });
    if (own) {
      v += (t.hand || []).filter(Boolean).length * 250;
      for (const c of t.hand || []) if (c && c.code && db) { const d = db.get(c.code); if (d && /\(quick effect\)[^.]*discard this card|discard this card[^.]*\(quick effect\)/i.test(d.desc || "")) v += 700; }
      v += Math.min(10, (t.grave || []).length) * 40;
    }
    return v;
  };
  return side(mine, true) - side(theirs, false) + ((mine.lp || 0) - (theirs.lp || 0)) / 4;
}

// ---------------------------------------------------------------------------
// Books
export function emptyBook(profile) { return { v: BOOK_VERSION, key: profile.key, codes: profile.codes, arche: profile.arche, lines: [], picks: {}, chains: {} }; }
const stepKey = (s) => `${s.a}:${s.c}:${s.d || ""}`;
const lineKey = (l) => l.steps.map(stepKey).join(">");
const bump = (table, key, code, n = 1) => { const t = table[key] || (table[key] = {}); t[code] = (t[code] || 0) + n; };

/** Adds `add` into `base` (both books). Lines with the same steps merge; counts add up. */
export function mergeBooks(base, add, weight = 1) {
  if (!add) return base;
  const byKey = new Map(base.lines.map((l) => [lineKey(l), l]));
  for (const l of add.lines || []) {
    const k = lineKey(l), have = byKey.get(k);
    if (have) { have.n += (l.n || 1) * weight; have.w = Math.max(have.w || 1, l.w || 1); have.score = Math.max(have.score, l.score || 0); if (l.src === "you") have.src = "you"; }
    else { const nl = { ...l, n: (l.n || 1) * weight }; base.lines.push(nl); byKey.set(k, nl); }
  }
  for (const [k, t] of Object.entries(add.picks || {})) for (const [c, n] of Object.entries(t)) bump(base.picks, k, c, n * weight);
  for (const [k, t] of Object.entries(add.chains || {})) for (const [c, n] of Object.entries(t)) bump(base.chains, k, c, n * weight);
  return compactBook(base);
}
/** Keeps a book inside the size limits, dropping the weakest entries. */
export function compactBook(b) {
  const rank = (l) => (l.score || 0) * (l.w || 1) + 600 * Math.log2(1 + (l.n || 1)) + (l.src === "you" ? 500 : 0);
  b.lines = b.lines.filter((l) => l.steps && l.steps.length).sort((x, y) => rank(y) - rank(x)).slice(0, LIMITS.lines);
  const trim = (table, max) => {
    const keys = Object.keys(table);
    if (keys.length > max) keys.map((k) => [k, Object.values(table[k]).reduce((s, n) => s + n, 0)]).sort((a, c) => a[1] - c[1]).slice(0, keys.length - max).forEach(([k]) => delete table[k]);
    for (const k of Object.keys(table)) {
      const e = Object.entries(table[k]).sort((a, c) => c[1] - a[1]).slice(0, LIMITS.perKey);
      table[k] = Object.fromEntries(e);
    }
  };
  trim(b.picks, LIMITS.picks); trim(b.chains, LIMITS.chains);
  return b;
}
/** Validates untrusted book data (from the network or storage) into a clean book, or null. */
export function sanitizeBook(raw) {
  if (!raw || typeof raw !== "object") return null;
  const int = (x) => (Number.isInteger(x) && x >= 0 && x < 2 ** 32 ? x : null);
  const codes = Array.isArray(raw.codes) ? raw.codes.map(int).filter((x) => x).slice(0, LIMITS.codes) : [];
  const arche = Array.isArray(raw.arche) ? raw.arche.map(int).filter((x) => x != null).slice(0, 3) : [];
  const out = { v: BOOK_VERSION, key: typeof raw.key === "string" ? raw.key.slice(0, 16).replace(/[^a-z0-9]/g, "") : "", codes, arche, lines: [], picks: {}, chains: {} };
  for (const l of Array.isArray(raw.lines) ? raw.lines.slice(0, LIMITS.lines * 2) : []) {
    if (!l || !Array.isArray(l.steps)) continue;
    const steps = l.steps.slice(0, LIMITS.steps).map((s) => ({ a: int(s && s.a), c: int(s && s.c), l: int(s && s.l) ?? 0, d: typeof (s && s.d) === "string" && /^\d{1,20}$/.test(s.d) ? s.d : undefined }))
      .filter((s) => s.a != null && s.a <= IDLE.ACTIVATE && s.c);
    if (!steps.length) continue;
    out.lines.push({ steps, start: Array.isArray(l.start) ? l.start.map(int).filter((x) => x).slice(0, LIMITS.start) : [], first: !!l.first,
      score: Number.isFinite(l.score) ? Math.max(-1e5, Math.min(1e5, l.score)) : 0, n: Number.isFinite(l.n) ? Math.max(1, Math.min(1e6, l.n)) : 1,
      w: Number.isFinite(l.w) ? Math.max(1, Math.min(3, l.w)) : 1, src: ["you", "online", "search"].includes(l.src) ? l.src : "online" });
  }
  const table = (t, max) => {
    const o = {};
    if (!t || typeof t !== "object") return o;
    for (const k of Object.keys(t).slice(0, max)) {
      if (!/^[\w:|*.-]{1,40}$/.test(k) || !t[k] || typeof t[k] !== "object") continue;
      const e = {};
      for (const c of Object.keys(t[k]).slice(0, LIMITS.perKey)) { const n = Number(t[k][c]); if (/^\d{1,10}$/.test(c) && Number.isFinite(n) && n > 0) e[c] = Math.min(n, 1e6); }
      if (Object.keys(e).length) o[k] = e;
    }
    return o;
  };
  out.picks = table(raw.picks, LIMITS.picks);
  out.chains = table(raw.chains, LIMITS.chains);
  return compactBook(out);
}

// ---------------------------------------------------------------------------
// Recording a player's decisions
/** Watches one seat (a human player) and turns their decisions into a book fragment. */
export class Recorder {
  constructor({ db, team, deck }) {
    this.db = db; this.team = team; this.profile = deckProfile(deck, db);
    this.book = emptyBook(this.profile);
    this.cur = null; this.ctxCode = 0; this.trigger = null; this.lastView = null; this.turn = 0; this.firstSeat = team === 0;
  }
  /** Every update packet this seat receives. */
  observe(packet) {
    if (!packet) return;
    if (packet.state) this.lastView = packet;
    for (const e of packet.events || []) {
      if (e.type === MSG.NEW_TURN) { this.closeLine(); this.turn++; this.trigger = null; }
      else if (e.type === MSG.CHAINING) { if (e.controller != null && e.controller !== this.team) this.trigger = "c:" + e.code; else if (e.controller === this.team) this.ctxCode = e.code; }
      else if ((e.type === MSG.SUMMONING || e.type === MSG.SPSUMMONING) && e.controller != null && e.controller !== this.team) this.trigger = "s:" + (e.code || 0);
      else if (e.type === MSG.ATTACK && e.card && e.card.controller !== this.team) this.trigger = "a";
      else if (e.type === MSG.CHAIN_END) this.trigger = null;
    }
  }
  /** The player answered `msg` with `ans` (hint = selection hint for card prompts). */
  answer(msg, ans, hint) {
    if (!msg || !ans || msg.player !== this.team) return;
    const v = this.lastView;
    if (msg.type === MSG.SELECT_IDLECMD && ans.action <= IDLE.ACTIVATE) {
      const list = msg[ACTION_LIST[ans.action]] || [], o = list[ans.index];
      if (!o || !o.code) return;
      if (!this.cur) {
        const hand = v && v.state ? (v.state.teams[this.team].hand || []).filter((c) => c && c.code).map((c) => c.code) : [];
        this.cur = { steps: [], start: [...new Set(hand)].slice(0, LIMITS.start), first: this.firstSeat && v && v.turn <= 1, src: "you", n: 1, w: 1,
          base: v ? boardScore(v, this.team, this.db) : 0 };
      }
      if (this.cur.steps.length < LIMITS.steps) this.cur.steps.push({ a: ans.action, c: o.code, l: o.location || 0, d: o.description && o.description !== "0" ? o.description : undefined });
      this.ctxCode = o.code;
    } else if ((msg.type === MSG.SELECT_CARD || msg.type === MSG.SELECT_TRIBUTE) && Array.isArray(ans.indices)) {
      for (const i of ans.indices) { const s = msg.selects[i]; if (s && s.code && s.controller === this.team) bump(this.book.picks, `${this.ctxCode || "*"}|${hint || 0}`, s.code); }
    } else if (msg.type === MSG.SELECT_UNSELECT_CARD && ans.index >= 0) {
      const s = msg.select_cards[ans.index]; if (s && s.code && s.controller === this.team) bump(this.book.picks, `${this.ctxCode || "*"}|${hint || 0}`, s.code);
    } else if (msg.type === MSG.SELECT_CHAIN && ans.index != null && !msg.forced) {
      const s = msg.selects[ans.index];
      if (s && s.code && this.trigger) bump(this.book.chains, this.trigger, s.code);
      if (s && s.code) this.ctxCode = s.code;
    }
  }
  closeLine() {
    const l = this.cur; this.cur = null;
    if (!l || !l.steps.length) return;
    const after = this.lastView ? boardScore(this.lastView, this.team, this.db) : 0;
    l.score = Math.round(after - l.base); delete l.base;
    // Lines that set up nothing aren't worth replaying.
    if (l.steps.length >= 2 || l.score > 1500) this.book.lines.push(l);
  }
  /** Ends the duel; winners' lines count double. Returns the book fragment (or null if nothing was learned). */
  finish(won) {
    this.closeLine();
    if (won) for (const l of this.book.lines) l.w = 2;
    const b = compactBook(this.book);
    return b.lines.length || Object.keys(b.picks).length || Object.keys(b.chains).length ? b : null;
  }
}

// ---------------------------------------------------------------------------
// Using a book during a duel
export class Advisor {
  constructor(book, { similarity: sim = 1 } = {}) { this.book = book; this.sim = sim; }
  get size() { return this.book ? this.book.lines.length : 0; }
  static find(msg, step) {
    const list = msg[ACTION_LIST[step.a]] || [];
    let best = -1;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o.code !== step.c) continue;
      if (step.a === IDLE.ACTIVATE && step.d && o.description === step.d) return i;
      if (best < 0) best = i;
    }
    return best;
  }
  /** Main-phase advice: the next step of the best line that still fits the game, or null. */
  idle(msg, mem, view) {
    if (!this.book || !this.book.lines.length) return null;
    const turn = view ? view.turn : 0;
    if (mem.lineTurn !== turn) { mem.lineTurn = turn; mem.line = null; mem.step = 0; mem.tried = new Set(); }
    if (!mem.line) {
      const handCodes = new Set(view && view.state ? (view.state.teams[msg.player].hand || []).filter((c) => c && c.code).map((c) => c.code) : []);
      let best = null, bestScore = -Infinity;
      for (const l of this.book.lines) {
        if (mem.tried.has(l)) continue;
        if (Advisor.find(msg, l.steps[0]) < 0) continue;
        const startHit = l.start && l.start.length ? l.start.filter((c) => handCodes.has(c)).length / l.start.length : 0.5;
        const s = (l.score || 0) * (l.w || 1) + 700 * Math.log2(1 + (l.n || 1)) + 1500 * startHit + (l.src === "you" ? 800 : l.src === "search" ? 300 : 0)
          + (l.first && turn <= 1 ? 400 : 0);
        if (s > bestScore) { bestScore = s; best = l; }
      }
      if (!best || bestScore < 600) return null;
      mem.line = best; mem.step = 0; mem.tried.add(best);
    }
    const steps = mem.line.steps;
    for (let j = mem.step; j < Math.min(steps.length, mem.step + 3); j++) {
      const i = Advisor.find(msg, steps[j]);
      if (i >= 0) { mem.step = j + 1; if (mem.step >= steps.length) mem.done = true; return { action: steps[j].a, index: i, code: steps[j].c, line: true }; }
    }
    mem.line = null; // the line no longer fits; let the heuristics take over
    return null;
  }
  /** Ordered indices of `options` (cards) by how often players picked them in this spot, or null. */
  pick(options, hint, ctxCode, me) {
    if (!this.book) return null;
    const t = this.book.picks[`${ctxCode || "*"}|${hint || 0}`] || (ctxCode ? null : null);
    if (!t) return null;
    const scored = options.map((o, i) => ({ i, n: o.controller === me ? t[o.code] || 0 : 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
    return scored.length ? scored.map((x) => x.i) : null;
  }
  /** Index into SELECT_CHAIN `selects` that players used against this trigger, or -1. */
  chain(selects, trigger) {
    if (!this.book || !trigger) return -1;
    const t = this.book.chains[trigger] || (trigger.startsWith("c:") || trigger.startsWith("s:") ? null : null);
    if (!t) return -1;
    let best = -1, n = 0;
    selects.forEach((s, i) => { const k = t[s.code] || 0; if (k > n) { n = k; best = i; } });
    return best;
  }
}

/** Books are kept per exact deck; this merges the ones that resemble `profile` into one book for play. */
export function bookFor(profile, books, minSim = 0.45) {
  const out = emptyBook(profile);
  const scored = (books || []).map((b) => ({ b, s: similarity(profile, b) })).filter((x) => x.s >= minSim).sort((a, b) => b.s - a.s).slice(0, 6);
  for (const { b, s } of scored) mergeBooks(out, b, s);
  return { book: out, similarity: scored.length ? scored[0].s : 0, sources: scored.length };
}
