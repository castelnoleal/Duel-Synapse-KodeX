// Duel host: drives ocgcore and produces a filtered view for each viewer
// (team 0, team 1, spectators = 2). Environment-agnostic: runs in a Web Worker
// in the host's browser today, and can run inside a Durable Object unchanged.
import * as C from "./constants.js";
import { encodeResponse } from "./core.js";

const M = C.MSG;
const Q_FLAGS = C.QUERY_CODE | C.QUERY_POSITION | C.QUERY_ALIAS | C.QUERY_TYPE | C.QUERY_LEVEL | C.QUERY_RANK |
  C.QUERY_ATTRIBUTE | C.QUERY_RACE | C.QUERY_ATTACK | C.QUERY_DEFENSE | C.QUERY_BASE_ATTACK | C.QUERY_BASE_DEFENSE |
  C.QUERY_EQUIP_CARD | C.QUERY_TARGET_CARD | C.QUERY_OVERLAY_CARD | C.QUERY_COUNTERS | C.QUERY_OWNER | C.QUERY_STATUS |
  C.QUERY_IS_PUBLIC | C.QUERY_LSCALE | C.QUERY_RSCALE | C.QUERY_LINK | C.QUERY_IS_HIDDEN;
const LOCS = [["hand", C.LOCATION_HAND], ["mzone", C.LOCATION_MZONE], ["szone", C.LOCATION_SZONE],
  ["grave", C.LOCATION_GRAVE], ["banished", C.LOCATION_REMOVED], ["extra", C.LOCATION_EXTRA]];

function randomSeed() {
  const a = new BigUint64Array(4);
  if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
  else for (let i = 0; i < 4; i++) a[i] = BigInt(Math.floor(Math.random() * 2 ** 32)) << 32n | BigInt(Math.floor(Math.random() * 2 ** 32));
  return [...a];
}

function shuffle(a) {
  const r = new Uint32Array(a.length);
  if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(r); else for (let i = 0; i < r.length; i++) r[i] = Math.random() * 2 ** 32;
  for (let i = a.length - 1; i > 0; i--) { const j = r[i] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const DEFAULT_OPTIONS = { rule: 5, lp: 8000, start: 5, draw: 1, noShuffle: false, noHandLimit: false };

export class DuelHost {
  /**
   * core: OcgCore; db: CardDB; scripts: ScriptStore (already preloaded);
   * decks: [{main:[codes], extra:[codes]}, ...] indexed by team (team 0 goes first);
   * names: [name0, name1]; emit(viewer, packet) receives updates.
   */
  constructor({ core, db, scripts, decks, names, options, emit, seed }) {
    this.core = core; this.db = db; this.scripts = scripts; this.decks = decks;
    this.names = names || ["Player 1", "Player 2"];
    this.opt = { ...DEFAULT_OPTIONS, ...(options || {}) };
    this.emit = emit;
    this.seed = seed || randomSeed();
    this.duel = 0;
    this.pending = null;      // { player, msg }
    this.selectHint = [null, null];
    this.revealed = [new Set(), new Set()];
    this.turn = 0; this.turnPlayer = 0; this.phase = 0;
    this.ended = null;
    this.log = [];
    this.seq = 0;
  }

  flags() {
    let f = this.opt.rule === 4 ? C.DUEL.MODE_MR4 : this.opt.rule === 3 ? C.DUEL.MODE_MR3 : C.DUEL.MODE_MR5;
    if (this.opt.noHandLimit) f |= C.DUEL.NO_HAND_LIMIT;
    return f;
  }

  start() {
    const core = this.core;
    core.cards = (code) => this.db.engine(code);
    core.scripts = (name) => this.scripts.get(name);
    core.onLog = (text, type) => { if (type === 0 || type === 1) this.log.push(text); };
    const p = { lp: this.opt.lp, start: this.opt.start, draw: this.opt.draw };
    this.duel = core.createDuel({ seed: this.seed, flags: this.flags(), players: [p, p] });
    core.loadScript(this.duel, "constant.lua");
    core.loadScript(this.duel, "utility.lua");
    this.decks.forEach((d, team) => {
      // Like EDOPro's server, shuffle before handing the deck to the core (the core does not).
      // With "noShuffle" (test hands) the list order is the draw order.
      const main = this.opt.noShuffle ? [...(d.main || [])] : shuffle([...(d.main || [])]);
      main.reverse(); // cards are added bottom-to-top
      for (const code of main) core.newCard(this.duel, { team, code, location: C.LOCATION_DECK, position: C.POS_FACEDOWN_DEFENSE });
      for (const code of d.extra || []) core.newCard(this.duel, { team, code, location: C.LOCATION_EXTRA, position: C.POS_FACEDOWN_DEFENSE });
    });
    core.startDuel(this.duel);
    this.run();
  }

  destroy() { if (this.duel) { this.core.destroyDuel(this.duel); this.duel = 0; } }

  /** Answer the pending prompt. Returns an error string or null. */
  respond(player, resp) {
    if (this.ended) return "Duel is over";
    if (!this.pending || this.pending.player !== player) return "Not your decision";
    if (!resp || resp.t !== this.pending.msg.type) return "Answer does not match the prompt";
    let bytes;
    try { bytes = encodeResponse(resp); } catch (e) { return String(e.message || e); }
    this.pending = null;
    this.core.setResponse(this.duel, bytes);
    this.run();
    return null;
  }

  surrender(player) {
    if (this.ended) return;
    this.finish(1 - player, `${this.names[player]} surrendered`, []);
  }

  run() {
    const events = [];
    let guard = 0;
    for (;;) {
      if (++guard > 100000) { this.finish(-1, "engine loop", events); return; }
      const status = this.core.process(this.duel);
      const msgs = this.core.getMessages(this.duel);
      let stop = false;
      for (const msg of msgs) {
        if (msg.type === M.RETRY) {
          // Invalid answer: ask the same player again.
          if (this.lastPrompt) { this.pending = this.lastPrompt; events.push({ type: M.RETRY, player: this.lastPrompt.player }); stop = true; }
          continue;
        }
        this.track(msg);
        if (msg.type === M.WIN) { events.push(msg); this.finish(msg.player, this.db.victory(msg.reason) || "", events); return; }
        if (C.PROMPTS.has(msg.type)) {
          this.pending = { player: msg.player, msg, hint: this.selectHint[msg.player] };
          this.lastPrompt = this.pending;
          this.selectHint[msg.player] = null;
          stop = true;
          continue;
        }
        events.push(msg);
      }
      if (stop) break;
      if (status === 0) { this.finish(-1, "Duel ended", events); return; } // OCG_DUEL_STATUS_END
      if (status === 1 && !this.pending) {
        // Awaiting with no prompt read (should not happen); avoid a hard loop.
        break;
      }
    }
    this.broadcast(events);
  }

  track(msg) {
    switch (msg.type) {
      case M.NEW_TURN: this.turn++; this.turnPlayer = msg.player; this.revealed = [new Set(), new Set()]; break;
      case M.NEW_PHASE: this.phase = msg.phase; break;
      case M.HINT: if (msg.hint_type === C.HINT.SELECTMSG) this.selectHint[msg.player] = msg.hint; break;
      case M.CONFIRM_CARDS: for (const c of msg.cards) this.revealed[msg.player].add(`${c.controller}:${c.location}:${c.sequence}`); break;
      case M.SHUFFLE_HAND: this.revealed[1 - msg.player] = new Set([...this.revealed[1 - msg.player]].filter((k) => !k.startsWith(`${msg.player}:${C.LOCATION_HAND}:`))); break;
    }
  }

  finish(winner, reason, events) {
    this.ended = { winner, reason };
    this.pending = null;
    this.broadcast(events);
  }

  // ---------------------------------------------------------------------------
  // Views
  visible(card, viewer, team, location) {
    if (!card) return false;
    const faceup = !!(card.position & C.POS_FACEUP);
    switch (location) {
      case C.LOCATION_MZONE: case C.LOCATION_SZONE: return faceup || viewer === team;
      case C.LOCATION_HAND: return viewer === team || !!card.public;
      case C.LOCATION_EXTRA: return viewer === team || faceup;
      case C.LOCATION_GRAVE: return true;
      case C.LOCATION_REMOVED: return faceup || viewer === team;
      default: return false;
    }
  }

  snapshotRaw() {
    const s = { teams: [] };
    let field = null;
    try { field = this.readField(); } catch (e) { field = null; }
    for (let t = 0; t < 2; t++) {
      const z = { lp: field ? field.lp[t] : 0, deck: this.core.queryCount(this.duel, t, C.LOCATION_DECK) };
      for (const [k, l] of LOCS) z[k] = this.core.queryLocation(this.duel, Q_FLAGS, t, l);
      // Top card of the deck is public when the deck is reversed or revealed.
      if (z.deck) {
        const top = this.core.query(this.duel, C.QUERY_CODE | C.QUERY_POSITION, t, C.LOCATION_DECK, z.deck - 1);
        z.deckTop = top && top.position & C.POS_FACEUP ? top.code : 0;
      }
      s.teams.push(z);
    }
    s.chain = field ? field.chain : [];
    return s;
  }

  readField() {
    const u = this.core._buf((lp) => this.core.x.kx_query_field(this.duel, lp));
    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    let o = 0;
    const u8 = () => dv.getUint8(o++), u32 = () => { const x = dv.getUint32(o, true); o += 4; return x; }, i32 = () => { const x = dv.getInt32(o, true); o += 4; return x; };
    const u64 = () => { const x = dv.getBigUint64(o, true); o += 8; return x; };
    o += 4; // flags
    const lp = [];
    for (let p = 0; p < 2; p++) {
      lp.push(Math.max(0, i32()));
      for (let i = 0; i < 7; i++) if (u8()) { u8(); u32(); }
      for (let i = 0; i < 8; i++) if (u8()) { u8(); u32(); }
      for (let i = 0; i < 6; i++) u32();
    }
    const chain = [];
    const n = u32();
    for (let i = 0; i < n; i++) {
      const code = u32(), controller = u8(), location = u8(), sequence = u32(), position = u32();
      const tc = u8(), tl = u8(), ts = u32(), desc = u64();
      chain.push({ code, controller, location, sequence, position, triggering_controller: tc, triggering_location: tl, triggering_sequence: ts, description: desc.toString() });
    }
    return { lp, chain };
  }

  viewFor(raw, viewer) {
    const teams = raw.teams.map((z, t) => {
      const out = { lp: z.lp, deck: z.deck, deckTop: z.deckTop || 0 };
      for (const [k, l] of LOCS) {
        out[k] = z[k].map((c, i) => {
          if (!c) return null;
          if (this.visible(c, viewer, t, l) || (viewer < 2 && this.revealed[viewer].has(`${t}:${l}:${i}`))) return c;
          return { hidden: true, position: c.position, overlays: c.overlays && c.overlays.length ? c.overlays : undefined };
        });
      }
      return out;
    });
    return { teams, chain: raw.chain };
  }

  maskCode(viewer, code, controller, location, position) {
    if (viewer === controller) return code;
    if (location & (C.LOCATION_GRAVE | C.LOCATION_OVERLAY)) return code;
    if (location & (C.LOCATION_DECK | C.LOCATION_HAND)) return 0;
    if (position & C.POS_FACEDOWN) return 0;
    return code;
  }

  filterEvent(e, viewer) {
    switch (e.type) {
      case M.HINT: {
        const own = [C.HINT.EVENT, C.HINT.MESSAGE, C.HINT.SELECTMSG, C.HINT.EFFECT].includes(e.hint_type);
        const others = [C.HINT.OPSELECTED, C.HINT.RACE, C.HINT.ATTRIB, C.HINT.CODE, C.HINT.NUMBER, C.HINT.ZONE].includes(e.hint_type);
        if (own && viewer !== e.player) return null;
        if (others && viewer === e.player) return null;
        return e;
      }
      case M.MOVE: return { ...e, code: this.maskCode(viewer, e.code, e.to.controller, e.to.location, e.to.position) };
      case M.SET: return { ...e, code: 0 };
      case M.DRAW: return viewer === e.player ? e : { ...e, drawn: e.drawn.map((d) => ({ ...d, code: d.position & C.POS_FACEUP ? d.code : 0 })) };
      case M.SHUFFLE_HAND: case M.SHUFFLE_EXTRA: return viewer === e.player ? e : { ...e, cards: e.cards.map(() => 0) };
      case M.CONFIRM_CARDS:
        if (e.cards.length && e.cards[0].location === C.LOCATION_DECK && viewer !== e.player) return null;
        return e;
      case M.DECK_TOP: return e.position & C.POS_FACEUP ? e : { ...e, code: 0 };
      case M.MISSED_EFFECT: return viewer === e.controller ? e : null;
      case M.CHAINING: case M.SUMMONING: case M.SPSUMMONING: case M.FLIPSUMMONING: return e;
      default: return e;
    }
  }

  promptFor(viewer) {
    if (!this.pending || this.pending.player !== viewer) return null;
    const msg = structuredClone(this.pending.msg);
    // Hide identities of cards the chooser cannot see, unless they were just revealed to them.
    const mask = (c) => {
      if (c == null || c.code === undefined || c.controller === viewer) return c;
      if (this.revealed[viewer].has(`${c.controller}:${c.location}:${c.sequence}`)) return c;
      if (c.location & (C.LOCATION_DECK | C.LOCATION_HAND) || (c.position !== undefined && c.position & C.POS_FACEDOWN && !(c.location & C.LOCATION_GRAVE))) c.code = 0;
      return c;
    };
    for (const k of ["selects", "select_cards", "unselect_cards", "selects_must", "cards", "summons", "special_summons", "activates", "chains"])
      if (Array.isArray(msg[k])) msg[k].forEach(mask);
    return { msg, hint: this.pending.hint };
  }

  broadcast(events) {
    const raw = this.duel ? this.snapshotRaw() : null;
    this.seq++;
    const log = this.log.splice(0);
    for (let v = 0; v < 3; v++) {
      const ev = events.map((e) => this.filterEvent(e, v)).filter(Boolean);
      const packet = {
        kind: "update", seq: this.seq, viewer: v, turn: this.turn, turnPlayer: this.turnPlayer, phase: this.phase,
        names: this.names, state: raw ? this.viewFor(raw, v) : null, events: ev,
        prompt: v < 2 ? this.promptFor(v) : null,
        waitingFor: this.pending ? this.pending.player : -1,
        ended: this.ended, log,
      };
      this.emit(v, packet);
    }
  }
}
