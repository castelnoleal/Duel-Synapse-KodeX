// KodeX Premium showdowns in a real duel, with the Arena framed the way the KodeX app frames it:
//  • an Ace card (a Spell here: any card type can be one) gets its showdown before it resolves;
//  • a winning blow from a Spell (burn) gets the winning-blow showdown, at the length the player chose, before the
//    damage shows and the duel ends.
// usage: node tests/duel/ui-showdowns.mjs http://localhost:8787 [outdir]
import fs from "node:fs";
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787", out = process.argv[3] || ".";
const POT = 55144522, HINOTAMA = 46130346;
const cards = JSON.parse(fs.readFileSync(new URL("../../duel/data/cards.json", import.meta.url))).cards;
const normals = Object.entries(cards).filter(([c, r]) => !r[0] && (r[2] & 0x11) === 0x11 && !(r[2] & 0x4000)).slice(0, 34).map(([c, r]) => [Number(c), r[12], 1]);
const deck = { n: "Showdowns", m: [[POT, "Pot of Greed", 3], [HINOTAMA, "Hinotama", 3], ...normals], e: [], s: [] };
const payload = Buffer.from(JSON.stringify(deck)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
await page.route(`${base}/wrap.html`, (r) => r.fulfill({ contentType: "text/html", body: `<!doctype html><body style="margin:0"><iframe id="f" src="${base}/duel/?app=1&embed=1#deck=${payload}" style="border:0;width:100vw;height:100vh"></iframe><script>
addEventListener("message", (e) => { if (e.data && e.data.kx === "ready") document.getElementById("f").contentWindow.postMessage({ kx: "skin", premium: true, signature: [${POT}], aces: [${POT}], aceStyle: "destiny", finale: "domain", finaleMs: 4000, showFx: {} }, "*"); });
</script></body>` }));
await page.goto(`${base}/wrap.html`);
const f = await (await page.waitForSelector("#f")).contentFrame();
await f.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
await page.waitForTimeout(800);
await f.evaluate(([a, b]) => { window.__duel.testHand.add(a); window.__duel.testHand.add(b); }, [POT, HINOTAMA]);
await f.evaluate(() => { const l = document.querySelector("#optLP"); l.value = "500"; l.dispatchEvent(new Event("change")); });
await f.evaluate(() => { for (const [id, v] of [["#soloOpp", "passive"], ["#soloOppDeck", "same"], ["#soloFirst", "me"]]) { const e = document.querySelector(id); e.value = v; e.dispatchEvent(new Event("change")); } });
await f.click("#soloStart");
await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.prompt && window.__duel.packet.waitingFor === window.__duel.team, null, { timeout: 60000 });
await page.waitForTimeout(1500);
const fail = (m) => { console.error("FAIL:", m, errors); process.exit(1); };
async function activate(code) {
  const idx = await f.evaluate((code) => window.__duel.packet.state.teams[window.__duel.team].hand.findIndex((h) => Number(h.code) === code), code);
  if (idx < 0) fail("card not in hand: " + code);
  await f.click(`#myHand .card:nth-child(${idx + 1})`, { force: true });
  await page.waitForTimeout(300);
  const items = await f.$$("#menu button");
  let hit = false;
  for (const b of items) { const t = await b.textContent(); if (/^Activate/.test(t)) { await b.click(); hit = true; break; } }
  if (!hit) fail("no Activate in the menu for " + code);
  // a Spell from the hand: pick a zone for it
  await page.waitForTimeout(400);
  const z = await f.$(".zone.free");
  if (z) { await z.click({ force: true }); await page.waitForTimeout(200); const go = await f.$("#sheetActions .btn.primary:not([disabled])"); if (go && await go.isVisible()) await go.click(); }
}
// 1) Ace card (a Spell): its showdown plays before it resolves
await activate(POT);
const ace = await f.waitForFunction(() => { const t = document.querySelector(".cf-ace-tag"), h = document.querySelector(".cf-hero.ace"); return t && h ? { tag: t.textContent, cls: h.className, veil: (document.querySelector(".cf-veil-all") || {}).className } : null; }, null, { timeout: 8000 }).then((h) => h.jsonValue()).catch(() => null);
if (!ace) { console.log(await f.evaluate(() => [...document.querySelectorAll("#log li")].slice(0, 8).map((l) => l.textContent))); fail("no Ace showdown for the Ace Spell"); }
console.log("Ace showdown:", ace);
if (!/destiny/.test(ace.cls)) fail("Ace showdown style was not the chosen one (destiny)");
await page.screenshot({ path: `${out}/showdown-ace.png` });
const capText = await f.evaluate(() => (document.querySelector("#chainFx .chain-cap") || {}).textContent || "");
await f.waitForFunction(() => !document.querySelector(".cf-ace-tag") && window.__duel.packet.waitingFor === window.__duel.team && window.__duel.packet.prompt && window.__duel.packet.prompt.msg.type === 11, null, { timeout: 20000 }).catch(() => fail("the duel did not continue after the Ace showdown"));
console.log("chain caption:", JSON.stringify(capText));
// 2) a Spell deals the winning damage: the winning-blow showdown first (4 s), then the damage and the result
const t0 = Date.now();
await activate(HINOTAMA);
const fin = await f.waitForFunction(() => { const v = document.querySelector(".cf-veil-all.domain"); return v ? { lp: window.__duel.packet.state.teams.map((t) => t.lp), ended: !!window.__duel.packet.ended, line: (document.querySelector(".cf-line") || {}).textContent } : null; }, null, { timeout: 10000 }).then((h) => h.jsonValue()).catch(() => null);
if (!fin) fail("no winning-blow showdown for the burn Spell");
console.log("winning-blow showdown:", fin);
if (fin.ended) fail("the duel ended on screen before the showdown");
await page.screenshot({ path: `${out}/showdown-burn.png` });
await f.waitForFunction(() => window.__duel.packet.ended, null, { timeout: 20000 }).catch(() => fail("the duel did not end"));
const took = Date.now() - t0;
console.log("result after", took, "ms:", await f.evaluate(() => window.__duel.packet.ended));
if (took < 3800) fail("the result came before the 4 s showdown finished");
if (errors.length) fail("page errors");
await browser.close();
console.log("OK: Ace showdown for a Spell, and the winning-blow showdown for a burn Spell at the chosen length");
