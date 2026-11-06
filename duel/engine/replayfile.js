// Replay files from desktop duel clients: ".yrpX" (a stream of duel messages, LZMA-compressed, that carries the classic
// replay inside it) and ".yrp" ("YRP1": seed, players, duel options, both decks in engine order, then every answer).
// The Arena replays a file by re-running the duel on its own engine with the same seed, decks and answers, the way
// those clients' classic replay mode does. Layout from gframe/replay.cpp (ReplayHeader / ExtendedReplayHeader).
const YRP1 = 0x31707279, YRPX = 0x58707279;
const F = { COMPRESSED: 0x1, TAG: 0x2, SINGLE: 0x8, NEWREPLAY: 0x20, HAND_TEST: 0x40, DUEL64: 0x100, EXT: 0x200 };
const OLD_REPLAY_MODE = 231;

// ---- LZMA ("LZMA1", as written by LzmaLib's LzmaCompress: 5 property bytes kept in the header, no size field)
/** Decodes `src` (Uint8Array) to exactly `outSize` bytes. props: 5 bytes (lc/lp/pb byte + dictionary size). */
export function lzmaDecode(src, props, outSize) {
  let d = props[0];
  if (d >= 9 * 5 * 5) throw new Error("bad LZMA properties");
  const lc = d % 9; d = (d / 9) | 0; const lp = d % 5, pb = (d / 5) | 0;
  let dictSize = props[1] | (props[2] << 8) | (props[3] << 16) | (props[4] << 24) >>> 0;
  if (dictSize < 4096) dictSize = 4096;
  const out = new Uint8Array(outSize);
  // range decoder
  let ip = 0, range = 0xffffffff, code = 0;
  if (src[ip++] !== 0) throw new Error("bad LZMA stream");
  for (let i = 0; i < 4; i++) code = ((code << 8) | src[ip++]) >>> 0;
  const kTop = 1 << 24;
  const norm = () => { if (range >>> 0 < kTop) { range = (range << 8) >>> 0; code = ((code << 8) | (ip < src.length ? src[ip++] : 0)) >>> 0; } };
  const bit = (p, i) => {
    const bound = ((range >>> 11) * p[i]) >>> 0;
    let b;
    if (code >>> 0 < bound) { range = bound; p[i] += (2048 - p[i]) >> 5; b = 0; }
    else { range = (range - bound) >>> 0; code = (code - bound) >>> 0; p[i] -= p[i] >> 5; b = 1; }
    norm(); return b;
  };
  const direct = (n) => { let r = 0; while (n--) { range = range >>> 1; let t = (code - range) >>> 31; code = (code - (range & (t - 1))) >>> 0; r = (r << 1) + (1 - t); norm(); } return r >>> 0; };
  const P = (n) => new Uint16Array(n).fill(1024);
  const tree = (p, base, nbits) => { let m = 1; for (let i = 0; i < nbits; i++) m = (m << 1) + bit(p, base + m); return m - (1 << nbits); };
  const rtree = (p, base, nbits) => { let m = 1, s = 0; for (let i = 0; i < nbits; i++) { const b = bit(p, base + m); m = (m << 1) + b; s |= b << i; } return s; };
  const lenCoder = () => ({ choice: P(2), low: P(16 << 3), mid: P(16 << 3), high: P(256) });
  const decLen = (lc2, posState) => {
    if (!bit(lc2.choice, 0)) return tree(lc2.low, posState << 3, 3);
    if (!bit(lc2.choice, 1)) return 8 + tree(lc2.mid, posState << 3, 3);
    return 16 + tree(lc2.high, 0, 8);
  };
  const literal = P(0x300 << (lc + lp)), isMatch = P(12 << 4), isRep = P(12), isRepG0 = P(12), isRepG1 = P(12), isRepG2 = P(12), isRep0Long = P(12 << 4);
  const posSlot = P(4 << 6), posDecoders = P(1 + 114), align = P(16), lenD = lenCoder(), repLenD = lenCoder();
  let state = 0, rep0 = 0, rep1 = 0, rep2 = 0, rep3 = 0, op = 0;
  const pbMask = (1 << pb) - 1, lpMask = (1 << lp) - 1;
  while (op < outSize) {
    const posState = op & pbMask;
    if (!bit(isMatch, (state << 4) + posState)) {
      const prev = op > 0 ? out[op - 1] : 0;
      const base = 0x300 * (((op & lpMask) << lc) + (prev >> (8 - lc)));
      let sym = 1;
      if (state >= 7) {
        let matchByte = out[op - rep0 - 1];
        do {
          const mb = (matchByte >> 7) & 1; matchByte <<= 1;
          const b = bit(literal, base + ((1 + mb) << 8) + sym);
          sym = (sym << 1) | b;
          if (mb !== b) break;
        } while (sym < 0x100);
      }
      while (sym < 0x100) sym = (sym << 1) | bit(literal, base + sym);
      out[op++] = sym & 0xff;
      state = state < 4 ? 0 : state < 10 ? state - 3 : state - 6;
      continue;
    }
    let len;
    if (bit(isRep, state)) {
      if (op === 0) throw new Error("bad LZMA stream");
      if (!bit(isRepG0, state)) {
        if (!bit(isRep0Long, (state << 4) + posState)) { state = state < 7 ? 9 : 11; out[op] = out[op - rep0 - 1]; op++; continue; }
      } else {
        let dist;
        if (!bit(isRepG1, state)) dist = rep1;
        else { if (!bit(isRepG2, state)) dist = rep2; else { dist = rep3; rep3 = rep2; } rep2 = rep1; }
        rep1 = rep0; rep0 = dist;
      }
      len = decLen(repLenD, posState);
      state = state < 7 ? 8 : 11;
    } else {
      rep3 = rep2; rep2 = rep1; rep1 = rep0;
      len = decLen(lenD, posState);
      state = state < 7 ? 7 : 10;
      const lenState = Math.min(len, 3);
      const slot = tree(posSlot, lenState << 6, 6);
      if (slot < 4) rep0 = slot;
      else {
        const nd = (slot >>> 1) - 1;
        let dist = ((2 | (slot & 1)) << nd) >>> 0;
        if (slot < 14) dist = (dist + rtree(posDecoders, dist - slot, nd)) >>> 0;
        else { dist = (dist + ((direct(nd - 4) << 4) >>> 0)) >>> 0; dist = (dist + rtree(align, 0, 4)) >>> 0; }
        rep0 = dist;
      }
      if (rep0 === 0xffffffff) break;               // end marker
      if (rep0 >= op || rep0 >= dictSize) throw new Error("bad LZMA distance");
    }
    len += 2;
    for (let i = 0; i < len && op < outSize; i++, op++) out[op] = out[op - rep0 - 1];
  }
  return out;
}

// ---- reading
function header(buf) {
  if (buf.length < 32) throw new Error("This isn't a replay file.");
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const h = { id: dv.getUint32(0, true), version: dv.getUint32(4, true), flag: dv.getUint32(8, true), timestamp: dv.getUint32(12, true), datasize: dv.getUint32(16, true), props: buf.slice(24, 32), size: 32 };
  if (h.id !== YRP1 && h.id !== YRPX) throw new Error("This isn't a replay file.");
  if (h.flag & F.EXT) {
    if (buf.length < 72) throw new Error("The replay file is cut short.");
    h.headerVersion = dv.getBigUint64(32, true);
    h.seed = [0, 1, 2, 3].map((i) => dv.getBigUint64(40 + i * 8, true));
    h.size = 72;
  }
  return h;
}
function body(buf, h) {
  const data = buf.subarray(h.size);
  if (!(h.flag & F.COMPRESSED)) return data;
  return lzmaDecode(data, h.props, h.datasize);
}
function reader(u) {
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength); let o = 0;
  const need = (n) => { if (o + n > u.length) throw new Error("The replay file is cut short."); };
  return {
    get pos() { return o; }, get left() { return u.length - o; },
    u8() { need(1); return dv.getUint8(o++); },
    u16() { need(2); const v = dv.getUint16(o, true); o += 2; return v; },
    u32() { need(4); const v = dv.getUint32(o, true); o += 4; return v; },
    u64() { need(8); const v = dv.getBigUint64(o, true); o += 8; return v; },
    bytes(n) { need(n); const v = u.slice(o, o + n); o += n; return v; },
    name() { let t = ""; for (let i = 0; i < 20; i++) { const c = this.u16(); if (c && t.length === i) t += String.fromCharCode(c); } return t; },
  };
}
function names(r, h) {
  const out = [];
  if (h.flag & F.SINGLE) return { names: [r.name(), r.name()], home: 1, opp: 1 };
  const count = () => (h.flag & F.NEWREPLAY ? r.u32() : h.flag & F.TAG ? 2 : 1);
  const home = count(); for (let i = 0; i < home; i++) out.push(r.name());
  const opp = count(); for (let i = 0; i < opp; i++) out.push(r.name());
  return { names: out, home, opp };
}
/** A classic YRP1 replay, ready to re-run. */
function readYrp1(buf) {
  const h = header(buf);
  if (h.id !== YRP1) throw new Error("not YRP1");
  if (!(h.flag & F.EXT) || h.headerVersion !== 1n) throw new Error("This replay is from an older client version that recorded no seed; it can't be re-run.");
  if (h.flag & F.SINGLE && !(h.flag & F.HAND_TEST)) throw new Error("Puzzle replays aren't supported.");
  const r = reader(body(buf, h));
  const n = names(r, h);
  if (n.home !== 1 || n.opp !== 1) throw new Error("Tag duel replays aren't supported yet: only 1 vs 1.");
  const params = { lp: r.u32(), start: r.u32(), draw: r.u32(), flags: h.flag & F.DUEL64 ? r.u64() : BigInt(r.u32()) };
  if (h.flag & F.SINGLE) { const len = r.u16(); r.bytes(len); }
  const decks = [];
  for (let i = 0; i < 2; i++) { const main = []; for (let k = r.u32(); k--;) main.push(r.u32()); const extra = []; for (let k = r.u32(); k--;) extra.push(r.u32()); decks.push({ main, extra }); }
  const rules = [];
  if (h.flag & F.NEWREPLAY && !(h.flag & F.HAND_TEST)) for (let k = r.u32(); k--;) rules.push(r.u32());
  const responses = [];
  while (r.left > 0) { const len = r.u8(); if (!len) break; responses.push(r.bytes(len)); }
  return { kind: "yrp", seed: h.seed, time: h.timestamp, names: n.names, params, decks, rules, responses };
}
/** Reads a .yrp or .yrpX file (Uint8Array). Throws a readable message when it can't be replayed. */
export function readReplay(buf) {
  const h = header(buf);
  if (h.id === YRP1) return readYrp1(buf);
  // YRPX: names, duel options, then packets [message u8, length u32, data]; the classic replay is the packet
  // OLD_REPLAY_MODE (231). Everything needed to re-run the duel is in there.
  const r = reader(body(buf, h));
  const n = names(r, h);
  if (h.flag & F.DUEL64) r.u64(); else r.u32();
  let inner = null, turns = 0;
  while (r.left >= 5) {
    const msg = r.u8(), len = r.u32();
    if (len > r.left) break;
    const data = r.bytes(len);
    if (msg === 40) turns++;                                    // MSG_NEW_TURN
    if (msg === OLD_REPLAY_MODE && !inner) inner = data;
  }
  if (!inner) throw new Error("This replay has no recorded answers in it (it was saved without the classic replay), so it can't be re-run.");
  const out = readYrp1(inner);
  if (n.names.length === out.names.length) out.names = n.names;   // the newer file keeps full names
  out.kind = "yrpX"; out.turns = turns;
  return out;
}
