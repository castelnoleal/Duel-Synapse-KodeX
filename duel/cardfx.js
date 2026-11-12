// Card-specific moments for everyone, plus KodeX Premium showcases:
//  • staple(name): a unique animation for the most-played hand traps and staples, by card name (alt arts included)
//  • finale(style): a 3+ second dramatic, comic-style beat before an attack that wins the duel
//  • ace(): a KodeX Premium "Ace card" shown big on screen before its effect resolves
// Only transforms and opacity are animated; everything sits on one fixed layer that ignores taps.
// Showdowns: one set of styles for the winning-attack finale and for Ace cards (any card type).
import { play, vibrate } from "./audio.js";
export const SHOWS = ["menacing", "rush", "timestop", "freeze", "domain", "allout", "impact", "destiny", "finalblow", "powerup", "beam", "spotlight", "radiant"];
export const SHOW_NAMES = { menacing: "Menacing", rush: "Rush", timestop: "Time Stop", freeze: "Freeze Frame", domain: "Domain Expansion", allout: "All-Out Attack",
  impact: "Impact Frame", destiny: "Destiny Draw", finalblow: "Final Blow", powerup: "Power Up", beam: "Energy Blast", spotlight: "Spotlight", radiant: "Radiant" };
export const FINALES = SHOWS, ACE_STYLES = SHOWS;
export const SHOW_MIN = 3000, SHOW_MAX = 5000;
/** "random" (or an unknown name) becomes one of the styles. `seed` makes every player's screen pick the same one. */
export function pickShow(style, seed = 0, allowed = SHOWS) {
  if (allowed.includes(style)) return style;
  if (style !== "random") return allowed[0];
  let h = (Number(seed) || 0) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return allowed[(h ^ (h >>> 16)) % allowed.length];
}
const rnd = (a, b) => a + Math.random() * (b - a);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const px = (n) => Math.round(n) + "px";
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function layer() {
  let l = document.getElementById("cardFx");
  if (!l) { l = document.createElement("div"); l.id = "cardFx"; l.className = "card-fx"; l.setAttribute("aria-hidden", "true"); document.body.append(l); }
  return l;
}
function div(cls, css, text) { const d = document.createElement("div"); d.className = cls; if (css) for (const [k, v] of Object.entries(css)) { if (k.startsWith("--")) d.style.setProperty(k, v); else d.style[k] = v; } if (text != null) d.textContent = text; return d; }
const later = (n, ms) => setTimeout(() => n.remove(), ms);
/** el.animate, with the easing applied between each pair of keyframes (in the options it would bend the whole
 *  timeline, so "hold" keyframes would be skipped and things would fade early). */
function A(el, frames, opts = {}) {
  const { easing, ...o } = typeof opts === "number" ? { duration: opts } : opts;
  return el.animate(easing ? frames.map((f) => ({ easing, ...f })) : frames, o);
}

// ---------------------------------------------------------------- staples
// kind: how the particles move. glyph: what they are. word: the stamp. col: the colour of the moment.
const STAPLES = {
  "s p little knight": { kind: "dash", glyph: ["⚔"], word: "BANISHED!", sub: "S:P Little Knight", col: "#9fe2ff", cut: true },
  "baronne de fleur": { kind: "rise", glyph: ["🌹", "✿"], word: "NEGATED!", sub: "Baronne de Fleur", col: "#ff6a9a", cut: true },
  "apollousa bow of the goddess": { kind: "rays", glyph: ["✦"], word: "NEGATED!", sub: "Apollousa", col: "#ffe08a", cut: true },
  "i p masquerena": { kind: "swirl", glyph: ["🎭"], word: "LINK!", sub: "I:P Masquerena", col: "#c48bff", cut: true },
  "accesscode talker": { kind: "bolt", glyph: ["⚡", "◆"], word: "ACCESS!", sub: "Accesscode Talker", col: "#3ac8ff", cut: true },
  "knightmare unicorn": { kind: "dash", glyph: ["🦄"], word: "SHUFFLE!", sub: "Knightmare Unicorn", col: "#b46bff", cut: true },
  "ash blossom joyous spring": { kind: "swirl", glyph: ["🌸", "✿", "❀"], word: "ASH BLOSSOM", sub: "negated", col: "#ff8fc0" },
  "ghost belle haunted mansion": { kind: "rise", glyph: ["👻", "🔔"], word: "GHOST BELLE", sub: "the graveyard is sealed", col: "#b7a6ff" },
  "effect veiler": { kind: "veil", glyph: ["✧"], word: "VEILED", sub: "effects negated", col: "#9fd8ff" },
  "called by the grave": { kind: "rise", glyph: ["💀", "✋"], word: "CALLED BY THE GRAVE", sub: "banished", col: "#c9a6ff" },
  "crossout designator": { kind: "cross", glyph: ["✖"], word: "CROSSOUT", sub: "declared and denied", col: "#ff4d6a" },
  "infinite impermanence": { kind: "ring", glyph: ["∞", "⛓"], word: "IMPERMANENCE", sub: "negated", col: "#7fe0ff" },
  "maxx c": { kind: "dash", glyph: ["🪳", "🪳", "🪳"], word: "MAXX \"C\"", sub: "every summon draws", col: "#c99a5a", many: 26 },
  "retaliating c": { kind: "dash", glyph: ["🪳"], word: "RETALIATING \"C\"", sub: "", col: "#c99a5a", many: 16 },
  "droll lock bird": { kind: "fly", glyph: ["🐦", "🔒"], word: "LOCKED", sub: "no more adding cards", col: "#ffd46b" },
  "ghost ogre snow rabbit": { kind: "fall", glyph: ["❄", "❅", "🐇"], word: "GHOST OGRE", sub: "destroyed", col: "#d8f1ff" },
  "nibiru the primal being": { kind: "nibiru", glyph: ["☀"], word: "NIBIRU", sub: "the primal being descends", col: "#ffb347" },
  "d d crow": { kind: "fly", glyph: ["🐦‍⬛", "🪶"], word: "D.D. CROW", sub: "banished", col: "#9aa4bd" },
  "ghost mourner moonlit chill": { kind: "fall", glyph: ["🌙", "✦"], word: "GHOST MOURNER", sub: "", col: "#c6d4ff" },
  "ghost sister spooky dogwood": { kind: "fall", glyph: ["🌸", "💮"], word: "GHOST SISTER", sub: "", col: "#ffc2dc" },
  "dimension shifter": { kind: "ring", glyph: ["◈"], word: "DIMENSION SHIFTER", sub: "banished instead", col: "#b46bff" },
  "psy framegear gamma": { kind: "bolt", glyph: ["⚡"], word: "GAMMA", sub: "negated", col: "#7fd1ff" },
  "mulcharmy fuwalos": { kind: "fall", glyph: ["☁", "✧"], word: "MULCHARMY", sub: "every summon draws", col: "#ffd7f0" },
  "mulcharmy purulia": { kind: "fall", glyph: ["💧", "✧"], word: "MULCHARMY", sub: "every summon draws", col: "#9ce8ff" },
  "mulcharmy meowls": { kind: "fall", glyph: ["🐾", "✧"], word: "MULCHARMY", sub: "every summon draws", col: "#ffe08a" },
  "forbidden droplet": { kind: "fall", glyph: ["💧"], word: "FORBIDDEN DROPLET", sub: "", col: "#5ec8ff", many: 30 },
  "triple tactics talent": { kind: "fan", glyph: ["🂠"], word: "TRIPLE TACTICS", sub: "", col: "#ffcf5a" },
  "triple tactics thrust": { kind: "fan", glyph: ["🂠"], word: "TRIPLE TACTICS", sub: "", col: "#ffcf5a" },
  "harpie s feather duster": { kind: "storm", glyph: ["🪶"], word: "FEATHER DUSTER", sub: "", col: "#7fffb0", many: 30 },
  "raigeki": { kind: "bolt", glyph: ["⚡"], word: "RAIGEKI", sub: "", col: "#ffe46b" },
  "lightning storm": { kind: "bolt", glyph: ["⚡"], word: "LIGHTNING STORM", sub: "", col: "#ffe46b" },
  "dark ruler no more": { kind: "wave", glyph: ["☾"], word: "DARK RULER NO MORE", sub: "", col: "#a26bff" },
  "evenly matched": { kind: "scales", glyph: ["⚖"], word: "EVENLY MATCHED", sub: "", col: "#f0b429" },
  "pot of prosperity": { kind: "burst", glyph: ["🏺", "🪙"], word: "PROSPERITY", sub: "", col: "#ffcf5a" },
  "pot of desires": { kind: "burst", glyph: ["🏺", "✦"], word: "POT OF DESIRES", sub: "", col: "#7ff0a6" },
  "pot of extravagance": { kind: "burst", glyph: ["🏺", "💎"], word: "EXTRAVAGANCE", sub: "", col: "#ff9edb" },
  "pot of greed": { kind: "burst", glyph: ["🏺"], word: "POT OF GREED", sub: "", col: "#7ff0a6" },
  "super polymerization": { kind: "vortex", glyph: ["◉"], word: "SUPER POLY", sub: "", col: "#b97bff" },
  "solemn judgment": { kind: "rays", glyph: ["⚖"], word: "SOLEMN JUDGMENT", sub: "", col: "#ffe08a" },
  "solemn strike": { kind: "rays", glyph: ["⚖"], word: "SOLEMN STRIKE", sub: "", col: "#ffe08a" },
  "solemn warning": { kind: "rays", glyph: ["⚖"], word: "SOLEMN WARNING", sub: "", col: "#ffe08a" },
  "lava golem": { kind: "rise", glyph: ["🔥"], word: "LAVA GOLEM", sub: "", col: "#ff6a2a" },
  "book of moon": { kind: "moon", glyph: ["🌙"], word: "BOOK OF MOON", sub: "", col: "#c6d4ff" },
  "cosmic cyclone": { kind: "vortex", glyph: ["✦"], word: "COSMIC CYCLONE", sub: "", col: "#7fd1ff" },
  "twin twisters": { kind: "vortex", glyph: ["🌀"], word: "TWIN TWISTERS", sub: "", col: "#8ff0d0" },
  "mystical space typhoon": { kind: "vortex", glyph: ["🌀"], word: "MST", sub: "", col: "#8ff0d0" },
  "bystial magnamhut": { kind: "wave", glyph: ["✹"], word: "BYSTIAL", sub: "", col: "#ff7a3a" },
  "bystial druiswurm": { kind: "wave", glyph: ["✹"], word: "BYSTIAL", sub: "", col: "#a26bff" },
  "kurikara divincarnate": { kind: "rise", glyph: ["🔥", "⚔"], word: "KURIKARA", sub: "", col: "#ff5a3a" },
  "ice dragon s prison": { kind: "fall", glyph: ["❄"], word: "ICE DRAGON'S PRISON", sub: "", col: "#bfe9ff" },
  "abominable unchained soul": { kind: "wave", glyph: ["☠"], word: "UNCHAINED", sub: "", col: "#ff4d6a" },
  "sauravis the ancient and ascended": { kind: "rays", glyph: ["✦"], word: "SAURAVIS", sub: "", col: "#7ff0a6" },
  "fantastical dragon phantazmay": { kind: "rise", glyph: ["✧"], word: "PHANTAZMAY", sub: "", col: "#ffcf5a" },
  "dominus impulse": { kind: "bolt", glyph: ["✷"], word: "DOMINUS", sub: "", col: "#ff6a7a" },
  "dominus purge": { kind: "bolt", glyph: ["✷"], word: "DOMINUS", sub: "", col: "#ff6a7a" },
  "monster reborn": { kind: "rays", glyph: ["☥"], word: "MONSTER REBORN", sub: "", col: "#ffe08a" },
  "mirror force": { kind: "cross", glyph: ["◇"], word: "MIRROR FORCE", sub: "", col: "#bfe9ff" },
  "torrential tribute": { kind: "fall", glyph: ["🌊"], word: "TORRENTIAL", sub: "", col: "#5ec8ff", many: 26 },
  "skill drain": { kind: "wave", glyph: ["⊘"], word: "SKILL DRAIN", sub: "", col: "#a26bff" },
  "anti spell fragrance": { kind: "rise", glyph: ["🌼"], word: "ANTI-SPELL", sub: "", col: "#ffe46b" },
  "gameciel the sea turtle kaiju": { kind: "kaiju", glyph: ["🐢"], word: "KAIJU!", sub: "", col: "#5ec8ff" },
  "dogoran the mad flame kaiju": { kind: "kaiju", glyph: ["🦖"], word: "KAIJU!", sub: "", col: "#ff6a2a" },
  "radian the multidimensional kaiju": { kind: "kaiju", glyph: ["👾"], word: "KAIJU!", sub: "", col: "#b46bff" },
  "kumongous the sticky string kaiju": { kind: "kaiju", glyph: ["🕷"], word: "KAIJU!", sub: "", col: "#c9a6ff" },
  "gadarla the mystery dust kaiju": { kind: "kaiju", glyph: ["🦋"], word: "KAIJU!", sub: "", col: "#ffd46b" },
  "jizukiru the star destroying kaiju": { kind: "kaiju", glyph: ["🦂"], word: "KAIJU!", sub: "", col: "#ff9a5a" },
  "thunder king the lightningstrike kaiju": { kind: "kaiju", glyph: ["⚡"], word: "KAIJU!", sub: "", col: "#ffe46b" },
};
export const stapleNames = () => Object.keys(STAPLES);
export const isStaple = (name) => !!STAPLES[norm(name)];

function stamp(L, word, sub, col, big, low) {
  const s = div("cf-stamp" + (big ? " big" : "") + (low ? " low" : ""), { "--c": col });
  s.append(div("cf-word", null, word));
  if (sub) s.append(div("cf-sub", null, sub));
  L.append(s); later(s, 1900);
  A(s, [{ transform: "translate(-50%,-50%) scale(2.6) rotate(-8deg)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(.94) rotate(-6deg)", opacity: 1, offset: .16 }, { transform: "translate(-50%,-50%) scale(1) rotate(-6deg)", opacity: 1, offset: .8 }, { transform: "translate(-50%,-50%) scale(1.06) rotate(-6deg)", opacity: 0 }], { duration: 1800, easing: "cubic-bezier(.2,.9,.3,1)", fill: "both" });
}
function glyphs(L, spec, from) {
  const W = innerWidth, H = innerHeight, n = spec.many || 18, g = spec.glyph;
  for (let i = 0; i < n; i++) {
    const p = div("cf-p", { color: spec.col }, g[i % g.length]);
    L.append(p); later(p, 2400);
    let k;
    const x0 = from ? from.x : W / 2, y0 = from ? from.y : H / 2;
    switch (spec.kind) {
      case "swirl": { const a = (i / n) * Math.PI * 4, r = rnd(60, Math.min(W, H) * .45); k = [{ transform: `translate(${px(x0)},${px(y0)}) scale(.2) rotate(0)`, opacity: 0 }, { transform: `translate(${px(x0 + Math.cos(a) * r * .5)},${px(y0 + Math.sin(a) * r * .5)}) scale(1.2) rotate(180deg)`, opacity: 1, offset: .4 }, { transform: `translate(${px(x0 + Math.cos(a + 1.4) * r)},${px(y0 + Math.sin(a + 1.4) * r + 80)}) scale(.8) rotate(420deg)`, opacity: 0 }]; break; }
      case "rise": { const x = rnd(W * .15, W * .85); k = [{ transform: `translate(${px(x)},${px(H + 40)}) scale(.8)`, opacity: 0 }, { transform: `translate(${px(x + rnd(-40, 40))},${px(H * .5)}) scale(1.2)`, opacity: 1, offset: .5 }, { transform: `translate(${px(x + rnd(-60, 60))},${px(-60)}) scale(.9)`, opacity: 0 }]; break; }
      case "fall": case "storm": { const x = rnd(0, W), d = spec.kind === "storm" ? rnd(-300, 300) : rnd(-60, 60); k = [{ transform: `translate(${px(x)},${px(-40)}) rotate(0)`, opacity: 0 }, { transform: `translate(${px(x + d * .5)},${px(H * .5)}) rotate(${rnd(-180, 180)}deg)`, opacity: 1, offset: .45 }, { transform: `translate(${px(x + d)},${px(H + 40)}) rotate(${rnd(-360, 360)}deg)`, opacity: 0 }]; break; }
      case "dash": { const y = rnd(H * .1, H * .9), dir = i % 2 ? 1 : -1; k = [{ transform: `translate(${px(dir > 0 ? -60 : W + 60)},${px(y)}) scaleX(${-dir})`, opacity: 1 }, { transform: `translate(${px(dir > 0 ? W + 60 : -60)},${px(y + rnd(-60, 60))}) scaleX(${-dir})`, opacity: 1 }]; break; }
      case "fly": { const y = rnd(H * .2, H * .6); k = [{ transform: `translate(${px(-60)},${px(y)}) scale(1.2)`, opacity: 0 }, { transform: `translate(${px(W * .5)},${px(y - 80)}) scale(1.5)`, opacity: 1, offset: .5 }, { transform: `translate(${px(W + 60)},${px(y - 200)}) scale(1)`, opacity: 0 }]; break; }
      default: { const a = (i / n) * Math.PI * 2, r = rnd(90, Math.min(W, H) * .5); k = [{ transform: `translate(${px(x0)},${px(y0)}) scale(.3)`, opacity: 1 }, { transform: `translate(${px(x0 + Math.cos(a) * r)},${px(y0 + Math.sin(a) * r)}) scale(1.3) rotate(${rnd(-90, 90)}deg)`, opacity: 0 }]; }
    }
    p.animate(k, { duration: spec.kind === "dash" ? rnd(700, 1300) : rnd(1100, 1900), delay: rnd(0, spec.kind === "dash" ? 700 : 300), easing: spec.kind === "dash" ? "linear" : "cubic-bezier(.2,.7,.3,1)", fill: "both" });
  }
}
function overlay(L, spec, at) {
  const W = innerWidth, H = innerHeight, c = spec.col;
  const add = (cls, css, kf, opt) => { const d = div(cls, { "--c": c, ...css }); L.append(d); later(d, (opt.duration || 1200) + (opt.delay || 0) + 100); A(d, kf, { fill: "both", ...opt }); return d; };
  switch (spec.kind) {
    case "veil": add("cf-veil", {}, [{ transform: "translateX(-110%) skewX(-12deg)", opacity: .9 }, { transform: "translateX(0) skewX(-12deg)", opacity: .75, offset: .45 }, { transform: "translateX(110%) skewX(-12deg)", opacity: 0 }], { duration: 1300, easing: "cubic-bezier(.5,0,.3,1)" }); break;
    case "cross": for (const r of [45, -45]) add("cf-slash", { transform: `translate(-50%,-50%) rotate(${r}deg)` }, [{ transform: `translate(-50%,-50%) rotate(${r}deg) scaleX(0)`, opacity: 1 }, { transform: `translate(-50%,-50%) rotate(${r}deg) scaleX(1)`, opacity: 1, offset: .35 }, { transform: `translate(-50%,-50%) rotate(${r}deg) scaleX(1)`, opacity: 0 }], { duration: 1100, delay: r > 0 ? 0 : 160, easing: "cubic-bezier(.2,.9,.2,1)" }); break;
    case "ring": case "vortex": add("cf-ring " + spec.kind, { left: px(at.x), top: px(at.y) }, [{ transform: "translate(-50%,-50%) scale(.1) rotate(0)", opacity: 1 }, { transform: "translate(-50%,-50%) scale(1) rotate(360deg)", opacity: 1, offset: .5 }, { transform: "translate(-50%,-50%) scale(1.4) rotate(720deg)", opacity: 0 }], { duration: 1500, easing: "ease-in-out" }); break;
    case "bolt": for (let i = 0; i < 4; i++) { const x = rnd(W * .15, W * .85); add("cf-bolt", { left: px(x) }, [{ opacity: 0 }, { opacity: 1, offset: .1 }, { opacity: .2, offset: .3 }, { opacity: 1, offset: .4 }, { opacity: 0 }], { duration: 600, delay: i * 140 }); } add("cf-flash", {}, [{ opacity: 0 }, { opacity: .5, offset: .1 }, { opacity: 0 }], { duration: 600, delay: 120 }); break;
    case "wave": add("cf-wave", { left: px(at.x), top: px(at.y) }, [{ transform: "translate(-50%,-50%) scale(0)", opacity: .9 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 0 }], { duration: 1300, easing: "ease-out" }); break;
    case "rays": case "nibiru": add("cf-rays", { left: px(W / 2), top: px(spec.kind === "nibiru" ? H * .25 : H / 2) }, [{ transform: "translate(-50%,-50%) scale(.2) rotate(0)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1) rotate(30deg)", opacity: 1, offset: .35 }, { transform: "translate(-50%,-50%) scale(1.3) rotate(70deg)", opacity: 0 }], { duration: 1600, easing: "ease-out" }); if (spec.kind === "nibiru") add("cf-sun", { left: px(W / 2) }, [{ transform: "translate(-50%,-120%) scale(.6)", opacity: 0 }, { transform: "translate(-50%,10vh) scale(1)", opacity: 1, offset: .5 }, { transform: "translate(-50%,20vh) scale(1.4)", opacity: 0 }], { duration: 1600, easing: "cubic-bezier(.5,0,.6,1)" }); break;
    case "scales": add("cf-big", { left: px(W / 2), top: px(H * .42) }, [{ transform: "translate(-50%,-50%) rotate(-14deg) scale(.6)", opacity: 0 }, { transform: "translate(-50%,-50%) rotate(14deg) scale(1)", opacity: 1, offset: .3 }, { transform: "translate(-50%,-50%) rotate(-8deg)", offset: .55 }, { transform: "translate(-50%,-50%) rotate(0)", opacity: 0 }], { duration: 1500 }).textContent = "⚖"; break;
    case "moon": add("cf-big", { left: px(W / 2), top: px(H * .4) }, [{ transform: "translate(-50%,-50%) rotateY(0)", opacity: 0 }, { transform: "translate(-50%,-50%) rotateY(180deg)", opacity: 1, offset: .5 }, { transform: "translate(-50%,-50%) rotateY(360deg)", opacity: 0 }], { duration: 1400 }).textContent = "🌙"; break;
    case "fan": for (let i = -1; i <= 1; i++) add("cf-cardfan", { left: px(W / 2), top: px(H * .45) }, [{ transform: "translate(-50%,-50%) rotate(0) translateY(0)", opacity: 0 }, { transform: `translate(-50%,-50%) rotate(${i * 22}deg) translateY(-30px)`, opacity: 1, offset: .35 }, { transform: `translate(-50%,-50%) rotate(${i * 22}deg) translateY(-30px)`, opacity: 0 }], { duration: 1500, easing: "cubic-bezier(.2,.9,.3,1)" }); break;
    case "kaiju": add("cf-kaiju", {}, [{ transform: "translateY(40%) scale(1.2)", opacity: 0 }, { transform: "translateY(0) scale(1)", opacity: .85, offset: .4 }, { transform: "translateY(-6%) scale(1.05)", opacity: 0 }], { duration: 1700 }).textContent = spec.glyph[0]; break;
    case "burst": add("cf-big", { left: px(W / 2), top: px(H * .45) }, [{ transform: "translate(-50%,-50%) scale(.2)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1.15)", opacity: 1, offset: .3 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 0 }], { duration: 1400 }).textContent = spec.glyph[0]; break;
    default: break;
  }
}
/** A staple's moment. `at` is the zone or card it came from (optional). Returns true when the card has one. */
export function staple(name, code, src, at) {
  if (at === undefined && code && code.getBoundingClientRect) { at = code; code = 0; src = ""; }   // old call: staple(name, at)
  const spec = STAPLES[norm(name)];
  if (!spec || reduced()) return !!spec;
  const L = layer(), r = at && at.getBoundingClientRect && at.getBoundingClientRect();
  const from = r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight / 2 };
  overlay(L, spec, from);
  glyphs(L, spec, from);
  play("cutin");
  if (src) cutIn(L, src, name, spec.col);
  else stamp(L, spec.word, spec.sub, spec.col);
  if (src) stamp(L, spec.word, "", spec.col, false, true);
  return true;
}
/** Anime cut-in: a diagonal band slides across with the card's own art and name. */
function cutIn(L, src, name, col) {
  const b = div("cf-cut", { "--c": col });
  const art = div("cf-cut-art"); art.style.backgroundImage = `url("${src}")`;
  const t = div("cf-cut-t", null, name);
  b.append(art, t); L.append(b); later(b, 1700);
  A(b, [{ transform: "translateY(-50%) skewY(-6deg) translateX(-110%)", opacity: 1 }, { transform: "translateY(-50%) skewY(-6deg) translateX(0)", opacity: 1, offset: .18 }, { transform: "translateY(-50%) skewY(-6deg) translateX(3%)", opacity: 1, offset: .78 }, { transform: "translateY(-50%) skewY(-6deg) translateX(110%)", opacity: 0 }], { duration: 1600, easing: "cubic-bezier(.2,.9,.3,1)", fill: "both" });
  A(art, [{ backgroundPosition: "50% 20%" }, { backgroundPosition: "50% 40%" }], { duration: 1600, fill: "both" });
}

// ---------------------------------------------------------------- showdowns (finale before a winning blow, Ace cards)
function speedLines(L, col, ms) {
  const s = div("cf-speed", { "--c": col }); L.append(s); later(s, ms);
  A(s, [{ opacity: 0 }, { opacity: 1, offset: .08 }, { opacity: 1, offset: .9 }, { opacity: 0 }], { duration: ms, fill: "both" });
  return s;
}
function bigCard(L, src, title, cls, ms) {
  const w = div("cf-hero " + cls);
  if (src) { const i = document.createElement("img"); i.src = src; i.alt = ""; w.append(i); }
  w.append(div("cf-hero-t", null, title));
  L.append(w); later(w, ms);
  return w;
}
function sfx(L, txt, n, col, ms) {
  for (let i = 0; i < n; i++) {
    const pos = i % 2 ? { right: rnd(2, 8) + "%" } : { left: rnd(2, 8) + "%" };
    const g = div("cf-sfx", { color: col, ...pos, top: (8 + (i >> 1) * (70 / Math.max(1, Math.ceil(n / 2))) + rnd(0, 6)).toFixed(1) + "%", fontSize: `clamp(24px, ${rnd(6, 8.5).toFixed(1)}vmin, 80px)` }, txt);
    L.append(g); later(g, ms);
    A(g, [{ transform: "scale(.4) rotate(-12deg)", opacity: 0 }, { transform: "scale(1) rotate(-8deg)", opacity: 1, offset: .12 }, { transform: "scale(1.04) rotate(-8deg) translateY(-6px)", opacity: 1, offset: .55 }, { transform: "scale(1) rotate(-8deg)", opacity: 1, offset: .9 }, { transform: "scale(1.1) rotate(-8deg)", opacity: 0 }], { duration: ms - 300, delay: i * 120, fill: "both", easing: "ease-out" });
  }
}
/** Big title text across the screen. */
// keep a big word inside the screen on narrow (portrait) screens: shrink the font, never cut the text
function fitWord(t, L) {
  try { const W = (L.clientWidth || innerWidth) * .94, w = t.scrollWidth; if (w > W) { const fs = parseFloat(getComputedStyle(t).fontSize); t.style.fontSize = Math.max(14, Math.floor(fs * W / w)) + "px"; } } catch {}
}
function word(L, txt, cls, T, at = .3, top = "62%") {
  const t = div("cf-word2 " + (cls || ""), { top }, txt); L.append(t); later(t, T); fitWord(t, L);
  A(t, [{ opacity: 0, transform: "scale(1.6)" }, { opacity: 0, transform: "scale(1.6)", offset: Math.max(0, at - .08) }, { opacity: 1, transform: "scale(1)", offset: at }, { opacity: 1, transform: "scale(1.02)", offset: .88 }, { opacity: 0, transform: "scale(1.08)" }], { duration: T, fill: "both", easing: "cubic-bezier(.2,.9,.3,1)" });
  return t;
}
const heroIn = (h, T, from = "scale(.6)", hold = "scale(1.05)") => A(h, [{ transform: `translate(-50%,-50%) ${from}`, opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: .14 }, { transform: `translate(-50%,-50%) ${hold}`, opacity: 1, offset: .86 }, { transform: "translate(-50%,-50%) scale(1.4)", opacity: 0 }], { duration: T, fill: "both", easing: "cubic-bezier(.2,.9,.3,1)" });
const at = (ms, f) => setTimeout(f, ms);

/** One showdown. kind "finale" (before the winning blow) or "ace" (an Ace card before it resolves). Resolves when done. */
export function show(style, { kind = "finale", src = "", title = "", line = "", owner = "", premiumNote = "", ms = 0 } = {}) {
  return new Promise((done) => {
    if (reduced()) { done(); return; }
    style = SHOWS.includes(style) ? style : "menacing";
    const T = Math.round(Math.min(SHOW_MAX, Math.max(kind === "ace" ? 2400 : SHOW_MIN, ms || (kind === "ace" ? 2800 : 3300))));
    const L = layer(), root = document.body, cls = ["cf-hold", "cf-" + style];
    const veil = div("cf-veil-all " + style); L.append(veil); later(veil, T);
    A(veil, [{ opacity: 0 }, { opacity: 1, offset: .08 }, { opacity: 1, offset: .9 }, { opacity: 0 }], { duration: T, fill: "both" });
    root.classList.add(...cls);
    play("sd_" + style); if (style !== "timestop") vibrate(kind === "ace" ? [40, 50, 120] : [70, 40, 70, 40, 220]);
    const flag = (c, from, to) => { at(from, () => root.classList.add(c)); cls.push(c); if (to) at(to, () => root.classList.remove(c)); };
    let h;
    switch (style) {
      case "menacing":
        speedLines(L, "#f0b429", T); sfx(L, "ゴゴゴゴ", 6, "#c48bff", T);
        h = bigCard(L, src, title, "menacing", T); A(h, [{ transform: "translate(-50%,-50%) scale(.6) rotate(-4deg)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1) rotate(-4deg)", opacity: 1, offset: .15 }, { transform: "translate(-50%,-50%) scale(1.06) rotate(-4deg)", opacity: 1, offset: .85 }, { transform: "translate(-50%,-50%) scale(1.4) rotate(-4deg)", opacity: 0 }], { duration: T, fill: "both" });
        break;
      case "rush": {
        speedLines(L, "#ff5a3a", T);
        h = bigCard(L, src, title, "rush", T); A(h, [{ transform: "translate(-50%,-50%) scale(.7)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: .1 }, { transform: "translate(-52%,-49%) scale(1.02)", offset: .3 }, { transform: "translate(-48%,-51%) scale(1.02)", offset: .5 }, { transform: "translate(-50%,-50%) scale(1.05)", opacity: 1, offset: .88 }, { transform: "translate(-50%,-50%) scale(1.5)", opacity: 0 }], { duration: T, fill: "both" });
        const n = Math.round((T - 700) / 85);
        for (let i = 0; i < n; i++) at(300 + i * 85, () => { const f = div("cf-fist", { left: rnd(10, 90) + "%", top: rnd(12, 88) + "%" }, i % 3 ? "✊" : "💥"); L.append(f); later(f, 520); A(f, [{ transform: "translate(-50%,-50%) scale(.3)", opacity: 1 }, { transform: "translate(-50%,-50%) scale(1.5)", opacity: 0 }], { duration: 480, easing: "ease-out", fill: "both" }); });
        sfx(L, "ドドドド", 4, "#ffcf5a", T);
        const r = div("cf-rushword", null, "RUSH! RUSH! RUSH!"); L.append(r); later(r, T); A(r, [{ transform: "translateX(100%)" }, { transform: "translateX(-100%)" }], { duration: T, easing: "linear" });
        break;
      }
      case "timestop": {
        // A great clock races, slows and locks. At that instant the screen flashes to its negative, the world loses
        // its colour and everything in the air hangs still; only the card keeps its light. Then time resumes.
        const stop = 950, sf = stop / T, resume = .86;
        const dial = div("cf-ts-dial");
        dial.innerHTML = `<svg viewBox="-100 -100 200 200" aria-hidden="true"><circle r="97" class="rim"/><circle r="88" class="rim2"/><circle r="52" class="rim3"/>${Array.from({ length: 60 }, (_, i) => `<line class="${i % 5 ? "tk" : "tk big"}" x1="0" y1="${i % 5 ? -93 : -95}" x2="0" y2="${i % 5 ? -89 : -80}" transform="rotate(${i * 6})"/>`).join("")}${["XII", "III", "VI", "IX"].map((n, i) => `<text class="num" x="${[0, 68, 0, -68][i]}" y="${[-62, 6, 74, 6][i]}" text-anchor="middle">${n}</text>`).join("")}<g class="gear"><path d="M0-40 6-30 16-37 18-25 30-27 27-15 38-11 31-1 39 8 29 13 33 25 21 25 19 37 9 31 0 40-9 31-19 37-21 25-33 25-29 13-39 8-31-1-38-11-27-15-30-27-18-25-16-37-6-30Z"/></g><g class="hand h"><path d="M-3.4 9 0-50 3.4 9Z"/></g><g class="hand m"><path d="M-2.2 12 0-80 2.2 12Z"/></g><g class="hand sec"><path d="M-.8 16 0-86 .8 16Z"/></g><circle r="5.5" class="hub"/></svg>`;
        L.append(dial); later(dial, T);
        A(dial, [{ transform: "translate(-50%,-50%) scale(.25) rotate(-40deg)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1) rotate(0)", opacity: 1, offset: .12 }, { transform: "translate(-50%,-50%) scale(1.03) rotate(0)", opacity: 1, offset: resume }, { transform: "translate(-50%,-50%) scale(1.35) rotate(12deg)", opacity: 0 }], { duration: T, fill: "both", easing: "cubic-bezier(.2,.9,.3,1)" });
        const spin = (sel, turns, after) => dial.querySelector(sel).animate([{ transform: "rotate(0deg)", easing: "cubic-bezier(.05,.6,.15,1)" }, { transform: `rotate(${turns}deg)`, offset: sf }, { transform: `rotate(${turns}deg)`, offset: resume, easing: "cubic-bezier(.6,0,.9,.4)" }, { transform: `rotate(${turns + after}deg)` }], { duration: T, fill: "both" });
        spin(".hand.sec", 2880, 720); spin(".hand.m", 1080, 240); spin(".hand.h", 300, 40); spin(".gear", -540, -120);
        // a digital readout that runs down to zero
        const tm = div("cf-ts-timer", null, "00:09.99"); L.append(tm); later(tm, T);
        A(tm, [{ opacity: 0 }, { opacity: 1, offset: .1 }, { opacity: 1, offset: resume }, { opacity: 0 }], { duration: T, fill: "both" });
        const t0 = performance.now(), tick = setInterval(() => { const left = Math.max(0, stop - (performance.now() - t0)); const v = (left / stop) ** 2 * 9.99; tm.textContent = "00:0" + v.toFixed(2); if (!left) { clearInterval(tick); tm.textContent = "00:00.00"; tm.classList.add("zero"); } }, 33);
        at(T, () => clearInterval(tick));
        // dust and shards in the air: they fly, then hang where they are, then fall away
        for (let i = 0; i < 34; i++) {
          const x0 = rnd(4, 96), y0 = rnd(6, 94), dx = rnd(-22, 22), dy = rnd(-26, 10), r = rnd(-200, 200);
          const sh = div("cf-ts-shard" + (i % 3 ? "" : " big"), { left: x0 + "%", top: y0 + "%" }); L.append(sh); later(sh, T);
          A(sh, [{ transform: "translate(0,0) rotate(0)", opacity: 0 }, { transform: `translate(${dx * .9}vmin, ${dy * .9}vmin) rotate(${r}deg)`, opacity: 1, offset: sf }, { transform: `translate(${dx}vmin, ${dy}vmin) rotate(${r + 4}deg)`, opacity: 1, offset: resume }, { transform: `translate(${dx * 1.4}vmin, ${dy + 40}vmin) rotate(${r * 2}deg)`, opacity: 0 }], { duration: T, fill: "both" });
        }
        // the instant time stops: a ring sweeps out and the picture flips to its negative for a few frames
        const ring = div("cf-ts-ring"); L.append(ring); later(ring, T);
        A(ring, [{ transform: "translate(-50%,-50%) scale(0)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(0)", opacity: 1, offset: sf }, { transform: "translate(-50%,-50%) scale(1)", opacity: 0, offset: Math.min(.8, sf + .28) }, { opacity: 0 }], { duration: T, fill: "both", easing: "cubic-bezier(.1,.7,.2,1)" });
        flag("cf-inv", stop, stop + 120); flag("cf-frozen", stop + 120, T * resume);
        at(stop, () => vibrate([30, 40, 160]));
        at(T * resume, () => { play("sd_resume"); const f = div("cf-flash"); L.append(f); later(f, 420); A(f, [{ opacity: .7 }, { opacity: 0 }], { duration: 400, fill: "both" }); });
        // the card arrives as time locks, with its after-images closing in
        for (const [k, dx] of [["g1", -16], ["g2", 16]]) { const g = bigCard(L, src, "", "timestop ghost " + k, T); A(g, [{ transform: `translate(calc(-50% + ${dx}vmin),-50%) scale(1.08)`, opacity: 0 }, { transform: `translate(calc(-50% + ${dx}vmin),-50%) scale(1.08)`, opacity: 0, offset: Math.max(0, sf - .04) }, { transform: `translate(calc(-50% + ${dx * .5}vmin),-50%) scale(1.04)`, opacity: .5, offset: sf + .03 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 0, offset: sf + .14 }, { opacity: 0 }], { duration: T, fill: "both" }); }
        h = bigCard(L, src, title, "timestop", T);
        A(h, [{ transform: "translate(-50%,-50%) scale(1.5)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1.5)", opacity: 0, offset: Math.max(0, sf - .03) }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: sf + .08 }, { transform: "translate(-50%,-50%) scale(1.03)", opacity: 1, offset: resume }, { transform: "translate(-50%,-50%) scale(1.3)", opacity: 0 }], { duration: T, fill: "both", easing: "cubic-bezier(.2,.9,.3,1)" });
        word(L, "TIME STOP", "timestop", T, sf + .06, "7%");
        break;
      }
      case "freeze": {
        flag("cf-sepia", 600);
        h = bigCard(L, src, title, "freeze", T); A(h, [{ transform: "translate(-50%,-50%) scale(.8)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: .15 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: .9 }, { opacity: 0 }], { duration: T, fill: "both" });
        const a = div("cf-tbc"); a.append(div("cf-tbc-t", null, "TO BE CONTINUED")); L.append(a); later(a, T);
        A(a, [{ transform: "translateX(-120%)" }, { transform: "translateX(-120%)", offset: .25 }, { transform: "translateX(0)", offset: .4 }, { transform: "translateX(0)" }], { duration: T, easing: "cubic-bezier(.2,.9,.3,1)", fill: "both" });
        break;
      }
      case "domain": {
        // the screen is swallowed by a void that opens from the centre; a sigil turns behind the card
        const v = div("cf-void"); L.append(v); later(v, T);
        A(v, [{ clipPath: "circle(0% at 50% 46%)" }, { clipPath: "circle(0% at 50% 46%)", offset: .06 }, { clipPath: "circle(150% at 50% 46%)", offset: .32 }, { clipPath: "circle(150% at 50% 46%)", opacity: 1, offset: .9 }, { clipPath: "circle(150% at 50% 46%)", opacity: 0 }], { duration: T, fill: "both", easing: "cubic-bezier(.6,0,.2,1)" });
        for (const [k, dir] of [["a", 1], ["b", -1], ["c", 1]]) { const s = div("cf-sigil " + k); L.append(s); later(s, T); A(s, [{ transform: "translate(-50%,-50%) scale(.2) rotate(0)", opacity: 0 }, { transform: `translate(-50%,-50%) scale(1) rotate(${dir * 90}deg)`, opacity: 1, offset: .35 }, { transform: `translate(-50%,-50%) scale(1.05) rotate(${dir * 240}deg)`, opacity: 1, offset: .88 }, { transform: `translate(-50%,-50%) scale(1.3) rotate(${dir * 280}deg)`, opacity: 0 }], { duration: T, fill: "both" }); }
        h = bigCard(L, src, title, "domain", T); heroIn(h, T, "scale(.3)");
        word(L, "DOMAIN EXPANSION", "domain", T, .34, "7%");
        break;
      }
      case "allout": {
        // comic panels slam in, red and black, with a cut-out title
        for (let i = 0; i < 5; i++) { const p = div("cf-panel p" + i); if (src) p.style.backgroundImage = `url("${src}")`; L.append(p); later(p, T); A(p, [{ transform: `translateX(${i % 2 ? 130 : -130}%) skewX(-14deg)`, opacity: 0 }, { transform: "translateX(0) skewX(-14deg)", opacity: 1, offset: .08 + i * .05 }, { transform: "translateX(0) skewX(-14deg)", opacity: 1, offset: .86 }, { transform: `translateX(${i % 2 ? -40 : 40}%) skewX(-14deg)`, opacity: 0 }], { duration: T, fill: "both", easing: "cubic-bezier(.2,.9,.3,1)" }); }
        const t = div("cf-cutout"); "ALL-OUT ATTACK".split("").forEach((ch, i) => { const b = document.createElement("b"); b.textContent = ch; b.style.setProperty("--r", `${(i * 37 % 13) - 6}deg`); t.append(b); });
        L.append(t); later(t, T); fitWord(t, L); A(t, [{ transform: "translate(-50%,-50%) scale(2.4) rotate(-8deg)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(2.4) rotate(-8deg)", opacity: 0, offset: .3 }, { transform: "translate(-50%,-50%) scale(1) rotate(-6deg)", opacity: 1, offset: .38 }, { transform: "translate(-50%,-50%) scale(1.04) rotate(-6deg)", opacity: 1, offset: .9 }, { transform: "translate(-50%,-50%) scale(1.2) rotate(-6deg)", opacity: 0 }], { duration: T, fill: "both", easing: "cubic-bezier(.2,.9,.3,1)" });
        flag("cf-redshift", T * .3, T * .9);
        break;
      }
      case "impact": {
        // anime impact frames: the picture flips to black and white for a few frames at each hit
        h = bigCard(L, src, title, "impact", T); heroIn(h, T, "scale(1.6)", "scale(1.03)");
        const hits = [.18, .3, .42, .62];
        for (const k of hits) { flag("cf-inv", T * k, T * k + 90); at(T * k + 140, () => root.classList.add("cf-inv")); at(T * k + 210, () => root.classList.remove("cf-inv")); at(T * k, () => { const c = div("cf-crack", { left: rnd(25, 75) + "%", top: rnd(25, 70) + "%", rotate: rnd(0, 180) + "deg" }); L.append(c); later(c, 700); A(c, [{ transform: "translate(-50%,-50%) scale(.2)", opacity: 1 }, { transform: "translate(-50%,-50%) scale(1.3)", opacity: 0 }], { duration: 650, easing: "ease-out", fill: "both" }); }); }
        speedLines(L, "#ffffff", T);
        word(L, "IMPACT", "impact", T, .64, "5%");
        break;
      }
      case "destiny": {
        // a single card shoots up from the deck in a trail of gold, then the card is revealed
        const c = div("cf-drawcard"); L.append(c); later(c, T);
        A(c, [{ transform: "translate(-50%, 60vh) rotate(0) scale(.6)", opacity: 0 }, { transform: "translate(-50%, 0) rotate(720deg) scale(1)", opacity: 1, offset: .3 }, { transform: "translate(-50%, 0) rotateY(90deg) scale(1.1)", opacity: 1, offset: .38 }, { transform: "translate(-50%, 0) rotateY(90deg) scale(1.1)", opacity: 0, offset: .39 }, { opacity: 0 }], { duration: T, fill: "both", easing: "cubic-bezier(.3,.7,.3,1)" });
        for (let i = 0; i < 26; i++) at(rnd(0, T * .35), () => { const s = div("cf-spark", { left: rnd(40, 60) + "%", top: rnd(30, 90) + "%" }, "✦"); L.append(s); later(s, 900); A(s, [{ transform: "scale(.2)", opacity: 1 }, { transform: `translate(${rnd(-80, 80)}px, ${rnd(-120, -20)}px) scale(1.2)`, opacity: 0 }], { duration: 850, easing: "ease-out", fill: "both" }); });
        at(T * .38, () => { const f = div("cf-flash"); L.append(f); later(f, 500); A(f, [{ opacity: .9 }, { opacity: 0 }], { duration: 480, fill: "both" }); });
        const r = div("cf-rays", { left: "50%", top: "46%", "--c": "#ffe08a" }); L.append(r); later(r, T); A(r, [{ transform: "translate(-50%,-50%) scale(.3)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(.3)", opacity: 0, offset: .37 }, { transform: "translate(-50%,-50%) scale(1.3) rotate(40deg)", opacity: 1, offset: .5 }, { transform: "translate(-50%,-50%) scale(1.5) rotate(90deg)", opacity: 0 }], { duration: T, fill: "both" });
        h = bigCard(L, src, title, "destiny", T); A(h, [{ transform: "translate(-50%,-50%) rotateY(-90deg)", opacity: 0 }, { transform: "translate(-50%,-50%) rotateY(-90deg)", opacity: 0, offset: .38 }, { transform: "translate(-50%,-50%) rotateY(0) scale(1.06)", opacity: 1, offset: .48 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: .88 }, { transform: "translate(-50%,-50%) scale(1.3)", opacity: 0 }], { duration: T, fill: "both", easing: "cubic-bezier(.2,.9,.3,1)" });
        word(L, "DESTINY DRAW", "destiny", T, .5, "7%");
        break;
      }
      case "finalblow": {
        // slow zoom in on the card, focus lines, a white flash, then the K.O.
        const st = div("cf-starburst"); L.append(st); later(st, T); A(st, [{ transform: "translate(-50%,-50%) scale(.2) rotate(0)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1) rotate(20deg)", opacity: 1, offset: .2 }, { transform: "translate(-50%,-50%) scale(1.1) rotate(60deg)", opacity: 1, offset: .7 }, { transform: "translate(-50%,-50%) scale(1.8) rotate(80deg)", opacity: 0 }], { duration: T, fill: "both" });
        speedLines(L, "#9fe2ff", T);
        h = bigCard(L, src, title, "finalblow", T); A(h, [{ transform: "translate(-50%,-50%) scale(.9)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: .1 }, { transform: "translate(-50%,-50%) scale(1.22)", opacity: 1, offset: .62 }, { transform: "translate(-50%,-50%) scale(1.22)", opacity: 1, offset: .9 }, { transform: "translate(-50%,-50%) scale(1.6)", opacity: 0 }], { duration: T, fill: "both", easing: "cubic-bezier(.5,0,.9,.6)" });
        at(T * .62, () => { const f = div("cf-flash"); L.append(f); later(f, 600); A(f, [{ opacity: 1 }, { opacity: 0 }], { duration: 560, fill: "both" }); });
        word(L, "FINAL BLOW", "finalblow", T, .2, "6%");
        word(L, "K.O.!", "ko", T, .64, "calc(46% - .5em)");
        break;
      }
      case "powerup": {
        // a golden aura bursts around the card, the ground shakes and sparks rise
        const au = div("cf-aura"); L.append(au); later(au, T); A(au, [{ transform: "translate(-50%,-50%) scale(.4)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: .2 }, { transform: "translate(-50%,-50%) scale(1.08)", opacity: 1, offset: .5 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: .86 }, { transform: "translate(-50%,-50%) scale(1.5)", opacity: 0 }], { duration: T, fill: "both" });
        h = bigCard(L, src, title, "powerup", T); heroIn(h, T, "scale(.8) translateY(40px)", "scale(1.08)");
        for (let i = 0; i < Math.round(T / 90); i++) at(rnd(200, T - 500), () => { const s = div("cf-ember", { left: rnd(30, 70) + "%" }); L.append(s); later(s, 1100); A(s, [{ transform: "translateY(0) scale(1)", opacity: 1 }, { transform: `translate(${rnd(-30, 30)}px, -${rnd(30, 60)}vh) scale(.3)`, opacity: 0 }], { duration: 1050, easing: "ease-out", fill: "both" }); });
        for (let i = 0; i < 3; i++) at(T * (.25 + i * .18), () => { const b = div("cf-bolt", { left: rnd(25, 75) + "%", "--c": "#ffe066" }); L.append(b); later(b, 500); A(b, [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: .2, offset: .4 }, { opacity: 1, offset: .55 }, { opacity: 0 }], { duration: 480 }); });
        flag("cf-quake", T * .2, T * .75);
        word(L, "POWER UP!", "powerup", T, .3, "7%");
        break;
      }
      case "beam": {
        // energy gathers into a ball, then a beam crosses the whole screen
        const orb = div("cf-orb"); L.append(orb); later(orb, T); A(orb, [{ transform: "translate(-50%,-50%) scale(0)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: .42 }, { transform: "translate(-50%,-50%) scale(1.2)", opacity: 1, offset: .5 }, { transform: "translate(-50%,-50%) scale(.4)", opacity: 0, offset: .6 }, { opacity: 0 }], { duration: T, fill: "both", easing: "ease-in" });
        for (let i = 0; i < 22; i++) at(rnd(100, T * .4), () => { const a = rnd(0, Math.PI * 2), d = rnd(28, 48); const s = div("cf-mote", { left: "50%", top: "46%" }); L.append(s); later(s, 700); A(s, [{ transform: `translate(${Math.cos(a) * d}vmin, ${Math.sin(a) * d}vmin)`, opacity: 0 }, { opacity: 1, offset: .3 }, { transform: "translate(0,0)", opacity: 0 }], { duration: 650, easing: "ease-in", fill: "both" }); });
        const bm = div("cf-beam"); L.append(bm); later(bm, T); A(bm, [{ transform: "translateY(-50%) scaleX(0) scaleY(.2)", opacity: 0 }, { transform: "translateY(-50%) scaleX(0) scaleY(.2)", opacity: 0, offset: .5 }, { transform: "translateY(-50%) scaleX(1) scaleY(1)", opacity: 1, offset: .58 }, { transform: "translateY(-50%) scaleX(1) scaleY(1.15)", opacity: 1, offset: .86 }, { transform: "translateY(-50%) scaleX(1) scaleY(0)", opacity: 0 }], { duration: T, fill: "both" });
        h = bigCard(L, src, title, "beam", T); A(h, [{ transform: "translate(-50%,-50%) scale(.6)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: .14 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1, offset: .48 }, { transform: "translate(-50%,-50%) scale(.7)", opacity: 0, offset: .56 }, { opacity: 0 }], { duration: T, fill: "both" });
        flag("cf-quake", T * .55, T * .85);
        word(L, "FULL POWER", "beam", T, .58, "78%");
        break;
      }
      case "radiant": {
        const r = div("cf-rays", { left: "50%", top: "46%", "--c": "#ffe08a" }); L.append(r); later(r, T); A(r, [{ transform: "translate(-50%,-50%) scale(.3) rotate(0)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1.2) rotate(40deg)", opacity: 1, offset: .3 }, { transform: "translate(-50%,-50%) scale(1.4) rotate(90deg)", opacity: 0 }], { duration: T, fill: "both" });
        speedLines(L, "#ffe08a", T);
        h = bigCard(L, src, title, "radiant", T); heroIn(h, T, "perspective(900px) rotateY(-70deg) scale(.5)");
        break;
      }
      default: { // spotlight
        const sp = div("cf-spot"); L.append(sp); later(sp, T); A(sp, [{ opacity: 0, transform: "translateX(-50%) scaleX(.2)" }, { opacity: 1, transform: "translateX(-50%) scaleX(1)", offset: .2 }, { opacity: 1, offset: .86 }, { opacity: 0 }], { duration: T, fill: "both" });
        speedLines(L, "#8d99ff", T);
        h = bigCard(L, src, title, "spotlight", T);
        A(h, [{ transform: "translate(-50%,-50%) perspective(900px) rotateY(-70deg) scale(.5)", opacity: 0 }, { transform: "translate(-50%,-50%) perspective(900px) rotateY(8deg) scale(1.05)", opacity: 1, offset: .22 }, { transform: "translate(-50%,-50%) perspective(900px) rotateY(0) scale(1)", opacity: 1, offset: .35 }, { transform: "translate(-50%,-50%) perspective(900px) rotateY(0) scale(1.04)", opacity: 1, offset: .86 }, { transform: "translate(-50%,-50%) perspective(900px) rotateY(0) scale(1.35)", opacity: 0 }], { duration: T, fill: "both", easing: "cubic-bezier(.2,.9,.3,1)" });
      }
    }
    if (kind === "ace") {
      if (h) h.classList.add("ace");
      const tag = div("cf-ace-tag", null, "ACE CARD" + (owner ? " · " + owner : "")); L.append(tag); later(tag, T);
      A(tag, [{ opacity: 0, transform: "translate(-50%, -10px)" }, { opacity: 1, transform: "translate(-50%, 0)", offset: .25 }, { opacity: 1, offset: .86 }, { opacity: 0 }], { duration: T, fill: "both" });
    }
    const note = line || premiumNote;
    if (note) { const c = div("cf-line", null, note); L.append(c); later(c, T); A(c, [{ opacity: 0, transform: "translate(-50%, 20px)" }, { opacity: 1, transform: "translate(-50%, 0)", offset: .2 }, { opacity: 1, offset: .88 }, { opacity: 0 }], { duration: T, fill: "both" }); }
    at(T, () => { root.classList.remove(...cls); done(); });
  });
}
/** The finale before a winning blow (3 to 5 s), then the blow plays. */
export const finale = (style, o = {}) => show(style, { ...o, kind: "finale" });
/** An Ace card on the big screen before its effect resolves. */
export const ace = (style, o = {}) => show(style, { ...o, kind: "ace" });
