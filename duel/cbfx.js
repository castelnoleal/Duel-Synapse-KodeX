// Dramatic combo effects (KodeX Premium): drawn on a 2D canvas, the same way on screen (a layer over the Arena) and in
// a recorded video (video.js). Each one plays for about a second and a half around the card that was summoned or
// activated; the last step of a combo ends with a "COMBO COMPLETE" slam in the same style.
// Created by Castel Noleal, creator of MEIOCG. A project of Meta Insider OCG since 2023.

export const FX_STYLES = [
  ["shockwave", "Shockwave", "A white flash and rings of force that shake the table"],
  ["lightning", "Lightning", "The table goes dark and bolts strike the card"],
  ["inferno", "Inferno", "Flames roar up from below with a rain of embers"],
  ["cosmic", "Cosmic", "Warp-speed starlight streams out of the card"],
  ["glitch", "Glitch", "The picture tears into colour-split slices"],
  ["eclipse", "Eclipse", "A black sun rises behind the card, then bursts"],
  ["random", "Random", "A different one every time"],
];
export const FX_MS = 1500;
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
export function drawFx(g, W, H, style, k, at, seed = 1, u = 1) {
  style = fxStyle(style, seed);
  const P = PAL[style] || PAL.shockwave, x = at ? at.x : W / 2, y = at ? at.y : H / 2, R = Math.hypot(W, H);
  g.save();
  if (style === "shockwave") {
    if (k < .16) { g.fillStyle = `rgba(255,255,255,${.75 * (1 - k / .16)})`; g.fillRect(0, 0, W, H); }
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
    g.fillStyle = `rgba(2,4,18,${.62 * dim})`; g.fillRect(0, 0, W, H);
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
      if (t < .2) { g.shadowBlur = 0; g.globalAlpha = .55 * (1 - t / .2); g.fillStyle = "#e8f4ff"; g.fillRect(0, 0, W, H); }
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
    const vg = g.createRadialGradient(x, y, 0, x, y, R * .7); vg.addColorStop(0, "rgba(40,10,80,0)"); vg.addColorStop(1, `rgba(8,2,24,${.8 * v})`); g.fillStyle = vg; g.fillRect(0, 0, W, H);
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
    g.fillStyle = `rgba(3,2,8,${.7 * dark})`; g.fillRect(0, 0, W, H);
    const rise = ease(clamp(k / .45)), burst = clamp((k - .62) / .38), rad = (90 + 40 * rise) * u;
    g.translate(x, y);
    g.rotate(k * .8);
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; g.globalAlpha = dark * (.25 + .35 * Math.sin(i * 1.7 + k * 8) ** 2) * (1 - burst); const ray = g.createLinearGradient(0, 0, Math.cos(a) * R * .5, Math.sin(a) * R * .5); ray.addColorStop(0, P[1]); ray.addColorStop(1, P[2] + "00"); g.strokeStyle = ray; g.lineWidth = (6 + (i % 3) * 5) * u; g.beginPath(); g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); g.lineTo(Math.cos(a) * R * .5, Math.sin(a) * R * .5); g.stroke(); }
    g.rotate(-k * .8);
    const corona = g.createRadialGradient(0, 0, rad * .9, 0, 0, rad * 2.4); corona.addColorStop(0, P[0]); corona.addColorStop(.25, P[1] + "cc"); corona.addColorStop(1, P[2] + "00");
    g.globalAlpha = dark * rise; g.fillStyle = corona; g.beginPath(); g.arc(0, 0, rad * 2.4, 0, Math.PI * 2); g.fill();
    g.globalAlpha = dark * rise * (1 - burst); g.fillStyle = "#050307"; g.beginPath(); g.arc(0, 0, rad, 0, Math.PI * 2); g.fill();
    if (burst > 0) { g.globalAlpha = (1 - burst) * .9; g.lineWidth = 18 * u * (1 - burst); g.strokeStyle = P[0]; g.shadowColor = P[1]; g.shadowBlur = 40 * u; g.beginPath(); g.arc(0, 0, rad + burst * R * .6, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0; if (burst < .15) { g.globalAlpha = .7 * (1 - burst / .15); g.fillStyle = P[0]; g.fillRect(-x, -y, W, H); } }
  }
  g.restore();
}

/** The end of a Premium combo: "COMBO COMPLETE" slams in, in the style's colours. k: 0..1 over about 2 s. */
export function drawFinale(g, W, H, style, k, seed = 1, u = 1, title = "") {
  style = fxStyle(style, seed);
  const P = PAL[style] || PAL.shockwave;
  g.save();
  const inK = ease(clamp(k / .18)), out = clamp((k - .82) / .18), a = (1 - out);
  g.fillStyle = `rgba(3,4,14,${.55 * a * inK})`; g.fillRect(0, 0, W, H);
  // a band of light across the screen
  const bh = 190 * u * inK, by = H / 2 - bh / 2, band = g.createLinearGradient(0, by, 0, by + bh);
  band.addColorStop(0, P[2] + "00"); band.addColorStop(.5, P[2] + "aa"); band.addColorStop(1, P[2] + "00");
  g.globalAlpha = a; g.fillStyle = band; g.fillRect(0, by, W, bh);
  const s = 1 + (1 - inK) * 1.8, fs = Math.min(W * .11, 150 * u);
  g.translate(W / 2, H / 2); g.scale(s, s); g.rotate((1 - inK) * -.08);
  g.font = `900 italic ${Math.round(fs)}px "Chakra Petch", system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  const shake = k < .25 ? Math.sin(k * 160) * 10 * u * (1 - k / .25) : 0;
  g.globalAlpha = a * inK;
  g.lineWidth = 14 * u; g.strokeStyle = "#05060f"; g.strokeText("COMBO COMPLETE", shake, 0);
  g.shadowColor = P[1]; g.shadowBlur = 40 * u; g.fillStyle = P[0]; g.fillText("COMBO COMPLETE", shake, 0); g.shadowBlur = 0;
  // a gleam sweeping across the words
  const gx = (-1 + 2.4 * clamp((k - .2) / .45)) * fs * 4, gl = g.createLinearGradient(gx - fs, 0, gx + fs, 0);
  gl.addColorStop(0, "#ffffff00"); gl.addColorStop(.5, "#ffffffcc"); gl.addColorStop(1, "#ffffff00");
  g.globalCompositeOperation = "source-atop"; g.fillStyle = gl; g.fillText("COMBO COMPLETE", shake, 0); g.globalCompositeOperation = "source-over";
  if (title) { g.font = `800 ${Math.round(fs * .3)}px "Chakra Petch", system-ui, sans-serif`; g.globalAlpha = a * clamp((k - .18) / .15); g.fillStyle = P[1]; g.fillText(String(title).toUpperCase().slice(0, 40), 0, fs * .72); }
  g.restore();
  // sparks
  const rr = rnd(seed + 99); g.save(); g.globalAlpha = a;
  for (let i = 0; i < 40; i++) { const an = rr() * Math.PI * 2, d = ease(clamp(k / .5)) * (200 + rr() * 600) * u; g.fillStyle = rr() > .5 ? P[0] : P[1]; g.fillRect(W / 2 + Math.cos(an) * d, H / 2 + Math.sin(an) * d * .5, 4 * u, 4 * u); }
  g.restore();
}

/** On screen: a full-window layer that plays an effect and removes itself. */
export function playFx(style, at, opts = {}) {
  const cv = document.createElement("canvas"), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = innerWidth, H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.className = "cbfx-layer"; cv.setAttribute("aria-hidden", "true");
  Object.assign(cv.style, { position: "fixed", inset: "0", width: W + "px", height: H + "px", pointerEvents: "none", zIndex: "80" });
  document.body.append(cv);
  const g = cv.getContext("2d"); g.scale(dpr, dpr);
  const seed = opts.seed || Math.floor(Math.random() * 1e6), ms = opts.finale ? 2100 : FX_MS, t0 = performance.now();
  if (!opts.finale && fxStyle(style, seed) === "shockwave") { document.body.classList.remove("cbfx-shake"); void document.body.offsetWidth; document.body.classList.add("cbfx-shake"); setTimeout(() => document.body.classList.remove("cbfx-shake"), 500); }
  return new Promise((done) => {
    const step = (now) => {
      const k = (now - t0) / ms;
      g.clearRect(0, 0, W, H);
      if (k >= 1) { cv.remove(); done(); return; }
      if (opts.finale) drawFinale(g, W, H, style, k, seed, Math.min(W, H) / 900, opts.title || "");
      else drawFx(g, W, H, style, k, at, seed, Math.min(W, H) / 900 * 1.3);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
