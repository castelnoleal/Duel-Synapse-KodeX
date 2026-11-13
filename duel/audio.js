// Duel Synapse sound: every effect and the music are synthesised here with Web Audio (no recordings), so they are
// original to the Arena. KodeX Premium can replace the music and some effects with the player's own files.
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off */ } } };

let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
const prefs = { music: ls.get("duel:music", true), sfx: ls.get("duel:sfx", true), musicVol: 0.35, sfxVol: 0.8 };
const custom = { music: null, sfx: {} };          // decoded AudioBuffers from KodeX Premium
let musicNode = null, musicTimer = 0, musicOn = false;

function ac() {
  if (ctx) return ctx;
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  ctx = new C();
  master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = prefs.sfxVol; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = prefs.musicVol; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}
/** Browsers start audio only after a tap: call on the first interaction. */
export function unlock() { const c = ac(); if (c && c.state === "suspended") c.resume().catch(() => {}); if (prefs.music && musicOn) startMusic(); }

// ---- building blocks
function env(g, t, a, peak, d, end = 0.0001) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(end, t + a + d); }
function tone(freq, t, { type = "sine", a = 0.005, d = 0.3, peak = 0.3, glide = 0, out = sfxBus, detune = 0 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
  if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glide), t + a + d);
  env(g, t, a, peak, d); o.connect(g).connect(out); o.start(t); o.stop(t + a + d + 0.05);
}
function noise(t, { d = 0.2, peak = 0.3, type = "bandpass", f = 2000, q = 1, f2 = 0, out = sfxBus } = {}) {
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d);
  env(g, t, 0.004, peak, d); s.connect(fl).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
}
function bell(freq, t, peak = 0.22, d = 0.9) { // two-operator FM bell
  const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
  car.frequency.value = freq; mod.frequency.value = freq * 2.71; mg.gain.setValueAtTime(freq * 2.2, t); mg.gain.exponentialRampToValueAtTime(1, t + d);
  mod.connect(mg).connect(car.frequency); env(g, t, 0.003, peak, d); car.connect(g).connect(sfxBus);
  car.start(t); mod.start(t); car.stop(t + d + 0.05); mod.stop(t + d + 0.05);
}

// ---- effects
const SFX = {
  tap(t) { tone(1800, t, { type: "triangle", d: 0.04, peak: 0.08 }); },
  draw(t) { noise(t, { d: 0.16, peak: 0.18, f: 900, f2: 4200, q: 0.8 }); },
  set(t) { noise(t, { d: 0.09, peak: 0.2, type: "lowpass", f: 900 }); tone(180, t, { d: 0.08, peak: 0.12 }); },
  summon(t) { tone(392, t, { type: "triangle", d: 0.22, peak: 0.22 }); tone(587.3, t + 0.07, { type: "triangle", d: 0.32, peak: 0.2 }); noise(t, { d: 0.25, peak: 0.08, f: 6000, q: 0.5 }); },
  spsummon(t) { [523.3, 659.3, 784, 1046.5].forEach((f, i) => tone(f, t + i * 0.055, { type: "triangle", d: 0.35, peak: 0.16 })); noise(t, { d: 0.45, peak: 0.1, f: 3000, f2: 9000, q: 0.6 }); },
  boss(t) {
    tone(55, t, { type: "sine", a: 0.01, d: 1.4, peak: 0.6, glide: 0.6 });
    tone(110, t, { type: "sawtooth", a: 0.4, d: 0.9, peak: 0.08, glide: 4 });
    noise(t, { d: 1.2, peak: 0.25, type: "lowpass", f: 300, f2: 4000 });
    [784, 987.8, 1174.7, 1568].forEach((f, i) => bell(f, t + 0.45 + i * 0.07, 0.12, 1.1));
  },
  activate(t) { bell(880, t, 0.2, 0.7); bell(1318.5, t + 0.05, 0.1, 0.6); },
  chain(t, n = 1) { bell(440 * Math.pow(2, Math.min(n, 8) / 6), t, 0.22, 0.6); },
  attack(t) { noise(t, { d: 0.25, peak: 0.3, f: 1200, f2: 300, q: 1.5 }); tone(220, t, { type: "sawtooth", d: 0.2, peak: 0.08, glide: 0.5 }); },
  damage(t, big = false) { tone(big ? 70 : 110, t, { d: big ? 0.6 : 0.3, peak: big ? 0.5 : 0.35, glide: 0.5 }); noise(t, { d: big ? 0.5 : 0.25, peak: big ? 0.35 : 0.2, type: "lowpass", f: 1500, f2: 200 }); },
  destroy(t) { noise(t, { d: 0.5, peak: 0.3, type: "lowpass", f: 3000, f2: 150 }); tone(160, t, { type: "square", d: 0.18, peak: 0.06, glide: 0.4 }); },
  phase(t) { tone(1200, t, { type: "sine", d: 0.08, peak: 0.08 }); },
  turn(t) { tone(330, t, { type: "triangle", d: 0.25, peak: 0.18 }); tone(494, t + 0.12, { type: "triangle", d: 0.4, peak: 0.18 }); },
  win(t) { [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => tone(f, t + i * 0.11, { type: "triangle", d: 0.7, peak: 0.2 })); },
  lose(t) { [440, 415.3, 349.2, 293.7].forEach((f, i) => tone(f, t + i * 0.18, { type: "sine", d: 0.6, peak: 0.18 })); },
  finish(t) {
    tone(42, t, { type: "sine", a: 0.005, d: 1.8, peak: 0.8, glide: 0.5 });
    noise(t, { d: 0.9, peak: 0.5, type: "lowpass", f: 5000, f2: 120 });
    for (let i = 0; i < 14; i++) bell(1800 + Math.random() * 2600, t + 0.35 + i * 0.045, 0.05, 0.4);   // glass-like shards
    noise(t + 0.35, { d: 0.7, peak: 0.25, type: "highpass", f: 3000 });
  },
  otk(t) { SFX.boss(t); [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(f, t + 0.9 + i * 0.09, { type: "square", d: 0.3, peak: 0.07 })); },
};
// ---- v62: a sound for every moment (shuffles, searches, the graveyard, banishing, negations), every premium
// entrance, attack and finishing move, and every showdown. All synthesised here.
const sweep = (t, f1, f2, d, peak = 0.25, q = 1.2, type = "bandpass") => noise(t, { d, peak, f: f1, f2, q, type });
Object.assign(SFX, {
  shuffle(t) { for (let i = 0; i < 9; i++) noise(t + i * 0.05 + Math.random() * 0.012, { d: 0.045, peak: 0.16 + (i % 3) * 0.04, f: 2200 + Math.random() * 2600, q: 2.2 }); noise(t + 0.5, { d: 0.09, peak: 0.2, type: "lowpass", f: 700 }); tone(150, t + 0.5, { d: 0.08, peak: 0.1 }); },
  search(t) { sweep(t, 700, 5200, 0.2, 0.16, 0.9); bell(1174.7, t + 0.12, 0.12, 0.5); bell(1568, t + 0.2, 0.1, 0.6); },
  tograve(t) { tone(150, t, { d: 0.22, peak: 0.22, glide: 0.5 }); noise(t, { d: 0.18, peak: 0.14, type: "lowpass", f: 900, f2: 200 }); },
  banish(t) { sweep(t, 6000, 500, 0.4, 0.16, 0.8, "highpass"); tone(420, t, { type: "sine", a: 0.02, d: 0.42, peak: 0.12, glide: 3.6 }); },
  negate(t) { tone(520, t, { type: "square", d: 0.28, peak: 0.1, glide: 0.32 }); tone(262, t + 0.02, { type: "sawtooth", d: 0.3, peak: 0.08, glide: 0.4 }); noise(t, { d: 0.12, peak: 0.22, f: 1800, q: 3 }); },
  flip(t) { sweep(t, 1400, 3800, 0.1, 0.18, 1.5); tone(740, t + 0.05, { type: "triangle", d: 0.1, peak: 0.1 }); },
  heal(t) { [784, 987.8, 1318.5].forEach((f, i) => bell(f, t + i * 0.08, 0.1, 0.8)); },
  reveal(t) { bell(1568, t, 0.1, 0.5); bell(2093, t + 0.07, 0.07, 0.5); },
  cutin(t) { sweep(t, 400, 5200, 0.34, 0.26, 0.8); tone(92, t + 0.26, { d: 0.35, peak: 0.4, glide: 0.6 }); noise(t + 0.26, { d: 0.2, peak: 0.2, type: "lowpass", f: 1400, f2: 200 }); },
  counter(t) { tone(988, t, { type: "triangle", d: 0.09, peak: 0.1 }); tone(1318.5, t + 0.06, { type: "triangle", d: 0.12, peak: 0.1 }); },
  // entrances
  ent_portal(t) { tone(160, t, { type: "sine", a: 0.3, d: 0.6, peak: 0.25, glide: 3 }); sweep(t, 300, 4200, 0.8, 0.14, 4); bell(1318.5, t + 0.7, 0.12, 0.8); },
  ent_storm(t) { sweep(t, 500, 2600, 0.9, 0.22, 0.6); noise(t + 0.45, { d: 0.12, peak: 0.4, type: "highpass", f: 3500 }); tone(70, t + 0.45, { d: 0.7, peak: 0.4, glide: 0.5 }); },
  ent_inferno(t) { noise(t, { d: 1.0, peak: 0.3, type: "lowpass", f: 500, f2: 2600 }); tone(82, t, { type: "sawtooth", a: 0.2, d: 0.8, peak: 0.1, glide: 1.8 }); for (let i = 0; i < 8; i++) noise(t + 0.2 + i * 0.09, { d: 0.03, peak: 0.12, type: "highpass", f: 5000 }); },
  ent_nova(t) { tone(1760, t, { type: "sine", a: 0.25, d: 0.1, peak: 0.1, glide: 0.5 }); noise(t + 0.3, { d: 0.6, peak: 0.34, type: "lowpass", f: 6000, f2: 200 }); tone(60, t + 0.3, { d: 0.9, peak: 0.5, glide: 0.5 }); [1046.5, 1568, 2093].forEach((f, i) => bell(f, t + 0.36 + i * 0.05, 0.1, 0.9)); },
  ent_glitch(t) { for (let i = 0; i < 10; i++) tone(200 + Math.random() * 2400, t + i * 0.045, { type: "square", d: 0.03, peak: 0.07 }); noise(t + 0.2, { d: 0.08, peak: 0.2, f: 3000, q: 6 }); tone(110, t + 0.46, { type: "sawtooth", d: 0.2, peak: 0.12 }); },
  // attacks
  atk_beam(t) { tone(1400, t, { type: "sawtooth", a: 0.01, d: 0.45, peak: 0.12, glide: 0.25 }); sweep(t, 5000, 800, 0.45, 0.2, 2); tone(70, t + 0.3, { d: 0.4, peak: 0.35, glide: 0.5 }); },
  atk_comet(t) { tone(1900, t, { type: "sine", a: 0.01, d: 0.4, peak: 0.12, glide: 0.2 }); sweep(t, 3000, 300, 0.4, 0.18, 1.2); tone(55, t + 0.38, { d: 0.7, peak: 0.6, glide: 0.5 }); noise(t + 0.38, { d: 0.45, peak: 0.3, type: "lowpass", f: 2500, f2: 150 }); },
  atk_claw(t) { for (let i = 0; i < 3; i++) { sweep(t + i * 0.08, 5200, 1200, 0.1, 0.26, 2.5); tone(900 - i * 140, t + i * 0.08, { type: "sawtooth", d: 0.07, peak: 0.05, glide: 0.5 }); } },
  atk_phantom(t) { tone(330, t, { type: "sine", a: 0.15, d: 0.5, peak: 0.14, glide: 0.5 }); tone(495, t + 0.04, { type: "sine", a: 0.15, d: 0.5, peak: 0.08, glide: 0.5 }); sweep(t, 900, 300, 0.6, 0.12, 5); },
  // finishing moves
  fin_meteor(t) { tone(2200, t, { type: "sine", a: 0.05, d: 1.1, peak: 0.12, glide: 0.12 }); sweep(t, 4000, 300, 1.15, 0.2, 1); tone(40, t + 1.2, { d: 2.0, peak: 0.9, glide: 0.5 }); noise(t + 1.2, { d: 1.3, peak: 0.55, type: "lowpass", f: 4500, f2: 90 }); for (let i = 0; i < 10; i++) noise(t + 1.4 + Math.random() * 0.9, { d: 0.08, peak: 0.12, type: "lowpass", f: 900 }); },
  fin_thunder(t) { noise(t, { d: 0.07, peak: 0.7, type: "highpass", f: 2500 }); noise(t + 0.06, { d: 1.6, peak: 0.45, type: "lowpass", f: 900, f2: 70 }); tone(48, t + 0.05, { d: 1.6, peak: 0.6, glide: 0.6 }); noise(t + 0.5, { d: 0.05, peak: 0.5, type: "highpass", f: 3000 }); },
  fin_vortex(t) { for (let i = 0; i < 4; i++) sweep(t + i * 0.28, 300 + i * 200, 2600 + i * 600, 0.3, 0.16, 5); tone(220, t, { type: "sawtooth", a: 0.6, d: 0.7, peak: 0.08, glide: 0.2 }); tone(44, t + 1.2, { d: 1.2, peak: 0.6, glide: 0.5 }); },
  fin_slash(t) { sweep(t, 7000, 1500, 0.14, 0.4, 2, "highpass"); bell(2637, t + 0.1, 0.12, 1.2); sweep(t + 0.32, 7000, 1500, 0.14, 0.4, 2, "highpass"); tone(52, t + 0.6, { d: 1.2, peak: 0.6, glide: 0.5 }); noise(t + 0.6, { d: 0.6, peak: 0.3, type: "lowpass", f: 3000, f2: 150 }); },
  // showdowns
  sd_menacing(t) { for (let i = 0; i < 6; i++) { tone(52, t + i * 0.42, { type: "sine", d: 0.34, peak: 0.5, glide: 0.8 }); noise(t + i * 0.42, { d: 0.2, peak: 0.12, type: "lowpass", f: 300 }); } tone(104, t, { type: "sawtooth", a: 1.6, d: 0.8, peak: 0.07, glide: 1.5 }); },
  sd_rush(t) { for (let i = 0; i < 22; i++) { noise(t + 0.3 + i * 0.085, { d: 0.05, peak: 0.26, f: 900 + (i % 4) * 300, q: 2 }); tone(120 + (i % 3) * 30, t + 0.3 + i * 0.085, { d: 0.05, peak: 0.16 }); } sweep(t, 400, 3000, 0.3, 0.2); },
  sd_timestop(t) {
    for (let i = 0; i < 9; i++) { const d = t + [0, .16, .3, .42, .53, .63, .72, .8, .87][i]; tone(i % 2 ? 1900 : 2400, d, { type: "square", d: 0.025, peak: 0.07 }); noise(d, { d: 0.02, peak: 0.1, type: "highpass", f: 6000 }); }
    tone(880, t + 0.95, { type: "sine", a: 0.01, d: 1.1, peak: 0.22, glide: 0.12 }); tone(1320, t + 0.95, { type: "sine", a: 0.01, d: 1.1, peak: 0.12, glide: 0.1 });
    noise(t + 0.95, { d: 0.9, peak: 0.3, type: "lowpass", f: 5000, f2: 120 }); tone(46, t + 0.98, { d: 1.6, peak: 0.6, glide: 0.7 });
    bell(2093, t + 1.5, 0.06, 1.6); bell(3136, t + 1.62, 0.04, 1.6);
  },
  sd_resume(t) { tone(120, t, { type: "sine", a: 0.01, d: 0.4, peak: 0.2, glide: 6 }); sweep(t, 300, 6000, 0.35, 0.22, 1); tone(2000, t + 0.3, { type: "square", d: 0.03, peak: 0.07 }); },
  sd_freeze(t) { noise(t, { d: 0.05, peak: 0.4, type: "highpass", f: 4000 }); for (let i = 0; i < 8; i++) bell(2200 + Math.random() * 2400, t + 0.05 + i * 0.05, 0.05, 0.5); [392, 370, 330].forEach((f, i) => tone(f, t + 0.9 + i * 0.3, { type: "triangle", d: 0.5, peak: 0.12 })); },
  sd_domain(t) { tone(36, t, { type: "sine", a: 0.5, d: 2.2, peak: 0.7, glide: 0.9 }); for (const f of [110, 116.5, 164.8]) tone(f, t + 0.2, { type: "sawtooth", a: 0.8, d: 1.6, peak: 0.05 }); sweep(t + 0.15, 200, 3000, 0.9, 0.2, 3); bell(523.3, t + 1.0, 0.14, 2); },
  sd_allout(t) { for (let i = 0; i < 5; i++) { sweep(t + i * 0.14, 6000, 900, 0.1, 0.3, 2.5, "highpass"); tone(70, t + i * 0.14 + 0.05, { d: 0.14, peak: 0.3 }); } [329.6, 392, 493.9].forEach((f) => tone(f, t + 0.9, { type: "square", a: 0.01, d: 0.5, peak: 0.07 })); tone(55, t + 0.9, { d: 0.9, peak: 0.5, glide: 0.6 }); },
  sd_impact(t) { for (const d of [0.5, 0.85, 1.2, 1.8]) { tone(48, t + d, { d: 0.35, peak: 0.7, glide: 0.5 }); noise(t + d, { d: 0.09, peak: 0.5, type: "highpass", f: 1800 }); noise(t + d, { d: 0.3, peak: 0.3, type: "lowpass", f: 1200, f2: 120 }); } },
  sd_destiny(t) { sweep(t, 600, 6000, 0.8, 0.16, 1); for (let i = 0; i < 10; i++) bell(1400 + i * 180, t + 0.1 + i * 0.07, 0.05, 0.4); [523.3, 784, 1046.5, 1568].forEach((f, i) => bell(f, t + 1.05 + i * 0.06, 0.16, 1.6)); tone(65, t + 1.05, { d: 0.8, peak: 0.4, glide: 0.6 }); },
  sd_finalblow(t) { tone(180, t, { type: "sawtooth", a: 1.7, d: 0.1, peak: 0.1, glide: 5 }); sweep(t, 300, 7000, 1.8, 0.16, 1); tone(40, t + 1.9, { d: 1.6, peak: 0.9, glide: 0.5 }); noise(t + 1.9, { d: 0.8, peak: 0.5, type: "lowpass", f: 5000, f2: 120 }); bell(1046.5, t + 1.95, 0.14, 1.4); },
  sd_powerup(t) { tone(110, t, { type: "sawtooth", a: 1.4, d: 0.5, peak: 0.1, glide: 4 }); tone(220, t, { type: "square", a: 1.4, d: 0.5, peak: 0.04, glide: 4 }); for (let i = 0; i < 14; i++) noise(t + 0.2 + i * 0.1, { d: 0.05, peak: 0.1 + i * 0.008, type: "highpass", f: 4000 }); [659.3, 830.6, 987.8, 1318.5].forEach((f, i) => bell(f, t + 1.5 + i * 0.05, 0.12, 1.2)); },
  sd_beam(t) { tone(200, t, { type: "sine", a: 1.3, d: 0.1, peak: 0.16, glide: 7 }); for (let i = 0; i < 12; i++) tone(900 + i * 120, t + 0.1 + i * 0.1, { type: "sine", d: 0.06, peak: 0.05 }); tone(1500, t + 1.5, { type: "sawtooth", a: 0.01, d: 1.0, peak: 0.14, glide: 0.4 }); noise(t + 1.5, { d: 1.0, peak: 0.4, type: "bandpass", f: 2600, f2: 500, q: 0.7 }); tone(44, t + 1.5, { d: 1.2, peak: 0.6, glide: 0.7 }); },
  sd_spotlight(t) { noise(t, { d: 0.03, peak: 0.4, type: "highpass", f: 3000 }); tone(140, t, { d: 0.12, peak: 0.3 }); [659.3, 987.8, 1318.5, 1975.5].forEach((f, i) => bell(f, t + 0.35 + i * 0.09, 0.1, 1.2)); },
  sd_radiant(t) { for (const [f, d] of [[523.3, 0], [659.3, 0.06], [784, 0.12], [1046.5, 0.18], [1318.5, 0.26]]) bell(f, t + 0.2 + d, 0.13, 1.8); sweep(t, 2000, 9000, 1.2, 0.08, 0.6, "highpass"); },
});
// ---- vibration (phones): showdowns, Ace cards, big hits. Inside KodeX the app is asked to vibrate too.
prefs.vibe = ls.get("duel:vibe", true);
/** A live audio track of everything the Arena plays (for video clips). Returns { track, close } or null. */
export function tap() {
  const c = ac(); if (!c || !master || !c.createMediaStreamDestination) return null;
  try {
    const d = c.createMediaStreamDestination(); master.connect(d);
    const track = d.stream.getAudioTracks()[0]; if (!track) return null;
    return { track, close() { try { master.disconnect(d); } catch {} try { track.stop(); } catch {} } };
  } catch { return null; }
}
export function vibrate(pattern) {
  if (!prefs.vibe) return;
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* not allowed */ }
  try { if (window.parent !== window) window.parent.postMessage({ kx: "vibrate", p: pattern }, "*"); } catch { /* not embedded */ }
}
/** True when a named effect exists. */
export const has = (name) => !!SFX[name];

// ---- sound emotes: short original sounds in the style of well-known meme sounds, all synthesised here
const MEME = {
  boom(t) { tone(48, t, { type: "sine", a: 0.004, d: 1.3, peak: 0.9, glide: 0.55 }); noise(t, { d: 0.5, peak: 0.4, type: "lowpass", f: 600, f2: 80 }); tone(96, t, { type: "triangle", d: 0.6, peak: 0.25, glide: 0.5 }); },
  airhorn(t) { for (const [d, len] of [[0, 0.16], [0.2, 0.16], [0.4, 0.7]]) for (const f of [440, 554, 660]) tone(f, t + d, { type: "sawtooth", a: 0.01, d: len, peak: 0.07, detune: Math.random() * 14 - 7 }); },
  sadtrom(t) { [[392, 0], [370, 0.45], [349, 0.9]].forEach(([f, d]) => tone(f, t + d, { type: "sawtooth", a: 0.03, d: 0.38, peak: 0.12 })); tone(330, t + 1.35, { type: "sawtooth", a: 0.03, d: 1.2, peak: 0.12, glide: 0.94 }); },
  rimshot(t) { noise(t, { d: 0.08, peak: 0.35, f: 1800, q: 2 }); tone(180, t, { d: 0.1, peak: 0.25 }); noise(t + 0.22, { d: 0.08, peak: 0.35, f: 1800, q: 2 }); tone(160, t + 0.22, { d: 0.1, peak: 0.25 }); noise(t + 0.48, { d: 0.9, peak: 0.25, type: "highpass", f: 6000 }); },
  dramatic(t) { [[294, 0, 0.28], [311, 0.38, 0.28], [262, 0.8, 1.4]].forEach(([f, d, l]) => { tone(f, t + d, { type: "sawtooth", a: 0.01, d: l, peak: 0.13 }); tone(f / 2, t + d, { type: "square", a: 0.01, d: l, peak: 0.06 }); }); },
  crickets(t) { for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) tone(4400, t + i * 0.42 + j * 0.05, { type: "sine", d: 0.03, peak: 0.06 }); },
  bonk(t) { tone(900, t, { type: "square", d: 0.06, peak: 0.12, glide: 0.4 }); noise(t, { d: 0.12, peak: 0.3, f: 1200, q: 4 }); tone(240, t, { type: "sine", d: 0.25, peak: 0.25, glide: 0.7 }); },
  honk(t) { tone(330, t, { type: "square", a: 0.01, d: 0.35, peak: 0.12 }); tone(336, t, { type: "sawtooth", a: 0.01, d: 0.35, peak: 0.08 }); },
  applause(t) { for (let i = 0; i < 40; i++) noise(t + Math.random() * 1.6, { d: 0.05, peak: 0.12 + Math.random() * 0.1, f: 1500 + Math.random() * 2500, q: 1.5 }); },
  scratch(t) { noise(t, { d: 0.18, peak: 0.35, f: 600, f2: 3000, q: 3 }); noise(t + 0.2, { d: 0.25, peak: 0.35, f: 3000, f2: 400, q: 3 }); },
  riser(t) { tone(200, t, { type: "sawtooth", a: 1.6, d: 0.2, peak: 0.12, glide: 6 }); noise(t, { d: 1.8, peak: 0.15, type: "bandpass", f: 400, f2: 6000 }); },
  levelup(t) { [523.3, 659.3, 784, 1046.5, 1318.5].forEach((f, i) => tone(f, t + i * 0.07, { type: "square", d: 0.12, peak: 0.07 })); },
  buzzer(t) { tone(110, t, { type: "sawtooth", a: 0.01, d: 0.8, peak: 0.2 }); tone(116, t, { type: "square", a: 0.01, d: 0.8, peak: 0.1 }); },
  tada(t) { [[523.3, 0], [659.3, 0.1], [784, 0.2], [1046.5, 0.3]].forEach(([f, d]) => bell(f, t + d, 0.15, 1.1)); },
};
export const MEME_SOUNDS = Object.keys(MEME);
/** A sound emote by id. */
export function meme(id) {
  if (!prefs.sfx) return;
  const c = ac(); if (!c || c.state !== "running" || !MEME[id]) return;
  MEME[id](c.currentTime + 0.01);
}
// ---- the players' own clips (card voices, emote sounds): data: URLs, decoded once
const clips = new Map();
export async function clip(url, vol = 1) {
  if (!prefs.sfx || typeof url !== "string" || !url.startsWith("data:audio/")) return;
  const c = ac(); if (!c || c.state !== "running") return;
  let buf = clips.get(url);
  if (!buf) {
    try { const b64 = url.slice(url.indexOf(",") + 1), bin = atob(b64), arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); buf = await c.decodeAudioData(arr.buffer); }
    catch { return; }
    if (clips.size > 40) clips.delete(clips.keys().next().value);
    clips.set(url, buf);
  }
  const s = c.createBufferSource(), g = c.createGain(); g.gain.value = vol; s.buffer = buf; s.connect(g).connect(sfxBus); s.start();
}

/** Plays a named effect (or the player's own sound for it, in KodeX Premium). */
export function play(name, arg) {
  if (!prefs.sfx) return;
  const c = ac(); if (!c || c.state !== "running") return;
  const t = c.currentTime + 0.01;
  const mine = custom.sfx[name];
  if (mine) { const s = c.createBufferSource(); s.buffer = mine; s.connect(sfxBus); s.start(t); return; }
  if (SFX[name]) SFX[name](t, arg);
}

// ---- music: an original loop in A minor (Am–F–C–G, then Dm–F–Em–Am), pads, a plucked arpeggio and soft hats
const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62], [50, 53, 57], [53, 57, 60], [52, 55, 59], [57, 60, 64]];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
function scheduleBar(t0, bar) {
  const chord = PROG[bar % PROG.length], beat = 0.5; // 120 bpm, 4 beats per bar
  for (const n of chord) for (const det of [-6, 6]) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "sawtooth"; o.frequency.value = midi(n); o.detune.value = det; f.type = "lowpass"; f.frequency.value = 900; f.Q.value = 0.3;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.022, t0 + 0.6); g.gain.linearRampToValueAtTime(0.0001, t0 + beat * 4 + 0.3);
    o.connect(f).connect(g).connect(musicBus); o.start(t0); o.stop(t0 + beat * 4 + 0.4);
  }
  const arp = [chord[0] + 12, chord[1] + 12, chord[2] + 12, chord[1] + 24];
  for (let i = 0; i < 8; i++) tone(midi(arp[(i + bar) % 4]), t0 + i * beat / 2, { type: "triangle", d: 0.25, peak: 0.05, out: musicBus });
  tone(midi(chord[0] - 12), t0, { type: "sine", d: beat * 3.5, peak: 0.12, out: musicBus });
  for (let i = 0; i < 8; i++) noise(t0 + i * beat / 2 + beat / 4, { d: 0.05, peak: i % 2 ? 0.025 : 0.04, type: "highpass", f: 7000, out: musicBus });
}
function startMusic() {
  const c = ac(); if (!c || c.state !== "running" || musicNode || musicTimer) return;
  if (custom.music) {
    musicNode = c.createBufferSource(); musicNode.buffer = custom.music; musicNode.loop = true; musicNode.connect(musicBus); musicNode.start();
    return;
  }
  let bar = 0, next = c.currentTime + 0.1;
  const tick = () => { while (next < c.currentTime + 1.2) { scheduleBar(next, bar++); next += 2; } };
  tick(); musicTimer = setInterval(tick, 400);
}
function stopMusic() {
  if (musicNode) { try { musicNode.stop(); } catch { /* stopped */ } musicNode = null; }
  if (musicTimer) { clearInterval(musicTimer); musicTimer = 0; }
}
/** Music plays during duels (when switched on). */
export function music(on) { musicOn = on; if (on && prefs.music) startMusic(); else stopMusic(); }
export function setPref(k, v) {
  prefs[k] = v; ls.set(k === "music" ? "duel:music" : k === "vibe" ? "duel:vibe" : "duel:sfx", v);
  if (k === "music") { if (v && musicOn) { unlock(); startMusic(); } else stopMusic(); }
}
export const getPrefs = () => ({ ...prefs });

/** KodeX Premium: the player's own music and sounds (ArrayBuffers of audio files). */
export async function setCustom(data) {
  const c = ac(); if (!c) return;
  const dec = async (buf) => { try { return buf && buf.byteLength ? await c.decodeAudioData(buf.slice(0)) : null; } catch { return null; } };
  const wasPlaying = !!(musicNode || musicTimer);
  stopMusic();
  custom.music = await dec(data && data.music);
  custom.sfx = {};
  for (const k of ["summon", "activate", "damage", "win"]) { const b = await dec(data && data.sfx && data.sfx[k]); if (b) custom.sfx[k] = b; }
  if (wasPlaying || musicOn) music(musicOn);
}
