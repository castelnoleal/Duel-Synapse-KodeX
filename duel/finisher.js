// Finishing moves: when a duel is won, the loser's half of the field breaks apart and their cards are torn up.
// Styles: shatter (default), meteor, thunder, vortex, slash. KodeX Premium lets players pick the style and give
// signature cards their own; zoneStrike() plays a small version of a style on one zone when such a card arrives.
export const STYLES = ["shatter", "meteor", "thunder", "vortex", "slash"];
const rnd = (a, b) => a + Math.random() * (b - a);
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function layer() {
  let l = document.getElementById("finFx");
  if (!l) { l = document.createElement("div"); l.id = "finFx"; l.className = "fin-fx"; document.body.append(l); }
  return l;
}
function div(cls, css) { const d = document.createElement("div"); d.className = cls; if (css) Object.assign(d.style, css); return d; }
const px = (n) => Math.round(n) + "px";

function bolt(x, y0, y1) {
  const n = 9, pts = [];
  for (let i = 0; i <= n; i++) pts.push(`${(x + (i && i < n ? rnd(-28, 28) : 0)).toFixed(1)},${(y0 + (y1 - y0) * i / n).toFixed(1)}`);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "fin-bolt"); svg.setAttribute("width", innerWidth); svg.setAttribute("height", innerHeight);
  svg.innerHTML = `<polyline points="${pts.join(" ")}" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><polyline points="${pts.join(" ")}" fill="none" stroke="#9fd0ff" stroke-width="14" stroke-opacity=".35" stroke-linejoin="round"/>`;
  return svg;
}

/** The finishing move on `side` ("me" or "op"). Resolves when the show is over (about 2.6 s). */
export function runFinisher({ style = "shatter", side = "op", mat, title = "FINISH!" }) {
  return new Promise((done) => {
    if (!mat || reduced()) { done(); return; }
    style = STYLES.includes(style) ? style : "shatter";
    const L = layer(); L.replaceChildren(); L.className = "fin-fx on " + style;
    const m = mat.getBoundingClientRect();
    const half = side === "op" ? { x: m.left, y: m.top, w: m.width, h: m.height / 2 } : { x: m.left, y: m.top + m.height / 2, w: m.width, h: m.height / 2 };
    const cx = half.x + half.w / 2, cy = half.y + half.h / 2;
    const cards = [...mat.querySelectorAll(`.zone.${side} .card, #${side}-grave .card, #${side}-banished .card, #${side}-extra .card, #${side}-deck .card, #${side === "op" ? "opHand" : "myHand"} .card`)].filter((c) => c.getBoundingClientRect().width > 4);
    const t0 = style === "meteor" ? 650 : style === "thunder" ? 700 : style === "vortex" ? 300 : style === "slash" ? 520 : 380;

    // --- prelude
    if (style === "meteor") {
      const met = div("fin-meteor", { left: px(innerWidth * .95), top: px(-120) });
      L.append(met);
      met.animate([{ transform: "translate(0,0) scale(.6)" }, { transform: `translate(${px(cx - innerWidth * .95)},${px(cy + 120)}) scale(1.3)` }], { duration: t0, easing: "cubic-bezier(.5,0,1,1)", fill: "forwards" });
      setTimeout(() => met.remove(), t0 + 40);
    } else if (style === "thunder") {
      [0, 220, 420].forEach((d, i) => setTimeout(() => {
        const b = bolt(cx + (i - 1) * half.w * .28, 0, cy + rnd(-10, 20)); L.append(b);
        L.animate([{ background: "#e8f4ff88" }, { background: "transparent" }], { duration: 160 });
        b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, fill: "forwards" }); setTimeout(() => b.remove(), 300);
      }, d));
    } else if (style === "vortex") {
      const v = div("fin-vortex", { left: px(cx), top: px(cy) }); L.append(v);
      v.animate([{ transform: "translate(-50%,-50%) scale(0) rotate(0deg)" }, { transform: "translate(-50%,-50%) scale(1) rotate(540deg)", offset: .5 }, { transform: "translate(-50%,-50%) scale(1.2) rotate(1080deg)", opacity: 1, offset: .85 }, { transform: "translate(-50%,-50%) scale(0) rotate(1440deg)", opacity: 0 }], { duration: 2300, easing: "ease-in-out", fill: "forwards" });
    } else if (style === "slash") {
      [[-22, 0], [22, 180]].forEach(([deg, d]) => setTimeout(() => {
        const s = div("fin-slash", { left: px(cx), top: px(cy), transform: `translate(-50%,-50%) rotate(${deg}deg) scaleX(0)` }); L.append(s);
        s.animate([{ transform: `translate(-50%,-50%) rotate(${deg}deg) scaleX(0)`, opacity: 1 }, { transform: `translate(-50%,-50%) rotate(${deg}deg) scaleX(1)`, opacity: 1, offset: .4 }, { transform: `translate(-50%,-50%) rotate(${deg}deg) scaleX(1.1)`, opacity: 0 }], { duration: 700, easing: "cubic-bezier(.2,.9,.2,1)", fill: "forwards" });
      }, d));
    } else {
      const cr = div("fin-crack", { left: px(half.x), top: px(half.y), width: px(half.w), height: px(half.h) }); L.append(cr);
      cr.animate([{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1)" }], { duration: t0, easing: "ease-out", fill: "forwards" });
    }

    // --- impact: flash, shockwave, the half breaks into shards, cards are torn in two
    setTimeout(() => {
      document.body.classList.remove("fin-shake"); void document.body.offsetWidth; document.body.classList.add("fin-shake");
      L.append(div("fin-flash"));
      const ring = div("fin-ring", { left: px(cx), top: px(cy) }); L.append(ring);
      const hole = div("fin-hole " + side, { left: px(half.x), top: px(half.y), width: px(half.w), height: px(half.h) }); L.append(hole);
      // shards of the field
      const cols = 6, rows = 3, sw = half.w / cols, sh = half.h / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const j = () => rnd(-.18, .18);
        const poly = [[j(), j()], [1 + j(), j()], [1 + j(), 1 + j()], [j(), 1 + j()]].map(([a, b]) => `${(a * 100).toFixed(1)}% ${(b * 100).toFixed(1)}%`).join(",");
        const sx = half.x + c * sw, sy = half.y + r * sh;
        const s = div("fin-shard", { left: px(sx), top: px(sy), width: px(sw), height: px(sh), clipPath: `polygon(${poly})` });
        L.append(s);
        const dx = (sx + sw / 2 - cx), dy = (sy + sh / 2 - cy);
        const away = style === "vortex"
          ? [{ transform: "none", opacity: 1 }, { transform: `translate(${px(-dx)},${px(-dy)}) rotate(${rnd(360, 900)}deg) scale(0)`, opacity: 0 }]
          : [{ transform: "none", opacity: 1 }, { transform: `translate(${px(dx * rnd(1.5, 3))},${px(dy * rnd(1.5, 3) + (side === "op" ? -1 : 1) * rnd(40, 160))}) rotate(${rnd(-260, 260)}deg) scale(${rnd(.3, .9)})`, opacity: 0 }];
        s.animate(away, { duration: rnd(1300, 1900), delay: rnd(140, 380), easing: "cubic-bezier(.45,.05,.55,1)", fill: "both" });
      }
      // cards torn in half
      for (const card of cards) {
        const r = card.getBoundingClientRect();
        const img = card.querySelector("img"), src = img && img.src;
        card.style.visibility = "hidden";
        for (const k of [0, 1]) {
          const h = div("fin-half", { left: px(r.left), top: px(r.top), width: px(r.width), height: px(r.height),
            backgroundImage: src ? `url("${src}")` : "", clipPath: k ? "polygon(48% 0,100% 0,100% 100%,52% 100%,46% 78%,55% 55%,45% 32%,54% 12%)" : "polygon(0 0,48% 0,54% 12%,45% 32%,55% 55%,46% 78%,52% 100%,0 100%)" });
          if (!src) h.classList.add("back");
          L.append(h);
          const dir = k ? 1 : -1;
          const fly = style === "vortex"
            ? [{ transform: "none" }, { transform: `translate(${px(cx - r.left - r.width / 2)},${px(cy - r.top - r.height / 2)}) rotate(${dir * rnd(400, 900)}deg) scale(0)`, opacity: 0 }]
            : [{ transform: "none" }, { transform: `translate(${px(dir * rnd(10, 26))},${px(-8)}) rotate(${dir * 8}deg)`, offset: .18 }, { transform: `translate(${px(dir * rnd(60, 220) + (r.left - cx) * .6)},${px(rnd(160, 420))}) rotate(${dir * rnd(90, 320)}deg)`, opacity: 0 }];
          h.animate(fly, { duration: rnd(1100, 1700), delay: rnd(60, 260), easing: "cubic-bezier(.3,.1,.6,1)", fill: "forwards" });
        }
      }
      // embers
      for (let i = 0; i < 46; i++) {
        const e = div("fin-ember", { left: px(cx + rnd(-half.w / 2, half.w / 2)), top: px(cy + rnd(-half.h / 2, half.h / 2)) });
        L.append(e);
        e.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${px(rnd(-160, 160))},${px(rnd(-260, -40))}) scale(0)`, opacity: 0 }], { duration: rnd(700, 1600), easing: "ease-out", fill: "forwards" });
      }
      const t = div("fin-title"); t.textContent = title; L.append(t);
    }, t0);

    setTimeout(() => {
      L.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, fill: "forwards" });
      setTimeout(() => { L.className = "fin-fx"; L.replaceChildren(); L.getAnimations().forEach((a) => a.cancel()); document.body.classList.remove("fin-shake"); done(); }, 360);
    }, t0 + 2100);
  });
}

/** A small version of a style on one zone (KodeX Premium signature cards). */
export function zoneStrike(style, zone) {
  if (!zone || reduced()) return;
  const L = layer(), r = zone.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const box = div("fin-mini " + style, { left: px(cx), top: px(cy) });
  L.append(box);
  if (style === "thunder") { const b = bolt(cx, 0, cy); L.append(b); b.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, fill: "forwards" }); setTimeout(() => b.remove(), 460); }
  if (style === "meteor") {
    const met = div("fin-meteor small", { left: px(cx + 260), top: px(cy - 300) }); L.append(met);
    met.animate([{ transform: "translate(0,0)" }, { transform: "translate(-260px,300px)" }], { duration: 380, easing: "cubic-bezier(.5,0,1,1)", fill: "forwards" });
    setTimeout(() => met.remove(), 420);
  }
  box.animate([{ transform: "translate(-50%,-50%) scale(.2)", opacity: 1 }, { transform: "translate(-50%,-50%) scale(1.6)", opacity: 0 }], { duration: 900, delay: style === "meteor" ? 360 : 0, easing: "ease-out", fill: "forwards" });
  setTimeout(() => box.remove(), 1300);
}
