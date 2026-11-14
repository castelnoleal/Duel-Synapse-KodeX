// KodeX Premium: video clips of replays for content creators.
// The duel is drawn for video on its own canvas (1080p, 1440p or 4K; landscape, portrait or square) — not a screen
// capture — and recorded as it plays: the field, both players' profiles and Life Points, hands, the chain cut-ins with
// the real card art, summons, attacks, damage, turns and the winner. MediaRecorder writes MP4 where the device can,
// otherwise WebM. Created by Castel Noleal, creator of MEIOCG.
import * as C from "./engine/constants.js";
import { presetIcon } from "./profile.js";
const M = C.MSG;

export const FORMATS = { landscape: [16, 9], portrait: [9, 16], square: [1, 1] };
export const SIZES = { 1080: 1080, 1440: 1440, 2160: 2160 };
const FRAME_COL = { none: ["#2a3354", "#2a3354"], rookie: ["#8a96b4", "#4c5878"], bronze: ["#e0a070", "#8a4b20"], silver: ["#f4f7fb", "#8d97a8"], gold: ["#ffe08a", "#a8740b"],
  platinum: ["#f2fffd", "#5fd3c4"], diamond: ["#8be1ff", "#b46bff"], master: ["#ffb347", "#e0102a"], premium: ["#ffe08a", "#7a4fd6"] };
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

export function bestMime() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["video/mp4;codecs=avc1.640028", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"])
    if (MediaRecorder.isTypeSupported(m)) return m;
  return "";
}
export const canRecord = () => !!bestMime() && !!HTMLCanvasElement.prototype.captureStream;

export class Clip {
  /**
   * o: { format: "landscape"|"portrait"|"square", size: 1080|1440|2160, fps, watermark, title,
   *      packet: () => current packet, team: () => bottom player, art: (code) => url, name: (code) => string,
   *      kind: (code) => "monster"|"spell"|"trap"|…, profile: (team) => profile|null, logo: url, aces: (team) => Set }
   */
  constructor(o) {
    this.o = o;
    const [a, b] = FORMATS[o.format] || FORMATS.landscape, short = SIZES[o.size] || 1080;
    this.W = a >= b ? Math.round(short * a / b) : short; this.H = a >= b ? short : Math.round(short * b / a);
    this.W -= this.W % 2; this.H -= this.H % 2;
    this.u = Math.min(this.W, this.H) / 1080;               // 1 unit = 1 px at 1080p
    this.cv = document.createElement("canvas"); this.cv.width = this.W; this.cv.height = this.H;
    this.g = this.cv.getContext("2d", { alpha: false });
    this.imgs = new Map(); this.fx = []; this.lp = [null, null]; this.lpShow = [0, 0];
    // what the frame carries besides the table: the play-by-play and the card being played
    this.show = { feed: o.feed !== false, card: o.details !== false }; this.show.any = this.show.feed || this.show.card;
    this.th = Object.assign({ me: "108,150,255", op: "255,112,134", acc: "240,180,41", a: "#1b2358", b: "#0b0e1f", e: "#4654c4" }, o.theme || {});
    this.notes = []; this.cur = null; this.headline = String(o.title || (o.intro && o.intro.title) || "").trim();
    this.logo = this.load(o.logo);
    if (o.intro) { this.introBg = this.load(o.intro.bg); this.introCard = this.load(o.intro.card); }
    this.layout();
  }
  /* pictures: same-origin or CORS-enabled, so the canvas stays recordable */
  load(url) {
    if (!url) return null;
    let r = this.imgs.get(url);
    if (r) return r;
    r = { ok: false, img: new Image() };
    r.img.crossOrigin = "anonymous"; r.img.decoding = "async";
    r.img.onload = () => { r.ok = true; }; r.img.onerror = () => { r.bad = true; };
    r.img.src = url; this.imgs.set(url, r);
    return r;
  }
  art(code) { return code ? this.load(this.o.art(code)) : null; }
  /* ---------- layout ---------- */
  layout() {
    const { W, H, u } = this, L = {}, sh = this.show;
    const land = W > H * 1.2, port = H > W * 1.2;
    L.land = land; L.port = port;
    // field: 7 columns × 5 rows of card slots
    const fw = land ? W * 0.5 : W * 0.92, fh = land ? H * 0.85 : port ? H * (sh.any ? 0.46 : 0.5) : H * 0.7;
    const cell = Math.min(fw / 7, fh / 5 * (59 / 86));
    const ch = Math.min(fh / 5, cell * 86 / 59), cw = ch * 59 / 86, gap = cw * 0.1;
    L.cw = cw * 0.9; L.ch = ch * 0.9; L.pitchX = cw + gap * 0.2; L.pitchY = ch;
    const gridW = L.pitchX * 7, gridH = L.pitchY * 5;
    L.fx0 = (W - gridW) / 2;
    L.fy0 = land ? 96 * u + (H - 126 * u - gridH) / 2 : port ? H * 0.5 - gridH / 2 : H * 0.53 - gridH / 2;
    L.gridW = gridW; L.gridH = gridH; this.L0w = gridW;
    // plates, hands and the information panels
    if (land) {
      const pw = Math.min(W * 0.23, (W - this.L0w) / 2 - 60 * u), ph = 170 * u;
      L.plate = [{ x: 40 * u, y: H - ph - 40 * u, w: pw, h: ph }, { x: 40 * u, y: 40 * u, w: pw, h: ph }];
      const hx = L.fx0 + gridW + 40 * u, hw = W - hx - 40 * u;
      if (sh.card) {
        const hh = H * 0.19, mb = (this.o.watermark ? 84 : 40) * u;      // the mark sits under your hand
        L.hand = [{ x: hx, y: H - mb - hh, w: hw, h: hh }, { x: hx, y: 40 * u, w: hw, h: hh }];
        L.card = { x: hx, y: 40 * u + hh + 16 * u, w: hw, h: H - 40 * u - mb - hh * 2 - 32 * u };
      } else L.hand = [{ x: hx, y: H * 0.56, w: hw, h: H * 0.36 }, { x: hx, y: H * 0.08, w: hw, h: H * 0.36 }];
      L.info = { x: 40 * u, y: 40 * u + ph + 22 * u, w: pw, h: 146 * u };
      const fy = L.info.y + L.info.h + 16 * u;
      if (sh.feed) L.feed = { x: 40 * u, y: fy, w: pw, h: L.plate[0].y - 22 * u - fy };
    } else if (port) {
      const pw = W - 80 * u;
      if (sh.any) {
        const ph = 120 * u, top = 90 * u, th = 96 * u;
        L.head = { x: 40 * u, y: 20 * u, w: pw, h: 56 * u };
        L.plate = [{ x: 40 * u, y: H - ph - 60 * u, w: pw, h: ph }, { x: 40 * u, y: top, w: pw, h: ph }];
        const a = top + ph + 12 * u, b = L.plate[0].y - 12 * u, free = Math.max(0, b - a - gridH - th - 36 * u), oh = free * 0.4;
        L.hand = [null, { x: 40 * u, y: a, w: pw, h: oh }];
        L.fy0 = a + oh + 10 * u;
        L.tick = { x: 40 * u, y: L.fy0 + gridH + 14 * u, w: pw, h: th };
        const hy = L.tick.y + th + 10 * u; L.hand[0] = { x: 40 * u, y: hy, w: pw, h: b - hy };
      } else {
        const ph = 140 * u;
        L.plate = [{ x: 40 * u, y: H - ph - 60 * u, w: pw, h: ph }, { x: 40 * u, y: 60 * u, w: pw, h: ph }];
        L.hand = [{ x: 40 * u, y: L.fy0 + gridH + 30 * u, w: pw, h: L.plate[0].y - (L.fy0 + gridH) - 60 * u }, { x: 40 * u, y: L.plate[1].y + ph + 30 * u, w: pw, h: L.fy0 - (L.plate[1].y + ph) - 60 * u }];
      }
      L.info = null;
    } else {
      const pw = W * 0.46, ph = 110 * u;
      L.plate = [{ x: 30 * u, y: H - ph - 24 * u, w: pw, h: ph }, { x: W - pw - 30 * u, y: 24 * u, w: pw, h: ph }];
      L.hand = [null, null]; L.info = null;
      if (sh.any) {
        L.head = { x: 30 * u, y: 24 * u, w: W - pw - 80 * u, h: ph };
        L.tick = { x: 50 * u + pw, y: H - ph - 24 * u, w: W - pw - 80 * u, h: 64 * u };
      }
    }
    this.L = L;
  }
  /** Where a card sits on the field (centre), from the bottom player's view. */
  slot(team, location, seq) {
    const L = this.L, me = this.o.team(), mine = team === me;
    let col = -1, row = -1;
    if (location === C.LOCATION_MZONE) {
      if (seq >= 5) { row = 2; const left = mine ? seq === 5 : seq === 6; col = left ? 2 : 4; }
      else { row = mine ? 3 : 1; col = mine ? seq + 1 : 5 - seq; }
    } else if (location === C.LOCATION_SZONE) {
      if (seq === 5) { row = mine ? 3 : 1; col = mine ? 0 : 6; }
      else if (seq < 5) { row = mine ? 4 : 0; col = mine ? seq + 1 : 5 - seq; }
    } else if (location === C.LOCATION_GRAVE) { row = mine ? 3 : 1; col = mine ? 6 : 0; }
    else if (location === C.LOCATION_DECK) { row = mine ? 4 : 0; col = mine ? 6 : 0; }
    else if (location === C.LOCATION_EXTRA) { row = mine ? 4 : 0; col = mine ? 0 : 6; }
    else if (location === C.LOCATION_REMOVED) { row = 2; col = mine ? 6 : 0; }
    if (row < 0) return null;
    return { x: L.fx0 + L.pitchX * (col + 0.5), y: L.fy0 + L.pitchY * (row + 0.5) };
  }
  /* ---------- events become effects ---------- */
  /** Where a card is on the frame: a zone or pile, or the middle of a hand. */
  spot(w) {
    if (!w) return null;
    const loc = w.location & ~C.LOCATION_OVERLAY;
    if (loc === C.LOCATION_HAND) { const R = this.L.hand[w.controller === this.o.team() ? 0 : 1]; return R ? { x: R.x + R.w / 2, y: R.y + R.h / 2 } : null; }
    return this.slot(w.controller, loc, w.sequence);
  }
  feed(p) {
    const now = performance.now(), me = this.o.team();
    let nf = 0, lit = false;
    const light = (code, tag, team) => { if (!code) return; lit = true; if (this.cur && this.cur.code === Number(code) && this.cur.tag === tag && now - this.cur.t0 < 1500) return; this.cur = { code: Number(code), tag, team, t0: now }; };
    for (const e of p.events || []) {
      if (e.type === M.CHAINING) light(e.code, "ACTIVATE", e.controller);
      else if (e.type === M.SUMMONING) light(e.code, "NORMAL SUMMON", e.controller);
      else if (e.type === M.SPSUMMONING) light(e.code, "SPECIAL SUMMON", e.controller);
      else if (e.type === M.FLIPSUMMONING) light(e.code, "FLIP SUMMON", e.controller);
      // a card that changes place travels there (hand, Deck, piles, zones)
      if (e.type === M.MOVE && e.from && e.to && e.from.location && e.to.location && nf < 10) {
        const a = this.spot(e.from), b = this.spot(e.to), tl = e.to.location & ~C.LOCATION_OVERLAY;
        // banished: the card is squeezed into a line of light where it stood and drawn upward
        if (a && tl === C.LOCATION_REMOVED) { this.fx.push({ k: "rift", at: a, code: e.code && !(e.to.position & C.POS_FACEDOWN) ? e.code : 0, t0: now + nf * 70, d: 600 }); nf++; }
        else if (a && b && Math.hypot(a.x - b.x, a.y - b.y) > 8) {
          const down = tl === C.LOCATION_DECK || ((tl === C.LOCATION_MZONE || tl === C.LOCATION_SZONE) && e.to.position & C.POS_FACEDOWN);
          this.fx.push({ k: "fly", code: down ? 0 : e.code, a, b, t0: now + nf * 70, d: 420, key: tl === C.LOCATION_MZONE || tl === C.LOCATION_SZONE ? `${e.to.controller}:${tl}:${e.to.sequence}` : "" }); nf++;
        }
      } else if (e.type === M.DRAW && e.drawn && nf < 10) {
        const a = this.spot({ controller: e.player, location: C.LOCATION_DECK, sequence: 0 }), b = this.spot({ controller: e.player, location: C.LOCATION_HAND });
        if (a && b) e.drawn.slice(0, 6).forEach((d) => { this.fx.push({ k: "fly", code: e.player === me ? d.code : 0, a, b, t0: now + nf * 70, d: 420, key: "" }); nf++; });
      }
      if (e.type === M.CHAINING) {
        const ace = this.o.aces && this.o.aces(e.controller).has(Number(e.code));
        this.fx.push({ k: ace ? "ace" : "cut", code: e.code, team: e.controller, t0: now, d: ace ? 2600 : 1500, n: e.chain_size || 1 });
      } else if (e.type === M.SUMMONING || e.type === M.SPSUMMONING || e.type === M.FLIPSUMMONING) {
        const at = this.slot(e.controller, e.location, e.sequence);
        this.fx.push({ k: "summon", code: e.code, at, team: e.controller, t0: now, d: 900 });
        if (this.o.aces && this.o.aces(e.controller).has(Number(e.code))) this.fx.push({ k: "ace", code: e.code, team: e.controller, t0: now + 200, d: 2600 });
      } else if (e.type === M.DAMAGE || e.type === M.PAY_LPCOST || e.type === M.RECOVER) {
        this.fx.push({ k: "lp", team: e.player, amt: e.amount, up: e.type === M.RECOVER, t0: now, d: 1400 });
      } else if (e.type === M.NEW_TURN) {
        this.fx.push({ k: "turn", team: e.player, t0: now, d: 1500 });
      } else if (e.type === M.ATTACK) {
        const a = e.card && this.slot(e.card.controller, e.card.location, e.card.sequence);
        const b = e.target ? this.slot(e.target.controller, e.target.location, e.target.sequence) : null;
        if (a) this.fx.push({ k: "atk", a, b, team: e.card.controller, t0: now, d: 900 });
      } else if (e.type === M.MOVE && e.to && e.to.location === C.LOCATION_GRAVE && e.from && (e.from.location & (C.LOCATION_MZONE | C.LOCATION_SZONE))) {
        const at = this.slot(e.from.controller, e.from.location, e.from.sequence);
        if (at) this.fx.push({ k: "break", at, t0: now, d: 700 });
      }
    }
    // nothing announced itself: a card that came to the field face-up, or was added to a hand you can see
    if (!lit) for (const e of p.events || []) {
      if (e.type !== M.MOVE || !e.code || !e.to || !e.from) continue;
      const tl = e.to.location & ~C.LOCATION_OVERLAY, fl = e.from.location & ~C.LOCATION_OVERLAY;
      if ((tl === C.LOCATION_MZONE || tl === C.LOCATION_SZONE) && fl !== tl && !(e.to.position & C.POS_FACEDOWN)) { light(e.code, p.combo ? "PLAY" : "TO THE FIELD", e.to.controller); break; }
      if (tl === C.LOCATION_HAND && fl === C.LOCATION_DECK && (e.to.controller === me || p.combo)) { light(e.code, "ADD TO HAND", e.to.controller); break; }
    }
    if (p.ended && !this.endShown) { this.endShown = true; this.fx.push({ k: "win", winner: p.ended.winner, reason: p.ended.reason, t0: now + 600, d: 999999 }); }
  }
  /** A line for the play-by-play (the same words as the duel log). */
  note(text, code, cls) {
    if (!text || cls === "phase") return;
    this.notes.unshift({ text: String(text), code: Number(code) || 0, cls: cls || "", t0: performance.now() });
    if (this.notes.length > 14) this.notes.length = 14;
  }
  /* ---------- drawing ---------- */
  font(size, weight = 800, body = false) { this.g.font = `${weight} ${Math.round(size)}px ${body ? '"Plus Jakarta Sans", "Chakra Petch", system-ui, sans-serif' : '"Chakra Petch", "Plus Jakarta Sans", system-ui, sans-serif'}`; }
  /** Break text into lines that fit (the font must be set first); the last line gets an ellipsis when cut. */
  wrap(t, maxW, maxLines) {
    const g = this.g, out = [];
    for (const para of String(t || "").split(/\n+/)) {
      let line = "";
      for (const w of para.split(/\s+/)) {
        if (!w) continue;
        const tryL = line ? line + " " + w : w;
        if (g.measureText(tryL).width <= maxW || !line) line = tryL; else { out.push(line); line = w; }
        if (out.length >= maxLines) break;
      }
      if (out.length >= maxLines) break;
      if (line) out.push(line);
    }
    const cut = out.length > maxLines || String(t || "").split(/\s+/).join(" ").length > out.slice(0, maxLines).join(" ").length + 1;
    out.length = Math.min(out.length, maxLines);
    if (cut && out.length) { let l = out[out.length - 1]; while (l.length > 3 && g.measureText(l + "…").width > maxW) l = l.slice(0, -1); out[out.length - 1] = l.replace(/[\s.,;:]+$/, "") + "…"; }
    return out;
  }
  panel(R, o = {}) {
    const g = this.g, u = this.u;
    this.rr(R.x, R.y, R.w, R.h, o.r || 22 * u); g.fillStyle = o.fill || "#0a0e22d9"; g.fill();
    g.lineWidth = 2 * u; g.strokeStyle = o.stroke || "#ffffff1f"; g.stroke();
  }
  rr(x, y, w, h, r) { const g = this.g; g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  text(t, x, y, size, color, o = {}) {
    const g = this.g;
    g.font = `${o.weight || 800} ${o.italic ? "italic " : ""}${Math.round(size)}px ${o.font || '"Chakra Petch", "Plus Jakarta Sans", system-ui, sans-serif'}`;
    g.textAlign = o.align || "left"; g.textBaseline = o.base || "alphabetic";
    if (o.max) { while (g.measureText(t).width > o.max && t.length > 3) t = t.slice(0, -2) + "…"; }
    if (o.stroke) { g.lineWidth = o.stroke; g.strokeStyle = o.strokeColor || "#000"; g.lineJoin = "round"; g.strokeText(t, x, y); }
    if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = size * 0.6; }
    g.fillStyle = color; g.fillText(t, x, y); g.shadowBlur = 0;
  }
  back(x, y, w, h) {
    const g = this.g, gr = g.createLinearGradient(x, y, x + w, y + h);
    gr.addColorStop(0, "#1b2466"); gr.addColorStop(1, "#0b0f2a");
    this.rr(x, y, w, h, w * 0.06); g.fillStyle = gr; g.fill(); g.lineWidth = Math.max(1, w * 0.03); g.strokeStyle = "#6f7dff88"; g.stroke();
    if (this.logo && this.logo.ok) { const s = w * 0.6; g.globalAlpha = 0.9; g.drawImage(this.logo.img, x + (w - s) / 2, y + (h - s) / 2, s, s); g.globalAlpha = 1; }
  }
  card(code, x, y, w, h, o = {}) {
    const g = this.g;
    if (!code || o.down) { this.back(x, y, w, h); return; }
    const a = this.art(code);
    g.save();
    if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = w * 0.35; }
    this.rr(x, y, w, h, w * 0.05); g.fillStyle = "#121a2b"; g.fill(); g.shadowBlur = 0;
    g.clip();
    if (a && a.ok) g.drawImage(a.img, x, y, w, h);
    else {
      const k = this.o.kind(code), col = { spell: "#1d8a6e", trap: "#a3326e", link: "#1d4f9a", xyz: "#2a2a2a", synchro: "#ddd", fusion: "#7a4fd6", ritual: "#3a6fd6", normal: "#c8a24a" }[k] || "#c46a2a";
      g.fillStyle = col; g.fillRect(x, y, w, h);
      this.text(this.o.name(code), x + w / 2, y + h * 0.5, Math.max(9, w * 0.11), "#fff", { align: "center", max: w * 0.9, weight: 700 });
    }
    g.restore();
    if (o.ring) { this.rr(x, y, w, h, w * 0.05); g.lineWidth = Math.max(2, w * 0.035); g.strokeStyle = o.ring; g.stroke(); }
  }
  avatar(team, cx, cy, r) {
    const g = this.g, p = this.o.profile(team), fr = FRAME_COL[(p && p.frame) || "none"] || FRAME_COL.none;
    const src = p ? (p.icon === "custom" && p.img ? p.img : presetIcon(p.icon) || this.o.logo) : this.o.logo;
    const gr = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r); gr.addColorStop(0, fr[0]); gr.addColorStop(1, fr[1]);
    if (p && /premium|diamond|master|gold|platinum/.test(p.frame || "")) { g.shadowColor = fr[0]; g.shadowBlur = r * 0.6; }
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fillStyle = gr; g.fill(); g.shadowBlur = 0;
    const im = this.load(src);
    g.save(); g.beginPath(); g.arc(cx, cy, r * 0.86, 0, Math.PI * 2); g.clip(); g.fillStyle = "#0c1426"; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    if (im && im.ok) g.drawImage(im.img, cx - r * 0.86, cy - r * 0.86, r * 1.72, r * 1.72);
    g.restore();
  }
  plate(team, R, p, now) {
    const g = this.g, u = this.u, st = p.state.teams[team], active = !p.ended && p.turnPlayer === team, pf = this.o.profile(team);
    const side = team === this.o.team() ? this.th.me : this.th.op;
    g.save(); this.rr(R.x, R.y, R.w, R.h, 26 * u);
    const gr = g.createLinearGradient(R.x, R.y, R.x + R.w, R.y + R.h); gr.addColorStop(0, active ? `rgba(${side},.3)` : "#121734ee"); gr.addColorStop(1, "#0b0f26ee");
    g.fillStyle = "#0b0f26"; g.fill(); g.fillStyle = gr; g.fill(); g.lineWidth = 3 * u; g.strokeStyle = active ? `rgb(${side})` : "#ffffff22"; g.stroke(); g.restore();
    const r = R.h * 0.34; this.avatar(team, R.x + R.h * 0.5, R.y + R.h * 0.5, r);
    const tx = R.x + R.h, right = R.x + R.w - 26 * u, nm = p.names[team] || "Duelist";
    // Life Points count towards their new value
    if (this.lp[team] == null) this.lp[team] = st.lp;
    this.lp[team] += (st.lp - this.lp[team]) * 0.18; if (Math.abs(st.lp - this.lp[team]) < 1) this.lp[team] = st.lp;
    const low = st.lp <= 2000, lpT = String(Math.round(this.lp[team]));
    this.text(lpT, right, R.y + R.h * 0.62, 50 * u, low ? "#ff8a9a" : "#fff", { align: "right", glow: low ? "#e0102a" : `rgb(${side})` });
    const lw = g.measureText(lpT).width;
    this.text("LP", right - lw - 10 * u, R.y + R.h * 0.6, 18 * u, "#9aa3c7", { align: "right", weight: 800 });
    const narrow = R.w < 600 * u, maxT = right - lw - 60 * u - tx, title = pf && pf.title;
    this.text(nm, tx, R.y + R.h * (narrow ? 0.3 : 0.36), 32 * u, "#fff", { max: narrow ? right - tx : maxT });
    const full = `Hand ${st.hand.length} · Deck ${st.deck} · GY ${st.grave.length}${st.banished.length ? " · Banished " + st.banished.length : ""} · Extra ${st.extra.length}`;
    // the Life Point bar; the counts sit beside the name on a wide plate and under the bar on a narrow one
    const by = R.y + R.h * 0.72, bw = right - tx, bh = Math.max(6 * u, R.h * 0.06), k = clamp01(this.lp[team] / 8000);
    this.rr(tx, by, bw, bh, bh / 2); g.fillStyle = "#ffffff1a"; g.fill();
    if (k > 0) { this.rr(tx, by, Math.max(bh, bw * k), bh, bh / 2); const bg = g.createLinearGradient(tx, 0, tx + bw, 0); bg.addColorStop(0, low ? "#e0102a" : `rgba(${side},.75)`); bg.addColorStop(1, low ? "#ff8a9a" : `rgb(${side})`); g.fillStyle = bg; g.fill(); }
    if (narrow) {
      if (title && maxT > 90 * u) this.text(title, tx, R.y + R.h * 0.56, 18 * u, "#a9b4ff", { weight: 600, max: maxT });
      this.font(16 * u, 600); const fits = g.measureText(full).width <= bw;
      this.text(fits ? full : `Hand ${st.hand.length} · Deck ${st.deck} · GY ${st.grave.length} · EX ${st.extra.length}`, tx, R.y + R.h * 0.92, 16 * u, "#9aa3c7", { weight: 600, max: bw });
    } else this.text(title ? `${title}  ·  ${full}` : full, tx, R.y + R.h * 0.58, 19 * u, "#9aa3c7", { weight: 600, max: maxT });
  }
  hand(team, R, p) {
    if (!R || R.h < 40) return;
    const list = p.state.teams[team].hand, n = list.length; if (!n) return;
    const h = Math.min(R.h * 0.9, R.w / (1 + (Math.max(n, 3) - 1) * 0.62) * 86 / 59), w = h * 59 / 86;
    const step = n > 1 ? Math.min(w * 1.04, (R.w - w) / (n - 1)) : 0;
    const total = step * (n - 1) + w, x0 = R.x + (R.w - total) / 2, y = R.y + (R.h - h) / 2;
    list.forEach((c, i) => this.card(c && !c.hidden ? c.code : 0, x0 + i * step, y, w, h, { down: !c || c.hidden }));
  }
  field(p, now) {
    const g = this.g, L = this.L, u = this.u;
    this.flying = new Set(this.fx.filter((f) => f.k === "fly" && f.key && now - f.t0 < f.d).map((f) => f.key));
    // the mat: the theme's colours, the opponent's tint above and yours below, the emblem at the centre
    const T = this.th, mx = L.fx0 - 12 * u, my = L.fy0 - 8 * u, mw = L.gridW + 24 * u, mh = L.gridH + 16 * u;
    g.save(); this.rr(mx, my, mw, mh, 26 * u);
    const mg = g.createRadialGradient(mx + mw / 2, my + mh / 2, 0, mx + mw / 2, my + mh / 2, Math.max(mw, mh) * 0.62); mg.addColorStop(0, T.a); mg.addColorStop(1, T.b);
    g.shadowColor = `rgba(${T.acc},.25)`; g.shadowBlur = 40 * u; g.fillStyle = mg; g.fill(); g.shadowBlur = 0;
    const tg = g.createLinearGradient(0, my, 0, my + mh); tg.addColorStop(0, `rgba(${T.op},.2)`); tg.addColorStop(.4, `rgba(${T.op},0)`); tg.addColorStop(.6, `rgba(${T.me},0)`); tg.addColorStop(1, `rgba(${T.me},.22)`);
    g.fillStyle = tg; g.fill(); g.lineWidth = 3 * u; g.strokeStyle = T.e; g.stroke(); g.restore();
    const cy0 = L.fy0 + L.pitchY * 2.5, lg = g.createLinearGradient(mx, 0, mx + mw, 0);
    lg.addColorStop(0, `rgba(${T.acc},0)`); lg.addColorStop(.2, `rgba(${T.acc},.6)`); lg.addColorStop(.42, `rgba(${T.acc},0)`); lg.addColorStop(.58, `rgba(${T.acc},0)`); lg.addColorStop(.8, `rgba(${T.acc},.6)`); lg.addColorStop(1, `rgba(${T.acc},0)`);
    g.fillStyle = lg; g.fillRect(mx + 20 * u, cy0 - u, mw - 40 * u, 2 * u);
    if (this.logo && this.logo.ok) { const s = L.cw * 0.9; g.globalAlpha = 0.16; g.drawImage(this.logo.img, mx + mw / 2 - s / 2, cy0 - s / 2, s, s); g.globalAlpha = 1; }
    for (let row = 0; row < 5; row++) for (let col = 0; col < 7; col++) {
      if (row === 2 && col !== 2 && col !== 4 && col !== 0 && col !== 6) continue;
      const x = L.fx0 + L.pitchX * col + (L.pitchX - L.cw) / 2, y = L.fy0 + L.pitchY * row + (L.pitchY - L.ch) / 2;
      const pile = col === 0 || col === 6, emz = row === 2 && !pile, c = row < 2 ? T.op : T.me, main = row === 1 || row === 3;
      this.rr(x, y, L.cw, L.ch, 10 * u);
      g.fillStyle = pile ? "#00000073" : emz ? `rgba(${T.acc},.1)` : `rgba(${c},${main ? .16 : .08})`; g.fill();
      g.lineWidth = 2 * u; g.strokeStyle = pile ? "#ffffff3d" : emz ? `rgba(${T.acc},.85)` : `rgba(${c},${main ? .75 : .45})`; g.setLineDash(emz ? [8 * u, 6 * u] : []); g.stroke(); g.setLineDash([]);
    }
    for (const t of [0, 1]) {
      const z = p.state.teams[t];
      const put = (c, loc, i, cnt) => {
        const s = this.slot(t, loc, i); if (!s || !c) return;
        if (!cnt && this.flying && this.flying.has(`${t}:${loc}:${i}`)) return;      // still on its way here
        const down = c.hidden || !!(c.position & C.POS_FACEDOWN), def = loc === C.LOCATION_MZONE && c.position & C.POS_DEFENSE;
        const w = L.cw, h = L.ch;
        g.save(); g.translate(s.x, s.y); if (def) g.rotate(Math.PI / 2 * (t === this.o.team() ? 1 : -1));
        const sc = def ? 0.78 : 1;
        this.card(down && !(loc === C.LOCATION_MZONE || loc === C.LOCATION_SZONE) ? 0 : c.code, -w * sc / 2, -h * sc / 2, w * sc, h * sc, { down: down && loc !== C.LOCATION_GRAVE, ring: c.status & C.STATUS_DISABLED ? "#ff5a7a" : null });
        g.restore();
        if (cnt) { this.rr(s.x + L.cw * 0.18, s.y + L.ch * 0.3, 44 * u, 30 * u, 15 * u); g.fillStyle = "#0b1024ee"; g.fill(); this.text(String(cnt), s.x + L.cw * 0.18 + 22 * u, s.y + L.ch * 0.3 + 22 * u, 20 * u, "#fff", { align: "center" }); }
        if (loc === C.LOCATION_MZONE && !down && c.type & C.TYPE.MONSTER) {
          const tag = c.type & C.TYPE.LINK ? `${c.attack} / L${c.link}` : `${c.attack} / ${c.defense}`;
          this.rr(s.x - L.cw * 0.5, s.y + L.ch * 0.36, L.cw, 26 * u, 8 * u); g.fillStyle = "#0b1024dd"; g.fill();
          this.text(tag, s.x, s.y + L.ch * 0.36 + 19 * u, 17 * u, "#fff", { align: "center", max: L.cw * 0.95 });
        }
      };
      z.mzone.forEach((c, i) => put(c, C.LOCATION_MZONE, i));
      z.szone.forEach((c, i) => put(c, C.LOCATION_SZONE, i));
      if (z.grave.length) put(z.grave[z.grave.length - 1], C.LOCATION_GRAVE, 0, z.grave.length);
      if (z.banished.length) put(z.banished[z.banished.length - 1], C.LOCATION_REMOVED, 0, z.banished.length);
      if (z.extra.length) put({ hidden: true, position: C.POS_FACEDOWN }, C.LOCATION_EXTRA, 0, z.extra.length);
      if (z.deck) put({ hidden: true, position: C.POS_FACEDOWN }, C.LOCATION_DECK, 0, z.deck);
    }
  }
  bg() {
    const g = this.g, { W, H } = this;
    const gr = g.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
    gr.addColorStop(0, this.th.a); gr.addColorStop(0.5, this.th.b); gr.addColorStop(1, "#04050c");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  phases(p, x, y, w, h) {
    const g = this.g, u = this.u, ph = ["DP", "SP", "M1", "BP", "M2", "EP"], bits = [0x01, 0x02, 0x04, 0xf8, 0x100, 0x200], gap = 6 * u, pw = (w - gap * 5) / 6;
    ph.forEach((n, i) => { const on = p.phase & bits[i]; this.rr(x + i * (pw + gap), y, pw, h, h * 0.3); g.fillStyle = on ? `rgb(${this.th.acc})` : "#ffffff14"; g.fill(); this.text(n, x + i * (pw + gap) + pw / 2, y + h * 0.7, h * 0.5, on ? "#141005" : "#9aa3c7", { align: "center" }); });
  }
  /** Turn, phase and whose turn it is (or, for a combo, its name). */
  head(p) {
    const L = this.L, u = this.u, g = this.g, mine = p.turnPlayer === this.o.team(), side = mine ? this.th.me : this.th.op;
    const who = p.ended ? "Duel over" : `${p.names[p.turnPlayer] || "Duelist"}'s turn`;
    if (L.info) {
      const I = L.info; this.panel(I);
      if (p.combo) {
        this.text("COMBO", I.x + 20 * u, I.y + 38 * u, 20 * u, `rgb(${this.th.acc})`);
        this.font(30 * u); const ls = this.wrap(this.headline || "Combo line", I.w - 40 * u, 2);
        ls.forEach((l, i) => this.text(l, I.x + 20 * u, I.y + 78 * u + i * 36 * u, 30 * u, "#fff"));
      } else {
        this.text(`TURN ${p.turn}`, I.x + 20 * u, I.y + 54 * u, 42 * u, "#fff", { italic: true });
        const tw = g.measureText(`TURN ${p.turn}`).width;
        this.text(who, I.x + I.w - 20 * u, I.y + 50 * u, 20 * u, `rgb(${side})`, { align: "right", weight: 700, max: I.w - tw - 60 * u });
        this.phases(p, I.x + 20 * u, I.y + 82 * u, I.w - 40 * u, 42 * u);
      }
      // the headline (or the matchup) above the field
      if (!p.combo && L.fy0 > 60 * u) this.text(this.headline || `${p.names[this.o.team()] || "Duelist"}  vs  ${p.names[1 - this.o.team()] || "Duelist"}`, this.W / 2, 52 * u, 30 * u, "#fffffff0", { align: "center", max: L.gridW, base: "middle", stroke: 6 * u, strokeColor: "#04050c" });
      return;
    }
    if (p.combo && L.port && L.plate[1]) {
      // a combo has no opponent: its name takes that place
      const R = L.plate[1]; this.panel(R);
      this.text("COMBO", R.x + 26 * u, R.y + R.h * 0.36, 20 * u, `rgb(${this.th.acc})`);
      this.text(this.headline || "Combo line", R.x + 26 * u, R.y + R.h * 0.74, 36 * u, "#fff", { max: R.w - 52 * u });
    }
    if (!L.head || p.combo) return;
    const R = L.head; this.panel(R, { r: 18 * u });
    if (L.port) {
      this.text(`TURN ${p.turn}`, R.x + 18 * u, R.y + R.h * 0.68, 28 * u, "#fff", { italic: true });
      const tw = g.measureText(`TURN ${p.turn}`).width, pw = Math.min(R.w * 0.42, 420 * u);
      this.text(this.headline || who, R.x + 34 * u + tw, R.y + R.h * 0.66, 20 * u, this.headline ? "#ffffffcc" : `rgb(${side})`, { weight: 700, max: R.w - tw - pw - 70 * u });
      this.phases(p, R.x + R.w - pw - 12 * u, R.y + 10 * u, pw, R.h - 20 * u);
    } else {
      this.text(`TURN ${p.turn}`, R.x + 16 * u, R.y + 42 * u, 30 * u, "#fff", { italic: true });
      const tw = g.measureText(`TURN ${p.turn}`).width;
      this.text(this.headline || who, R.x + R.w - 16 * u, R.y + 40 * u, 18 * u, this.headline ? "#ffffffcc" : `rgb(${side})`, { align: "right", weight: 700, max: R.w - tw - 50 * u });
      this.phases(p, R.x + 16 * u, R.y + 60 * u, R.w - 32 * u, 36 * u);
    }
  }
  noteColor(n) { return n.cls === "chain" ? `rgb(${this.th.acc})` : n.cls === "dmg" ? "#ff5a7a" : n.cls === "turn" ? "#ffffff" : n.cls === "sys" ? "#9aa3c7" : `rgb(${this.th.me})`; }
  /** Play-by-play: the newest line on top, older lines fading below it. */
  feedPanel(now) {
    const R = this.L.feed, g = this.g, u = this.u; if (!R || R.h < 120 * u) return;
    this.panel(R);
    this.text("PLAY-BY-PLAY", R.x + 20 * u, R.y + 34 * u, 17 * u, `rgb(${this.th.acc})`);
    const top = R.y + 50 * u, rh = 66 * u, step = rh + 8 * u, rows = Math.floor((R.y + R.h - 10 * u - top) / step);
    if (!this.notes.length) { this.text("The plays appear here as they happen", R.x + 20 * u, top + 30 * u, 17 * u, "#9aa3c7", { weight: 600, max: R.w - 40 * u }); return; }
    const k = ease((now - this.notes[0].t0) / 260);
    g.save(); g.beginPath(); g.rect(R.x, top - 2 * u, R.w, R.y + R.h - top - 4 * u); g.clip();
    this.notes.slice(0, rows + 1).forEach((n, i) => {
      const y = top + i * step - (1 - k) * step, a = i === 0 ? k : Math.max(.3, 1 - i * .13);
      if (y + rh > R.y + R.h - 6 * u) return;
      g.globalAlpha = a;
      this.rr(R.x + 12 * u, y, R.w - 24 * u, rh, 12 * u); g.fillStyle = i === 0 ? "#1a2150" : "#11163a"; g.fill();
      g.fillStyle = this.noteColor(n); g.fillRect(R.x + 12 * u, y + 10 * u, 4 * u, rh - 20 * u);
      let tx = R.x + 28 * u;
      if (n.code) { const h = rh - 10 * u, w = h * 59 / 86; this.card(n.code, tx, y + 5 * u, w, h); tx += w + 12 * u; }
      this.font(18 * u, n.cls === "turn" ? 800 : 600, true);
      if (!n.lines) n.lines = this.wrap(n.text, R.x + R.w - 24 * u - tx, 2);
      n.lines.forEach((l, j) => this.text(l, tx, y + rh / 2 + (n.lines.length === 1 ? 6 * u : (j ? 19 * u : -4 * u)), 18 * u, n.cls === "turn" ? `rgb(${this.th.acc})` : "#eef0ff", { weight: n.cls === "turn" ? 800 : 600, font: '"Plus Jakarta Sans", "Chakra Petch", system-ui, sans-serif' }));
    });
    g.restore(); g.globalAlpha = 1;
  }
  /** The card being played, large, with what it is and what it does. */
  cardPanel(now) {
    const R = this.L.card, g = this.g, u = this.u, c = this.cur; if (!R) return;
    this.panel(R);
    if (!c) {
      if (this.logo && this.logo.ok) { const s = Math.min(R.w, R.h) * 0.3; g.globalAlpha = .22; g.drawImage(this.logo.img, R.x + (R.w - s) / 2, R.y + R.h / 2 - s * 0.7, s, s); g.globalAlpha = 1; }
      this.text("The card in play shows here", R.x + R.w / 2, R.y + R.h / 2 + Math.min(R.w, R.h) * 0.2, 18 * u, "#9aa3c7", { align: "center", weight: 600, max: R.w - 30 * u });
      return;
    }
    const k = ease((now - c.t0) / 320), side = c.team === this.o.team() ? this.th.me : this.th.op;
    if (!c.info) c.info = (this.o.info && this.o.info(c.code)) || { name: this.o.name(c.code), line: "", stats: "", text: "" };
    g.save(); g.globalAlpha = k;
    // what happened, in the player's colour
    this.font(17 * u); const tw = g.measureText(c.tag).width + 28 * u;
    this.rr(R.x + 16 * u, R.y + 16 * u, tw, 34 * u, 12 * u); g.fillStyle = `rgb(${side})`; g.fill();
    this.text(c.tag, R.x + 16 * u + tw / 2, R.y + 40 * u, 17 * u, "#0a0d1c", { align: "center" });
    const chh = Math.min(R.h * 0.44, (R.w - 60 * u) * 86 / 59), cww = chh * 59 / 86, cx = R.x + (R.w - cww) / 2, cy = R.y + 64 * u + (1 - k) * 14 * u;
    this.card(c.code, cx, cy, cww, chh, { glow: `rgba(${side},.8)` });
    let y = cy + chh + 40 * u;
    this.text(c.info.name, R.x + R.w / 2, y, 27 * u, "#fff", { align: "center", max: R.w - 32 * u });
    if (c.info.line) { y += 28 * u; this.text(c.info.line, R.x + R.w / 2, y, 16 * u, "#a9b4ff", { align: "center", weight: 700, max: R.w - 32 * u }); }
    if (c.info.stats) { y += 32 * u; this.text(c.info.stats, R.x + R.w / 2, y, 21 * u, `rgb(${this.th.acc})`, { align: "center", max: R.w - 32 * u }); }
    y += 18 * u;
    const lh = 22 * u, n = Math.floor((R.y + R.h - 14 * u - y) / lh);
    if (n > 0 && c.info.text) {
      this.font(16 * u, 500, true);
      if (!c.lines || c.linesN !== n) { c.lines = this.wrap(c.info.text, R.w - 40 * u, n); c.linesN = n; }
      c.lines.forEach((l, i) => this.text(l, R.x + 20 * u, y + (i + 1) * lh - 4 * u, 16 * u, "#cfd5f2", { weight: 500, font: '"Plus Jakarta Sans", "Chakra Petch", system-ui, sans-serif' }));
    }
    g.restore();
  }
  /** Portrait and square: one strip with the latest play and the card it is about. */
  ticker(now) {
    const R = this.L.tick, g = this.g, u = this.u, n = this.notes[0], c = this.cur; if (!R) return;
    this.panel(R, { r: Math.min(20 * u, R.h * 0.3) });
    const code = (this.show.feed && n && n.code) || (c && c.code) || 0;
    let tx = R.x + 16 * u;
    if (code) { const h = R.h - 12 * u, w = h * 59 / 86; this.card(code, tx, R.y + 6 * u, w, h); tx += w + 14 * u; }
    const f1 = R.h * 0.27, f2 = R.h * 0.21, max = R.x + R.w - 16 * u - tx;
    const line1 = this.show.feed ? (n ? n.text : "The plays appear here as they happen") : c ? `${c.tag[0]}${c.tag.slice(1).toLowerCase()}: ${this.o.name(c.code)}` : "The card in play shows here";
    let line2 = "";
    if (this.show.card && code) { const key = "i" + code; this.infoC = this.infoC || new Map(); if (!this.infoC.has(key)) this.infoC.set(key, (this.o.info && this.o.info(code)) || null); const inf = this.infoC.get(key); if (inf) line2 = [inf.line, inf.stats].filter(Boolean).join("  ·  "); }
    const a = n && this.show.feed ? Math.max(.35, ease((now - n.t0) / 260)) : 1;
    g.globalAlpha = a;
    this.text(line1, tx, R.y + (line2 ? R.h * 0.44 : R.h * 0.6), f1, n && n.cls === "chain" ? `rgb(${this.th.acc})` : "#fff", { weight: 700, max, font: '"Plus Jakarta Sans", "Chakra Petch", system-ui, sans-serif' });
    g.globalAlpha = 1;
    if (line2) this.text(line2, tx, R.y + R.h * 0.78, f2, "#a9b4ff", { weight: 700, max });
  }
  drawFx(now, p) {
    const g = this.g, { W, H, u } = this;
    this.fx = this.fx.filter((f) => now - f.t0 < f.d);
    for (const f of this.fx) {
      const t = (now - f.t0) / f.d; if (t < 0) continue;
      if (f.k === "fly") {
        const e = ease(t), lift = 1 + .16 * Math.sin(Math.PI * t), w = this.L.cw * lift, h = this.L.ch * lift;
        const x = f.a.x + (f.b.x - f.a.x) * e, y = f.a.y + (f.b.y - f.a.y) * e - 18 * u * Math.sin(Math.PI * t);
        g.save(); g.shadowColor = "#000c"; g.shadowBlur = 26 * u; g.shadowOffsetY = 10 * u; this.rr(x - w / 2, y - h / 2, w, h, 8 * u); g.fillStyle = "#0b1024"; g.fill(); g.restore();
        this.card(f.code, x - w / 2, y - h / 2, w, h, { down: !f.code });
      } else if (f.k === "summon" && f.at) {
        const r = (60 + 160 * ease(t)) * u; g.globalAlpha = 1 - t; g.lineWidth = 8 * u * (1 - t); g.strokeStyle = "#c9d2ff";
        g.beginPath(); g.arc(f.at.x, f.at.y, r, 0, Math.PI * 2); g.stroke();
        const beam = g.createLinearGradient(f.at.x, 0, f.at.x, f.at.y); beam.addColorStop(0, "#8d99ff00"); beam.addColorStop(1, "#ffffffcc");
        g.fillStyle = beam; g.fillRect(f.at.x - 30 * u * (1 - t), 0, 60 * u * (1 - t), f.at.y); g.globalAlpha = 1;
      } else if (f.k === "rift" && f.at) {
        const k = ease(Math.min(1, t / .65)), up = clamp01((t - .65) / .35), w = this.L.cw * (1 - .95 * k), h = this.L.ch * (1 + .3 * k), y = f.at.y - up * this.L.ch * .9;
        g.save(); g.globalAlpha = 1 - up; g.shadowColor = "#b98bff"; g.shadowBlur = 30 * u;
        if (k < .9) this.card(f.code, f.at.x - w / 2, y - h / 2, w, h, { down: !f.code });
        g.globalAlpha = (1 - up) * k; g.fillStyle = "#f1e6ff"; this.rr(f.at.x - 5 * u, y - h * .8, 10 * u, h * 1.6, 5 * u); g.fill();
        g.globalAlpha = (1 - t) * .9; g.lineWidth = 5 * u; g.strokeStyle = "#c9a6ff"; g.beginPath(); g.arc(f.at.x, f.at.y, (40 + 120 * ease(t)) * u, 0, Math.PI * 2); g.stroke(); g.restore();
      } else if (f.k === "break" && f.at) {
        g.globalAlpha = 1 - t; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, d = 140 * u * ease(t); g.fillStyle = i % 2 ? "#ffb347" : "#fff"; g.fillRect(f.at.x + Math.cos(a) * d, f.at.y + Math.sin(a) * d, 12 * u, 12 * u); } g.globalAlpha = 1;
      } else if (f.k === "atk" && f.a) {
        const b = f.b || { x: f.a.x, y: f.team === this.o.team() ? 0 : H }, e = ease(Math.min(1, t * 1.6));
        g.globalAlpha = 1 - clamp01((t - 0.6) / 0.4); g.lineWidth = 14 * u; g.lineCap = "round"; g.strokeStyle = "#ff8a3a"; g.shadowColor = "#ff5a1a"; g.shadowBlur = 30 * u;
        g.beginPath(); g.moveTo(f.a.x, f.a.y); g.lineTo(f.a.x + (b.x - f.a.x) * e, f.a.y + (b.y - f.a.y) * e); g.stroke(); g.shadowBlur = 0; g.globalAlpha = 1;
      } else if (f.k === "lp") {
        const R = this.L.plate[f.team === this.o.team() ? 0 : 1]; if (!R) continue;
        g.globalAlpha = 1 - clamp01((t - 0.6) / 0.4);
        this.text((f.up ? "+" : "−") + f.amt, R.x + R.w - 30 * u, R.y - 20 * u - 60 * u * ease(t) + (R.y < H / 2 ? R.h + 120 * u : 0), 64 * u, f.up ? "#7dffb0" : "#ff5a7a", { align: "right", stroke: 6 * u, strokeColor: "#0b0f26" });
        g.globalAlpha = 1;
      } else if (f.k === "turn") {
        const a = t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 1; g.globalAlpha = a;
        g.fillStyle = "#0b1024cc"; g.fillRect(0, H / 2 - 70 * u, W, 140 * u);
        this.text(`TURN ${p.turn}`, W / 2, H / 2 + 6 * u, 64 * u, "#fff", { align: "center", italic: true, glow: "#3347f0" });
        this.text(p.names[f.team] || "", W / 2, H / 2 + 50 * u, 26 * u, "#a9b4ff", { align: "center", weight: 700 });
        g.globalAlpha = 1;
      } else if (f.k === "cut") {
        const a = t < 0.12 ? ease(t / 0.12) : t > 0.82 ? 1 - (t - 0.82) / 0.18 : 1, bh = 260 * u, y = H * (this.L.land ? 0.5 : 0.5) - bh / 2;
        const col = f.team === this.o.team() ? "#6f7dff" : "#ff5a7a", slide = (1 - a) * W * (f.team === this.o.team() ? -0.3 : 0.3);
        g.save(); g.globalAlpha = Math.max(0, a); g.translate(slide, 0);
        g.fillStyle = "#0b1024ee"; g.fillRect(0, y, W, bh); g.fillStyle = col; g.fillRect(0, y, W, 6 * u); g.fillRect(0, y + bh - 6 * u, W, 6 * u);
        const ch = bh * 0.86, cw = ch * 59 / 86, cx = this.L.land ? W * 0.3 : W * 0.08;
        this.card(f.code, cx, y + (bh - ch) / 2, cw, ch, { glow: col });
        const tx = cx + cw + 36 * u;
        this.text(`CHAIN ${f.n}`, tx, y + bh * 0.36, 30 * u, col, { weight: 800 });
        this.text(this.o.name(f.code), tx, y + bh * 0.62, 54 * u, "#fff", { max: W - tx - 40 * u, italic: true });
        this.text(`${p.names[f.team] || ""} activated`, tx, y + bh * 0.84, 24 * u, "#c9d0f2", { weight: 600, max: W - tx - 40 * u });
        g.restore();
      } else if (f.k === "ace") {
        const a = t < 0.1 ? t / 0.1 : t > 0.85 ? (1 - t) / 0.15 : 1;
        g.save(); g.globalAlpha = Math.max(0, a); g.fillStyle = "#05060fcc"; g.fillRect(0, 0, W, H);
        g.translate(W / 2, H * 0.44); g.rotate(now / 3000);
        for (let i = 0; i < 24; i++) { g.rotate(Math.PI / 12); g.fillStyle = i % 2 ? "#f0b42944" : "#8d99ff33"; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.max(W, H), -40 * u); g.lineTo(Math.max(W, H), 40 * u); g.closePath(); g.fill(); }
        g.restore(); g.save(); g.globalAlpha = Math.max(0, a);
        const s = 0.9 + 0.1 * ease(t * 4), ch = Math.min(H * 0.56, W * 0.6 * 86 / 59) * s, cw = ch * 59 / 86;
        this.card(f.code, W / 2 - cw / 2, H * 0.44 - ch / 2, cw, ch, { glow: "#c48bff", ring: "#fff" });
        this.text(this.o.name(f.code), W / 2, H * 0.44 + ch / 2 + 70 * u, 64 * u, "#fff", { align: "center", italic: true, stroke: 8 * u, strokeColor: "#0c0f1f", max: W * 0.9 });
        this.text(`ACE CARD · ${p.names[f.team] || ""}`, W / 2, H * 0.44 + ch / 2 + 120 * u, 26 * u, "#ffe08a", { align: "center", weight: 800, max: W * 0.9 });
        g.restore();
      } else if (f.k === "win") {
        const a = ease(clamp01(t * f.d / 700)); g.save(); g.globalAlpha = a; g.fillStyle = "#05060fe6"; g.fillRect(0, 0, W, H);
        if (f.winner === 0 || f.winner === 1) {
          const r = 110 * u; this.avatar(f.winner, W / 2, H * 0.32, r);
          this.text(p.names[f.winner] || "", W / 2, H * 0.32 + r + 60 * u, 50 * u, "#fff", { align: "center", max: W * 0.9 });
          this.text("WINNER", W / 2, H * 0.32 + r + 150 * u, 110 * u, "#ffe08a", { align: "center", italic: true, glow: "#f0b429" });
          this.text(f.reason || "", W / 2, H * 0.32 + r + 210 * u, 26 * u, "#c9d0f2", { align: "center", weight: 600, max: W * 0.9 });
        } else this.text("End of the replay", W / 2, H / 2, 70 * u, "#fff", { align: "center" });
        g.restore();
      }
    }
  }
  /* ---------- a combo: its title card (the first seconds of the video) and the step caption ---------- */
  /** Draws the picture to fill w×h, zoomed about the centre. A card picture is cropped to its artwork. */
  cover(img, w, h, zoom = 1, isCard = false) {
    const g = this.g, iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, a = isCard ? { x: .14, y: .2, w: .72, h: .42 } : { x: 0, y: 0, w: 1, h: 1 };
    const k = Math.max(w / (iw * a.w), h / (ih * a.h)) * zoom, sw = w / k, sh = h / k;
    g.drawImage(img, iw * (a.x + a.w / 2) - sw / 2, ih * (a.y + a.h / 2) - sh / 2, sw, sh, 0, 0, w, h);
  }
  drawIntro(k) {
    const g = this.g, { W, H, u } = this, it = this.o.intro, wide = W > H * 1.2, E = (a, b) => ease((k - a) / (b - a));
    g.fillStyle = "#070914"; g.fillRect(0, 0, W, H);
    const bg = this.introBg && this.introBg.ok ? this.introBg : this.introCard && this.introCard.ok ? this.introCard : null;
    if (bg) {
      // clears from soft to sharp: the soft version is the same view on a tiny canvas drawn over it (a blur filter
      // on every frame slowed the recording)
      const f = E(0, .55), card = bg === this.introCard || !!it.bgCard;
      this.cover(bg.img, W, H, 1.18 - .16 * E(0, .75), card);
      if (f < 1) {
        if (!this.introSoft) { const c = document.createElement("canvas"); c.width = 48; c.height = Math.max(8, Math.round(48 * H / W)); const cg = c.getContext("2d"), keep = this.g; this.g = cg; try { this.cover(bg.img, c.width, c.height, 1.1, card); } catch { /* not drawable */ } this.g = keep; this.introSoft = c; }
        const a0 = g.globalAlpha; g.globalAlpha = a0 * (1 - f); g.imageSmoothingQuality = "high"; g.drawImage(this.introSoft, 0, 0, W, H); g.globalAlpha = a0;
      }
    } else { this.bg(); }
    let sh = g.createLinearGradient(0, H, 0, 0); sh.addColorStop(0.04, "#05060fee"); sh.addColorStop(0.5, "#05060f66"); sh.addColorStop(0.75, "#05060f22"); sh.addColorStop(1, "#05060f99"); g.fillStyle = sh; g.fillRect(0, 0, W, H);
    if (wide) { sh = g.createLinearGradient(0, 0, W * .62, 0); sh.addColorStop(0, "#05060fb8"); sh.addColorStop(1, "#05060f00"); g.fillStyle = sh; g.fillRect(0, 0, W, H); }
    // brand
    const ba = E(.05, .2); g.globalAlpha *= ba;
    if (this.logo && this.logo.ok) g.drawImage(this.logo.img, 44 * u, 36 * u, 52 * u, 52 * u);
    this.text("MEIOCG · DUEL SYNAPSE: KODEX", 110 * u, 72 * u, 22 * u, "#f0b429", { weight: 700 });
    g.globalAlpha /= ba || 1;
    // the key card
    const kc = this.introCard && this.introCard.ok ? this.introCard : null;
    const cw = wide ? Math.min(W * .22, H * .56 * 59 / 86) : Math.min(W * .5, H * .36 * 59 / 86), ch = cw * 86 / 59;
    const cx = wide ? W * .76 : W * .5, cy = wide ? H * .5 : H * .36;
    if (kc) {
      const f = E(.4, .62);
      if (f > 0) {
        g.save(); g.globalAlpha *= f; g.translate(cx, cy); g.rotate((5 + (1 - f) * 12) * Math.PI / 180); g.scale((1.3 - .3 * f) * (.9 + .1 * f), 1.3 - .3 * f);
        g.shadowColor = "#f0b42988"; g.shadowBlur = 60 * u; this.rr(-cw / 2 - 4 * u, -ch / 2 - 4 * u, cw + 8 * u, ch + 8 * u, cw * .045); g.fillStyle = "#fff"; g.fill(); g.shadowBlur = 0;
        g.save(); this.rr(-cw / 2, -ch / 2, cw, ch, cw * .04); g.clip(); g.drawImage(kc.img, -cw / 2, -ch / 2, cw, ch);
        const s = E(.6, .85); if (s > 0 && s < 1) { const gx = -cw + s * cw * 2.4, gl = g.createLinearGradient(gx, 0, gx + cw * .6, 0); gl.addColorStop(0, "#ffffff00"); gl.addColorStop(.5, "#ffffff88"); gl.addColorStop(1, "#ffffff00"); g.fillStyle = gl; g.fillRect(-cw / 2, -ch / 2, cw, ch); }
        g.restore(); g.restore();
      }
    }
    // the title: lands from the left, with a short colour-split glitch
    const tx = wide ? 64 * u : W / 2, tw = wide ? W * (kc ? .56 : .86) : W * .9, align = wide ? "left" : "center";
    const by = wide ? H - 130 * u : (kc ? cy + ch / 2 + 190 * u : H * .56);
    let fs = (wide ? 104 : 92) * u; g.font = `900 italic ${Math.round(fs)}px "Chakra Petch", system-ui, sans-serif`;
    const words = String(it.title || "Combo").split(/\s+/); let lines = [it.title];
    if (g.measureText(it.title).width > tw && words.length > 1) { let best = 1, bd = 1e9; for (let i = 1; i < words.length; i++) { const d = Math.abs(g.measureText(words.slice(0, i).join(" ")).width - g.measureText(words.slice(i).join(" ")).width); if (d < bd) { bd = d; best = i; } } lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")]; }
    const widest = Math.max(...lines.map((l) => g.measureText(l).width)); if (widest > tw) fs *= tw / widest;
    const by2 = wide ? by : (kc ? cy + ch / 2 + 96 * u : H * .5) + lines.length * fs * 1.04;
    const tf = E(.34, .5);
    if (tf > 0) {
      const dx = (1 - tf) * -60 * u, gl = k > .34 && k < .34 + 620 / it.ms ? Math.sin(k * 400) * 9 * u : 0;
      lines.forEach((l, i) => {
        const y = by2 - (lines.length - 1 - i) * fs * 1.04;
        g.globalAlpha *= tf;
        if (gl) { this.text(l, tx + dx - gl, y + 2 * u, fs, "#3ac8ffcc", { italic: true, weight: 900, align }); this.text(l, tx + dx + gl, y - 2 * u, fs, "#ff4d6acc", { italic: true, weight: 900, align }); }
        this.text(l, tx + dx, y, fs, "#ffe08a", { italic: true, weight: 900, align, stroke: 8 * u, strokeColor: "#0c0f1f", glow: "#f0b42988" });
        g.globalAlpha /= tf;
      });
      const ya = by2 - lines.length * fs * 1.04 - 6 * u;
      g.globalAlpha *= tf; this.text("C O M B O", tx, ya, 26 * u, "#9fe2ff", { weight: 800, align }); g.globalAlpha /= tf;
    }
    const sf = E(.5, .64), sub = [it.sub, it.by ? "by " + it.by : ""].filter(Boolean).join("  ·  ");
    if (sf > 0 && sub) { g.globalAlpha *= sf; this.text(sub, tx, by2 + 54 * u, 32 * u, "#e9ecff", { weight: 700, align, max: tw, font: '"Plus Jakarta Sans", "Chakra Petch", system-ui, sans-serif', stroke: 5 * u, strokeColor: "#05060f" }); g.globalAlpha /= sf; }
  }
  caption(c) {
    const g = this.g, { W, u } = this, w = Math.min(W - 60 * u, 1500 * u), x = (W - w) / 2, y = 18 * u, h = 66 * u;
    this.rr(x, y, w, h, 20 * u); g.fillStyle = "#0c0f1fe6"; g.fill(); g.lineWidth = 2 * u; g.strokeStyle = "#f0b42988"; g.stroke();
    const tag = c.step ? `STEP ${c.step}/${c.steps}` : "START";
    g.font = `800 ${Math.round(24 * u)}px "Chakra Petch", system-ui, sans-serif`; const tw = g.measureText(tag).width + 36 * u;
    this.rr(x + 10 * u, y + 11 * u, tw, h - 22 * u, 14 * u); g.fillStyle = "#f0b429"; g.fill();
    this.text(tag, x + 10 * u + tw / 2, y + h / 2 + 9 * u, 24 * u, "#1a1405", { align: "center" });
    this.text(c.caption + (c.note ? "  ·  " + c.note : ""), x + tw + 28 * u, y + h / 2 + 10 * u, 28 * u, "#fff", { weight: 700, max: w - tw - 48 * u, font: '"Plus Jakarta Sans", "Chakra Petch", system-ui, sans-serif' });
  }
  frame() {
    const p = this.o.packet(); const now = performance.now();
    this.bg();
    if (p && p.state) {
      const me = this.o.team(), op = 1 - me;
      this.field(p, now);
      this.hand(me, this.L.hand[0], p); if (!p.combo) this.hand(op, this.L.hand[1], p);
      this.plate(me, this.L.plate[0], p, now); if (!p.combo) this.plate(op, this.L.plate[1], p, now);
      if (p.combo) this.caption(p.combo);
      this.head(p);
      if (this.L.feed) this.feedPanel(now);
      if (this.L.card) this.cardPanel(now);
      if (this.L.tick) this.ticker(now);
      this.drawFx(now, p);
    }
    // a combo's title card covers the first seconds, then fades into the table
    const it = this.o.intro, el = this.t0 ? now - this.t0 : 0;
    if (it && it.ms && el < it.ms) { this.g.globalAlpha = el > it.ms - 380 ? Math.max(0, (it.ms - el) / 380) : 1; this.drawIntro(el / it.ms); this.g.globalAlpha = 1; }
    if (this.o.watermark) {
      const u = this.u, g = this.g; g.globalAlpha = 0.85;
      this.text("KodeX · meiocg.org", this.W - 30 * u, this.H - 34 * u, 22 * u, "#fff", { weight: 700, align: "right" });
      const tw = g.measureText("KodeX · meiocg.org").width;
      if (this.logo && this.logo.ok) g.drawImage(this.logo.img, this.W - 30 * u - tw - 52 * u, this.H - 68 * u, 44 * u, 44 * u);
      g.globalAlpha = 1;
    }
  }
  /** Start recording; resolves to { blob, mime, ext } when stop() is called. */
  start() {
    const mime = bestMime(); if (!mime) throw new Error("This device can't record video here.");
    const fps = this.o.fps || 30, br = { 1080: 12e6, 1440: 20e6, 2160: 40e6 }[this.o.size] || 12e6;
    this.frame();
    this.stream = this.cv.captureStream(fps);
    // the duel's own sounds go into the clip; if this device can't mix them in, the clip is recorded without sound
    const opt = { mimeType: mime, videoBitsPerSecond: br * (fps > 30 ? 1.5 : 1) };
    this.sound = false;
    if (this.o.audio) {
      try { const st = new MediaStream([...this.stream.getVideoTracks(), this.o.audio]); this.rec = new MediaRecorder(st, { ...opt, audioBitsPerSecond: 160000 }); this.stream = st; this.sound = true; }
      catch { try { const m2 = mime.split(";")[0]; const st = new MediaStream([...this.stream.getVideoTracks(), this.o.audio]); this.rec = new MediaRecorder(st, { ...opt, mimeType: m2, audioBitsPerSecond: 160000 }); this.stream = st; this.sound = true; } catch { this.rec = null; } }
    }
    if (!this.rec) this.rec = new MediaRecorder(this.stream, opt);
    const parts = []; this.rec.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
    this.done = new Promise((ok) => { this.rec.onstop = () => ok({ blob: new Blob(parts, { type: mime.split(";")[0] }), mime, ext: mime.startsWith("video/mp4") ? "mp4" : "webm" }); });
    this.rec.start(1000);
    this.t0 = performance.now();
    const loop = () => { if (!this.rec || this.rec.state === "inactive") return; this.frame(); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
    // keep drawing when the page is in the background (requestAnimationFrame pauses there)
    this.tick = setInterval(() => { if (document.hidden) this.frame(); }, 1000 / fps);
    return this.done;
  }
  elapsed() { return this.t0 ? (performance.now() - this.t0) / 1000 : 0; }
  stop() { cancelAnimationFrame(this.raf); clearInterval(this.tick); if (this.rec && this.rec.state !== "inactive") this.rec.stop(); if (this.stream) this.stream.getTracks().forEach((t) => t.stop()); return this.done; }
}
