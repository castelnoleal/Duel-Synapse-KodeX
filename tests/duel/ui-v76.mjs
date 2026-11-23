// Arena v76: in landscape a tapped card shows on the Card tab (compact, glowing tabs), quick reactions chosen in
// Settings (a chooser that fits landscape; 2 by default; KodeX can set them), Premium combo dramatic effects on screen,
// and a combo video that ends with its credits.
// usage: node tests/duel/ui-v76.mjs http://localhost:8787 [outdir]
import fs from "node:fs";
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787", out = process.argv[3] || ".";
const raw = JSON.parse(fs.readFileSync(new URL("../../duel/data/cards.json", import.meta.url))).cards;
const byName = (n) => { for (const [c, r] of Object.entries(raw)) if (r[12] === n) return Number(c); throw new Error("no card " + n); };
const normals = Object.entries(raw).filter(([c, r]) => !r[0] && (r[2] & 0x11) === 0x11 && !(r[2] & 0x4000)).slice(0, 40).map(([c, r]) => [Number(c), r[12], 1]);
const payload = Buffer.from(JSON.stringify({ n: "v76", m: normals, e: [], s: [] })).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const CUTIA = byName("DoSolfachord Cutia"), HARM = byName("Solfachord Harmonia"), COOLIA = byName("DoSolfachord Coolia"), GRAN = byName("GranSolfachord Coolia");
const combo = { id: "t76", title: "Solfachord Test", deck: "Solfachord", hand: [CUTIA], extra: [GRAN], fx: "lightning",
  credits: { by: "Mei", deck: "Solfachord", handle: "@meiocg", line: "Follow for more", theme: "neon", ms: 3000, custom: true },
  lines: [[{ cards: [{ c: CUTIA, a: "ss" }] }, { cards: [{ c: HARM }] }, { cards: [{ c: COOLIA, a: "ss" }] }]], intro: { ms: 1200, key: GRAN, art: GRAN } };
const browser = await chromium.launch();
const errors = [];
const fail = (m) => { console.error("FAIL:", m, errors); process.exit(1); };
const ok = (c, m) => { if (!c) fail(m); console.log("ok:", m); };
const page = await browser.newPage({ viewport: { width: 860, height: 390 } });
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
await page.route(`${base}/wrap.html`, (r) => r.fulfill({ contentType: "text/html", body: `<!doctype html><body style="margin:0"><iframe id="f" src="${base}/duel/?app=1&embed=1#deck=${payload}" style="border:0;width:100vw;height:100vh"></iframe><script>
window.__videos = [];
addEventListener("message", (e) => { const d = e.data || {}; if (d.kx === "ready") document.getElementById("f").contentWindow.postMessage({ kx: "skin", premium: true, showFx: {} }, "*");
  if (d.kx === "saveVideo") window.__videos.push({ name: d.name, size: d.buf.byteLength, last: d.last }); });
</script></body>` }));
await page.goto(`${base}/wrap.html`);
const f = await (await page.waitForSelector("#f")).contentFrame();
await f.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
await page.waitForTimeout(800);
await f.evaluate(() => { for (const [id, v] of [["#soloOpp", "passive"], ["#soloOppDeck", "same"], ["#soloFirst", "me"]]) { const e = document.querySelector(id); if (e) { e.value = v; e.dispatchEvent(new Event("change")); } } });
await f.click("#soloStart");
await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.prompt && window.__duel.packet.waitingFor === window.__duel.team, null, { timeout: 60000 });
await page.waitForTimeout(2200);
await f.evaluate(() => document.querySelector("#opening")?.click());

// ----- landscape: a tapped card always shows on the Card tab
await f.evaluate(() => { const b = document.querySelector('#info .dock-tabs [data-tab="log"]'); b.click(); });
ok(await f.evaluate(() => document.querySelector('#info .dock-tabs [data-tab="log"]').getAttribute("aria-selected") === "true"), "the Log tab is open");
await f.click("#myHand .card", { force: true });
await page.waitForTimeout(400);
ok(await f.evaluate(() => document.querySelector('#info .dock-tabs [data-tab="card"]').getAttribute("aria-selected") === "true" && !document.querySelector("#infoBody").hidden), "tapping a card goes back to the Card tab");
const sz = await f.evaluate(() => { const fs = (s) => { const e = document.querySelector(s); return e ? parseFloat(getComputedStyle(e).fontSize) : 0; }; const t = document.querySelector('#info .dock-tabs [aria-selected="true"]'); return { name: fs("#infoBody .info-name"), text: fs("#infoBody .info-text"), glow: getComputedStyle(t).boxShadow }; });
ok(sz.name <= 14.5 && sz.text <= 12 && sz.text >= 10.5, "compact card text in landscape " + JSON.stringify(sz));
ok(/rgb/.test(sz.glow), "the open tab glows");
await page.screenshot({ path: `${out}/v76-card.png` });

// ----- quick reactions from Settings (fits landscape)
await f.evaluate(() => document.querySelector('#info .dock-tabs [data-tab="opts"]').click());
await page.waitForTimeout(200);
ok((await f.$$eval("#quickNow .qs-chip", (c) => c.length)) === 2, "Settings shows the 2 default quick reactions");
await f.evaluate(() => document.querySelector("#quickEdit").click());
await page.waitForTimeout(300);
const dr = await f.evaluate(() => { const r = document.querySelector("#quickDlg").getBoundingClientRect(); return { t: r.top, b: r.bottom, H: innerHeight, sc: document.querySelector("#quickAll").scrollHeight > document.querySelector("#quickAll").clientHeight }; });
ok(dr.t >= 0 && dr.b <= dr.H + 1, "the chooser fits a landscape screen " + JSON.stringify(dr));
await f.click('#quickAll [data-qid="fire"]');
await f.fill("#quickPhrase", "Your move"); await f.click("#quickAdd .btn");
const chosen = await f.$$eval("#quickPicked [data-qid]", (b) => b.map((x) => x.dataset.qid));
ok(chosen.join() === "gg,nice,fire,t:Your move", "add an emote and a phrase " + chosen);
await page.screenshot({ path: `${out}/v76-quick.png` });
await f.click('#quickPicked [data-qid="nice"]');
ok((await f.$$eval("#quickNow .qs-chip", (c) => c.length)) === 3, "Settings follows the chooser");
await f.click("#quickDone");
// KodeX's Studio sets them too
await page.evaluate(() => document.getElementById("f").contentWindow.postMessage({ kx: "quick", list: ["hi", "t:GG"], bar: true }, "*"));
await page.waitForTimeout(300);
ok((await f.$$eval("#quickNow .qs-chip", (c) => c.length)) === 2 && (await f.evaluate(() => !document.querySelector("#quickBar").hidden)), "KodeX can set the quick reactions and the buttons");

// ----- a Premium combo: dramatic effects on screen, credits at the end of its video
await page.evaluate((c) => document.getElementById("f").contentWindow.postMessage({ kx: "combo", combo: c, keep: false }, "*"), combo);
await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.combo, null, { timeout: 40000 });
await f.waitForFunction(() => !!document.querySelector(".cbfx-layer"), null, { timeout: 20000 }).catch(() => fail("no dramatic effect on screen"));
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}/v76-fx.png` });
ok(true, "a dramatic effect plays on a summon");
await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.combo && window.__duel.packet.combo.last, null, { timeout: 40000 });
await f.waitForFunction(() => !!document.querySelector(".cbfx-layer"), null, { timeout: 6000 }).catch(() => fail("no finale"));
ok(true, "COMBO COMPLETE at the end");
// record it: the video ends with the credits
await page.waitForTimeout(2500);
await f.evaluate(() => document.querySelector("#rbRec").click()); await page.waitForTimeout(300);
await f.evaluate(() => { document.querySelector("#recUntil").value = "end"; document.querySelector("#recSize").value = "1080"; document.querySelector("#recGo").click(); });
await f.waitForFunction(() => window.__duel.rec && window.__duel.rec.outro, null, { timeout: 60000 }).catch(() => fail("the credits never started"));
await page.waitForTimeout(1600);
const shot = await f.evaluate(() => window.__duel.rec && window.__duel.rec.clip.cv.toDataURL("image/jpeg", .8));
if (shot) fs.writeFileSync(`${out}/v76-credits.jpg`, Buffer.from(shot.split(",")[1], "base64"));
ok(await f.evaluate(() => !!window.__duel.rec), "still recording while the credits play");
await page.waitForFunction(() => window.__videos.some((v) => v.size > 1000), null, { timeout: 30000 }).catch(() => fail("no video"));
ok(true, "the video is saved after the credits " + JSON.stringify(await page.evaluate(() => window.__videos)));
ok(!errors.length, "no page errors " + errors.join(" | "));
await browser.close();
console.log("OK: v76");
