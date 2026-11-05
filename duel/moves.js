// Grand entrances (summons) and attacks. Everyone gets the default of each; KodeX Premium players pick other styles,
// as their default or for chosen cards, and their choice shows on every screen in the duel.
// Only transforms and opacity are animated, so it stays smooth on phones.
export const ENTRANCES = ["rise", "portal", "storm", "inferno", "nova", "glitch"];
export const ATTACKS = ["lunge", "beam", "comet", "claw", "phantom"];
const rnd = (a, b) => a + Math.random() * (b - a);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const px = (n) => Math.round(n) + "px";

function layer() {
  let l = document.getElementById("moveFx");
  if (!l) { l = document.createElement("div"); l.id = "moveFx"; l.className = "move-fx"; l.setAttribute("aria-hidden", "true"); document.body.append(l); }
  return l;
}
function div(cls, css) { const d = document.createElement("div"); d.className = cls; if (css) Object.assign(d.style, css); return d; }
function later(node, ms) { setTimeout(() => node.remove(), ms); }
function bolt(x, y0, y1, w = 22) {
  const n = 7, pts = [];
  for (let i = 0; i <= n; i++) pts.push(`${(x + (i && i < n ? rnd(-w, w) : 0)).toFixed(1)},${(y0 + (y1 - y0) * i / n).toFixed(1)}`);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "mv-svg"); svg.setAttribute("width", innerWidth); svg.setAttribute("height", innerHeight);
  svg.innerHTML = `<polyline points="${pts.join(" ")}" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><polyline points="${pts.join(" ")}" fill="none" stroke="#8fc8ff" stroke-width="11" stroke-opacity=".35" stroke-linejoin="round"/>`;
  return svg;
}

/** A summon's entrance on `zone` (the zone element holding the new card). `big` makes it grander (boss monsters). */
export function entrance(style, zone, { big = false } = {}) {
  if (!zone || reduced()) return;
  style = ENTRANCES.includes(style) ? style : "rise";
  const card = zone.querySelector(".card"), r = zone.getBoundingClientRect();
  if (!r.width) return;
  const L = layer(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, k = big ? 1.35 : 1;
  const ring = div("mv-ring " + style, { left: px(cx), top: px(cy), width: px(r.width * 1.9 * k), height: px(r.width * 1.9 * k) });
  L.append(ring); later(ring, 1200);
  ring.animate([{ transform: "translate(-50%,-50%) scale(.2)", opacity: 1 }, { transform: "translate(-50%,-50%) scale(1.25)", opacity: 0 }], { duration: 800 + (big ? 250 : 0), delay: style === "storm" ? 260 : style === "portal" ? 380 : 120, easing: "cubic-bezier(.2,.8,.3,1)", fill: "both" });
  let cardIn = [{ translate: "0 -46px", scale: "1.55", opacity: 0, filter: "brightness(2.4)" }, { translate: "0 4px", scale: ".96", opacity: 1, offset: .7 }, { translate: "0 0", scale: "1", opacity: 1, filter: "none" }];
  let delay = 0, dur = 620;
  if (style === "rise") {
    const col = div("mv-pillar", { left: px(cx), top: px(r.top - innerHeight * .6), width: px(r.width * .9 * k), height: px(innerHeight * .6 + r.height) });
    L.append(col); later(col, 1000);
    col.animate([{ transform: "translateX(-50%) scaleX(.1)", opacity: 0 }, { transform: "translateX(-50%) scaleX(1)", opacity: .9, offset: .3 }, { transform: "translateX(-50%) scaleX(.2)", opacity: 0 }], { duration: 900, easing: "ease-out", fill: "both" });
  } else if (style === "portal") {
    const p = div("mv-portal", { left: px(cx), top: px(cy), width: px(r.width * 1.6 * k), height: px(r.width * 1.6 * k) });
    L.append(p); later(p, 1500);
    p.animate([{ transform: "translate(-50%,-50%) scale(0) rotate(0)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1) rotate(360deg)", opacity: 1, offset: .35 }, { transform: "translate(-50%,-50%) scale(1.1) rotate(720deg)", opacity: 1, offset: .7 }, { transform: "translate(-50%,-50%) scale(0) rotate(1080deg)", opacity: 0 }], { duration: 1400, easing: "ease-in-out", fill: "both" });
    cardIn = [{ scale: "0", rotate: "-200deg", opacity: 0 }, { scale: "1.15", rotate: "10deg", opacity: 1, offset: .75 }, { scale: "1", rotate: "0deg", opacity: 1 }];
    delay = 380; dur = 640;
  } else if (style === "storm") {
    [0, 120, 250].forEach((d, i) => setTimeout(() => {
      const b = bolt(cx + (i - 1) * r.width * .35, Math.max(0, r.top - innerHeight * .5), cy); L.append(b);
      b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: "forwards" }); later(b, 280);
    }, d));
    const fl = div("mv-flash", {}); L.append(fl); later(fl, 600);
    fl.animate([{ opacity: 0 }, { opacity: .55, offset: .1 }, { opacity: 0 }], { duration: 520, delay: 250, fill: "both" });
    cardIn = [{ scale: "1.3", opacity: 0, filter: "brightness(4) saturate(0)" }, { scale: "1", opacity: 1, filter: "brightness(1.6)", offset: .4 }, { scale: "1", opacity: 1, filter: "none" }];
    delay = 260; dur = 520;
  } else if (style === "inferno") {
    for (let i = 0; i < (big ? 22 : 14); i++) {
      const f = div("mv-flame", { left: px(cx + rnd(-r.width * .55, r.width * .55)), top: px(r.bottom - 6) });
      L.append(f); later(f, 1300);
      f.animate([{ transform: "translate(-50%,0) scale(.6)", opacity: 0 }, { transform: `translate(-50%,${px(-r.height * .5)}) scale(1.2)`, opacity: 1, offset: .3 }, { transform: `translate(-50%,${px(-r.height * rnd(1, 1.7))}) scale(.2)`, opacity: 0 }], { duration: rnd(700, 1100), delay: rnd(0, 260), easing: "ease-out", fill: "both" });
    }
    cardIn = [{ translate: "0 40px", scale: ".8", opacity: 0, filter: "brightness(2) sepia(1) saturate(4) hue-rotate(-20deg)" }, { translate: "0 -6px", scale: "1.06", opacity: 1, offset: .6 }, { translate: "0 0", scale: "1", opacity: 1, filter: "none" }];
    delay = 180; dur = 700;
  } else if (style === "nova") {
    const rays = div("mv-rays", { left: px(cx), top: px(cy), width: px(r.width * 3 * k), height: px(r.width * 3 * k) });
    L.append(rays); later(rays, 1400);
    rays.animate([{ transform: "translate(-50%,-50%) scale(.2) rotate(0)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1) rotate(40deg)", opacity: 1, offset: .3 }, { transform: "translate(-50%,-50%) scale(1.3) rotate(90deg)", opacity: 0 }], { duration: 1300, easing: "ease-out", fill: "both" });
    for (let i = 0; i < 16; i++) {
      const s = div("mv-spark", { left: px(cx), top: px(cy) }); L.append(s); later(s, 1100);
      const a = (i / 16) * Math.PI * 2, d = r.width * rnd(1, 1.8) * k;
      s.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1 }, { transform: `translate(${px(Math.cos(a) * d - 3)},${px(Math.sin(a) * d - 3)}) scale(.2)`, opacity: 0 }], { duration: rnd(600, 950), delay: 120, easing: "cubic-bezier(.1,.7,.3,1)", fill: "both" });
    }
    cardIn = [{ scale: ".3", opacity: 0, filter: "brightness(3)" }, { scale: "1.12", opacity: 1, offset: .55 }, { scale: "1", opacity: 1, filter: "none" }];
    delay = 100; dur = 600;
  } else if (style === "glitch") {
    for (let i = 0; i < 6; i++) {
      const sl = div("mv-slice", { left: px(r.left), top: px(r.top + (r.height / 6) * i), width: px(r.width), height: px(r.height / 6 + 1) });
      L.append(sl); later(sl, 900);
      sl.animate([{ transform: `translateX(${px(rnd(-80, 80))})`, opacity: 0 }, { transform: `translateX(${px(rnd(-20, 20))})`, opacity: 1, offset: .4 }, { transform: "none", opacity: 0 }], { duration: 560, delay: i * 30, easing: "steps(6)", fill: "both" });
    }
    cardIn = [{ translate: "-14px 0", opacity: 0, filter: "hue-rotate(90deg) contrast(2)" }, { translate: "10px 0", opacity: 1, offset: .3 }, { translate: "-4px 0", filter: "hue-rotate(-60deg)", offset: .6 }, { translate: "0 0", opacity: 1, filter: "none" }];
    delay = 150; dur = 560;
  }
  if (card) card.animate(cardIn, { duration: dur * (big ? 1.2 : 1), delay, easing: "cubic-bezier(.2,.9,.25,1)", fill: "backwards" });
  if (big) {
    const t = div("mv-shock", { left: px(cx), top: px(cy) }); L.append(t); later(t, 1400);
    t.animate([{ transform: "translate(-50%,-50%) scale(.1)", opacity: .9 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 0 }], { duration: 1000, delay: delay + dur * .6, easing: "ease-out", fill: "both" });
  }
}

/** An attack from the `from` card to the `to` card (or, for a direct attack, to the defending player's box).
 *  The target is always marked first (a red lock-on with "TARGET"), so it's clear what is being attacked. */
export function attack(style, from, to, { direct = false } = {}) {
  if (!from || !to || reduced()) return;
  style = ATTACKS.includes(style) ? style : "lunge";
  const L = layer(), a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2, bx = b.left + b.width / 2, by = b.top + b.height / 2;
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
  // 1. lock-on: reticle and label on the target, a dashed line from the attacker
  const lock = div("mv-lock" + (direct ? " direct" : ""), { left: px(b.left - 6), top: px(b.top - 6), width: px(b.width + 12), height: px(b.height + 12) });
  lock.append(div("mv-lock-tag")); lock.firstChild.textContent = direct ? "DIRECT ATTACK" : "TARGET";
  L.append(lock); later(lock, 1500);
  lock.animate([{ transform: "scale(1.6) rotate(45deg)", opacity: 0 }, { transform: "scale(1) rotate(0)", opacity: 1, offset: .25 }, { opacity: 1, offset: .85 }, { opacity: 0 }], { duration: 1450, easing: "ease-out", fill: "both" });
  const line = div("mv-line " + style, { left: px(ax), top: px(ay), width: px(len), transform: `rotate(${ang}deg)` });
  L.append(line); later(line, 900);
  line.animate([{ clipPath: "inset(0 100% 0 0)", opacity: 1 }, { clipPath: "inset(0 0 0 0)", opacity: 1, offset: .35 }, { clipPath: "inset(0 0 0 100%)", opacity: .2 }], { duration: 800, easing: "ease-out", fill: "both" });
  const hit = 380;
  // 2. the attack itself
  if (style === "lunge" || style === "comet" || style === "phantom") {
    from.animate([{ translate: "0 0", scale: "1", zIndex: 5 }, { translate: `${px(-dx * .08)} ${px(-dy * .08)}`, scale: "1.08", zIndex: 5, offset: .25 }, { translate: `${px(dx * .82)} ${px(dy * .82)}`, scale: "1.12", zIndex: 5, offset: .55 }, { translate: "0 0", scale: "1", zIndex: 5 }], { duration: 820, delay: 120, easing: "cubic-bezier(.5,0,.3,1)" });
    if (style === "comet") {
      const tail = div("mv-comet", { left: px(ax), top: px(ay), width: px(len), transform: `rotate(${ang}deg)` }); L.append(tail); later(tail, 900);
      tail.animate([{ clipPath: "inset(0 100% 0 0)", opacity: 0 }, { clipPath: "inset(0 100% 0 0)", opacity: 1, offset: .3 }, { clipPath: "inset(0 10% 0 0)", opacity: 1, offset: .6 }, { clipPath: "inset(0 0 0 100%)", opacity: 0 }], { duration: 820, delay: 120, fill: "both" });
    }
    if (style === "phantom") for (let i = 1; i <= 3; i++) {
      const g = from.cloneNode(true); g.className = "card mv-ghost"; Object.assign(g.style, { left: px(a.left), top: px(a.top), width: px(a.width), height: px(a.height) });
      L.append(g); later(g, 1100);
      g.animate([{ transform: "none", opacity: 0 }, { transform: `translate(${px(dx * .82)},${px(dy * .82)})`, opacity: .5 - i * .12, offset: .55 }, { transform: `translate(${px(dx * .82)},${px(dy * .82)})`, opacity: 0 }], { duration: 820, delay: 120 + i * 45, easing: "cubic-bezier(.5,0,.3,1)", fill: "both" });
    }
  } else if (style === "beam") {
    from.animate([{ filter: "brightness(1)" }, { filter: "brightness(2.2)", offset: .3 }, { filter: "brightness(1)" }], { duration: 700 });
    const beam = div("mv-beam", { left: px(ax), top: px(ay), width: px(len), transform: `rotate(${ang}deg)` }); L.append(beam); later(beam, 900);
    beam.animate([{ transform: `rotate(${ang}deg) scaleY(0)`, opacity: 0 }, { transform: `rotate(${ang}deg) scaleY(1)`, opacity: 1, offset: .2 }, { transform: `rotate(${ang}deg) scaleY(1.3)`, opacity: 1, offset: .6 }, { transform: `rotate(${ang}deg) scaleY(0)`, opacity: 0 }], { duration: 760, delay: 200, fill: "both" });
  } else if (style === "claw") {
    from.animate([{ translate: "0 0", scale: "1" }, { translate: `${px(dx * .12)} ${px(dy * .12)}`, scale: "1.1", offset: .4 }, { translate: "0 0", scale: "1" }], { duration: 600, delay: 100 });
    [-1, 0, 1].forEach((k, i) => {
      const c = div("mv-claw", { left: px(bx + k * b.width * .22), top: px(by), height: px(b.height * 1.3) }); L.append(c); later(c, 1000);
      c.animate([{ transform: "translate(-50%,-50%) rotate(28deg) scaleY(0)", opacity: 1 }, { transform: "translate(-50%,-50%) rotate(28deg) scaleY(1)", opacity: 1, offset: .35 }, { transform: "translate(-50%,-50%) rotate(28deg) scaleY(1)", opacity: 0 }], { duration: 560, delay: hit + i * 70, easing: "cubic-bezier(.2,.9,.2,1)", fill: "both" });
    });
  }
  // 3. impact on the target
  const at = style === "beam" ? hit + 60 : hit + 160;
  setTimeout(() => {
    const burst = div("mv-impact " + style, { left: px(bx), top: px(by), width: px(b.width * 1.8), height: px(b.width * 1.8) }); L.append(burst); later(burst, 800);
    burst.animate([{ transform: "translate(-50%,-50%) scale(.2)", opacity: 1 }, { transform: "translate(-50%,-50%) scale(1.3)", opacity: 0 }], { duration: 560, easing: "ease-out", fill: "both" });
    to.animate([{ translate: "0 0" }, { translate: `${px(dx / len * 10)} ${px(dy / len * 10)}`, filter: "brightness(2.2)", offset: .2 }, { translate: `${px(-dx / len * 4)} ${px(-dy / len * 4)}`, offset: .5 }, { translate: "0 0", filter: "none" }], { duration: 420 });
  }, at);
}
