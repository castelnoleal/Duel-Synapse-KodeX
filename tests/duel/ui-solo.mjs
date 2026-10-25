// Browser smoke test: open the arena with a KodeX deck link, start a solo playtest and play a few actions.
// usage: NODE_PATH=$(npm root -g) node tests/duel/ui-solo.mjs http://localhost:8787 out-dir
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787";
const out = process.argv[3] || ".";
const deck = { n: "Classic Test", m: [[46986414, "Dark Magician", 3], [89631139, "Blue-Eyes White Dragon", 3], [12580477, "Raigeki", 1], [5318639, "Mystical Space Typhoon", 2],
  [83764718, "Monster Reborn", 1], [14558127, "Ash Blossom & Joyous Spring", 3], [44095762, "Mirror Force", 2], [26202165, "Sangan", 2], [53129443, "Dark Hole", 2],
  [70781052, "Summoned Skull", 3], [91152256, "Celtic Guardian", 3], [6368038, "Gaia The Fierce Knight", 3], [40640057, "Kuriboh", 3], [54652250, "Man-Eater Bug", 3],
  [31560081, "Magician of Faith", 2], [72302403, "Swords of Revealing Light", 1], [4206964, "Trap Hole", 2]], e: [[1861629, "Decode Talker", 1], [84013237, "Number 39: Utopia", 1]], s: [] };
const payload = Buffer.from(JSON.stringify(deck)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text()); });
page.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
await page.goto(`${base}/duel/#deck=${payload}`);
await page.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
await page.screenshot({ path: `${out}/lobby.png` });
await page.selectOption("#soloOpp", "passive");
await page.click("#soloStart");
await page.waitForFunction(() => document.querySelectorAll("#myHand .card").length >= 5, null, { timeout: 60000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/table-start.png` });
// Try a Normal Summon from hand if available.
const acts = await page.$$("#myHand .card.act");
console.log("hand cards with actions:", acts.length);
if (acts.length) {
  await acts[0].click();
  await page.waitForSelector("#menu:not([hidden])");
  const items = await page.$$eval("#menu button", (b) => b.map((x) => x.textContent));
  console.log("menu:", items);
  const btn = (await page.$$("#menu button")).find(async () => true);
  await page.click("#menu button");
  await page.waitForTimeout(1200);
  // handle any sheet (position, place, etc.)
  for (let i = 0; i < 5; i++) {
    if (await page.$(".zone.free")) { console.log("place prompt:", await page.evaluate(() => JSON.stringify(window.__duel.packet.prompt))); await page.click(".zone.free"); await page.waitForTimeout(600); }
    else if (await page.isVisible("#sheet")) {
      const title = await page.textContent("#sheetTitle");
      console.log("sheet:", title);
      const tile = await page.$("#sheetBody .card");
      if (tile) await tile.click(); else { const b = await page.$("#sheetActions .btn.primary"); if (b) await b.click(); }
      await page.waitForTimeout(600);
    }
  }
}
await page.screenshot({ path: `${out}/table-after.png` });
const log = await page.$$eval("#log li", (l) => l.map((x) => x.textContent));
console.log("log:", log.slice(-12));
console.log("errors:", errors);
await browser.close();
