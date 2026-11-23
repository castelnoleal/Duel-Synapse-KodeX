// Arena v77: a Premium combo opens with its dramatic opening (on screen and as the start of its video); the free
// edition keeps the classic title card. (setup as in v76)
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
const combo = { id: "t76", title: "Solfachord Test", deck: "Solfachord", hand: [CUTIA], extra: [GRAN], fx: "", opening: "thunder",
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
addEventListener("message", (e) => { const d = e.data || {}; if (d.kx === "ready") document.getElementById("f").contentWindow.postMessage({ kx: "skin", premium: window.__prem !== false, showFx: {} }, "*");
  if (d.kx === "comboShown") window.__shown = (window.__shown || 0) + 1;
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


// ----- Premium: the opening plays over the Arena before the first step
await page.evaluate((c) => document.getElementById("f").contentWindow.postMessage({ kx: "combo", combo: c, keep: false }, "*"), combo);
await f.waitForFunction(() => !!document.querySelector(".cbfx-open"), null, { timeout: 30000 }).catch(() => fail("no opening on screen"));
await page.waitForTimeout(2600);
await page.screenshot({ path: `${out}/v77-opening.png` });
ok(!(await f.$("#comboIntro")), "a Premium combo opens with its dramatic opening, not the classic title card");
await f.waitForFunction(() => !document.querySelector(".cbfx-open"), null, { timeout: 12000 }).catch(() => fail("the opening never ended"));
ok(true, "the opening ends and the combo starts");
// recording: the video starts with the same opening, for its whole length
await page.waitForTimeout(800);
await f.evaluate(() => document.querySelector("#rbRec").click()); await page.waitForTimeout(300);
await f.evaluate(() => { document.querySelector("#recUntil").value = "stop"; document.querySelector("#recSize").value = "1080"; document.querySelector("#recGo").click(); });
await f.waitForFunction(() => window.__duel.rec && window.__duel.rec.clip, null, { timeout: 20000 });
const io = await f.evaluate(() => window.__duel.rec.clip.o.intro);
ok(io && io.style === "thunder" && io.ms >= 5200, "the video's opening is the dramatic one " + JSON.stringify({ style: io && io.style, ms: io && io.ms }));
await page.waitForTimeout(2200);
const shot = await f.evaluate(() => window.__duel.rec.clip.cv.toDataURL("image/jpeg", .8));
fs.writeFileSync(`${out}/v77-video-opening.jpg`, Buffer.from(shot.split(",")[1], "base64"));
await f.evaluate(() => document.querySelector("#recStop").click());
await page.waitForFunction(() => window.__videos.some((v) => v.size > 1000), null, { timeout: 40000 }).catch(() => fail("no video"));
ok(true, "the video is saved");
// ----- free edition: the classic title card
await page.evaluate(() => { window.__prem = false; document.getElementById("f").contentWindow.postMessage({ kx: "skin", premium: false, showFx: {} }, "*"); });
await page.waitForTimeout(400);
await page.evaluate((c) => document.getElementById("f").contentWindow.postMessage({ kx: "combo", combo: c, keep: false }, "*"), combo);
await f.waitForFunction(() => !!document.querySelector("#comboIntro"), null, { timeout: 30000, polling: 50 }).catch(async () => fail("no classic title card shown=" + (await page.evaluate(() => window.__shown)) + " " + JSON.stringify(await f.evaluate(() => ({ prem: window.__duel.premium, mode: window.__duel.mode, combo: !!(window.__duel.packet && window.__duel.packet.combo), cover: !!document.querySelector("#comboCover"), dlg: [...document.querySelectorAll("dialog[open]")].map((d) => d.id), open: !!document.querySelector(".cbfx-open") })))));
ok(!(await f.$(".cbfx-open")), "the free edition keeps the classic title card");
ok(!errors.length, "no page errors " + errors.join(" | "));
await browser.close();
console.log("OK: v77");
