// Combo effects (KodeX Premium): drawn on a 2D canvas, the same way on screen (a layer over the Arena) and in a
// recorded video (video.js). Each one plays lightly for under a second around the card that was summoned or activated, in a
// soft circle around it (never over the whole screen, no flashes, nothing shakes); the last step of a combo ends with
// a "COMBO COMPLETE" title in the same colours.
// Created by Castel Noleal, creator of MEIOCG. A project of Meta Insider OCG since 2023.

export const FX_STYLES = [
  ["shockwave", "Shockwave", "Rings of force spread out from the card"],
  ["lightning", "Lightning", "Bolts of lightning strike the card"],
  ["inferno", "Inferno", "Flames and embers rise around the card"],
  ["cosmic", "Cosmic", "Starlight streams out of the card"],
  ["glitch", "Glitch", "Colour-split slices flicker around the card"],
  ["eclipse", "Eclipse", "A black sun rises behind the card and glows"],
  ["random", "Random", "A different one every time"],
];
export const FX_MS = 900;
const PAL = {
  shockwave: ["#ffffff", "#9fd3ff", "#5b7cff"],
  lightning: ["#ffffff", "#8fd8ff", "#3a7bff"],
  inferno: ["#fff1b8", "#ff9a2e", "#ff3d1f"],
  cosmic: ["#ffffff", "#c79bff", "#6a3dff"],
  glitch: ["#ffffff", "#2ef2ff", "#ff2e88"],
  eclipse: ["#fff3c4", "#f0b429", "#ff7a1a"],
};
const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const clamp = (t) => Math.min(1, Math.max(0, t));
/** A small seeded random, so a bolt keeps its shape across frames. */
function rnd(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }
/** Picks a style for "random" (fixed per effect by its seed). */
export function fxStyle(style, seed) {
  if (style !== "random") return style;
  const all = FX_STYLES.map((x) => x[0]).filter((x) => x !== "random");
  return all[Math.floor(rnd(seed + 7)() * all.length)];
}

/**
 * Draws one moment of an effect.
 * g: 2D context; W, H: size; style; k: 0..1 through the effect; at: {x, y} the card; seed: fixed per effect;
 * u: a size unit (1 on screen, larger in a 4K video).
 */
export function drawFx(g, W, H, style, k, at, seed = 1, u = 1, soft = false) {
  style = fxStyle(style, seed);
  const F = soft ? .22 : 1;       // flashes and darkness, much weaker when soft
  const P = PAL[style] || PAL.shockwave, x = at ? at.x : W / 2, y = at ? at.y : H / 2, R = Math.hypot(W, H);
  g.save();
  if (style === "shockwave") {
    if (k < .16) { g.fillStyle = `rgba(255,255,255,${.75 * F * (1 - k / .16)})`; g.fillRect(0, 0, W, H); }
    for (let i = 0; i < 3; i++) {
      const t = clamp((k - i * .09) / .75); if (t <= 0 || t >= 1) continue;
      const r = ease(t) * R * (.55 + i * .12);
      g.globalAlpha = (1 - t) * .95; g.lineWidth = (26 - i * 6) * u * (1 - t) + 2 * u;
      g.shadowColor = P[1]; g.shadowBlur = 40 * u; g.strokeStyle = i ? P[1] : P[0];
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    }
    g.shadowBlur = 0;
    const rr = rnd(seed), t = ease(clamp(k / .5));
    g.globalAlpha = .8 * (1 - clamp((k - .3) / .5)); g.strokeStyle = P[0]; g.lineWidth = 3 * u;
    for (let i = 0; i < 36; i++) { const a = rr() * Math.PI * 2, d0 = (40 + rr() * 80) * u + t * R * .25, d1 = d0 + (60 + rr() * 160) * u * (1 - k * .6); g.beginPath(); g.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0); g.lineTo(x + Math.cos(a) * d1, y + Math.sin(a) * d1); g.stroke(); }
    const core = g.createRadialGradient(x, y, 0, x, y, 220 * u * (1 + k)); core.addColorStop(0, `rgba(255,255,255,${.9 * (1 - k)})`); core.addColorStop(.4, P[1] + "66"); core.addColorStop(1, P[2] + "00");
    g.globalAlpha = 1; g.fillStyle = core; g.fillRect(0, 0, W, H);
  } else if (style === "lightning") {
    const dim = k < .1 ? k / .1 : 1 - clamp((k - .7) / .3);
    g.fillStyle = `rgba(2,4,18,${.62 * F * dim})`; g.fillRect(0, 0, W, H);
    const strikes = [0, .18, .4];
    strikes.forEach((s0, n) => {
      const t = (k - s0) / .32; if (t < 0 || t > 1) return;
      const rr = rnd(seed * 31 + n), sx = x + (rr() - .5) * W * .5, segs = 14;
      const pts = [[sx, -20 * u]]; for (let i = 1; i <= segs; i++) { const f = i / segs; pts.push([sx + (x - sx) * f + (rr() - .5) * 90 * u * (1 - f * .7), -20 * u + (y + 20 * u) * f]); }
      const flick = t < .15 || (t > .3 && t < .4) ? 1 : .55;
      for (const [lw, col, blur] of [[22, P[2], 50], [9, P[1], 30], [3.5, P[0], 0]]) {
        g.globalAlpha = (1 - t) * flick; g.lineWidth = lw * u; g.strokeStyle = col; g.shadowColor = P[1]; g.shadowBlur = blur * u; g.lineJoin = "round";
        g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
        // a fork
        g.beginPath(); const m = pts[Math.floor(segs * .55)]; g.moveTo(m[0], m[1]); g.lineTo(m[0] + (rr() - .5) * 200 * u, m[1] + 120 * u); g.stroke();
      }
      if (t < .2) { g.shadowBlur = 0; g.globalAlpha = .55 * F * (1 - t / .2); g.fillStyle = "#e8f4ff"; g.fillRect(0, 0, W, H); }
      const hit = g.createRadialGradient(x, y, 0, x, y, 260 * u); hit.addColorStop(0, `rgba(255,255,255,${.85 * (1 - t)})`); hit.addColorStop(.35, P[1] + "88"); hit.addColorStop(1, P[2] + "00");
      g.shadowBlur = 0; g.globalAlpha = 1; g.fillStyle = hit; g.fillRect(x - 300 * u, y - 300 * u, 600 * u, 600 * u);
    });
  } else if (style === "inferno") {
    const up = ease(clamp(k / .45)), out = clamp((k - .65) / .35), hgt = H * (.25 + .55 * up) * (1 - out * .6);
    for (let layer = 0; layer < 3; layer++) {
      const col = [P[2], P[1], P[0]][layer], hh = hgt * (1 - layer * .25);
      g.globalAlpha = (.85 - layer * .15) * (1 - out);
      const gr = g.createLinearGradient(0, H, 0, H - hh); gr.addColorStop(0, col); gr.addColorStop(.7, col + "88"); gr.addColorStop(1, col + "00");
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, H);
      for (let i = 0; i <= 48; i++) { const fx = i / 48 * W, w = Math.sin(i * .9 + k * 18 + layer * 2 + seed) * .5 + Math.sin(i * 2.3 - k * 25 + layer) * .3; g.lineTo(fx, H - hh * (.7 + .3 * w)); }
      g.lineTo(W, H); g.closePath(); g.fill();
    }
    const rr = rnd(seed); g.globalAlpha = 1 - out;
    for (let i = 0; i < 70; i++) { const ex = rr() * W, sp = .4 + rr() * .9, ey = H - (k * sp * 1.4 + rr() * .2) * H, s = (2 + rr() * 5) * u; g.fillStyle = rr() > .5 ? P[0] : P[1]; g.shadowColor = P[1]; g.shadowBlur = 10 * u; g.fillRect(ex + Math.sin(k * 10 + i) * 20 * u, ey, s, s); }
    g.shadowBlur = 0;
    const heat = g.createRadialGradient(x, y, 0, x, y, 280 * u); heat.addColorStop(0, `rgba(255,240,200,${.9 * (1 - k)})`); heat.addColorStop(.3, P[1] + "aa"); heat.addColorStop(1, P[2] + "00");
    g.globalAlpha = 1; g.fillStyle = heat; g.fillRect(0, 0, W, H);
  } else if (style === "cosmic") {
    const v = k < .15 ? k / .15 : 1 - clamp((k - .75) / .25);
    const vg = g.createRadialGradient(x, y, 0, x, y, R * .7); vg.addColorStop(0, "rgba(40,10,80,0)"); vg.addColorStop(1, `rgba(8,2,24,${.8 * F * v})`); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    const rr = rnd(seed), sp = ease(clamp(k / .8));
    for (let i = 0; i < 140; i++) {
      const a = rr() * Math.PI * 2, d0 = rr() * R * .08 + sp * R * (.15 + rr() * .5), len = (30 + rr() * 260) * u * (.3 + sp);
      g.globalAlpha = v * (.4 + rr() * .6); g.strokeStyle = rr() > .7 ? P[1] : P[0]; g.lineWidth = (1 + rr() * 2.5) * u;
      g.beginPath(); g.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0); g.lineTo(x + Math.cos(a) * (d0 + len), y + Math.sin(a) * (d0 + len)); g.stroke();
    }
    for (let i = 0; i < 3; i++) { const nx = x + Math.cos(seed + i * 2.1) * 220 * u, ny = y + Math.sin(seed + i * 2.1) * 160 * u, nb = g.createRadialGradient(nx, ny, 0, nx, ny, 320 * u); nb.addColorStop(0, (i % 2 ? P[2] : P[1]) + "55"); nb.addColorStop(1, P[2] + "00"); g.globalAlpha = v; g.fillStyle = nb; g.fillRect(0, 0, W, H); }
    const ring = ease(clamp((k - .1) / .6)); g.globalAlpha = v * (1 - ring); g.lineWidth = 6 * u; g.strokeStyle = P[0]; g.shadowColor = P[1]; g.shadowBlur = 30 * u;
    g.beginPath(); g.ellipse(x, y, ring * 420 * u, ring * 140 * u, -.25, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0;
  } else if (style === "glitch") {
    const rr = rnd(Math.floor(k * 22) + seed * 13), on = k < .85;
    if (on) {
      const src = g.canvas, cw = src.width, ch = src.height, sc = cw / W;
      for (let i = 0; i < 9; i++) {
        const sy = rr() * H, sh = (8 + rr() * 70) * u, dx = (rr() - .5) * 140 * u * (1 - k);
        try { g.drawImage(src, 0, sy * sc, cw, sh * sc, dx, sy, W, sh); } catch { /* a tainted canvas: colour bars only */ }
        g.globalAlpha = .35; g.fillStyle = rr() > .5 ? P[1] : P[2]; g.fillRect(dx < 0 ? 0 : dx, sy, W, sh * .3); g.globalAlpha = 1;
      }
      g.globalCompositeOperation = "screen";
      g.globalAlpha = .5 * (1 - k); g.fillStyle = P[2]; g.fillRect(x - 160 * u + 10 * u, y - 230 * u, 320 * u, 460 * u);
      g.fillStyle = P[1]; g.fillRect(x - 160 * u - 10 * u, y - 230 * u, 320 * u, 460 * u);
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = .18; g.fillStyle = "#000"; for (let sy = 0; sy < H; sy += 4 * u) g.fillRect(0, sy, W, 1.5 * u);
      g.globalAlpha = .9; for (let i = 0; i < 18; i++) { g.fillStyle = [P[0], P[1], P[2]][i % 3]; g.fillRect(rr() * W, rr() * H, (4 + rr() * 40) * u, (2 + rr() * 8) * u); }
    }
  } else if (style === "eclipse") {
    const dark = k < .2 ? k / .2 : 1 - clamp((k - .8) / .2);
    g.fillStyle = `rgba(3,2,8,${.7 * F * dark})`; g.fillRect(0, 0, W, H);
    const rise = ease(clamp(k / .45)), burst = clamp((k - .62) / .38), rad = (90 + 40 * rise) * u;
    g.translate(x, y);
    g.rotate(k * .8);
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; g.globalAlpha = dark * (.25 + .35 * Math.sin(i * 1.7 + k * 8) ** 2) * (1 - burst); const ray = g.createLinearGradient(0, 0, Math.cos(a) * R * .5, Math.sin(a) * R * .5); ray.addColorStop(0, P[1]); ray.addColorStop(1, P[2] + "00"); g.strokeStyle = ray; g.lineWidth = (6 + (i % 3) * 5) * u; g.beginPath(); g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); g.lineTo(Math.cos(a) * R * .5, Math.sin(a) * R * .5); g.stroke(); }
    g.rotate(-k * .8);
    const corona = g.createRadialGradient(0, 0, rad * .9, 0, 0, rad * 2.4); corona.addColorStop(0, P[0]); corona.addColorStop(.25, P[1] + "cc"); corona.addColorStop(1, P[2] + "00");
    g.globalAlpha = dark * rise; g.fillStyle = corona; g.beginPath(); g.arc(0, 0, rad * 2.4, 0, Math.PI * 2); g.fill();
    g.globalAlpha = dark * rise * (1 - burst); g.fillStyle = "#050307"; g.beginPath(); g.arc(0, 0, rad, 0, Math.PI * 2); g.fill();
    if (burst > 0) { g.globalAlpha = (1 - burst) * .9; g.lineWidth = 18 * u * (1 - burst); g.strokeStyle = P[0]; g.shadowColor = P[1]; g.shadowBlur = 40 * u; g.beginPath(); g.arc(0, 0, rad + burst * R * .6, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0; if (burst < .15) { g.globalAlpha = .7 * F * (1 - burst / .15); g.fillStyle = P[0]; g.fillRect(-x, -y, W, H); } }
  }
  g.restore();
}

let scratch = null, scratch2 = null;
function canvasOf(w, h, which) {
  let c = which ? scratch2 : scratch;
  if (!c) { c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : document.createElement("canvas"); if (which) scratch2 = c; else scratch = c; }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const x = c.getContext("2d"); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = "source-over"; x.globalAlpha = 1; x.clearRect(0, 0, w, h);
  return [c, x];
}
/**
 * The gentle effect used in combos: drawn in a box of size S around the card, faded out towards the box's edge and
 * at partial strength, so the table stays readable. res: pixels per unit of g (a sharper picture on a dense screen).
 */
export function drawFxLocal(g, style, k, at, S, seed = 1, res = 1, alpha = .6) {
  const s = Math.max(8, Math.round(S * res)), [c, x] = canvasOf(s, s, 0);
  drawFx(x, s, s, style, k, { x: s / 2, y: s / 2 }, seed, s / 900, true);
  x.globalCompositeOperation = "destination-in";
  const m = x.createRadialGradient(s / 2, s / 2, s * .1, s / 2, s / 2, s / 2); m.addColorStop(0, "rgba(0,0,0,1)"); m.addColorStop(.55, "rgba(0,0,0,.75)"); m.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = m; x.fillRect(0, 0, s, s); x.globalCompositeOperation = "source-over";
  const fade = k < .12 ? k / .12 : k > .8 ? (1 - k) / .2 : 1;
  g.save(); g.globalAlpha = alpha * Math.max(0, fade); g.drawImage(c, at.x - S / 2, at.y - S / 2, S, S); g.restore();
}
/** Draws fn(ctx) on a layer the size of g and lays it down at a given strength (to soften a whole build-up). */
function layer(g, W, H, alpha, fn) {
  const t = g.getTransform ? g.getTransform() : { a: 1 }, r = Math.max(1, Math.abs(t.a || 1));
  const [c, x] = canvasOf(Math.max(1, Math.round(W * r)), Math.max(1, Math.round(H * r)), 1);
  x.scale(r, r); fn(x);
  g.save(); g.globalAlpha = alpha; g.drawImage(c, 0, 0, W, H); g.restore();
}

/** The end of a Premium combo: "COMBO COMPLETE" slams in, in the style's colours. k: 0..1 over about 2 s. */
export function drawFinale(g, W, H, style, k, seed = 1, u = 1, title = "") {
  style = fxStyle(style, seed);
  const P = PAL[style] || PAL.shockwave;
  g.save();
  const inK = ease(clamp(k / .18)), out = clamp((k - .82) / .18), a = (1 - out);
  g.fillStyle = `rgba(3,4,14,${.18 * a * inK})`; g.fillRect(0, 0, W, H);
  // a band of light across the screen
  const bh = 150 * u * inK, by = H / 2 - bh / 2, band = g.createLinearGradient(0, by, 0, by + bh);
  band.addColorStop(0, P[2] + "00"); band.addColorStop(.5, P[2] + "55"); band.addColorStop(1, P[2] + "00");
  g.globalAlpha = a; g.fillStyle = band; g.fillRect(0, by, W, bh);
  const s = 1 + (1 - inK) * .25, fs = Math.min(W * .075, 100 * u);
  g.translate(W / 2, H / 2); g.scale(s, s);
  g.font = `900 italic ${Math.round(fs)}px "Chakra Petch", system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  const shake = 0;
  g.globalAlpha = a * inK;
  g.lineWidth = 10 * u; g.strokeStyle = "#05060f"; g.strokeText("COMBO COMPLETE", shake, 0);
  g.shadowColor = P[1]; g.shadowBlur = 18 * u; g.fillStyle = P[0]; g.fillText("COMBO COMPLETE", shake, 0); g.shadowBlur = 0;
  // a gleam sweeping across the words
  const gx = (-1 + 2.4 * clamp((k - .2) / .45)) * fs * 4, gl = g.createLinearGradient(gx - fs, 0, gx + fs, 0);
  gl.addColorStop(0, "#ffffff00"); gl.addColorStop(.5, "#ffffff88"); gl.addColorStop(1, "#ffffff00");
  g.fillStyle = gl; g.fillText("COMBO COMPLETE", shake, 0);
  if (title) { g.font = `800 ${Math.round(fs * .3)}px "Chakra Petch", system-ui, sans-serif`; g.globalAlpha = a * clamp((k - .18) / .15); g.fillStyle = P[1]; g.fillText(String(title).toUpperCase().slice(0, 40), 0, fs * .72); }
  g.restore();
  // sparks
  const rr = rnd(seed + 99); g.save(); g.globalAlpha = a;
  g.globalAlpha = a * .6; for (let i = 0; i < 18; i++) { const an = rr() * Math.PI * 2, d = ease(clamp(k / .5)) * (160 + rr() * 380) * u; g.fillStyle = rr() > .5 ? P[0] : P[1]; g.fillRect(W / 2 + Math.cos(an) * d, H / 2 + Math.sin(an) * d * .5, 4 * u, 4 * u); }
  g.restore();
}

/** On screen: a layer over the window that plays an effect and removes itself. opts.size: the card's size (px). */
export function playFx(style, at, opts = {}) {
  const cv = document.createElement("canvas"), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = innerWidth, H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.className = "cbfx-layer"; cv.setAttribute("aria-hidden", "true");
  Object.assign(cv.style, { position: "fixed", inset: "0", width: W + "px", height: H + "px", pointerEvents: "none", zIndex: "80" });
  document.body.append(cv);
  const g = cv.getContext("2d"); g.scale(dpr, dpr);
  const seed = opts.seed || Math.floor(Math.random() * 1e6), ms = opts.finale ? 1900 : FX_MS, t0 = performance.now();
  const S = Math.max(120, Math.min(Math.min(W, H) * .5, (opts.size || Math.min(W, H) * .14) * 2.8)), pt = at || { x: W / 2, y: H / 2 };
  return new Promise((done) => {
    const step = (now) => {
      const k = (now - t0) / ms;
      g.clearRect(0, 0, W, H);
      if (k >= 1) { cv.remove(); done(); return; }
      if (opts.finale) drawFinale(g, W, H, style, k, seed, Math.min(W, H) / 900, opts.title || "");
      else drawFxLocal(g, style, k, pt, S, seed, dpr);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* ---------- Premium openings: the title sequence before a combo (calm on the eyes: no flashes, nothing shakes) ---------- */
export const OPENINGS = [
  ["", "Classic", "The picture clears, the title lands and the key card slides in (free)"],
  ["thunder", "Thunderstrike", "Bolts strike down and the key card lands in a ring of light"],
  ["inferno", "Inferno Rise", "The screen catches fire and the key card rises out of the flames"],
  ["warp", "Cosmic Warp", "Warp-speed starlight; the key card flies out of the void"],
  ["shatter", "Shatter", "A sheet of glass cracks and its shards drift away to reveal the combo"],
  ["eclipse", "Eclipse Summon", "A summoning circle turns under a black sun and the key card rises from it"],
  ["cutin", "Anime Cut-in", "Speed lines and a slanted cut-in of the key card"],
  ["random", "Random", "A different opening every time"],
];
export const OPENING_MS = 4400;
const OPAL = { thunder: ["#ffffff", "#8fd8ff", "#3a7bff"], inferno: ["#fff1b8", "#ff9a2e", "#ff3d1f"], warp: ["#ffffff", "#c79bff", "#6a3dff"],
  shatter: ["#ffffff", "#9fe2ff", "#4f6bff"], eclipse: ["#fff3c4", "#f0b429", "#ff7a1a"], cutin: ["#ffffff", "#ff4d6a", "#ffd23f"] };
export function openingStyle(style, seed) {
  if (style !== "random") return style;
  const all = OPENINGS.map((x) => x[0]).filter((x) => x && x !== "random");
  return all[Math.floor(rnd(seed + 3)() * all.length)];
}
function oCover(g, img, W, H, zoom = 1, isCard = false) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height; if (!iw || !ih) return;
  const a = isCard ? { x: .14, y: .2, w: .72, h: .42 } : { x: 0, y: 0, w: 1, h: 1 };
  const k = Math.max(W / (iw * a.w), H / (ih * a.h)) * zoom, sw = W / k, sh = H / k;
  g.drawImage(img, iw * (a.x + a.w / 2) - sw / 2, ih * (a.y + a.h / 2) - sh / 2, sw, sh, 0, 0, W, H);
}
function oRR(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function oText(g, t, x, y, size, color, o = {}) {
  g.font = `${o.weight || 900} ${o.italic === false ? "" : "italic "}${Math.round(size)}px "Chakra Petch", system-ui, sans-serif`;
  g.textAlign = o.align || "center"; g.textBaseline = "alphabetic";
  if (o.stroke) { g.lineWidth = o.stroke; g.strokeStyle = o.strokeColor || "#05060f"; g.lineJoin = "round"; g.strokeText(t, x, y); }
  if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = size * .7; }
  g.fillStyle = color; g.fillText(t, x, y); g.shadowBlur = 0;
}
/**
 * One moment of a Premium opening (k: 0..1 over OPENING_MS).
 * d: { title, sub, bg (image, the backdrop), bgCard (bg is a card picture), card (image of the key card), logo (image) }
 */
export function drawOpening(g, W, H, style, k, d = {}, seed = 1, u = 1) {
  style = openingStyle(style, seed);
  const P = OPAL[style] || OPAL.thunder, wide = W > H * 1.2, R = Math.hypot(W, H);
  const E = (a, b) => ease(clamp((k - a) / (b - a))), L = (a, b) => clamp((k - a) / (b - a));
  const cw = wide ? Math.min(W * .2, H * .5 * 59 / 86) : Math.min(W * .46, H * .32 * 59 / 86), ch = cw * 86 / 59;
  const cx = wide ? W * .73 : W * .5, cy = wide ? H * .47 : H * .34;
  const ok = (im) => im && (im.naturalWidth || im.width);
  g.save();
  g.fillStyle = "#03040b"; g.fillRect(0, 0, W, H);
  // the backdrop: held back until the opening reveals it
  const reveal = { thunder: E(.32, .5), inferno: E(.2, .55), warp: E(.4, .62), shatter: 1, eclipse: E(.45, .7), cutin: E(.05, .2) }[style] ?? 1;
  if (ok(d.bg) && reveal > 0) { g.globalAlpha = reveal * .9; oCover(g, d.bg, W, H, 1.2 - .14 * E(0, 1), !!d.bgCard); g.globalAlpha = 1; }
  let sh = g.createLinearGradient(0, H, 0, 0); sh.addColorStop(0, "#03040bf2"); sh.addColorStop(.55, "#03040b66"); sh.addColorStop(1, "#03040bb0"); g.fillStyle = sh; g.fillRect(0, 0, W, H);
  // ---- the style's own build-up
  if (style === "thunder") {
    g.fillStyle = `rgba(2,4,18,${.5 * (1 - E(.3, .5))})`; g.fillRect(0, 0, W, H);
    if (k < .62) layer(g, W, H, .6, (x) => drawFx(x, W, H, "lightning", clamp(k / .62) * .9, { x: cx, y: cy }, seed, u, true));
  } else if (style === "inferno") {
    // the fire roars up, then dies down once the card has risen out of it
    layer(g, W, H, .55, (x) => drawFx(x, W, H, "inferno", .12 + .88 * L(0, .92), { x: cx, y: cy + ch * .3 }, seed, u, true));
  } else if (style === "warp") {
    if (k < .7) layer(g, W, H, .6, (x) => drawFx(x, W, H, "cosmic", .1 + .7 * L(0, .62), { x: cx, y: cy }, seed, u, true));
  } else if (style === "shatter") {
    // a sheet of glass over the screen cracks, then its shards fly off
    const rr = rnd(seed + 5), n = 9, crack = L(.1, .26), fly = E(.28, .7);
    if (fly < 1) {
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x0 = i / n * W, y0 = j / n * H, w = W / n, h = H / n, jx = (rr() - .5) * w * .5, jy = (rr() - .5) * h * .5;
        const tri = [[[x0, y0], [x0 + w + jx, y0], [x0 + jx, y0 + h + jy]], [[x0 + w + jx, y0], [x0 + w, y0 + h], [x0 + jx, y0 + h + jy]]];
        for (const t of tri) {
          const mx = (t[0][0] + t[1][0] + t[2][0]) / 3, my = (t[0][1] + t[1][1] + t[2][1]) / 3, dx = mx - W / 2, dy = my - H / 2, dist = Math.hypot(dx, dy) || 1;
          const sp = fly * (R * .6 + rr() * R * .5), ang = fly * (rr() - .5) * 6;
          g.save(); g.globalAlpha = 1 - fly; g.translate(mx + dx / dist * sp, my + dy / dist * sp + fly * fly * 300 * u); g.rotate(ang);
          g.beginPath(); t.forEach(([px, py], q) => (q ? g.lineTo(px - mx, py - my) : g.moveTo(px - mx, py - my))); g.closePath();
          const gl = g.createLinearGradient(-w, -h, w, h); gl.addColorStop(0, "#1a2152"); gl.addColorStop(.5, "#0b0f2a"); gl.addColorStop(1, "#2a3577"); g.fillStyle = gl; g.fill();
          g.strokeStyle = `rgba(190,230,255,${.25 + .6 * crack})`; g.lineWidth = 1.5 * u; g.stroke(); g.restore();
        }
      }
      if (crack > 0 && fly < .05) { g.strokeStyle = P[1]; g.lineWidth = 2.5 * u; g.shadowColor = P[1]; g.shadowBlur = 8 * u; g.globalAlpha = crack * .7;
        const r2 = rnd(seed + 9); for (let i = 0; i < 12; i++) { let x = W / 2, y = H / 2; const a = i / 12 * Math.PI * 2; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += Math.cos(a + (r2() - .5)) * R * .09 * crack; y += Math.sin(a + (r2() - .5)) * R * .09 * crack; g.lineTo(x, y); } g.stroke(); }
        g.shadowBlur = 0; g.globalAlpha = 1; }
      
    }
  } else if (style === "eclipse") {
    if (k < .75) layer(g, W, H, .6, (x) => drawFx(x, W, H, "eclipse", .1 + .55 * L(0, .7), { x: cx, y: cy - ch * .05 }, seed, u, true));
    // the summoning circle under the card
    const cf = E(.12, .4) * (1 - E(.85, 1)), ry = (wide ? cw * 1.4 : cw * 1.2), rx = ry * 2.2;
    if (cf > 0) {
      g.save(); g.translate(cx, cy + ch * .55); g.scale(1, .32); g.globalAlpha = cf * .75; g.strokeStyle = P[1]; g.shadowColor = P[1]; g.shadowBlur = 12 * u;
      for (const [r, w, sp] of [[1, 4, 1], [.82, 2, -1.6], [.6, 3, 2.2]]) { g.lineWidth = w * u; g.beginPath(); g.arc(0, 0, rx * r * .5, 0, Math.PI * 2); g.stroke();
        g.save(); g.rotate(k * sp * 4); for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(rx * r * .5, 0); g.lineTo(rx * r * .5 - 18 * u, 6 * u); g.stroke(); } g.restore(); }
      g.rotate(k * 2); g.beginPath(); for (let i = 0; i <= 5; i++) { const a = i * 4 * Math.PI / 5 - Math.PI / 2; const px = Math.cos(a) * rx * .3, py = Math.sin(a) * rx * .3; i ? g.lineTo(px, py) : g.moveTo(px, py); } g.stroke();
      g.restore();
    }
  } else if (style === "cutin") {
    // speed lines from the right, a slanted band with the key card's art crossing the screen
    const rr = rnd(seed + 11); g.save(); g.globalAlpha = .3 * (1 - E(.8, 1));
    for (let i = 0; i < 60; i++) { const y = rr() * H, len = (.2 + rr() * .5) * W, x = ((rr() + k * (2 + rr() * 2)) % 1.4 - .2) * W; g.fillStyle = rr() > .7 ? P[2] : "#ffffff"; g.fillRect(W - x, y, len, (1 + rr() * 3) * u); }
    g.restore();
    const bIn = E(.08, .22), bOut = E(.4, .5), bh = H * .32;
    if (bIn > 0 && bOut < 1) {
      g.save(); g.translate(W / 2 + (1 - bIn) * W * 1.2 - bOut * W * 1.3, H / 2); g.rotate(-.12);
      g.beginPath(); g.rect(-W, -bh / 2, W * 2, bh); g.save(); g.clip();
      if (ok(d.card)) { g.translate(-W, -bh / 2); oCover(g, d.card, W * 2, bh, 1.05, true); g.translate(W, bh / 2); } else { g.fillStyle = P[1]; g.fillRect(-W, -bh / 2, W * 2, bh); }
      g.restore(); g.lineWidth = 8 * u; g.strokeStyle = P[2]; g.strokeRect(-W, -bh / 2, W * 2, bh); g.lineWidth = 3 * u; g.strokeStyle = "#fff"; g.strokeRect(-W, -bh / 2 - 12 * u, W * 2, bh + 24 * u);
      g.restore();
    }
  }
  // ---- the key card arrives, each style its own way
  const at = { thunder: .3, inferno: .38, warp: .42, shatter: .34, eclipse: .45, cutin: .52 }[style] ?? .4;
  const f = E(at, at + .16);
  if (ok(d.card) && f > 0) {
    g.save();
    let x = cx, y = cy, s = 1, rot = 5 * Math.PI / 180, a = f;
    if (style === "thunder") { y = cy - (1 - f) * H * .6; s = 1 + (1 - f) * .3; }
    else if (style === "inferno") { y = cy + (1 - f) * H * .5; a = f; }
    else if (style === "warp") { s = .05 + .95 * f; rot += (1 - f) * Math.PI * 2; }
    else if (style === "shatter") { s = 1.4 - .4 * f; }
    else if (style === "eclipse") { y = cy + (1 - f) * ch * .9; a = f; }
    else if (style === "cutin") { x = cx + (1 - f) * W * .7; rot = (5 + (1 - f) * -20) * Math.PI / 180; }
    const bob = Math.sin(k * 9) * 4 * u * E(at + .16, at + .3);
    g.globalAlpha = a; g.translate(x, y + bob); g.rotate(rot); g.scale(s, s);
    g.shadowColor = P[1]; g.shadowBlur = 28 * u; oRR(g, -cw / 2 - 5 * u, -ch / 2 - 5 * u, cw + 10 * u, ch + 10 * u, cw * .05); g.fillStyle = P[0]; g.fill(); g.shadowBlur = 0;
    g.save(); oRR(g, -cw / 2, -ch / 2, cw, ch, cw * .04); g.clip(); g.drawImage(d.card, -cw / 2, -ch / 2, cw, ch);
    const gs = E(at + .14, at + .34); if (gs > 0 && gs < 1) { const gx = -cw + gs * cw * 2.4, gr = g.createLinearGradient(gx, 0, gx + cw * .6, 0); gr.addColorStop(0, "#ffffff00"); gr.addColorStop(.5, "#ffffffaa"); gr.addColorStop(1, "#ffffff00"); g.fillStyle = gr; g.fillRect(-cw / 2, -ch / 2, cw, ch); }
    g.restore(); g.restore();
    // the landing
    const land = L(at + .14, at + .3);
    if (land > 0 && land < 1 && style !== "inferno") drawFxLocal(g, "shockwave", .2 + land * .8, { x: cx, y: cy }, Math.max(cw, ch) * 2.4, seed + 1, 1, .5);
  }
  // ---- the title slams in
  const tAt = Math.max(.52, at + .12), tf = E(tAt, tAt + .1), title = String(d.title || "Combo");
  if (tf > 0) {
    const tx = wide ? W * .07 : W / 2, align = wide ? "left" : "center", tw = wide ? W * .58 : W * .9;
    let fs = (wide ? 110 : 94) * u; g.font = `900 italic ${Math.round(fs)}px "Chakra Petch", system-ui, sans-serif`;
    const words = title.split(/\s+/); let lines = [title];
    if (g.measureText(title).width > tw && words.length > 1) { let best = 1, bd = 1e9; for (let i = 1; i < words.length; i++) { const dd = Math.abs(g.measureText(words.slice(0, i).join(" ")).width - g.measureText(words.slice(i).join(" ")).width); if (dd < bd) { bd = dd; best = i; } } lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")]; }
    const widest = Math.max(...lines.map((l) => g.measureText(l).width)); if (widest > tw) fs *= tw / widest;
    const baseY = wide ? H * .62 : cy + ch / 2 + 150 * u;
    const s = 1 + (1 - tf) * .3, shake = 0;
    g.save(); g.globalAlpha = tf;
    lines.forEach((l, i) => {
      const y = baseY + i * fs * 1.04;
      g.save(); g.translate(tx + shake, y); g.scale(s, s);
      const split = (1 - tf) * 6 * u;
      if (split > .5) { oText(g, l, -split, 0, fs, P[2] + "cc", { align }); oText(g, l, split, 0, fs, P[1] + "cc", { align }); }
      oText(g, l, 0, 0, fs, "#ffffff", { align, stroke: 8 * u, glow: P[1] + "99" });
      // a gleam across the letters
      // a gleam across the letters (the words drawn again in a moving gradient, so only the letters light up)
      const gs = L(tAt + .1, tAt + .3); if (gs > 0 && gs < 1) { const w = g.measureText(l).width, x0 = align === "left" ? 0 : -w / 2, gx = x0 - w * .3 + gs * w * 1.6, gr = g.createLinearGradient(gx - fs, 0, gx + fs, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(.5, "rgba(255,255,255,.6)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillText(l, 0, 0); }
      g.restore();
    });
    // "COMBO" above, the subtitle below
    const ya = baseY - fs * .95; g.globalAlpha = E(tAt + .04, tAt + .14);
    oText(g, "C O M B O", tx, ya, 28 * u, P[1], { align, italic: false, weight: 800, glow: P[2] });
    if (d.sub) { g.globalAlpha = E(tAt + .1, tAt + .2); oText(g, String(d.sub).slice(0, 70), tx, baseY + lines.length * fs * 1.04 + 10 * u, 32 * u, "#e9ecff", { align, italic: false, weight: 700, stroke: 5 * u }); }
    g.restore();
  }
  // MEIOCG at the top, always
  const ba = E(.04, .16); g.globalAlpha = ba;
  if (ok(d.logo)) g.drawImage(d.logo, 44 * u, 36 * u, 52 * u, 52 * u);
  oText(g, "MEIOCG · DUEL SYNAPSE: KODEX", 110 * u, 72 * u, 22 * u, "#f0b429", { align: "left", italic: false, weight: 700 });
  g.globalAlpha = 1;
  g.restore();
}

/** On screen: the opening over the Arena (a tap skips it). Resolves when it ends. */
export function playOpening(style, d, ms = OPENING_MS) {
  const cv = document.createElement("canvas"), dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.className = "cbfx-open"; cv.setAttribute("aria-label", "Combo opening (tap to skip)");
  Object.assign(cv.style, { position: "fixed", inset: "0", width: W + "px", height: H + "px", zIndex: "85", cursor: "pointer" });
  document.body.append(cv);
  const g = cv.getContext("2d"); g.scale(dpr, dpr);
  const seed = Math.floor(Math.random() * 1e6), t0 = performance.now(), u = Math.min(W, H) / 1080 * (W > H ? 1.15 : 1.1);
  return new Promise((done) => {
    let over = false;
    const end = () => { if (over) return; over = true; cv.style.transition = "opacity .35s"; cv.style.opacity = "0"; setTimeout(() => cv.remove(), 380); done(); };
    cv.addEventListener("click", end);
    const step = (now) => { if (over) return; const k = (now - t0) / ms; if (k >= 1) { end(); return; } g.clearRect(0, 0, W, H); drawOpening(g, W, H, style, k, d, seed, u); requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
