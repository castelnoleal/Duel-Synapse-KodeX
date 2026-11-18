// Recorded-duel playback ("message stream" replays).
//
// A desktop client's .yrpX file carries every message its duel server sent during the duel, with the full contents of
// every card zone after each change (MSG_UPDATE_DATA / MSG_UPDATE_CARD). The desktop client plays such a file by
// showing those messages one after another; it does not run the duel again. StreamHost does the same, so a replay
// shows exactly what happened in the original duel (every card in the zone it was really in) whatever card scripts or
// engine version this Arena has. It looks like a DuelHost to the replay pump in host-worker.js: start(), pending,
// respondRaw() (go to the next step), finish(), destroy(), and the same "update" packets for viewer 3.
// Layout of the stream from gframe/generic_duel.cpp (Analyze, Refresh*) and gframe/replay_mode.cpp (ReplayAnalyze).
import * as C from "./constants.js";
import { Reader, parseMessage, parseQuery, parseQueryLocation } from "./core.js";

const M = C.MSG;
const LIST = { [C.LOCATION_DECK]: "deck", [C.LOCATION_HAND]: "hand", [C.LOCATION_GRAVE]: "grave", [C.LOCATION_REMOVED]: "banished", [C.LOCATION_EXTRA]: "extra" };
const ZONE = { [C.LOCATION_MZONE]: ["mzone", 7], [C.LOCATION_SZONE]: ["szone", 8] };
// what a step is built around: something you can see happen on the table
const ACTION = new Set([M.MOVE, M.DRAW, M.SUMMONING, M.SPSUMMONING, M.FLIPSUMMONING, M.CHAINING, M.CHAIN_SOLVING, M.ATTACK,
  M.DAMAGE, M.RECOVER, M.PAY_LPCOST, M.NEW_TURN, M.NEW_PHASE, M.POS_CHANGE, M.SWAP, M.CONFIRM_CARDS, M.CONFIRM_DECKTOP,
  M.CONFIRM_EXTRATOP, M.TOSS_COIN, M.TOSS_DICE, M.ADD_COUNTER, M.REMOVE_COUNTER, M.EQUIP, M.BECOME_TARGET, M.DECK_TOP,
  M.SHUFFLE_HAND, M.SHUFFLE_DECK, M.HAND_RES, M.ANNOUNCE_CARD, M.WIN]);
// messages that only carry data for the table (never shown as an event)
const DATA = new Set([M.START, M.UPDATE_DATA, M.UPDATE_CARD, M.AI_NAME, 231]);
const DELAY = { [M.NEW_TURN]: 700, [M.NEW_PHASE]: 380, [M.CHAINING]: 760, [M.CHAIN_SOLVING]: 520, [M.SPSUMMONING]: 640, [M.SUMMONING]: 640,
  [M.FLIPSUMMONING]: 640, [M.ATTACK]: 700, [M.DAMAGE]: 520, [M.DRAW]: 460, [M.MOVE]: 440, [M.CONFIRM_CARDS]: 900, [M.TOSS_COIN]: 900, [M.TOSS_DICE]: 900 };

/** Is this replay's message stream complete enough to be played as recorded? (r from readReplay) */
export function streamUsable(r) {
  if (!r || !Array.isArray(r.stream) || !r.stream.length) return false;
  if (r.legacy) return false;                    // written before 64-bit card messages: only the re-run can read it
  let start = false, moves = 0, data = 0;
  for (const p of r.stream) {
    if (p.msg === M.START) start = true;
    else if (p.msg === M.MOVE || p.msg === M.DRAW) moves++;
    else if (p.msg === M.UPDATE_DATA) data++;
  }
  return start && moves > 0 && data > 0;
}

function parse(p) {
  const b = new Uint8Array(p.data.length + 1);
  b[0] = p.msg; b.set(p.data, 1);
  return parseMessage(new Reader(b));
}

/** Splits the stream into steps: each holds one thing happening (or a run of cards moving together) and the data after it. */
export function streamSteps(stream) {
  const steps = [];
  let cur = [], act = null;
  for (const p of stream) {
    if (p.msg === 231) continue;                                   // the classic replay inside: not part of the duel
    if (ACTION.has(p.msg)) {
      const together = act && act.msg === M.MOVE && p.msg === M.MOVE && act.n < 8;   // cards moving at once go together
      if (act && !together) { steps.push(cur); cur = []; act = null; }
      if (act) act.n++; else act = { msg: p.msg, n: 1 };
    }
    cur.push(p);
  }
  if (cur.length) steps.push(cur);
  return steps;
}

const emptySide = () => ({ lp: 8000, deck: [], hand: [], mzone: Array(7).fill(null), szone: Array(8).fill(null), grave: [], banished: [], extra: [] });

export class StreamHost {
  /** r: from readReplay (with r.stream); db: CardDB; emit(viewer, packet) as DuelHost's. */
  constructor({ r, db, names, emit }) {
    this.r = r; this.db = db; this.emit = emit;
    this.names = names || r.names || ["Player 1", "Player 2"];
    this.steps = streamSteps(r.stream);
    this.at = 0;
    this.side = [emptySide(), emptySide()];
    this.chain = [];
    this.turn = 0; this.turnPlayer = 0; this.phase = 0;
    this.pending = null; this.ended = null; this.seq = 0; this.log = [];
    this.opt = { replay: r };
  }

  start() { this.next(); }
  /** The replay pump answers each "prompt" with the next recorded answer; here that just means: show the next step. */
  respondRaw() { if (!this.ended) this.next(); return null; }
  respond() { return this.respondRaw(); }
  destroy() { this.steps = []; this.pending = null; }
  replayFile() { return null; }
  surrender() {}
  timeout() {}

  next() {
    this.pending = null;
    if (this.at >= this.steps.length) { this.finish(-1, "End of the replay", []); return; }
    const events = [];
    let first = 0;
    for (const p of this.steps[this.at++]) {
      let msg;
      try { msg = parse(p); } catch (e) { continue; }
      if (msg.unknown && !DATA.has(p.msg)) continue;
      if (!first && ACTION.has(p.msg)) first = p.msg;
      this.apply(p, msg);
      if (msg.type === M.WIN) { events.push(msg); this.finish(msg.player, this.db.victory(msg.reason) || "", events); return; }
      if (DATA.has(p.msg) || C.PROMPTS.has(p.msg) || p.msg === M.RETRY) continue;
      events.push(msg);
    }
    if (this.at >= this.steps.length) { this.finish(-1, "End of the replay", events); return; }
    this.pending = { player: this.turnPlayer, msg: { type: 0 }, delay: DELAY[first] || 480 };
    this.broadcast(events);
  }

  finish(winner, reason, events) {
    this.ended = { winner, reason };
    this.pending = null;
    this.broadcast(events);
  }

  // ---------------------------------------------------------------------------
  // The table, kept from the recorded messages
  card(code, position) {
    const d = this.db.get ? this.db.get(code) : null;
    const c = { code: code || 0, position: position || C.POS_FACEDOWN_DEFENSE };
    if (d) {
      c.type = d.type; c.attribute = d.attribute || 0; c.race = String(d.race || 0);
      c.attack = d.atk; c.base_attack = d.atk;
      if (d.type & C.TYPE.LINK) { c.link = d.level || 0; c.link_marker = d.link_marker || 0; }
      else { c.level = d.level || 0; c.defense = d.def; c.base_defense = d.def; }
      if (d.type & C.TYPE.PENDULUM) { c.lscale = d.lscale || 0; c.rscale = d.rscale || 0; }
    }
    return c;
  }
  list(p, l) { const k = LIST[l]; return k ? this.side[p & 1][k] : null; }
  take(at) {
    const s = this.side[at.controller & 1];
    if (at.overlay != null) {
      const z = ZONE[at.location];
      const holder = z && s[z[0]][at.sequence];
      if (holder && holder.overlays && holder.overlays.length > at.overlay) return this.card(holder.overlays.splice(at.overlay, 1)[0], C.POS_FACEUP_ATTACK);
      return null;
    }
    const z = ZONE[at.location];
    if (z) { const c = s[z[0]][at.sequence]; s[z[0]][at.sequence] = null; return c; }
    const a = this.list(at.controller, at.location);
    if (!a) return null;
    if (at.location === C.LOCATION_DECK && at.sequence >= a.length) return a.pop() || null;
    return a.splice(Math.min(at.sequence, Math.max(0, a.length - 1)), 1)[0] || null;
  }
  put(at, c) {
    const s = this.side[at.controller & 1];
    if (at.overlay != null) {
      const z = ZONE[at.location];
      const holder = z && s[z[0]][at.sequence];
      if (holder) (holder.overlays || (holder.overlays = [])).splice(Math.min(at.overlay, holder.overlays.length), 0, c.code);
      return;
    }
    const z = ZONE[at.location];
    if (z) { s[z[0]][at.sequence] = c; return; }
    const a = this.list(at.controller, at.location);
    if (a) a.splice(Math.min(at.sequence, a.length), 0, c);
  }
  fresh(c, code, position, location) {
    // a card that leaves the field forgets what happened to it there
    const out = this.card(code || c.code, position);
    if (location & (C.LOCATION_MZONE | C.LOCATION_SZONE)) { if (c.overlays && c.overlays.length) out.overlays = c.overlays; }
    return out;
  }

  apply(p, msg) {
    const S = this.side;
    switch (p.msg) {
      case M.START: {
        // [type u8][lp0 u32][lp1 u32][deck0 u16][extra0 u16][deck1 u16][extra1 u16]
        const r = new Reader(p.data);
        try {
          r.u8(); S[0].lp = r.u32(); S[1].lp = r.u32();
          for (let t = 0; t < 2; t++) {
            if (r.avail < 2) break;
            const dk = r.u16(); const ex = r.avail >= 2 ? r.u16() : 0;
            S[t].deck = Array.from({ length: dk }, () => this.card(0));
            S[t].extra = Array.from({ length: ex }, () => this.card(0));
          }
        } catch (e) { /* short start message */ }
        break;
      }
      case M.UPDATE_DATA: {
        const r = new Reader(p.data);
        const player = r.u8() & 1, location = r.u8();
        let cards;
        try { cards = parseQueryLocation(p.data.subarray(2)); } catch (e) { break; }
        const z = ZONE[location];
        if (z) {
          const old = S[player][z[0]];
          S[player][z[0]] = Array.from({ length: z[1] }, (_, i) => (cards[i] ? this.keep(cards[i], old[i]) : null));
        } else if (LIST[location]) {
          const old = S[player][LIST[location]];
          S[player][LIST[location]] = cards.map((c, i) => this.keep(c || {}, old[i]));
        }
        break;
      }
      case M.UPDATE_CARD: {
        const r = new Reader(p.data);
        const player = r.u8() & 1, location = r.u8(), sequence = r.u8();
        let q;
        try { q = parseQuery(new Reader(p.data.subarray(3))); } catch (e) { break; }
        if (!q) break;
        const z = ZONE[location];
        if (z) { S[player][z[0]][sequence] = this.keep(q, S[player][z[0]][sequence]); break; }
        const a = this.list(player, location);
        if (a && a[sequence]) a[sequence] = this.keep(q, a[sequence]);
        break;
      }
      case M.NEW_TURN: this.turn++; this.turnPlayer = msg.player & 1; break;
      case M.NEW_PHASE: this.phase = msg.phase; break;
      case M.MOVE: {
        const { from, to } = msg;
        let c = from.location ? this.take(from) : null;
        if (!to.location) break;                                          // a token leaving the game
        if (!c) c = this.card(msg.code, to.position);
        const onField = to.location & (C.LOCATION_MZONE | C.LOCATION_SZONE);
        c = onField && (from.location & (C.LOCATION_MZONE | C.LOCATION_SZONE)) && from.overlay == null
          ? { ...c, code: msg.code || c.code, position: to.position }
          : this.fresh(c, msg.code, to.position, onField ? to.location : 0);
        if (to.overlay != null) { this.put(to, c); break; }
        if (!onField) delete c.overlays;
        this.put(to, c);
        break;
      }
      case M.DRAW: {
        const s = S[msg.player & 1];
        for (const d of msg.drawn) { s.deck.pop(); s.hand.push(this.card(d.code, d.position & C.POS_FACEUP ? C.POS_FACEUP_ATTACK : C.POS_FACEDOWN_DEFENSE)); }
        break;
      }
      case M.SHUFFLE_HAND: case M.SHUFFLE_EXTRA: {
        const a = S[msg.player & 1][p.msg === M.SHUFFLE_HAND ? "hand" : "extra"];
        const down = a.filter((c) => p.msg === M.SHUFFLE_HAND || !(c.position & C.POS_FACEUP));
        msg.cards.forEach((code, i) => { if (down[i] && code) Object.assign(down[i], this.card(code, down[i].position)); });
        break;
      }
      case M.SWAP_GRAVE_DECK: {
        const s = S[msg.player & 1];
        const g = s.grave; s.grave = s.deck.map((c) => this.card(c.code, C.POS_FACEUP_ATTACK)); s.deck = g.map((c) => this.card(c.code));
        const back = new Set(msg.returned_to_extra);
        s.extra.push(...s.deck.filter((_, i) => back.has(i)));
        s.deck = s.deck.filter((_, i) => !back.has(i));
        break;
      }
      case M.REVERSE_DECK: for (const s of S) { s.deck.reverse(); for (const c of s.deck) c.position = c.position & C.POS_FACEUP ? C.POS_FACEDOWN_DEFENSE : C.POS_FACEUP_DEFENSE; } break;
      case M.DECK_TOP: { const a = S[msg.player & 1].deck; const c = a[a.length - 1 - msg.count]; if (c) Object.assign(c, { code: msg.code, position: msg.position }); break; }
      case M.POS_CHANGE: {
        const z = ZONE[msg.location]; const c = z && S[msg.controller & 1][z[0]][msg.sequence];
        if (c) c.position = msg.position;
        break;
      }
      case M.SWAP: {
        const a = msg.card1, b = msg.card2;
        const ca = this.take(a), cb = this.take(b);
        if (cb) this.put(a, cb); if (ca) this.put(b, ca);
        break;
      }
      case M.SHUFFLE_SET_CARD: {
        const moved = msg.cards.map((x) => this.take(x.from));
        msg.cards.forEach((x, i) => { if (moved[i] && x.to.location) this.put(x.to, moved[i]); });
        break;
      }
      case M.LPUPDATE: S[msg.player & 1].lp = msg.lp; break;
      case M.DAMAGE: case M.PAY_LPCOST: S[msg.player & 1].lp = Math.max(0, S[msg.player & 1].lp - msg.amount); break;
      case M.RECOVER: S[msg.player & 1].lp += msg.amount; break;
      case M.ADD_COUNTER: case M.REMOVE_COUNTER: {
        const z = ZONE[msg.location]; const c = z && S[msg.controller & 1][z[0]][msg.sequence];
        if (!c) break;
        const list = (c.counters || []).map((x) => [...x]);
        const e = list.find((x) => x[0] === msg.counter_type);
        const n = (e ? e[1] : 0) + (p.msg === M.ADD_COUNTER ? msg.count : -msg.count);
        if (e) e[1] = Math.max(0, n); else if (n > 0) list.push([msg.counter_type, n]);
        c.counters = list.filter((x) => x[1] > 0);
        break;
      }
      case M.CHAINING: this.chain.push({ code: msg.code, controller: msg.controller, location: msg.location, sequence: msg.sequence, position: msg.position,
        triggering_controller: msg.triggering_controller, triggering_location: msg.triggering_location, triggering_sequence: msg.triggering_sequence, description: msg.description }); break;
      case M.CHAIN_SOLVED: if (msg.chain_size > 0 && this.chain.length >= msg.chain_size) this.chain.length = msg.chain_size - 1; break;
      case M.CHAIN_END: this.chain = []; break;
    }
  }
  /** A card's recorded data, keeping what the record leaves out (a public view drops some fields). */
  keep(q, old) {
    if (!q || !Object.keys(q).length) return old || null;
    const c = { ...(old && (q.code == null || old.code === q.code) ? old : {}), ...q };
    if (c.code == null) c.code = 0;
    if (c.position == null) c.position = C.POS_FACEDOWN_DEFENSE;
    return c;
  }

  view() {
    const teams = this.side.map((s) => {
      const top = s.deck[s.deck.length - 1];
      const out = { lp: s.lp, deck: s.deck.length, deckTop: top && top.position & C.POS_FACEUP ? top.code : 0 };
      for (const k of ["hand", "mzone", "szone", "grave", "banished", "extra"]) out[k] = s[k].map((c) => (c ? { ...c } : null));
      return out;
    });
    return { teams, chain: this.chain.map((c) => ({ ...c })) };
  }

  broadcast(events) {
    this.seq++;
    this.emit(3, {
      kind: "update", seq: this.seq, viewer: 3, turn: this.turn, turnPlayer: this.turnPlayer, phase: this.phase,
      names: this.names, state: this.view(), events: events.filter((e) => !(e.type === M.HINT && e.hint_type === C.HINT.SELECTMSG)),
      prompt: null, waitingFor: this.pending ? this.pending.player : -1, ended: this.ended, log: [], stream: true,
    });
  }
}
