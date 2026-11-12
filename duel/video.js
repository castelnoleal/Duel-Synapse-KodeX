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
    const { W, H, u } = this, L = {};
    const land = W > H * 1.2, port = H > W * 1.2;
    L.land = land; L.port = port;
    // field: 7 columns × 5 rows of card slots
    const fw = land ? W * 0.5 : W * 0.92, fh = land ? H * 0.9 : port ? H * 0.5 : H * 0.7;
    const cell = Math.min(fw / 7, fh / 5 * (59 / 86) + 0) ;
    const ch = Math.min(fh / 5, cell * 86 / 59), cw = ch * 59 / 86, gap = cw * 0.1;
    L.cw = cw * 0.9; L.ch = ch * 0.9; L.pitchX = cw + gap * 0.2; L.pitchY = ch;
    const gridW = L.pitchX * 7, gridH = L.pitchY * 5;
    L.fx0 = land ? (W - gridW) / 2 : (W - gridW) / 2;
    L.fy0 = land ? (H - gridH) / 2 : port ? H * 0.5 - gridH / 2 : H * 0.53 - gridH / 2;
    L.gridW = gridW; L.gridH = gridH; this.L0w = gridW;
    // plates and hands
    if (land) {
      const pw = Math.min(W * 0.23, (W - this.L0w) / 2 - 60 * u), ph = 170 * u;
      L.plate = [{ x: 40 * u, y: H - ph - 40 * u, w: pw, h: ph }, { x: 40 * u, y: 40 * u, w: pw, h: ph }];
      const hx = L.fx0 + gridW + 40 * u, hw = W - hx - 40 * u;
      L.hand = [{ x: hx, y: H * 0.56, w: hw, h: H * 0.36 }, { x: hx, y: H * 0.08, w: hw, h: H * 0.36 }];
      L.info = { x: 40 * u, y: H / 2 - 90 * u, w: pw, h: 180 * u };
    } else if (port) {
      const pw = W - 80 * u, ph = 140 * u;
      L.plate = [{ x: 40 * u, y: H - ph - 60 * u, w: pw, h: ph }, { x: 40 * u, y: 60 * u, w: pw, h: ph }];
      L.hand = [{ x: 40 * u, y: L.fy0 + gridH + 30 * u, w: W - 80 * u, h: L.plate[0].y - (L.fy0 + gridH) - 60 * u }, { x: 40 * u, y: L.plate[1].y + ph + 30 * u, w: W - 80 * u, h: L.fy0 - (L.plate[1].y + ph) - 60 * u }];
      L.info = null;
    } else {
      const pw = W * 0.46, ph = 110 * u;
      L.plate = [{ x: 30 * u, y: H - ph - 24 * u, w: pw, h: ph }, { x: W - pw - 30 * u, y: 24 * u, w: pw, h: ph }];
      L.hand = [null, null]; L.info = null;
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
  feed(p) {
    const now = performance.now(), me = this.o.team();
    for (const e of p.events || []) {
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
    if (p.ended && !this.endShown) { this.endShown = true; this.fx.push({ k: "win", winner: p.ended.winner, reason: p.ended.reason, t0: now + 600, d: 999999 }); }
  }
  /* ---------- drawing ---------- */
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
    g.save(); this.rr(R.x, R.y, R.w, R.h, 26 * u);
    const gr = g.createLinearGradient(R.x, R.y, R.x + R.w, R.y + R.h); gr.addColorStop(0, active ? "#1d2a7aee" : "#121734ee"); gr.addColorStop(1, "#0b0f26ee");
    g.fillStyle = gr; g.fill(); g.lineWidth = 3 * u; g.strokeStyle = active ? "#8d99ff" : "#ffffff22"; g.stroke(); g.restore();
    const r = R.h * 0.34; this.avatar(team, R.x + R.h * 0.5, R.y + R.h * 0.5, r);
    const tx = R.x + R.h, nm = p.names[team] || "Duelist";
    this.text(nm, tx, R.y + R.h * 0.36, 32 * u, "#fff", { max: R.w - R.h - 24 * u });
    this.text((pf && pf.title) || `Hand ${st.hand.length} · Deck ${st.deck}`, tx, R.y + R.h * 0.58, 20 * u, pf && pf.title ? "#a9b4ff" : "#9aa3c7", { weight: 600, max: R.w - R.h - 24 * u });
    // Life Points count towards their new value
    if (this.lp[team] == null) this.lp[team] = st.lp;
    this.lp[team] += (st.lp - this.lp[team]) * 0.18; if (Math.abs(st.lp - this.lp[team]) < 1) this.lp[team] = st.lp;
    const low = st.lp <= 2000;
    this.text(String(Math.round(this.lp[team])), R.x + R.w - 26 * u, R.y + R.h * 0.88, 50 * u, low ? "#ff8a9a" : "#fff", { align: "right", glow: low ? "#e0102a" : "#3347f0" });
    this.text("LP", R.x + R.w - 26 * u - this.g.measureText(String(Math.round(this.lp[team]))).width - 10 * u, R.y + R.h * 0.86, 18 * u, "#9aa3c7", { align: "right", weight: 800 });
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
    // mats
    for (let row = 0; row < 5; row++) for (let col = 0; col < 7; col++) {
      if (row === 2 && col !== 2 && col !== 4 && col !== 0 && col !== 6) continue;
      const x = L.fx0 + L.pitchX * col + (L.pitchX - L.cw) / 2, y = L.fy0 + L.pitchY * row + (L.pitchY - L.ch) / 2;
      this.rr(x, y, L.cw, L.ch, 10 * u); g.fillStyle = row < 2 ? "#2a0f2e66" : row > 2 ? "#0f1a4a66" : "#ffffff08"; g.fill();
      g.lineWidth = 2 * u; g.strokeStyle = row < 2 ? "#ff5a7a44" : row > 2 ? "#6f7dff55" : "#ffffff22"; g.setLineDash(row === 2 && (col === 2 || col === 4) ? [8 * u, 6 * u] : []); g.stroke(); g.setLineDash([]);
    }
    for (const t of [0, 1]) {
      const z = p.state.teams[t];
      const put = (c, loc, i, cnt) => {
        const s = this.slot(t, loc, i); if (!s || !c) return;
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
    gr.addColorStop(0, "#1a2260"); gr.addColorStop(0.55, "#0c1030"); gr.addColorStop(1, "#05060f");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  drawFx(now, p) {
    const g = this.g, { W, H, u } = this;
    this.fx = this.fx.filter((f) => now - f.t0 < f.d);
    for (const f of this.fx) {
      const t = (now - f.t0) / f.d; if (t < 0) continue;
      if (f.k === "summon" && f.at) {
        const r = (60 + 160 * ease(t)) * u; g.globalAlpha = 1 - t; g.lineWidth = 8 * u * (1 - t); g.strokeStyle = "#c9d2ff";
        g.beginPath(); g.arc(f.at.x, f.at.y, r, 0, Math.PI * 2); g.stroke();
        const beam = g.createLinearGradient(f.at.x, 0, f.at.x, f.at.y); beam.addColorStop(0, "#8d99ff00"); beam.addColorStop(1, "#ffffffcc");
        g.fillStyle = beam; g.fillRect(f.at.x - 30 * u * (1 - t), 0, 60 * u * (1 - t), f.at.y); g.globalAlpha = 1;
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
  cover(r, x, y, w, h, zoom = 1, fy = 0.3) {
    const g = this.g, iw = r.img.naturalWidth, ih = r.img.naturalHeight, sc = Math.max(w / iw, h / ih) * zoom, dw = iw * sc, dh = ih * sc;
    g.drawImage(r.img, x + (w - dw) / 2, y + (h - dh) * fy, dw, dh);
  }
  drawIntro(k) {
    const g = this.g, { W, H, u } = this, it = this.o.intro, wide = W > H * 1.2, E = (a, b) => ease((k - a) / (b - a));
    g.fillStyle = "#070914"; g.fillRect(0, 0, W, H);
    const bg = this.introBg && this.introBg.ok ? this.introBg : this.introCard && this.introCard.ok ? this.introCard : null;
    if (bg) {
      const f = E(0, .55), blur = (1 - f) * 30 * u;
      g.save(); if (blur > 0.5) g.filter = `blur(${blur.toFixed(1)}px) saturate(1.25)`;
      this.cover(bg, -W * .04, -H * .04, W * 1.08, H * 1.08, 1.5 - .46 * f, .3); g.restore(); g.filter = "none";
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
      if (this.L.info) {
        const I = this.L.info, u = this.u;
        this.text(`TURN ${p.turn}`, I.x, I.y + 40 * u, 44 * u, "#fff", { italic: true });
        const ph = ["DP", "SP", "M1", "BP", "M2", "EP"], bits = [0x01, 0x02, 0x04, 0xf8, 0x100, 0x200];
        ph.forEach((n, i) => { const on = p.phase & bits[i]; this.rr(I.x + i * 58 * u, I.y + 70 * u, 50 * u, 36 * u, 10 * u); this.g.fillStyle = on ? "#3347f0" : "#ffffff12"; this.g.fill(); this.text(n, I.x + i * 58 * u + 25 * u, I.y + 95 * u, 18 * u, on ? "#fff" : "#9aa3c7", { align: "center" }); });
      }
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
    this.rec = new MediaRecorder(this.stream, { mimeType: mime, videoBitsPerSecond: br * (fps > 30 ? 1.5 : 1) });
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
