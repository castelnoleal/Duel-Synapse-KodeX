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
  otk(t) { SFX.boss(t); [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(f, t + 0.9 + i * 0.09, { type: "square", d: 0.3, peak: 0.07 })); },
};
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
  prefs[k] = v; ls.set(k === "music" ? "duel:music" : "duel:sfx", v);
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
