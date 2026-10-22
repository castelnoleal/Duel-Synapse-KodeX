// Checks that card art actually renders in the Arena (production only: needs the /img proxy or ygoprodeck).
// usage: node tests/duel/ui-images.mjs https://kodex.meiocg.org [outdir]
import { chromium } from "playwright";
const base = process.argv[2];
const out = process.argv[3] || ".";
const deck = { n: "Art check", m: [[46986414, "Dark Magician", 3], [89631139, "Blue-Eyes White Dragon", 3], [14558127, "Ash Blossom & Joyous Spring", 3]], e: [[84013237, "Number 39: Utopia", 1]], s: [] };
const payload = Buffer.from(JSON.stringify(deck)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${base}/duel/#deck=${payload}`);
await page.waitForSelector(".deck-grid img", { timeout: 30000 });
await page.waitForFunction(() => [...document.querySelectorAll(".deck-grid img")].every((i) => i.complete), null, { timeout: 30000 }).catch(() => {});
const r = await page.$$eval(".deck-grid img", (imgs) => imgs.map((i) => ({ src: i.currentSrc, ok: i.complete && i.naturalWidth > 0 })));
const placeholders = await page.$$eval(".deck-grid .nm", (n) => n.length);
await page.screenshot({ path: `${out}/live-lobby.png` });
await browser.close();
const ok = r.filter((x) => x.ok).length;
console.log(`card images rendered: ${ok}/${r.length + placeholders}`, r.slice(0, 3));
if (ok === 0 || ok < (r.length + placeholders) / 2) { console.error("Card art is not loading."); process.exit(1); }
