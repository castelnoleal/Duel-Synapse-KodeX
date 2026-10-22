// Duel Synapse: KodeX — JavaScript binding for the EDOPro rules engine
// (edo9300/ygopro-core, AGPL-3.0-or-later) compiled to WebAssembly.
//
// Message/response layouts are ported from n1xx1/ocgcore-wasm (MIT) and checked
// against ygopro-core 11.0. Runs unchanged in browsers, Web Workers and Node.
import * as C from "./constants.js";

const td = new TextDecoder();
const te = new TextEncoder();

export class Reader {
  constructor(u8) { this.b = u8; this.v = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); this.o = 0; }
  get avail() { return this.b.length - this.o; }
  u8() { return this.v.getUint8(this.o++); }
  i8() { return this.v.getInt8(this.o++); }
  u16() { const x = this.v.getUint16(this.o, true); this.o += 2; return x; }
  u32() { const x = this.v.getUint32(this.o, true); this.o += 4; return x; }
  i32() { const x = this.v.getInt32(this.o, true); this.o += 4; return x; }
  u64() { const x = this.v.getBigUint64(this.o, true); this.o += 8; return x; }
  bytes(n) { const x = this.b.subarray(this.o, this.o + n); this.o += n; return x; }
}

class Writer {
  constructor() { this.a = []; }
  i8(x) { const b = new Uint8Array(1); new DataView(b.buffer).setInt8(0, x); this.a.push(b); }
  u8(x) { this.a.push(new Uint8Array([x & 0xff])); }
  i16(x) { const b = new Uint8Array(2); new DataView(b.buffer).setInt16(0, x, true); this.a.push(b); }
  i32(x) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, x, true); this.a.push(b); }
  u32(x) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, x >>> 0, true); this.a.push(b); }
  u64(x) { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(x), true); this.a.push(b); }
  out() { const n = this.a.reduce((t, b) => t + b.length, 0); const r = new Uint8Array(n); let o = 0; for (const b of this.a) { r.set(b, o); o += b.length; } return r; }
}

// 64-bit values (descriptions, races) travel as strings so they survive JSON.
const big = (r) => r.u64().toString();

function loc(r) {
  const controller = r.u8(), location = r.u8(), sequence = r.u32(), position = r.u32();
  if (location & C.LOCATION_OVERLAY)
    return { controller, location: location & ~C.LOCATION_OVERLAY, sequence, position: C.POS_FACEUP_ATTACK, overlay: position };
  return { controller, location, sequence, position };
}
const emptyLoc = (l) => !l.controller && !l.location && !l.sequence && !l.position && !l.overlay;
const arr = (n, f) => Array.from({ length: n }, f);
const card4 = (r) => ({ code: r.u32(), controller: r.u8(), location: r.u8(), sequence: r.u32() });
const card4s = (r) => ({ code: r.u32(), controller: r.u8(), location: r.u8(), sequence: r.u8() });
const cardL = (r) => ({ code: r.u32(), ...loc(r) });

export function parseMessage(r) {
  const type = r.u8();
  const M = C.MSG;
  switch (type) {
    case M.RETRY: return { type };
    case M.HINT: return { type, hint_type: r.u8(), player: r.u8(), hint: r.avail > 4 ? big(r) : String(r.u32()) };
    case M.WIN: return { type, player: r.u8(), reason: r.u8() };
    case M.SELECT_BATTLECMD: return {
      type, player: r.u8(),
      chains: arr(r.u32(), () => ({ code: r.u32(), controller: r.u8(), location: r.u8(), sequence: r.u32(), description: big(r), client_mode: r.u8() })),
      attacks: arr(r.u32(), () => ({ code: r.u32(), controller: r.u8(), location: r.u8(), sequence: r.u8(), can_direct: r.u8() !== 0 })),
      to_m2: r.u8() !== 0, to_ep: r.u8() !== 0 };
    case M.SELECT_IDLECMD: return {
      type, player: r.u8(),
      summons: arr(r.u32(), () => card4(r)),
      special_summons: arr(r.u32(), () => card4(r)),
      pos_changes: arr(r.u32(), () => card4s(r)),
      monster_sets: arr(r.u32(), () => card4(r)),
      spell_sets: arr(r.u32(), () => card4(r)),
      activates: arr(r.u32(), () => ({ ...card4(r), description: big(r), client_mode: r.u8() })),
      to_bp: r.u8() !== 0, to_ep: r.u8() !== 0, shuffle: r.u8() !== 0 };
    case M.SELECT_EFFECTYN: return { type, player: r.u8(), code: r.u32(), ...loc(r), description: big(r) };
    case M.SELECT_YESNO: return { type, player: r.u8(), description: big(r) };
    case M.SELECT_OPTION: return { type, player: r.u8(), options: arr(r.u8(), () => big(r)) };
    case M.SELECT_CARD: return { type, player: r.u8(), can_cancel: r.u8() !== 0, min: r.u32(), max: r.u32(), selects: arr(r.u32(), () => cardL(r)) };
    case M.SELECT_CHAIN: return {
      type, player: r.u8(), spe_count: r.u8(), forced: r.u8() !== 0, hint_timing: r.u32(), hint_timing_other: r.u32(),
      selects: arr(r.u32(), () => ({ ...cardL(r), description: big(r), client_mode: r.u8() })) };
    case M.SELECT_PLACE:
    case M.SELECT_DISFIELD: return { type, player: r.u8(), count: r.u8(), field_mask: r.u32() };
    case M.SELECT_POSITION: return { type, player: r.u8(), code: r.u32(), positions: r.u8() };
    case M.SELECT_TRIBUTE: return { type, player: r.u8(), can_cancel: r.u8() !== 0, min: r.u32(), max: r.u32(),
      selects: arr(r.u32(), () => ({ code: r.u32(), controller: r.u8(), location: r.u8(), sequence: r.u32(), release_param: r.u8() })) };
    case M.SORT_CHAIN:
    case M.SORT_CARD: return { type, player: r.u8(), cards: arr(r.u32(), () => ({ code: r.u32(), controller: r.u8(), location: r.u32(), sequence: r.u32() })) };
    case M.SELECT_COUNTER: return { type, player: r.u8(), counter_type: r.u16(), count: r.u16(),
      cards: arr(r.u32(), () => ({ code: r.u32(), controller: r.u8(), location: r.u8(), sequence: r.u8(), count: r.u16() })) };
    case M.SELECT_SUM: return { type, player: r.u8(), select_max: r.u8(), amount: r.u32(), min: r.u32(), max: r.u32(),
      selects_must: arr(r.u32(), () => ({ ...cardL(r), amount: r.u32() })),
      selects: arr(r.u32(), () => ({ ...cardL(r), amount: r.u32() })) };
    case M.SELECT_UNSELECT_CARD: return { type, player: r.u8(), can_finish: r.u8() !== 0, can_cancel: r.u8() !== 0, min: r.u32(), max: r.u32(),
      select_cards: arr(r.u32(), () => cardL(r)), unselect_cards: arr(r.u32(), () => cardL(r)) };
    case M.CONFIRM_DECKTOP:
    case M.CONFIRM_CARDS:
    case M.CONFIRM_EXTRATOP: return { type, player: r.u8(), cards: arr(r.u32(), () => card4(r)) };
    case M.SHUFFLE_DECK: return { type, player: r.u8() };
    case M.SHUFFLE_HAND:
    case M.SHUFFLE_EXTRA: return { type, player: r.u8(), cards: arr(r.u32(), () => r.u32()) };
    case M.REFRESH_DECK: return { type };
    case M.SWAP_GRAVE_DECK: { const player = r.u8(), deck_size = r.u32(); const bytes = r.bytes(r.u32()); const ret = [];
      for (let i = 0; i < bytes.length * 8; i++) if (bytes[i >> 3] & (1 << (i & 7))) ret.push(i);
      return { type, player, deck_size, returned_to_extra: ret }; }
    case M.SHUFFLE_SET_CARD: return { type, location: r.u8(), cards: arr(r.u8(), () => ({ from: loc(r), to: loc(r) })) };
    case M.REVERSE_DECK: return { type };
    case M.DECK_TOP: return { type, player: r.u8(), count: r.u32(), code: r.u32(), position: r.u32() };
    case M.NEW_TURN: return { type, player: r.u8() };
    case M.NEW_PHASE: return { type, phase: r.u16() };
    case M.MOVE: return { type, code: r.u32(), from: loc(r), to: loc(r), reason: r.u32() };
    case M.POS_CHANGE: return { type, code: r.u32(), controller: r.u8(), location: r.u8(), sequence: r.u8(), prev_position: r.u8(), position: r.u8() };
    case M.SET: return { type, code: r.u32(), ...loc(r) };
    case M.SWAP: return { type, card1: cardL(r), card2: cardL(r) };
    case M.FIELD_DISABLED: return { type, field_mask: r.u32() };
    case M.SUMMONING:
    case M.SPSUMMONING:
    case M.FLIPSUMMONING: return { type, code: r.u32(), ...loc(r) };
    case M.SUMMONED:
    case M.SPSUMMONED:
    case M.FLIPSUMMONED:
    case M.CHAIN_END:
    case M.ATTACK_DISABLED:
    case M.DAMAGE_STEP_START:
    case M.DAMAGE_STEP_END:
    case M.BE_CHAIN_TARGET:
    case M.CREATE_RELATION:
    case M.RELEASE_RELATION:
    case M.CUSTOM_MSG: return { type };
    case M.CHAINING: return { type, code: r.u32(), ...loc(r), triggering_controller: r.u8(), triggering_location: r.u8(), triggering_sequence: r.u32(), description: big(r), chain_size: r.u32() };
    case M.CHAINED:
    case M.CHAIN_SOLVING:
    case M.CHAIN_SOLVED:
    case M.CHAIN_NEGATED:
    case M.CHAIN_DISABLED: return { type, chain_size: r.u8() };
    case M.CARD_SELECTED:
    case M.BECOME_TARGET:
    case M.REMOVE_CARDS: return { type, cards: arr(r.u32(), () => loc(r)) };
    case M.RANDOM_SELECTED: return { type, player: r.u8(), cards: arr(r.u32(), () => loc(r)) };
    case M.DRAW: return { type, player: r.u8(), drawn: arr(r.u32(), () => ({ code: r.u32(), position: r.u32() })) };
    case M.DAMAGE:
    case M.RECOVER:
    case M.PAY_LPCOST: return { type, player: r.u8(), amount: r.u32() };
    case M.LPUPDATE: return { type, player: r.u8(), lp: r.u32() };
    case M.EQUIP:
    case M.CARD_TARGET:
    case M.CANCEL_TARGET: return { type, card: loc(r), target: loc(r) };
    case M.ADD_COUNTER:
    case M.REMOVE_COUNTER: return { type, counter_type: r.u16(), controller: r.u8(), location: r.u8(), sequence: r.u8(), count: r.u16() };
    case M.ATTACK: { const card = loc(r); const t = loc(r); return { type, card, target: emptyLoc(t) ? null : t }; }
    case M.BATTLE: return { type,
      card: { ...loc(r), attack: r.i32(), defense: r.i32(), destroyed: r.u8() !== 0 },
      target: { ...loc(r), attack: r.i32(), defense: r.i32(), destroyed: r.u8() !== 0 } };
    case M.MISSED_EFFECT: return { type, ...loc(r), code: r.u32() };
    case M.TOSS_COIN: return { type, player: r.u8(), results: arr(r.u8(), () => r.u8() !== 0) };
    case M.TOSS_DICE: return { type, player: r.u8(), results: arr(r.u8(), () => r.u8()) };
    case M.ROCK_PAPER_SCISSORS: return { type, player: r.u8() };
    case M.HAND_RES: { const x = r.u8(); return { type, results: [x & 3, (x >> 2) & 3] }; }
    case M.ANNOUNCE_RACE: return { type, player: r.u8(), count: r.u8(), available: big(r) };
    case M.ANNOUNCE_ATTRIB: return { type, player: r.u8(), count: r.u8(), available: r.u32() };
    case M.ANNOUNCE_CARD: return { type, player: r.u8(), opcodes: arr(r.u8(), () => big(r)) };
    case M.ANNOUNCE_NUMBER: return { type, player: r.u8(), options: arr(r.u8(), () => big(r)) };
    case M.CARD_HINT: return { type, ...loc(r), card_hint: r.u8(), description: big(r) };
    case M.PLAYER_HINT: return { type, player: r.u8(), player_hint: r.u8(), description: big(r) };
    case M.SHOW_HINT: return { type, hint: td.decode(r.bytes(r.u16())) };
    case M.AI_NAME: return { type, name: td.decode(r.bytes(r.u16())) };
    case M.MATCH_KILL: return { type, card: r.u32() };
    default: return { type, unknown: true };
  }
}

// Split the raw message buffer (u32 length + payload, repeated) into parsed messages.
export function parseMessages(u8) {
  const out = [];
  const r = new Reader(u8);
  while (r.avail >= 4) {
    const len = r.u32();
    if (len === 0 || len > r.avail) break;
    const body = r.bytes(len);
    try { out.push(parseMessage(new Reader(body))); }
    catch (e) { out.push({ type: body[0], unknown: true, error: String(e) }); }
  }
  return out;
}

// --- Responses -------------------------------------------------------------
// resp = { t: <MSG type of the prompt>, ...fields } coming from the UI or bot.
export function encodeResponse(resp) {
  const w = new Writer();
  const M = C.MSG;
  switch (resp.t) {
    case M.SELECT_BATTLECMD:
    case M.SELECT_IDLECMD: w.i32((resp.action | ((resp.index || 0) << 16)) >>> 0); break;
    case M.SELECT_EFFECTYN:
    case M.SELECT_YESNO: w.i32(resp.yes ? 1 : 0); break;
    case M.SELECT_OPTION: w.i32(resp.index | 0); break;
    case M.SELECT_CARD:
    case M.SELECT_TRIBUTE:
    case M.SELECT_SUM:
      if (resp.indices) { w.i32(0); w.i32(resp.indices.length); for (const i of resp.indices) w.i32(i); } else w.i32(-1);
      break;
    case M.SELECT_UNSELECT_CARD:
      if (resp.index == null || resp.index < 0) w.i32(-1); else { w.i32(1); w.i32(resp.index); }
      break;
    case M.SELECT_CHAIN: w.i32(resp.index == null ? -1 : resp.index); break;
    case M.SELECT_PLACE:
    case M.SELECT_DISFIELD: for (const p of resp.places) { w.u8(p.player); w.u8(p.location); w.u8(p.sequence); } break;
    case M.SELECT_POSITION: w.i32(resp.position); break;
    case M.SELECT_COUNTER: for (const c of resp.counters) w.i16(c); break;
    case M.SORT_CARD:
    case M.SORT_CHAIN:
      if (!resp.order) { w.i8(-1); break; }
      for (const i of resp.order) w.u8(i);
      break;
    case M.ANNOUNCE_RACE: w.u64(BigInt(resp.value)); break;
    case M.ANNOUNCE_ATTRIB: w.u32(resp.value); break;
    case M.ANNOUNCE_CARD: w.i32(resp.code); break;
    case M.ANNOUNCE_NUMBER: w.i32(resp.index); break;
    case M.ROCK_PAPER_SCISSORS: w.i32(resp.value); break;
    default: throw new Error("No response encoder for message " + resp.t);
  }
  return w.out();
}

// --- Queries -----------------------------------------------------------------
export function parseQuery(r) {
  const q = {};
  while (r.avail > 0) {
    let size = r.u16();
    if (size === 0) return null; // empty slot
    const flag = r.u32();
    size -= 4;
    const end = r.o + size;
    if (flag === C.QUERY_END) break;
    switch (flag) {
      case C.QUERY_CODE: q.code = r.u32(); break;
      case C.QUERY_POSITION: q.position = r.u32(); break;
      case C.QUERY_ALIAS: q.alias = r.u32(); break;
      case C.QUERY_TYPE: q.type = r.u32(); break;
      case C.QUERY_LEVEL: q.level = r.u32(); break;
      case C.QUERY_RANK: q.rank = r.u32(); break;
      case C.QUERY_ATTRIBUTE: q.attribute = r.u32(); break;
      case C.QUERY_RACE: q.race = r.u64().toString(); break;
      case C.QUERY_ATTACK: q.attack = r.i32(); break;
      case C.QUERY_DEFENSE: q.defense = r.i32(); break;
      case C.QUERY_BASE_ATTACK: q.base_attack = r.i32(); break;
      case C.QUERY_BASE_DEFENSE: q.base_defense = r.i32(); break;
      case C.QUERY_REASON: q.reason = r.u32(); break;
      case C.QUERY_COVER: q.cover = r.u32(); break;
      case C.QUERY_REASON_CARD: { const l = loc(r); if (!emptyLoc(l)) q.reason_card = l; break; }
      case C.QUERY_EQUIP_CARD: { const l = loc(r); if (!emptyLoc(l)) q.equip_card = l; break; }
      case C.QUERY_TARGET_CARD: q.targets = arr(r.u32(), () => loc(r)).filter((l) => !emptyLoc(l)); break;
      case C.QUERY_OVERLAY_CARD: q.overlays = arr(r.u32(), () => r.u32()); break;
      case C.QUERY_COUNTERS: q.counters = arr(r.u32(), () => { const count = r.u16(), kind = r.u16(); return [kind, count]; }); break;
      case C.QUERY_OWNER: q.owner = r.u8(); break;
      case C.QUERY_STATUS: q.status = r.u32(); break;
      case C.QUERY_IS_PUBLIC: q.public = r.u8() !== 0; break;
      case C.QUERY_LSCALE: q.lscale = r.u32(); break;
      case C.QUERY_RSCALE: q.rscale = r.u32(); break;
      case C.QUERY_LINK: q.link = r.u32(); q.link_marker = r.u32(); break;
      case C.QUERY_IS_HIDDEN: q.hidden = r.u8() !== 0; break;
    }
    r.o = end;
  }
  return q;
}

export function parseQueryLocation(u8) {
  const r = new Reader(u8);
  const total = r.u32();
  const out = [];
  const end = 4 + total;
  while (r.o < end && r.avail > 0) {
    const size = r.v.getUint16(r.o, true);
    if (size === 0) { r.o += 2; out.push(null); continue; }
    // A card's block is a list of (u16 size, u32 flag, data) ending with QUERY_END.
    const q = {};
    while (r.avail > 0) {
      const s = r.u16(); const flag = r.u32();
      const segEnd = r.o + s - 4;
      if (flag === C.QUERY_END) { r.o = segEnd; break; }
      r.o -= 6;
      const sub = new Reader(r.b.subarray(r.o, segEnd));
      Object.assign(q, parseQuery(sub) || {});
      r.o = segEnd;
    }
    out.push(q);
  }
  return out;
}

// --- WASI shim: the core only needs a clock and somewhere to print ------------
function wasi(getMem) {
  const ENOSYS = 52, EBADF = 8;
  return {
    clock_time_get(_id, _prec, out) { new DataView(getMem().buffer).setBigUint64(out, BigInt(Date.now()) * 1000000n, true); return 0; },
    fd_write(fd, iovs, n, nwritten) {
      const dv = new DataView(getMem().buffer); let total = 0; let s = "";
      for (let i = 0; i < n; i++) { const p = dv.getUint32(iovs + i * 8, true), l = dv.getUint32(iovs + i * 8 + 4, true); s += td.decode(new Uint8Array(getMem().buffer, p, l)); total += l; }
      dv.setUint32(nwritten, total, true); if (s.trim()) (fd === 2 ? console.warn : console.log)("[ocgcore]", s.trimEnd()); return 0;
    },
    fd_close() { return EBADF; }, fd_fdstat_get() { return EBADF; }, fd_fdstat_set_flags() { return EBADF; },
    fd_prestat_get() { return EBADF; }, fd_prestat_dir_name() { return EBADF; }, fd_read() { return EBADF; },
    fd_renumber() { return EBADF; }, fd_seek() { return EBADF; }, path_open() { return ENOSYS; },
    proc_exit(code) { throw new Error("ocgcore exited with " + code); },
  };
}

/**
 * Loads ocgcore.wasm. `source` is a URL, Response, ArrayBuffer or Uint8Array.
 * Each instance hosts one duel at a time (the callbacks are global to the module).
 */
export class OcgCore {
  static async load(source) {
    let bytes = source;
    if (typeof source === "string" || source instanceof URL) bytes = await (await fetch(source)).arrayBuffer();
    else if (typeof Response !== "undefined" && source instanceof Response) bytes = await source.arrayBuffer();
    const core = new OcgCore();
    let mem = null;
    const imports = {
      wasi_snapshot_preview1: wasi(() => mem),
      kx: {
        card_reader: (code, ptr) => core._cardReader(code, ptr),
        script_reader: (duel, namePtr) => core._scriptReader(duel, namePtr),
        log_handler: (ptr, t) => core._log(core._str(ptr), t),
      },
    };
    const { instance } = await WebAssembly.instantiate(bytes, imports);
    mem = instance.exports.memory;
    core.x = instance.exports;
    core.mem = mem;
    core.x._initialize();
    if (core.x.kx_card_data_size() !== 56) throw new Error("Unexpected OCG_CardData layout");
    return core;
  }

  constructor() { this.cards = null; this.scripts = null; this.onLog = null; this.missing = new Set(); }
  get version() { const v = this.x.kx_version(); return [Math.floor(v / 1000), v % 1000]; }
  _u8() { return new Uint8Array(this.mem.buffer); }
  _dv() { return new DataView(this.mem.buffer); }
  _str(ptr) { const u = this._u8(); let e = ptr; while (u[e]) e++; return td.decode(u.subarray(ptr, e)); }
  _alloc(bytes) { const p = this.x.kx_malloc(bytes.length + 1); const u = this._u8(); u.set(bytes, p); u[p + bytes.length] = 0; return p; }

  _cardReader(code, ptr) {
    const c = this.cards && this.cards(code);
    if (!c) return;
    const dv = this._dv();
    dv.setUint32(ptr + 0, code, true);
    dv.setUint32(ptr + 4, c.alias >>> 0, true);
    if (c.setcodes && c.setcodes.length) {
      const p = this.x.kx_malloc((c.setcodes.length + 1) * 2);
      const d = this._dv();
      c.setcodes.forEach((s, i) => d.setUint16(p + i * 2, s, true));
      d.setUint16(p + c.setcodes.length * 2, 0, true);
      dv.setUint32(ptr + 8, p, true);
    }
    const d = this._dv();
    d.setUint32(ptr + 12, c.type >>> 0, true);
    d.setUint32(ptr + 16, c.level >>> 0, true);
    d.setUint32(ptr + 20, c.attribute >>> 0, true);
    d.setBigUint64(ptr + 24, BigInt(c.race), true);
    d.setInt32(ptr + 32, c.atk | 0, true);
    d.setInt32(ptr + 36, c.def | 0, true);
    d.setUint32(ptr + 40, c.lscale >>> 0, true);
    d.setUint32(ptr + 44, c.rscale >>> 0, true);
    d.setUint32(ptr + 48, c.link_marker >>> 0, true);
  }

  _scriptReader(duel, namePtr) {
    const name = this._str(namePtr);
    const src = this.scripts && this.scripts(name);
    if (src == null) { this.missing.add(name); return 0; }
    return this.loadScriptText(duel, name, src);
  }

  _log(text, type) { if (this.onLog) this.onLog(text, type); }

  loadScriptText(duel, name, src) {
    const body = te.encode(src), nm = te.encode(name);
    const bp = this._alloc(body), np = this._alloc(nm);
    try { return this.x.kx_load_script(duel, bp, body.length, np); }
    finally { this.x.kx_free(bp); this.x.kx_free(np); }
  }

  loadScript(duel, name) {
    const src = this.scripts && this.scripts(name);
    if (src == null) { this.missing.add(name); return 0; }
    return this.loadScriptText(duel, name, src);
  }

  /** opts: { seed: BigInt[4], flags: BigInt, players: [{lp,start,draw}, {lp,start,draw}] } */
  createDuel(opts) {
    const sp = this.x.kx_malloc(32);
    const dv = this._dv();
    opts.seed.forEach((s, i) => dv.setBigUint64(sp + i * 8, BigInt.asUintN(64, BigInt(s)), true));
    const [a, b] = opts.players;
    const duel = this.x.kx_create_duel(sp, BigInt.asUintN(64, BigInt(opts.flags)), a.lp, a.start, a.draw, b.lp, b.start, b.draw);
    this.x.kx_free(sp);
    if (!duel) throw new Error("Duel creation failed");
    return duel;
  }
  destroyDuel(d) { this.x.kx_destroy_duel(d); }
  newCard(d, { team, duelist = 0, code, controller, location, sequence = 0, position }) {
    this.x.kx_new_card(d, team, duelist, code, controller ?? team, location, sequence, position);
  }
  startDuel(d) { this.x.kx_start_duel(d); }
  process(d) { return this.x.kx_process(d); }
  _buf(fn) {
    const lp = this.x.kx_malloc(4);
    const p = fn(lp);
    const len = this._dv().getUint32(lp, true);
    this.x.kx_free(lp);
    return p && len ? this._u8().slice(p, p + len) : new Uint8Array(0);
  }
  getMessages(d) { return parseMessages(this._buf((lp) => this.x.kx_get_message(d, lp))); }
  setResponse(d, bytes) { const p = this.x.kx_malloc(bytes.length || 1); this._u8().set(bytes, p); this.x.kx_set_response(d, p, bytes.length); this.x.kx_free(p); }
  queryCount(d, team, location) { return this.x.kx_query_count(d, team, location); }
  query(d, flags, con, location, seq, overlay = 0) {
    const u = this._buf((lp) => this.x.kx_query(d, lp, flags, con, location, seq, overlay));
    return u.length ? parseQuery(new Reader(u)) : null;
  }
  queryLocation(d, flags, con, location) { return parseQueryLocation(this._buf((lp) => this.x.kx_query_location(d, lp, flags, con, location))); }
}
