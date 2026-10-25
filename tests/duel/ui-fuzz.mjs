// UI fuzz test: plays through the real interface with random clicks against the random bot,
// using random decks, to exercise every prompt type in the browser.
// usage: node tests/duel/ui-fuzz.mjs http://localhost:8787 <steps> <seed> [outdir]
import fs from "node:fs";
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787";
const STEPS = Number(process.argv[3] || 400);
let seed = Number(process.argv[4] || 7);
const out = process.argv[5] || ".";
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const cards = JSON.parse(fs.readFileSync(new URL("../../duel/data/cards.json", import.meta.url))).cards;
const scripts = JSON.parse(fs.readFileSync(new URL("../../duel/data/scripts.json", import.meta.url)));
const has = new Set([...scripts.official]);
const pool = Object.entries(cards).filter(([c, r]) => has.has(Number(c)) && !r[0] && !(r[2] & 0x4000)).map(([c, r]) => [Number(c), r]);
const EXTRA = 0x40 | 0x2000 | 0x800000 | 0x4000000;
const main = [], extra = [];
while (main.length < 40) { const [c, r] = pool[Math.floor(rnd() * pool.length)]; if (r[2] & EXTRA) { if (extra.length < 15) extra.push([c, r[12], 1]); } else main.push([c, r[12], 1]); }
const payload = Buffer.from(JSON.stringify({ n: "Fuzz", m: main, e: extra, s: [] })).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
await page.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
const errors = [];
page.setDefaultTimeout(4000);
page.on("pageerror", (e) => errors.push("pageerror: " + e));
page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text()); });
await page.goto(`${base}/duel/#deck=${payload}`);
await page.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
await page.selectOption("#soloOpp", "random");
await page.selectOption("#soloOppDeck", "same");
await page.click("#soloStart");
await page.waitForFunction(() => window.__duel.packet && window.__duel.packet.state, null, { timeout: 60000 });
const seen = new Map();
let stuck = 0, lastSeq = -1;
const t0 = Date.now();
for (let step = 0; step < STEPS; step++) {
  if (step % 100 === 0) console.log(`step ${step} at ${Math.round((Date.now() - t0) / 1000)}s`);
  const st = await page.evaluate(() => { const p = window.__duel.packet; return p ? { seq: p.seq, ended: !!p.ended, turn: p.turn, mine: p.waitingFor === window.__duel.team, type: p.prompt ? p.prompt.msg.type : 0 } : null; });
  if (!st) { await page.waitForTimeout(200); continue; }
  if (st.ended) { console.log("duel ended at turn", st.turn); break; }
  if (st.seq === lastSeq) { stuck++; } else { stuck = 0; lastSeq = st.seq; }
  if (stuck > 25) { console.log("STUCK on prompt type", st.type); await page.screenshot({ path: `${out}/fuzz-stuck.png` }); break; }
  if (!st.mine) { await page.waitForTimeout(150); continue; }
  seen.set(st.type, (seen.get(st.type) || 0) + 1);
  try {
    if (await page.isVisible("#pile")) { const b = await page.$("#pileBody .btn"); if (b && rnd() < 0.5) await b.click(); else await page.click("#pileClose"); }
    else if (await page.$(".zone.free")) { const zs = await page.$$(".zone.free"); await zs[Math.floor(rnd() * zs.length)].click(); }
    else if (await page.isVisible("#sheet")) {
      const tiles = await page.$$("#sheetBody .card:not(.selected), #sheetBody .choice-list .btn, #sheetBody .chips button[aria-pressed=false], #sheetBody .chips button:not([aria-pressed]), #sheetBody .announce-list button, #sheetBody .counter-row button:last-child");
      const prim = await page.$("#sheetActions .btn.primary:not([disabled])");
      const r = rnd();
      if (prim && (r < 0.35 || !tiles.length)) await prim.click();
      else if (tiles.length) await tiles[Math.floor(rnd() * tiles.length)].click({ force: true });
      else { const any = await page.$("#sheetActions .btn:not([disabled])"); if (any) await any.click(); }
    } else {
      const acts = await page.$$(".card.act");
      const go = await page.$$("#phases button.go");
      if (acts.length && rnd() < 0.75) {
        await acts[Math.floor(rnd() * acts.length)].click({ force: true });
        if (await page.isVisible("#menu")) { const items = await page.$$("#menu button"); await items[Math.floor(rnd() * items.length)].click(); }
        else if (await page.isVisible("#pile")) { const b = await page.$("#pileBody .btn"); if (b) await b.click(); else await page.click("#pileClose"); }
      } else if (go.length) await go[go.length - 1].click();
    }
  } catch (e) { console.log('step error:', String(e).split('\n')[0].slice(0, 160)); }
  await page.waitForTimeout(120);
}
await page.screenshot({ path: `${out}/fuzz-end.png` });
const turn = await page.evaluate(() => window.__duel.packet && window.__duel.packet.turn);
console.log("turn reached:", turn, "prompts seen:", Object.fromEntries(seen));
console.log("errors:", errors.slice(0, 20));
await browser.close();
process.exit(errors.length ? 1 : 0);
