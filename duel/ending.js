// The end of a duel, in order, on both players' screens:
//   1. the finishing move breaks the loser's half of the field (finisher.js);
//   2. the loser's profile icon comes forward, cracks with a glowing line and shatters with the field;
//   3. a comeback (the winner was far behind) gets its own screen-wide moment;
//   4. only then the result: the winner's profile, their finishing card and the YOU WIN / YOU LOSE banner.
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const rnd = (a, b) => a + Math.random() * (b - a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function layer() {
  let l = document.getElementById("endFx");
  if (!l) { l = document.createElement("div"); l.id = "endFx"; l.className = "end-fx"; l.setAttribute("aria-hidden", "true"); document.body.append(l); }
  return l;
}
function div(cls, text) { const d = document.createElement("div"); d.className = cls; if (text != null) d.textContent = text; return d; }
const A = (n, k, o) => n.animate(k, o);

/** The loser's icon cracks and shatters. `avatar` is the plate's avatar element; `html` the icon to draw big. */
export async function breakProfile({ avatar, html, name, side }) {
  if (reduced()) return;
  const L = layer();
  const r = avatar && avatar.getBoundingClientRect();
  const from = r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, s: r.width } : { x: innerWidth / 2, y: side === "op" ? innerHeight * .25 : innerHeight * .75, s: 40 };
  const size = Math.round(Math.min(innerWidth, innerHeight) * .34);
  const box = div("ef-pf " + side);
  box.style.cssText = `left:${innerWidth / 2}px;top:${innerHeight * .44}px;width:${size}px;height:${size}px`;
  const face = div("ef-face"); face.innerHTML = html; box.append(face);
  // a glowing crack drawn across the icon
  const svgNS = "http://www.w3.org/2000/svg", svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("class", "ef-crack");
  const pts = [[50, 2]]; let x = 50;
  for (let y = 12; y <= 98; y += 12) { x = Math.max(18, Math.min(82, x + rnd(-16, 16))); pts.push([x, y]); }
  const main = pts.map((p) => p.join(",")).join(" ");
  const br = [];
  for (let i = 2; i < pts.length - 1; i += 2) { const [bx, by] = pts[i], d = i % 4 ? 1 : -1; br.push(`${bx},${by} ${bx + d * rnd(14, 26)},${by + rnd(-8, 10)} ${bx + d * rnd(26, 40)},${by + rnd(4, 16)}`); }
  svg.innerHTML = `<polyline points="${main}"/>` + br.map((b) => `<polyline class="b" points="${b}"/>`).join("");
  box.append(svg);
  const nm = div("ef-name", name || ""); box.append(nm);
  L.append(box);
  const dx = from.x - innerWidth / 2, dy = from.y - innerHeight * .44, k = from.s / size;
  await A(box, [{ transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(${k})`, opacity: .4 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 1 }], { duration: 520, easing: "cubic-bezier(.2,.9,.3,1)", fill: "both" }).finished;
  // shake, then the crack runs and glows
  A(box, [{ transform: "translate(-50%,-50%)" }, { transform: "translate(calc(-50% + 4px),calc(-50% - 3px))" }, { transform: "translate(calc(-50% - 4px),calc(-50% + 3px))" }, { transform: "translate(-50%,-50%)" }], { duration: 120, iterations: 5 });
  box.classList.add("cracking");
  await wait(820);
  // the icon breaks into pieces that fly apart with the field's shards
  const pieces = 14, img = face.querySelector("img"), src = img ? img.currentSrc || img.src : "";
  const rect = box.getBoundingClientRect();
  for (let i = 0; i < pieces; i++) {
    const s = div("ef-shard");
    const a = (i / pieces) * Math.PI * 2, r0 = size * .2, cx = rect.left + rect.width / 2 + Math.cos(a) * r0, cy = rect.top + rect.height / 2 + Math.sin(a) * r0;
    const w = size * rnd(.24, .38);
    s.style.cssText = `left:${cx}px;top:${cy}px;width:${w}px;height:${w}px;background-image:${src ? `url("${src}")` : "none"};background-size:${size}px ${size}px;background-position:${-(cx - rect.left - w / 2)}px ${-(cy - rect.top - w / 2)}px;clip-path:polygon(${[0, 1, 2].map(() => `${rnd(0, 100).toFixed(0)}% ${rnd(0, 100).toFixed(0)}%`).join(",")})`;
    L.append(s);
    const d = rnd(size * .8, size * 1.8);
    A(s, [{ transform: "translate(-50%,-50%) rotate(0)", opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d + 120}px)) rotate(${rnd(-540, 540)}deg) scale(.6)`, opacity: 0 }], { duration: rnd(900, 1300), easing: "cubic-bezier(.2,.6,.4,1)", fill: "both" });
    setTimeout(() => s.remove(), 1400);
  }
  const flash = div("ef-flash"); L.append(flash); A(flash, [{ opacity: .85 }, { opacity: 0 }], { duration: 500, fill: "both" }); setTimeout(() => flash.remove(), 520);
  box.remove();
  await wait(1100);
}

/** Screen-wide moment for a comeback: the colours flip, a gold shockwave and "COMEBACK!" */
export async function comeback() {
  if (reduced()) return;
  const L = layer();
  document.body.classList.add("ef-comeback");
  const wave = div("ef-wave"); L.append(wave);
  A(wave, [{ transform: "translate(-50%,-50%) scale(0)", opacity: 1 }, { transform: "translate(-50%,-50%) scale(1)", opacity: 0 }], { duration: 1200, easing: "cubic-bezier(.2,.7,.3,1)", fill: "both" });
  const rays = div("ef-rays"); L.append(rays);
  A(rays, [{ transform: "translate(-50%,-50%) scale(.3) rotate(0)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1.2) rotate(40deg)", opacity: 1, offset: .35 }, { transform: "translate(-50%,-50%) scale(1.5) rotate(90deg)", opacity: 0 }], { duration: 2200, fill: "both" });
  const t = div("ef-cb", "COMEBACK!"); L.append(t);
  A(t, [{ transform: "translate(-50%,-50%) scale(2.6) rotate(-10deg)", opacity: 0 }, { transform: "translate(-50%,-50%) scale(1) rotate(-6deg)", opacity: 1, offset: .2 }, { transform: "translate(-50%,-50%) scale(1.04) rotate(-6deg)", opacity: 1, offset: .82 }, { transform: "translate(-50%,-50%) scale(1.2) rotate(-6deg)", opacity: 0 }], { duration: 2200, easing: "cubic-bezier(.2,.9,.3,1)", fill: "both" });
  for (let i = 0; i < 30; i++) {
    const s = div("ef-star", "✦"); s.style.left = rnd(5, 95) + "%"; s.style.top = rnd(10, 90) + "%"; L.append(s);
    A(s, [{ transform: "scale(0) rotate(0)", opacity: 0 }, { transform: "scale(1.4) rotate(90deg)", opacity: 1, offset: .3 }, { transform: "scale(0) rotate(180deg)", opacity: 0 }], { duration: rnd(800, 1500), delay: rnd(0, 900), fill: "both" });
    setTimeout(() => s.remove(), 2600);
  }
  await wait(2200);
  document.body.classList.remove("ef-comeback");
  wave.remove(); rays.remove(); t.remove();
}
