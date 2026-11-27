/* KodeX 10.0 (v67): the combo sheet. Each play is a tile (what it used, the card, what it led to), tiles flow in a
   grid, and the sheet grows as tall as the combo needs. Cards keep the zone, position and source a replay gave them.
   Created by Castel Noleal, creator of MEIOCG. A project of Meta Insider OCG since 2023. */
for (const a of [
  ['mat', 'Use as material'],
  ['att', 'Attach as Xyz material'],
  ['ex', 'To the Extra Deck'],
  ['deck', 'Return to the Deck'],
  ['put', 'Place on the field'],
  ['trib', 'Tribute'],
  ['dis', 'Discard'],
  ['des', 'Destroy']
])
  if (!CB_ACT.some(x => x[0] === a[0])) CB_ACT.push(a);
Object.assign(CB_SHORT, {
  mat: 'Material',
  att: 'Attach',
  ex: 'To Extra',
  deck: 'To Deck',
  put: 'Place',
  trib: 'Tribute',
  dis: 'Discard',
  des: 'Destroy'
});
const CB_RESULT = new Set(['add', 'gy', 'ban', 'mat', 'att', 'ex', 'deck', 'put', 'trib', 'dis', 'des']);
const CB_GROUP = {
  add: 'ADD TO HAND',
  gy: 'SEND TO GY',
  ban: 'BANISH',
  mat: 'USING',
  att: 'USING',
  ex: 'TO EXTRA DECK',
  deck: 'RETURN TO DECK',
  put: 'PLACE',
  trib: 'TRIBUTE',
  dis: 'DISCARD',
  des: 'DESTROY',
  ss: 'SPECIAL SUMMON',
  ns: 'NORMAL SUMMON',
  set: 'SET',
  act: 'ACTIVATE',
  scale: 'PENDULUM SCALE',
  eff: 'EFFECT',
  auto: 'THEN'
};
/* the opponent's side (o:1): what happens to their cards, or to yours placed on their field */
const CB_GROUP_OPP = {
  dis: 'OPPONENT DISCARDS',
  des: "DESTROY THE OPPONENT'S",
  ban: "BANISH THE OPPONENT'S",
  gy: "SEND THE OPPONENT'S",
  trib: "TRIBUTE THE OPPONENT'S",
  ss: "TO THE OPPONENT'S FIELD",
  put: "TO THE OPPONENT'S FIELD",
  add: "TO THE OPPONENT'S HAND",
  deck: "TO THE OPPONENT'S DECK"
};
const cbPlaceOf = x => {
  const o = {};
  for (const [k, max, min] of [
    ['z', 7, 0],
    ['p', 3, 1],
    ['f', 7, 1],
    ['s', 7, 0]
  ]) {
    const v = x && x[k] != null ? Number(x[k]) : NaN;
    if (Number.isInteger(v) && v >= min && v <= max) o[k] = v;
  }
  if (x && (x.o === 1 || x.o === true)) o.o = 1; // on the opponent's side (summoned there, or one of their cards)
  if (x && (x.b === 1 || x.b === true)) o.o = o.b = 1; // played by the opponent (a hand trap, a play in their turn)
  if (x && (x.r === 'm' || x.r === 's')) o.r = x.r; // the row of z: Monster Zones or Spell & Trap Zones (a Pendulum Zone)
  return o;
};
/* ---------- the combo code, version 2: more steps, the new moves, and each card's placement ---------- */
const CBQ2 = {
  cell: 8,
  cal: 6,
  maxRows: 90,
  foot: 74,
  acts: [
    'auto',
    'act',
    'ns',
    'ss',
    'add',
    'set',
    'scale',
    'eff',
    'gy',
    'ban',
    'mat',
    'att',
    'ex',
    'deck',
    'put',
    'trib',
    'dis',
    'des'
  ]
};
function cbqPack(list, withExtra, withPlace) {
  const bits = [],
    put = (v, n) => {
      for (let i = n - 1; i >= 0; i--) bits.push(Math.floor(v / 2 ** i) % 2);
    },
    num = id => {
      const n = Number(pcode(String(id)));
      return Number.isInteger(n) && n > 0 && n < 2 ** 34 ? n : 0;
    };
  const dict = [],
    ref = id => {
      const n = num(id);
      if (!n) return -1;
      let i = dict.indexOf(n);
      if (i < 0) {
        if (dict.length >= 127) return -1;
        dict.push(n);
        i = dict.length - 1;
      }
      return i;
    };
  const cs = list.slice(0, 7).map(c => {
    const d = c.deckId ? deckById(c.deckId) : null;
    return {
      t: [...new TextEncoder().encode(cbTitle(c))].slice(0, 40),
      size: d ? Math.max(c.hand.length, copies(d, 'main').length) : 40,
      hand: c.hand
        .map(ref)
        .filter(i => i >= 0)
        .slice(0, 12),
      extra:
        withExtra && d
          ? copies(d, 'extra')
              .map(x => ref(pcOf(x)))
              .filter(i => i >= 0)
              .slice(0, 15)
          : [],
      lines: c.lines
        .slice(0, 60)
        .map(l =>
          l
            .slice(0, 12)
            .map(n =>
              n.cards
                .map(x => [ref(x.c), Math.max(0, CBQ2.acts.indexOf(x.a)), withPlace ? cbPlaceOf(x) : {}])
                .filter(x => x[0] >= 0)
                .slice(0, 6)
            )
            .filter(n => n.length)
        )
        .filter(l => l.length)
    };
  });
  put(3, 4); // version 3: 5-bit moves, and the opponent's side
  put(dict.length, 7);
  for (const n of dict) put(n, 34);
  put(cs.length, 3);
  for (const c of cs) {
    put(c.t.length, 6);
    for (const b of c.t) put(b, 8);
    put(Math.min(60, c.size), 6);
    put(c.hand.length, 4);
    for (const i of c.hand) put(i, 7);
    put(c.extra.length, 4);
    for (const i of c.extra) put(i, 7);
    put(c.lines.length, 6);
    for (const l of c.lines) {
      put(l.length, 4);
      for (const n of l) {
        put(n.length, 3);
        for (const [i, a, pl] of n) {
          put(i, 7);
          put(a, 5);
          const has = pl.z != null || pl.p != null || pl.f != null || !!pl.o;
          put(has ? 1 : 0, 1);
          if (has) {
            put(pl.z != null ? pl.z + 1 : 0, 4);
            put(pl.p || 0, 2);
            put(pl.f || 0, 3);
            put(pl.s != null ? pl.s + 1 : 0, 4);
            put(pl.o ? 1 : 0, 1);
          }
        }
      }
    }
  }
  while (bits.length % 8) bits.push(0);
  const body = new Uint8Array(bits.length / 8);
  for (let i = 0; i < body.length; i++) {
    let v = 0;
    for (let k = 0; k < 8; k++) v = v * 2 + bits[i * 8 + k];
    body[i] = v;
  }
  const out = new Uint8Array(body.length + 8);
  out[0] = 0x4d;
  out[1] = 0x43;
  out[2] = body.length >> 8;
  out[3] = body.length & 255;
  out.set(body, 4);
  const crc = cbqCrc(out.subarray(0, body.length + 4));
  out.set([crc >>> 24, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255], body.length + 4);
  return out;
}
function cbqUnpack(bytes) {
  if (bytes.length < 9 || bytes[0] !== 0x4d || bytes[1] !== 0x43) return null;
  const len = (bytes[2] << 8) | bytes[3];
  if (bytes.length < len + 8) return null;
  const crc = cbqCrc(bytes.subarray(0, len + 4)),
    got = ((bytes[len + 4] << 24) | (bytes[len + 5] << 16) | (bytes[len + 6] << 8) | bytes[len + 7]) >>> 0;
  if (crc !== got) return null;
  let p = 32;
  const end = (len + 4) * 8,
    get = n => {
      let v = 0;
      for (let i = 0; i < n; i++) {
        if (p >= end) throw new Error('short');
        v = v * 2 + ((bytes[p >> 3] >> (7 - (p & 7))) & 1);
        p++;
      }
      return v;
    };
  try {
    const ver = get(4);
    if (ver < 1 || ver > 3) return null;
    const dict = [];
    for (let n = get(7); n > 0; n--) dict.push(get(34));
    const at = i => dict[i] || 0,
      out = [];
    for (let n = get(3); n > 0; n--) {
      const tb = [];
      for (let k = get(6); k > 0; k--) tb.push(get(8));
      const c = {
        title: new TextDecoder().decode(new Uint8Array(tb)),
        deckSize: get(6),
        hand: [],
        extra: [],
        lines: []
      };
      for (let k = get(4); k > 0; k--) c.hand.push(at(get(7)));
      for (let k = get(4); k > 0; k--) c.extra.push(at(get(7)));
      for (let l = get(ver === 1 ? 5 : 6); l > 0; l--) {
        const line = [];
        for (let k = get(4); k > 0; k--) {
          const cards = [];
          for (let j = get(3); j > 0; j--) {
            const id = at(get(7)),
              x = { c: id, a: CBQ2.acts[get(ver === 3 ? 5 : 4)] || 'auto' };
            if (ver >= 2 && get(1)) {
              const z = get(4),
                pp = get(2),
                f = get(3),
                s = get(4);
              if (z) x.z = z - 1;
              if (pp) x.p = pp;
              if (f) x.f = f;
              if (s) x.s = s - 1;
              if (ver === 3 && get(1)) x.o = 1;
            }
            if (id) cards.push(x);
          }
          if (cards.length) line.push({ cards, note: '' });
        }
        if (line.length) c.lines.push(line);
      }
      c.hand = c.hand.filter(Boolean);
      c.extra = c.extra.filter(Boolean);
      if (c.hand.length || c.lines.length) out.push(c);
    }
    return out.length ? out : null;
  } catch (e) {
    return null;
  }
}
/** The strip for a combo sheet: { h (space it needs above the footer), draw(H) → svg }. Null when it cannot carry the combos. */
function cbqBand(list, W, H, pad, P) {
  const cols = Math.floor((W - pad * 2) / CBQ2.cell),
    per = cols - CBQ2.cal;
  let bytes = null,
    rows = 0;
  for (const [n, ex, pl] of [
    [list.length, true, true],
    [list.length, false, true],
    [list.length, false, false],
    [1, false, true],
    [1, false, false]
  ]) {
    const b = cbqPack(list.slice(0, n), ex, pl),
      r = Math.ceil((b.length * 8) / per);
    if (r <= CBQ2.maxRows) {
      bytes = b;
      rows = r;
      break;
    }
  }
  if (!bytes) return null;
  const c = CBQ2.cell,
    bit = i => (i < bytes.length * 8 ? (bytes[i >> 3] >> (7 - (i & 7))) & 1 : (i * 7 + 3) % 5 < 2 ? 1 : 0);
  const draw = Hh => {
    const y1 = Hh - CBQ2.foot;
    let d = '';
    for (let r = 0; r < rows; r++) {
      const y = y1 - c * (r + 1);
      let run = -1;
      for (let i = 0; i <= cols; i++) {
        const on = i < cols && (i < CBQ2.cal ? i % 2 === 0 : bit(r * per + i - CBQ2.cal));
        if (on && run < 0) run = i;
        if (!on && run >= 0) {
          d += `M${pad + run * c} ${y}h${(i - run) * c}v${c}h${-(i - run) * c}z`;
          run = -1;
        }
      }
    }
    const top = y1 - rows * c;
    return `<g><rect x="${pad - 10}" y="${top - 10}" width="${cols * c + 20}" height="${rows * c + 20}" rx="8" fill="${P.bg}"/><path d="${d}" fill="${P.ink}"/><text x="${pad - 10}" y="${top - 18}" font-family="'Chakra Petch',Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="3" fill="${P.mute}">COMBO CODE · OPEN THIS IMAGE IN KODEX TO LOAD THE COMBO AND ITS REPLAY</text></g>`;
  };
  return { h: rows * c + 46, rows, draw, svg: draw(H) };
}
/** Reads the strip back from a picture of a combo sheet of any height (also after resizing). Returns the combos or null. */
function cbqRead(img) {
  const w = img.naturalWidth || img.width,
    h = img.naturalHeight || img.height;
  if (!w || !h || h < w * 0.4 || h > w * 12) return null;
  const N = DI_SIZE,
    full = Math.round((h * N) / w),
    R = Math.min(full, CBQ2.maxRows * CBQ2.cell + 140),
    cv = document.createElement('canvas');
  cv.width = N;
  cv.height = R;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, R - full, N, full);
  let px;
  try {
    px = g.getImageData(0, 0, N, R).data;
  } catch (e) {
    return null;
  }
  const pad = 56,
    c = CBQ2.cell,
    cols = Math.floor((N - pad * 2) / c),
    per = cols - CBQ2.cal,
    y1 = R - CBQ2.foot;
  const lum = (x, y) => {
    let s = 0;
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++) {
        const X = Math.max(0, Math.min(N - 1, Math.round(x) + a)),
          Y = Math.max(0, Math.min(R - 1, Math.round(y) + b)),
          i = (Y * N + X) * 4;
        s += px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11;
      }
    return s / 9;
  };
  const row = (r, dx, dy, sc) => {
    const y = R - (R - (y1 - c * (r + 0.5))) * sc + dy,
      X = i => (pad + c * (i + 0.5) - N / 2) * sc + N / 2 + dx;
    if (y < 1) return null;
    let on = 0,
      off = 0;
    for (let i = 0; i < CBQ2.cal; i++) {
      const v = lum(X(i), y);
      if (i % 2 === 0) on += v;
      else off += v;
    }
    on /= 3;
    off /= 3;
    if (Math.abs(on - off) < 36) return null;
    const th = (on + off) / 2,
      pos = on > off,
      out = [];
    for (let i = CBQ2.cal; i < cols; i++) {
      const v = lum(X(i), y);
      out.push(v > th === pos ? 1 : 0);
    }
    return out;
  };
  const toBytes = bits => {
    const b = new Uint8Array(bits.length >> 3);
    for (let i = 0; i < b.length; i++) {
      let v = 0;
      for (let k = 0; k < 8; k++) v = v * 2 + bits[i * 8 + k];
      b[i] = v;
    }
    return b;
  };
  for (const sc of [1, 0.997, 1.003, 0.994, 1.006])
    for (let dy = 0; Math.abs(dy) <= 8; dy = dy > 0 ? -dy : -dy + 2)
      for (let dx = 0; Math.abs(dx) <= 8; dx = dx > 0 ? -dx : -dx + 2) {
        const r0 = row(0, dx, dy, sc);
        if (!r0) continue;
        const hd = toBytes(r0.slice(0, 32));
        if (hd[0] !== 0x4d || hd[1] !== 0x43) continue;
        const need = Math.ceil(((((hd[2] << 8) | hd[3]) + 8) * 8) / per);
        if (need < 1 || need > CBQ2.maxRows) continue;
        let bits = r0,
          okRows = true;
        for (let r = 1; r < need; r++) {
          const x = row(r, dx, dy, sc);
          if (!x) {
            okRows = false;
            break;
          }
          bits = bits.concat(x);
        }
        if (!okRows) continue;
        const got = cbqUnpack(toBytes(bits));
        if (got) return got;
      }
  return null;
}
function cbAdopt(raw, from) {
  const c = cbNew({
    title: String(raw.title || '').slice(0, 60),
    hand: (raw.hand || []).map(cbqId).slice(0, 12),
    lines: (raw.lines || [])
      .slice(0, 60)
      .map(l =>
        l
          .slice(0, 12)
          .map(n => ({
            cards: (n.cards || [])
              .slice(0, 6)
              .map(x => ({ c: cbqId(x.c), a: CBQ2.acts.includes(x.a) ? x.a : 'auto', ...cbPlaceOf(x) })),
            note: String(n.note || '').slice(0, 80)
          }))
          .filter(n => n.cards.length)
      )
      .filter(l => l.length)
  });
  if (from) c.from = from;
  if (!cbHas(c)) return null;
  // two turns: a replay read with its next turn (the opponent's) brings where that turn starts
  if (Number.isInteger(raw.t2) && raw.t2 >= 0) {
    c.turns = 2;
    c.t2 = Math.min(raw.t2, c.lines.length);
  }
  // a combo read from a replay brings the table exactly as it stood at the end of that turn
  const eb = cbBoardOf(raw.endBoard);
  if (eb) c.endBoard = { sig: cbLinesSig(c.lines), b: eb };
  cbStore(c);
  return c;
}
/** The steps as a short fingerprint: the replay's real end board is used while the steps are still the ones it came with. */
function cbLinesSig(lines) {
  const t = JSON.stringify(
    (lines || []).map(l => l.map(n => n.cards.map(x => [x.c, x.a, x.z, x.r, x.f, x.s, x.o ? 1 : 0, x.p])))
  );
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619) >>> 0;
  return h.toString(36) + ':' + t.length;
}
function cbBoardOf(b) {
  if (!Array.isArray(b) || b.length !== 2) return null;
  const z = v =>
    v && /^\d{1,10}$/.test(String(v.id))
      ? { id: String(v.id), pos: ['atk', 'def', 'down'].includes(v.pos) ? v.pos : 'atk' }
      : null;
  return b.map(sd => ({
    m: Array.from({ length: 7 }, (_, i) => z(sd && sd.m && sd.m[i])),
    s: Array.from({ length: 6 }, (_, i) => z(sd && sd.s && sd.s[i]))
  }));
}
/* ---------- what is on the field after the combo (for the sheet's "Final board") ----------
   Each card is followed zone by zone on both sides of the table, the way the Arena plays it back: a card summoned to the
   opponent's field (o:1) stands there, and one of their cards that the combo removes leaves their side. */
function cbWalk(c) {
  const hand = c.hand.map(String),
    gone = [];
  const B = [
    { m: Array(7).fill(null), s: Array(6).fill(null) },
    { m: Array(7).fill(null), s: Array(6).fill(null) }
  ];
  let normal = false;
  const txt = id => String((cbCard(id) || {}).type || ''),
    race = id => String((cbCard(id) || {}).race || ''),
    isMon = id => /monster/i.test(txt(id)),
    isX = id => /link|xyz|synchro|fusion/i.test(txt(id)),
    isPend = id => /pendulum/i.test(txt(id)),
    stays = id => isMon(id) || /continuous|field|equip/i.test(race(id));
  const drop = (a, id) => {
    const i = a.indexOf(String(id));
    if (i >= 0) a.splice(i, 1);
    return i >= 0;
  };
  // where a card stands: [side, row, zone]; the side asked for is looked at first
  const where = (id, pref = 0) => {
    for (const sd of [pref, 1 - pref])
      for (const r of ['m', 's']) {
        const i = B[sd][r].findIndex(z => z && z.id === String(id));
        if (i >= 0) return [sd, r, i];
      }
    return null;
  };
  const onField = id => !!where(id);
  const leave = (id, x) => {
    let w = null;
    if (x.s != null)
      for (const sd of [x.o ? 1 : 0, x.o ? 0 : 1])
        for (const r of ['m', 's']) if (!w && B[sd][r][x.s] && B[sd][r][x.s].id === String(id)) w = [sd, r, x.s];
    w = w || where(id, x.o ? 1 : 0);
    if (!w) return false;
    B[w[0]][w[1]][w[2]] = null;
    return true;
  };
  const place = (id, x, a) => {
    const sd = x.o ? 1 : 0,
      b = B[sd],
      // a Pendulum Monster activated, set as a scale or placed by an effect goes to a Pendulum Zone; a combo from a
      // replay says which row it really went to (r)
      mon =
        x.r === 'm' || (x.r !== 's' && isMon(id) && !(a === 'scale' || ((a === 'act' || a === 'put') && isPend(id))));
    const pos = x.p === 3 || (a === 'set' && mon) ? 'down' : x.p === 2 ? 'def' : 'atk';
    if (mon) {
      let z = x.z != null && x.z < 7 && !b.m[x.z] ? x.z : -1;
      if (z < 0 && isX(id)) z = [5, 6].find(i => !b.m[i] && !B[1 - sd].m[i]) ?? -1;
      if (z < 0) z = [2, 1, 3, 0, 4].find(i => !b.m[i]) ?? -1;
      if (z >= 0) b.m[z] = { id: String(id), pos };
    } else {
      const field = /field/i.test(race(id)) && !isMon(id);
      let z = field ? 5 : x.z != null && x.z < 6 && x.r !== 'm' && !b.s[x.z] ? x.z : -1;
      if (z < 0) z = (a === 'scale' || isPend(id) ? [0, 4] : [2, 1, 3, 0, 4]).find(i => !b.s[i]) ?? -1;
      if (z >= 0) b.s[z] = { id: String(id), pos: a === 'set' || (a === 'put' && x.p === 3) ? 'down' : 'atk' };
    }
  };
  // "Auto" is decided the way the Arena decides it: by where the card is and what it is
  const lines = c.lines.map(l =>
    l.map(n => ({
      note: n.note || '',
      cards: n.cards.map(x => {
        const id = String(x.c);
        let a = x.a;
        if (a === 'auto')
          a = onField(id)
            ? 'eff'
            : gone.includes(id)
              ? 'eff'
              : hand.includes(id)
                ? isMon(id)
                  ? normal
                    ? 'ss'
                    : 'ns'
                  : 'act'
                : isX(id)
                  ? 'ss'
                  : 'add';
        if (a === 'ns') normal = true;
        if (a === 'ns' || a === 'ss' || a === 'set' || a === 'scale' || a === 'put') {
          if (x.f === 6) leave(id, { ...x, o: 0 });
          else if (x.f === 1 || x.f == null) drop(hand, id);
          drop(gone, id);
          place(id, x, a);
        } else if (a === 'act') {
          if (!onField(id)) {
            drop(hand, id);
            if (stays(id)) place(id, x, a);
            else gone.push(id);
          } else {
            const w = where(id);
            if (w && B[w[0]][w[1]][w[2]].pos === 'down') B[w[0]][w[1]][w[2]].pos = 'atk';
          }
        } else if (a === 'add') {
          if (x.f === 6 || (x.f == null && onField(id))) leave(id, x);
          drop(gone, id);
          if (!x.o) hand.push(id);
        } else if (CB_RESULT.has(a)) {
          if (x.f === 6) leave(id, x);
          else if (x.f === 1 || a === 'dis') {
            if (!x.o) drop(hand, id);
          } else if (x.f == null) {
            if (!leave(id, x) && !x.o) drop(hand, id);
          }
          if (a !== 'deck' && a !== 'att') gone.push(id);
        }
        return Object.assign({}, x, { a });
      })
    }))
  );
  const ids = sd => [...B[sd].m, ...B[sd].s].filter(Boolean).map(z => z.id);
  return { lines, field: ids(0), opp: ids(1), hand, board: B };
}
const cbFinalBoard = c => {
  const w = cbWalk(c);
  // from a replay, with its steps unchanged: the board exactly as the duel left it
  if (c.endBoard && c.endBoard.b && c.endBoard.sig === cbLinesSig(c.lines)) {
    const B = cbBoardOf(c.endBoard.b);
    if (B) {
      const ids = sd => [...B[sd].m, ...B[sd].s].filter(Boolean).map(z => z.id);
      return { field: ids(0), hand: w.hand, opp: ids(1), board: B };
    }
  }
  return { field: w.field, hand: w.hand, opp: w.opp, board: w.board };
};
/* ---------- the combo sheet ---------- */
function buildComboSvg(list, meta, bg) {
  const W = meta.W || DI_SIZE, // wider for the big square sheet; the steps grid gains columns with it
    P = DI_PAL[meta.design] || DI_PAL.night,
    clean = meta.design === 'clean',
    X = v =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
  const F = "'Chakra Petch','Plus Jakarta Sans',Arial,sans-serif",
    B = "'Plus Jakarta Sans','Chakra Petch',Arial,sans-serif",
    pad = 56,
    pf = meta.profile ? diProfile() : null;
  const acc = clean ? P.accent : P.gold,
    title = String(meta.title || 'Combos'),
    right = pf ? 430 : 0,
    ts = Math.max(40, Math.min(76, Math.floor((W - pad * 2 - right) / (title.length * 0.62))));
  const band = cbqBand(list, W, 1600, pad, P),
    o = [],
    cuts = []; // places a page can end without cutting a card (for square pages)
  let y = 206 + ts;
  cuts.push(y - 20);
  const fit = (t, max, fs) => {
    t = String(t || '');
    const n = Math.max(3, Math.floor(max / (fs * 0.56)));
    return t.length > n ? t.slice(0, n - 1) + '…' : t;
  };
  const wrap = (t, max, fs, lines) => {
    const n = Math.max(4, Math.floor(max / (fs * 0.54))),
      out = [];
    let cur = '';
    for (const w of String(t || '').split(/\s+/)) {
      if (!w) continue;
      const tr = cur ? cur + ' ' + w : w;
      if (tr.length <= n || !cur) cur = tr;
      else {
        out.push(cur);
        cur = w;
      }
      if (out.length >= lines) break;
    }
    if (cur && out.length < lines) out.push(cur);
    if (out.length === lines && String(t).split(/\s+/).join(' ').length > out.join(' ').length)
      out[lines - 1] = fit(out[lines - 1] + '…', max, fs);
    return out.map(l => fit(l, max, fs));
  };
  let clipN = 0;
  const card = (id, x, y0, cw) => {
    const ch = Math.round((cw * 86) / 59),
      c = cbCard(id) || { name: cbName(id) },
      url = deckCardImageUrl(c),
      k = 'cc' + ++clipN,
      rx = Math.max(3, cw * 0.05);
    o.push(
      `<rect x="${x}" y="${y0 + 2}" width="${cw}" height="${ch}" rx="${rx}" fill="#000" opacity="${clean ? 0.16 : 0.5}"/>`
    );
    if (url) {
      let a = url;
      try {
        a = new URL(url, document.baseURI).href;
      } catch (e) {}
      o.push(
        `<clipPath id="${k}"><rect x="${x}" y="${y0}" width="${cw}" height="${ch}" rx="${rx}"/></clipPath><rect x="${x}" y="${y0}" width="${cw}" height="${ch}" rx="${rx}" fill="${P.slot}"/><image href="${X(a)}" xlink:href="${X(a)}" x="${x}" y="${y0}" width="${cw}" height="${ch}" preserveAspectRatio="none" clip-path="url(#${k})"/>`
      );
    } else
      o.push(`<rect x="${x}" y="${y0}" width="${cw}" height="${ch}" rx="${rx}" fill="${P.slot}" stroke="${P.line}"/>`);
    return ch;
  };
  const section = (t, y0) => {
    o.push(
      `<text x="${pad}" y="${y0 + 24}" font-family="${F}" font-size="24" font-weight="800" letter-spacing="3" fill="${acc}">${X(t)}</text><rect x="${pad + t.length * 18 + 20}" y="${y0 + 14}" width="${Math.max(0, W - pad * 2 - t.length * 18 - 20)}" height="2" fill="${P.line}"/>`
    );
    return y0 + 44;
  };
  const panel = (x, y0, w, h, on) =>
    o.push(
      `<rect x="${x}" y="${y0}" width="${w}" height="${h}" rx="14" fill="${P.head}" fill-opacity="${clean ? 0.75 : 0.8}" stroke="${on ? acc : P.line}" stroke-width="${on ? 2 : 1}"/>`
    );
  const kindOf = id => {
    const k = cbCard(id),
      t = String((k && (k.type || '')) || '');
    return /link/i.test(t)
      ? 'Link'
      : /xyz/i.test(t)
        ? 'Xyz'
        : /synchro/i.test(t)
          ? 'Synchro'
          : /fusion/i.test(t)
            ? 'Fusion'
            : /ritual/i.test(t) && /monster/i.test(t)
              ? 'Ritual'
              : '';
  };
  const LABEL = {
      ns: 'Normal Summon',
      ss: 'Special Summon',
      act: 'Activate',
      eff: 'Activate Effect',
      set: 'Set',
      scale: 'Pendulum Scale',
      auto: 'Play'
    },
    DOT = { ns: '#38c9a6', ss: P.gold, act: P.accent, eff: '#ff8a5c', set: '#8fa0c8', scale: '#b98bff', auto: P.sub };
  list.forEach((c, ci) => {
    if (list.length > 1) {
      o.push(
        `<rect x="${pad}" y="${y}" width="${W - pad * 2}" height="46" rx="10" fill="${P.head}"/><rect x="${pad}" y="${y}" width="6" height="46" rx="3" fill="url(#da)"/><text x="${pad + 20}" y="${y + 31}" font-family="${F}" font-size="24" font-weight="800" fill="${P.ink}">${X(ci + 1 + ' · ' + cbTitle(c))}</text>`
      );
      y += 64;
    }
    // starting hand
    y = section('STARTING HAND', y);
    {
      const cw = 118,
        ch = Math.round((cw * 86) / 59),
        gap = 16,
        per = Math.floor((W - pad * 2 - 32) / (cw + gap)),
        rows = Math.max(1, Math.ceil(c.hand.length / per)),
        h = rows * (ch + 34) + 24;
      panel(pad, y, W - pad * 2, h);
      if (!c.hand.length)
        o.push(
          `<text x="${pad + 20}" y="${y + h / 2 + 8}" font-family="${B}" font-size="22" fill="${P.mute}">Any hand</text>`
        );
      c.hand.forEach((id, i) => {
        const x = pad + 16 + (i % per) * (cw + gap),
          yy = y + 14 + Math.floor(i / per) * (ch + 34);
        card(id, x, yy, cw);
        o.push(
          `<text x="${x + cw / 2}" y="${yy + ch + 20}" font-family="${B}" font-size="14" font-weight="700" fill="${P.ink}" text-anchor="middle">${X(fit(cbName(id), cw + 10, 14))}</text>`
        );
      });
      y += h + 26;
    }
    // steps: every play is a tile; what a line used comes first ("USING"), what it led to follows under the card
    const tiles = [],
      walk = cbWalk(c);
    walk.lines.forEach((l, li) => {
      let cur = null,
        lead = [];
      l.forEach(n => {
        const isRes = x =>
            CB_RESULT.has(x.a) || (x.a === 'ss' && !!cur && (x.f != null || n.cards.some(k => CB_RESULT.has(k.a)))),
          play = n.cards.filter(x => !isRes(x)),
          res = n.cards.filter(isRes);
        if (play.length) {
          cur = { cards: play, groups: lead, note: n.note || '', line: li, first: !tiles.some(t => t.line === li) };
          lead = [];
          tiles.push(cur);
        }
        const tgt = cur ? cur.groups : lead;
        for (const x of res) {
          const lb = x.o ? CB_GROUP_OPP[x.a] || (CB_GROUP[x.a] || 'THEN') + " (OPPONENT'S)" : CB_GROUP[x.a] || 'THEN';
          let g = tgt[tgt.length - 1];
          if (!g || g.t !== lb || g.ids.length >= 8) {
            g = { t: lb, ids: [] };
            tgt.push(g);
          }
          g.ids.push(x.c);
        }
        if (!play.length && n.note && cur && !cur.note) cur.note = n.note;
      });
      if (lead.length) {
        tiles.push({ cards: [], groups: lead, note: '', line: li, first: !tiles.some(t => t.line === li) });
      }
    });
    if (tiles.length) {
      cuts.push(y);
      y = section(`COMBO STEPS · ${tiles.length}`, y);
      const cols = Math.max(5, Math.round((5 * W) / DI_SIZE)),
        gap = 16,
        tw = (W - pad * 2 - gap * (cols - 1)) / cols,
        mw = 60,
        mh = Math.round((mw * 86) / 59),
        mper = Math.floor((tw - 24 + 8) / (mw + 8));
      const hOf = t => {
        const n = t.cards.length,
          cw = n <= 1 ? 150 : n === 2 ? 112 : 74,
          ch = Math.round((cw * 86) / 59),
          rows = Math.ceil(Math.max(1, n) / 3);
        let h =
          74 +
          (n
            ? rows * (ch + 8 + (n > 1 ? 18 : 0)) +
              (n === 1 ? wrap(cbName(t.cards[0].c), tw - 24, 16, 2).length * 20 : 0) +
              8
            : 0);
        for (const g of t.groups) h += 24 + Math.ceil(g.ids.length / mper) * (mh + 8);
        if (t.note) h += wrap(t.note, tw - 24, 14, 3).length * 18 + 8;
        return h + 14;
      };
      // two turns: the opponent's turn starts a new row, under its own heading
      const t2 = c.turns === 2 && c.t2 != null ? c.t2 : Infinity,
        rowsOf = [];
      {
        let cur = [];
        tiles.forEach(t => {
          t.t2 = t.line >= t2;
          if (cur.length && (cur.length >= cols || cur[0].t2 !== t.t2)) {
            rowsOf.push(cur);
            cur = [];
          }
          cur.push(t);
        });
        if (cur.length) rowsOf.push(cur);
      }
      let stepNo = 0,
        t2Shown = false;
      for (const row of rowsOf) {
        if (row[0].t2 && !t2Shown) {
          t2Shown = true;
          cuts.push(y);
          y = section("TURN 2 · YOUR OPPONENT'S TURN", y);
        }
        const r = stepNo,
          rh = Math.max(...row.map(hOf));
        stepNo += row.length;
        row.forEach((t, i) => {
          const x = pad + i * (tw + gap),
            n = t.cards.length,
            main = t.cards[0],
            a = main ? main.a : '',
            k = main ? kindOf(main.c) : '';
          let yy = y;
          panel(x, yy, tw, rh, false);
          if (!t.first && i)
            o.push(
              `<text x="${x - gap / 2}" y="${yy + rh / 2}" font-family="${F}" font-size="20" font-weight="800" fill="${acc}" text-anchor="middle">›</text>`
            );
          o.push(
            `<text x="${x + tw / 2}" y="${yy + 30}" font-family="${F}" font-size="19" font-weight="800" fill="${P.ink}" text-anchor="middle">STEP ${r + i + 1}</text>`
          );
          const lab = !main
              ? 'Then'
              : (a === 'ss' && k && t.groups.some(g => g.t === 'USING') ? k + ' Summon' : LABEL[a] || 'Play') +
                (main.b
                  ? ' · opponent plays'
                  : main.o && ['ss', 'put', 'set', 'ns'].includes(a)
                    ? " · to opponent's field"
                    : main.o
                      ? " · opponent's card"
                      : ''),
            // the label shrinks to fit its tile (a summon to the opponent's field is a long label)
            lfs = Math.max(11, Math.min(17, Math.floor((tw - 40) / (lab.length * 0.56)))),
            lw = lab.length * lfs * 0.553 + 26;
          o.push(
            `<circle cx="${x + tw / 2 - lw / 2 + 6}" cy="${yy + 52}" r="6" fill="${DOT[a] || P.sub}"/><text x="${x + tw / 2 - lw / 2 + 22}" y="${yy + 58}" font-family="${F}" font-size="${lfs}" font-weight="700" fill="${DOT[a] || P.sub}">${X(lab)}</text>`
          );
          yy += 74;
          if (n) {
            const cw = n <= 1 ? 150 : n === 2 ? 112 : 74,
              ch = Math.round((cw * 86) / 59),
              per = Math.min(3, n),
              tot = per * cw + (per - 1) * 8;
            t.cards.forEach((cd, j) => {
              const cx = x + (tw - tot) / 2 + (j % 3) * (cw + 8),
                cy = yy + Math.floor(j / 3) * (ch + 8 + (n > 1 ? 18 : 0));
              card(cd.c, cx, cy, cw);
              if (n > 1)
                o.push(
                  `<text x="${cx + cw / 2}" y="${cy + ch + 14}" font-family="${B}" font-size="12" font-weight="700" fill="${P.ink}" text-anchor="middle">${X(fit(cbName(cd.c), cw + 6, 12))}</text>`
                );
            });
            yy += Math.ceil(n / 3) * (ch + 8 + (n > 1 ? 18 : 0));
            if (n === 1) {
              for (const ln of wrap(cbName(main.c), tw - 24, 16, 2)) {
                o.push(
                  `<text x="${x + tw / 2}" y="${yy + 14}" font-family="${B}" font-size="16" font-weight="700" fill="${P.ink}" text-anchor="middle">${X(ln)}</text>`
                );
                yy += 20;
              }
            }
            yy += 8;
          }
          for (const g of t.groups) {
            o.push(
              `<text x="${x + tw / 2}" y="${yy + 16}" font-family="${F}" font-size="13" font-weight="800" letter-spacing="1.5" fill="${g.t === 'USING' ? P.sub : acc}" text-anchor="middle">${X(g.t)}</text>`
            );
            yy += 24;
            g.ids.forEach((id, j) => {
              const inRow = Math.min(mper, g.ids.length - Math.floor(j / mper) * mper),
                tot = inRow * mw + (inRow - 1) * 8;
              card(id, x + (tw - tot) / 2 + (j % mper) * (mw + 8), yy + Math.floor(j / mper) * (mh + 8), mw);
            });
            yy += Math.ceil(g.ids.length / mper) * (mh + 8);
          }
          if (t.note)
            for (const ln of wrap(t.note, tw - 24, 14, 3)) {
              o.push(
                `<text x="${x + tw / 2}" y="${yy + 14}" font-family="${B}" font-size="14" font-style="italic" fill="${P.mute}" text-anchor="middle">${X(ln)}</text>`
              );
              yy += 18;
            }
        });
        y += rh + gap;
        cuts.push(y - gap / 2);
      }
      y += 12;
    }
    // final board: the field as it stands at the end, zone by zone (both sides when the combo used the opponent's)
    const fb = walk;
    if (fb.field.length || fb.opp.length) {
      cuts.push(y);
      y = section('FINAL BOARD', y);
      const both = fb.opp.length > 0,
        gap = 12,
        zw = Math.min(150, Math.floor((W - pad * 2 - 40 - gap * 6) / 7)),
        zh = Math.round((zw * 86) / 59),
        rowH = zh + 30,
        rows = both ? 5 : 3,
        h = rows * rowH + 40 + (fb.hand.length ? 34 : 0) + (both ? 30 : 0),
        x0 = pad + (W - pad * 2 - (7 * zw + 6 * gap)) / 2;
      panel(pad, y, W - pad * 2, h);
      const slot = (col, yy, label) => {
        const x = x0 + col * (zw + gap);
        o.push(
          `<rect x="${x}" y="${yy}" width="${zw}" height="${zh}" rx="${Math.round(zw * 0.06)}" fill="${P.slot}" fill-opacity=".45" stroke="${P.line}" stroke-dasharray="${label === 'EMZ' ? '6 5' : '0'}"/>`
        );
        if (label)
          o.push(
            `<text x="${x + zw / 2}" y="${yy + zh / 2 + 5}" font-family="${F}" font-size="${Math.round(zw / 9)}" font-weight="700" letter-spacing="1.5" fill="${P.mute}" text-anchor="middle">${label}</text>`
          );
        return x;
      };
      const back = (x, yy, w, hh) =>
        o.push(
          `<rect x="${x}" y="${yy}" width="${w}" height="${hh}" rx="${Math.round(w * 0.06)}" fill="${P.head}" stroke="${acc}" stroke-width="2"/><path d="M${x + w / 2} ${yy + hh * 0.28}L${x + w * 0.72} ${yy + hh / 2}L${x + w / 2} ${yy + hh * 0.72}L${x + w * 0.28} ${yy + hh / 2}Z" fill="none" stroke="${acc}" stroke-width="2"/>`
        );
      const put = (z, col, yy, flip) => {
        const x = x0 + col * (zw + gap);
        if (!z) return;
        if (z.pos === 'def' || (z.pos === 'down' && isMonId(z.id))) {
          // Defense Position: the card lies sideways within its zone
          const cw = Math.round((zw * 59) / 86) * 1,
            ch = Math.round((cw * 86) / 59),
            cx = x + zw / 2,
            cy = yy + zh / 2;
          o.push(`<g transform="rotate(${flip ? 90 : -90} ${cx} ${cy})">`);
          if (z.pos === 'down') back(cx - ch / 2 + (ch - cw) / 2, cy - ch / 2, cw, ch);
          else card(z.id, cx - cw / 2, cy - ch / 2, cw);
          o.push('</g>');
        } else if (z.pos === 'down') back(x, yy, zw, zh);
        else if (flip) {
          o.push(`<g transform="rotate(180 ${x + zw / 2} ${yy + zh / 2})">`);
          card(z.id, x, yy, zw);
          o.push('</g>');
        } else card(z.id, x, yy, zw);
        o.push(
          `<text x="${x + zw / 2}" y="${yy + zh + 18}" font-family="${B}" font-size="${Math.max(11, Math.round(zw / 11))}" font-weight="700" fill="${P.ink}" text-anchor="middle">${X(fit(z.pos === 'down' && flip ? 'Set card' : cbName(z.id), zw + gap, Math.max(11, Math.round(zw / 11))))}</text>`
        );
      };
      const isMonId = id => /monster/i.test(String((cbCard(id) || {}).type || ''));
      let yy = y + 20;
      const sideRows = (sd, flip) => {
        const b = fb.board[sd],
          order = flip ? ['s', 'm'] : ['m', 's'];
        for (const r of order) {
          for (let i = 0; i < 5; i++) slot(1 + (flip ? 4 - i : i), yy, '');
          if (r === 'm') slot(flip ? 6 : 0, yy, 'FIELD');
          if (r === 'm') put(b.s[5], flip ? 6 : 0, yy, flip);
          for (let i = 0; i < 5; i++) put(b[r][i], 1 + (flip ? 4 - i : i), yy, flip);
          yy += rowH;
        }
      };
      if (both) {
        o.push(
          `<text x="${pad + 20}" y="${yy + 14}" font-family="${F}" font-size="15" font-weight="800" letter-spacing="2" fill="${P.sub}">YOUR OPPONENT</text>`
        );
        yy += 26;
        sideRows(1, true);
      }
      // the Extra Monster Zones sit between the two sides, above zones 2 and 4
      slot(2, yy, 'EMZ');
      slot(4, yy, 'EMZ');
      for (const [i, col] of [
        [5, 2],
        [6, 4]
      ]) {
        const z = fb.board[0].m[i] || fb.board[1].m[i];
        put(z, col, yy, !fb.board[0].m[i] && !!fb.board[1].m[i]);
      }
      yy += rowH;
      sideRows(0, false);
      if (fb.hand.length)
        o.push(
          `<text x="${pad + 18}" y="${y + h - 16}" font-family="${B}" font-size="17" fill="${P.sub}">${X(fit('In hand: ' + fb.hand.map(cbName).join(', '), W - pad * 2 - 36, 17))}</text>`
        );
      y += h + 26;
    }
    y += 10;
  });
  cuts.push(y);
  const H = Math.max(meta.square ? W : 900, Math.ceil(y + (band ? band.h : 0) + 92));
  const head = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" data-cuts="${cuts.map(Math.round).join(',')}" data-foot="${Math.ceil(H - y)}">`,
    `<defs><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.bg2}"/><stop offset=".6" stop-color="${P.bg}"/><stop offset="1" stop-color="${P.bg}"/></linearGradient><linearGradient id="da" x1="0" x2="1"><stop offset="0" stop-color="${P.accent}"/><stop offset=".6" stop-color="${P.accent2}"/><stop offset="1" stop-color="${P.gold}"/></linearGradient>` +
      (pf
        ? `<linearGradient id="dfr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${(DI_FRAME[pf.frame] || DI_FRAME.none)[0]}"/><stop offset="1" stop-color="${(DI_FRAME[pf.frame] || DI_FRAME.none)[1]}"/></linearGradient><clipPath id="dav"><circle cx="0" cy="0" r="44"/></clipPath>`
        : '') +
      `<linearGradient id="dsh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.bg}" stop-opacity="${clean ? 0.9 : 0.6}"/><stop offset="${Math.min(0.5, 700 / H).toFixed(3)}" stop-color="${P.bg}" stop-opacity="${clean ? 0.95 : 0.94}"/><stop offset="1" stop-color="${P.bg}" stop-opacity="1"/></linearGradient></defs>`,
    `<rect width="${W}" height="${H}" fill="${clean ? P.bg : 'url(#dg)'}"/>`
  ];
  // the picture sits behind the heading only, so the steps stay easy to read
  if (bg)
    head.push(
      `<image href="${X(bg)}" xlink:href="${X(bg)}" width="${W}" height="${Math.min(H, 1600)}" preserveAspectRatio="xMidYMin slice"/><rect width="${W}" height="${H}" fill="url(#dsh)"/>`
    );
  if (clean) head.push(`<rect x="0" y="0" width="${W}" height="10" fill="url(#da)"/>`);
  else
    head.push(
      `<rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="28" fill="none" stroke="url(#da)" stroke-width="3"/>`
    );
  head.push(
    `<g font-family="${F}" fill="${P.ink}"><text x="${pad}" y="70" font-size="20" font-weight="700" letter-spacing="5" fill="${P.gold}">DUEL SYNAPSE · KODEX · COMBO</text>`,
    `<text x="${pad}" y="${80 + ts}" font-size="${ts}" font-weight="800">${X(title.slice(0, 60))}</text>`,
    `<text x="${pad}" y="${120 + ts}" font-family="${B}" font-size="24" font-weight="700" fill="${P.sub}">${X([meta.sub, meta.player].filter(Boolean).join('  ·  '))}</text>`,
    `<text x="${pad}" y="${156 + ts}" font-family="${B}" font-size="22" fill="${P.mute}">${X([meta.note, diDateText(meta.date)].filter(Boolean).join('  ·  '))}</text></g>`
  );
  if (pf) {
    const ax = W - pad - 44,
      ay = 96;
    head.push(
      `<g transform="translate(${ax},${ay})"><circle r="52" fill="url(#dfr)"/><circle r="46" fill="${P.bg}"/><image href="${X(pf.src)}" xlink:href="${X(pf.src)}" x="-44" y="-44" width="88" height="88" clip-path="url(#dav)" preserveAspectRatio="xMidYMid slice"/></g>`,
      `<g font-family="${F}" text-anchor="end"><text x="${ax - 66}" y="${ay - 12}" font-size="28" font-weight="800" fill="${P.ink}">${X(pf.name)}</text><text x="${ax - 66}" y="${ay + 18}" font-family="${B}" font-size="19" fill="${P.sub}">${X(pf.title || (KXPF.tierName(pf.tier) || '') + ' duelist')}</text><text x="${ax - 66}" y="${ay + 44}" font-size="16" font-weight="700" letter-spacing="2" fill="${P.gold}">MEIOCG${pf.rank ? ' PLAYERS #' + pf.rank : ' PROFILE'}${pf.premium ? ' · PREMIUM' : ''}</text></g>`
    );
  }
  const foot = [
    band ? band.draw(H) : '',
    `<g font-family="${F}"><text x="${pad}" y="${H - 44}" font-size="18" fill="${P.mute}">Made with Duel Synapse: KodeX · a project of Meta Insider OCG</text><text x="${W - pad}" y="${H - 44}" font-size="18" fill="${P.gold}" text-anchor="end" font-weight="700">kodex.meiocg.org</text></g></svg>`
  ];
  return head.join('') + o.join('') + foot.join('');
}
/* the preview scrolls for a tall sheet; saving a tall sheet draws it at full size instead of capturing the screen */
{
  const ci = cbImage;
  cbImage = function () {
    const r = ci.apply(this, arguments);
    const box = document.querySelector('.mdl[data-k=pm] .di-svg');
    if (box) {
      box.classList.add('tall');
      const sm = box.parentNode.querySelector('small');
      if (sm) sm.textContent = 'The sheet grows with the combo · zoom in after saving';
    }
    return r;
  };
}
{
  const dv = deckViewer;
  deckViewer = function (svg, name, deck) {
    const m = dv.apply(this, arguments);
    if (deck || !/DUEL SYNAPSE · KODEX · COMBO/.test(svg)) return m;
    const md =
      document.querySelector('.mdl.viewer') ||
      document.querySelector('.mdl[data-k=viewer]') ||
      document.querySelector('.vw-body')?.closest('.mdl');
    if (!md) return m;
    md.addEventListener(
      'click',
      e => {
        const b = e.target.closest('button[data-vsave]');
        if (!b || b.dataset.vsave === 'jpg') return;
        e.stopImmediatePropagation();
        e.preventDefault();
        const H = +((svg.match(/<svg[^>]* height="(\d+)"/) || [])[1] || 1600);
        b.disabled = true;
        toast('Preparing image…');
        svgToPng(svg, H > 5200 ? 1 : 1.5, 'image/png')
          .then(async p => {
            await saveFile(p, name + '.png', 'image/png');
          })
          .catch(() => toast('Could not make the image'))
          .finally(() => {
            b.disabled = false;
          });
      },
      true
    );
    return m;
  };
}
/* the Combo Generator button in the Arena's lobby: leave the Arena and open Combos */
window.addEventListener('message', e => {
  const d = e.data || {},
    f = $('arenaFrame');
  if (!f || e.source !== f.contentWindow || d.kx !== 'combos') return;
  if (!kxInApp()) {
    kxComboAd();
    return;
  }
  if (L.includes('arena')) {
    arenaBye = true;
    history.back();
    setTimeout(() => kxCombos(), 420);
  } else kxCombos();
});
/* ---------- sheet formats: long (grows with the combo), one big square, or square pages ---------- */
/** The long sheet, or for "square" the narrowest width at which the whole combo fits a square. */
function cbSheetSvg(list, o, bg) {
  if (o.fmt !== 'square') return buildComboSvg(list, o, bg);
  let svg = '';
  for (let W = DI_SIZE; W <= DI_SIZE * 3; W += 200) {
    svg = buildComboSvg(list, Object.assign({}, o, { W, square: true }), bg);
    const H = +((svg.match(/<svg[^>]* height="(\d+)"/) || [])[1] || 0);
    if (H <= W) break;
  }
  return svg;
}
/** Cuts the long sheet into square pages between rows, so no card is split; each page repeats the title and counts. */
function cbPages(svg, o, title) {
  const W = +((svg.match(/<svg[^>]* width="(\d+)"/) || [])[1] || DI_SIZE),
    H = +((svg.match(/<svg[^>]* height="(\d+)"/) || [])[1] || W),
    cuts = ((svg.match(/data-cuts="([\d,]*)"/) || [])[1] || '')
      .split(',')
      .map(Number)
      .filter(n => n > 0),
    P = DI_PAL[o.design] || DI_PAL.night,
    top = 84,
    bottom = 84,
    inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const starts = [0];
  for (let s0 = 0; ; ) {
    if (H - s0 <= W - (s0 ? top : 0)) break;
    const lim = s0 + W - bottom - (s0 ? top : 0),
      fit = cuts.filter(c => c > s0 + 200 && c <= lim);
    const nx = fit.length ? fit[fit.length - 1] : lim;
    starts.push(nx);
    s0 = nx;
    if (starts.length > 40) break;
  }
  const n = starts.length,
    X = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return starts.map((s0, i) => {
    const vy = i ? s0 - top : 0,
      end = i + 1 < n ? starts[i + 1] : H,
      bar = [];
    // hide what belongs to the next page, then the page's own head and foot
    if (i + 1 < n) bar.push(`<rect x="0" y="${end}" width="${W}" height="${vy + W - end}" fill="${P.bg}"/>`);
    if (i)
      bar.push(
        `<rect x="0" y="${vy}" width="${W}" height="${top}" fill="${P.bg}"/><text x="56" y="${vy + 54}" font-family="'Chakra Petch',Arial,sans-serif" font-size="26" font-weight="800" fill="${P.ink}">${X(String(title).slice(0, 50))}</text>`
      );
    bar.push(
      `<text x="${W - 56}" y="${vy + 54}" font-family="'Chakra Petch',Arial,sans-serif" font-size="24" font-weight="800" fill="${P.gold}" text-anchor="end">${i + 1} / ${n}</text>`
    );
    if (i + 1 < n)
      bar.push(
        `<text x="56" y="${vy + W - 34}" font-family="'Chakra Petch',Arial,sans-serif" font-size="18" fill="${P.mute}">Made with Duel Synapse: KodeX · a project of Meta Insider OCG</text><text x="${W - 56}" y="${vy + W - 34}" font-family="'Chakra Petch',Arial,sans-serif" font-size="18" font-weight="700" fill="${P.gold}" text-anchor="end">Swipe for more ›</text>`
      );
    bar.push(
      `<rect x="16" y="${vy + 16}" width="${W - 32}" height="${W - 32}" rx="28" fill="none" stroke="${P.gold}" stroke-opacity=".55" stroke-width="3"/>`
    );
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${W}" viewBox="0 ${vy} ${W} ${W}"><rect x="0" y="${vy}" width="${W}" height="${W}" fill="${P.bg}"/>${inner}${bar.join('')}</svg>`;
  });
}
/** Every page of a combo, each saved as its own picture (or all at once). */
function cbPagesViewer(pages, name) {
  const m = openModal(
    `<div class="dk-hd"><h3>${esc(name)} · ${pages.length} page${pages.length === 1 ? '' : 's'}</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
 <div class="cbp-list">${pages.map((p, i) => `<figure class="cbp"><div class="cbp-svg">${p}</div><figcaption>Page ${i + 1}<button class="btn sm" data-pg="${i}">${ic('down', 16)}Save</button></figcaption></figure>`).join('')}</div>
 <div class="dact"><button class="btn p" data-pgall>${ic('down', 18)}Save all ${pages.length} pages</button></div>`,
    'big',
    'cbp'
  );
  const save = async i => {
    const p = await svgToPng(pages[i], 1, 'image/png');
    await saveFile(p, `${name}-${i + 1}.png`, 'image/png');
  };
  m.querySelectorAll('[data-pg]').forEach(
    b =>
      (b.onclick = async () => {
        b.disabled = true;
        try {
          await save(+b.dataset.pg);
        } catch (e) {
          toast('Could not make the image');
        }
        b.disabled = false;
      })
  );
  m.querySelector('[data-pgall]').onclick = async e => {
    const b = e.currentTarget;
    b.disabled = true;
    toast('Saving ' + pages.length + ' pages…');
    try {
      for (let i = 0; i < pages.length; i++) await save(i);
      toast('Saved ' + pages.length + ' pages');
    } catch (err) {
      toast('Could not make the images');
    }
    b.disabled = false;
  };
  return m;
}
