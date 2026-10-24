// Accuracy of recognising cards by artwork, on real card images turned into simulated phone photos.
// Needs internet (YGOPRODeck card images) and scan/art.json. Run: node tests/scan/art-accuracy.mjs [count]
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";

const COUNT = Number(process.argv[2] || 150);
const art = JSON.parse(await readFile("scan/art.json", "utf8"));
const rows = JSON.parse(await readFile("scan/cards.json", "utf8"));
const hashed = new Set(art.ids);
const pool = rows.filter((r) => hashed.has(r[0]));
const step = Math.max(1, Math.floor(pool.length / COUNT));
const sample = pool.filter((_, i) => i % step === 0).slice(0, COUNT);
const images = [];
for (const r of sample) {
  try {
    const res = await fetch(`https://images.ygoprodeck.com/images/cards/${r[0]}.jpg`, { headers: { "User-Agent": "MEIOCG-KodeX-ScannerTest/1.0" } });
    if (!res.ok) continue;
    images.push({ id: r[0], name: r[1], url: "data:image/jpeg;base64," + Buffer.from(await res.arrayBuffer()).toString("base64") });
  } catch {}
}
console.log(`Testing ${images.length} cards (art index: ${art.count} artworks)`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<html><body></body></html>");
await page.addScriptTag({ content: await readFile("scan/arthash.js", "utf8") });
const result = await page.evaluate(async ({ art, rows, images }) => {
  const index = KodexArt.buildArtIndex(art);
  const owner = new Map();
  for (const [id, , , alts] of rows) { owner.set(id, id); for (const a of alts) owner.set(a, id); }
  const same = (a, b) => (owner.get(a) ?? a) === (owner.get(b) ?? b);
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const load = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
  const out = { correct: 0, wrong: 0, unsure: 0, top5: 0, ms: 0, fails: [], cases: [] };
  for (const im of images) {
    const img = await load(im.url);
    // A phone photo: card slightly tilted, lit unevenly, blurred, noisy, with a glare spot.
    const ph = document.createElement("canvas"); ph.width = 900; ph.height = 1200;
    const x = ph.getContext("2d");
    x.fillStyle = `rgb(${50 + rnd() * 80},${50 + rnd() * 80},${50 + rnd() * 80})`; x.fillRect(0, 0, 900, 1200);
    const cw = 620, chh = cw * 86 / 59, cx = 450 + (rnd() - 0.5) * 30, cy = 600 + (rnd() - 0.5) * 30, rot = (rnd() - 0.5) * 6 * Math.PI / 180;
    x.save(); x.translate(cx, cy); x.rotate(rot);
    x.filter = `blur(${(0.4 + rnd() * 1.2).toFixed(2)}px) brightness(${(0.75 + rnd() * 0.5).toFixed(2)}) contrast(${(0.8 + rnd() * 0.35).toFixed(2)}) saturate(${(0.8 + rnd() * 0.4).toFixed(2)})`;
    x.drawImage(img, -cw / 2, -chh / 2, cw, chh); x.restore(); x.filter = "none";
    const g = x.createRadialGradient(200 + rnd() * 500, 300 + rnd() * 600, 0, 450, 600, 140 + rnd() * 120);
    g.addColorStop(0, `rgba(255,255,255,${(0.15 + rnd() * 0.35).toFixed(2)})`); g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g; x.fillRect(0, 0, 900, 1200);
    const d = x.getImageData(0, 0, 900, 1200), p = d.data;
    for (let i = 0; i < p.length; i += 4) { const n = (rnd() - 0.5) * 18; p[i] += n; p[i + 1] += n; p[i + 2] += n; }
    x.putImageData(d, 0, 0);
    // The scanner's frame never sits exactly on the card: up to ±3% off and ±4% zoom.
    const fw = cw * (0.96 + rnd() * 0.08), fh = fw * 86 / 59, fx = cx - fw / 2 + (rnd() - 0.5) * 0.06 * cw, fy = cy - fh / 2 + (rnd() - 0.5) * 0.06 * chh;
    const card = document.createElement("canvas"); card.width = 590; card.height = 860;
    card.getContext("2d").drawImage(ph, fx, fy, fw, fh, 0, 0, 590, 860);
    const t0 = performance.now();
    const m = KodexArt.nearest(index, KodexArt.queriesFromCard(card), 8);
    out.ms += performance.now() - t0;
    const ok = m[0] && same(m[0].id, im.id), sure = KodexArt.confident(m, same);
    if (m[0]) { const b = m.find((z) => !same(z.id, m[0].id)); out.cases.push([m[0].d, b ? b.d - m[0].d : 64, ok ? 1 : 0]); }
    if (m.slice(0, 5).some((z) => same(z.id, im.id))) out.top5++;
    if (sure && ok) out.correct++; else if (sure) { out.wrong++; out.fails.push(`WRONG ${im.name} -> ${m[0].id} d=${m[0].d}`); } else { out.unsure++; if (out.fails.length < 40) out.fails.push(`unsure ${im.name}: best ${m[0] ? m[0].id + " d=" + m[0].d : "none"}${ok ? " (right card)" : ""}`); }
  }
  out.ms /= Math.max(1, images.length);
  return out;
}, { art, rows, images });
await browser.close();
const n = images.length, pct = (k) => ((100 * k) / Math.max(1, n)).toFixed(1) + "%";
console.log(result.fails.join("\n"));
const line = `Artwork recognition: ${pct(result.correct)} recognised with confidence, ${pct(result.wrong)} confidently wrong, ${pct(result.unsure)} unsure (right card in top 5: ${pct(result.top5)}), ${result.ms.toFixed(0)} ms per photo`;
console.log("\n" + line);
// Which "sure" rule would recognise the most photos without a single wrong card?
const rules = [];
for (const dMax of [8, 10, 12, 14, 16, 18, 20]) for (const gMin of [2, 3, 4, 5, 6, 8]) {
  let ok = 0, bad = 0; for (const [d, g, c] of result.cases) if (d <= dMax && g >= gMin) { if (c) ok++; else bad++; }
  rules.push({ dMax, gMin, ok, bad });
}
const safe = rules.filter((r) => r.bad === 0).sort((a, b) => b.ok - a.ok).slice(0, 4).map((r) => `d<=${r.dMax}&gap>=${r.gMin}: ${pct(r.ok)}`).join(", ");
const right = result.cases.filter((c) => c[2]).map((c) => c[0] + "/" + c[1]).join(" "), wrongTop = result.cases.filter((c) => !c[2]).map((c) => c[0] + "/" + c[1]).join(" ");
console.log(`::notice title=Safest rules (no wrong cards)::${safe}`);
console.log(`::notice title=Distance/gap when top match is right::${right.slice(0, 3000)}`);
console.log(`::notice title=Distance/gap when top match is wrong::${wrongTop || "none"}`);
console.log(`::notice title=Scanner accuracy::${line}`);
if (n < COUNT * 0.8) { console.log("::error::Too few card images downloaded"); process.exit(1); }
if (result.wrong / n > 0.02) { console.log("::error title=Scanner accuracy::Too many confident wrong matches"); process.exit(1); }
if (result.correct / n < 0.85) { console.log("::error title=Scanner accuracy::Too few cards recognised by artwork"); process.exit(1); }
