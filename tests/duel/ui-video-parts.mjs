// Recording a replay inside KodeX: the clip reaches KodeX ({kx:"saveVideo"}), and a long clip comes as several complete
// video files (the phone app hands each file to Android in one piece, which has a size limit). Here the limit is made
// tiny so a short recording has to be split; every part must be a playable file of its own.
// usage: node tests/duel/ui-video-parts.mjs http://localhost:8787 <file.yrpX> [outdir]
import fs from "node:fs";
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787", file = process.argv[3], out = process.argv[4] || ".";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
await page.route(`${base}/wrap.html`, (r) => r.fulfill({ contentType: "text/html", body: `<!doctype html><body style="margin:0"><iframe id="f" src="${base}/duel/?app=1&embed=1" style="border:0;width:100vw;height:100vh"></iframe><script>
window.__videos=[];addEventListener("message", (e) => { if (e.data && e.data.kx === "ready") document.getElementById("f").contentWindow.postMessage({ kx: "skin", premium: true, showFx: {} }, "*");
if (e.data && e.data.kx === "saveVideo") { const u = new Uint8Array(e.data.buf); window.__videos.push({ name: e.data.name, mime: e.data.mime, size: u.length, part: e.data.part, last: e.data.last, head: Array.from(u.slice(0, 12)) }); } });
</script></body>` }));
await page.goto(`${base}/wrap.html`);
const f = await (await page.waitForSelector("#f")).contentFrame();
const fail = (m) => { console.error("FAIL:", m, errors); process.exit(1); };
const ok = (c, m) => { if (!c) fail(m); console.log("ok:", m); };
await f.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
await page.waitForTimeout(600);
await f.setInputFiles("#replayFile2", file);
await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.state, null, { timeout: 30000 });
await f.evaluate(() => { window.__duel.recMax = 250000; });
await f.click("#rbRec");
ok(await f.evaluate(() => document.querySelector("#recDlg").open), "the record dialog opens");
await f.evaluate(() => { document.querySelector("#recUntil").value = "stop"; document.querySelector("#recSize").value = "1080"; document.querySelector("#recGo").click(); });
await page.waitForTimeout(9000);
await f.evaluate(() => document.querySelector("#recStop").click());
await page.waitForFunction(() => window.__videos.some((v) => v.last), null, { timeout: 20000 }).catch(async () => console.log("no last part", errors, await f.evaluate(() => ({ rec: !!window.__duel.rec, keep: window.__duel.recKeep }))));
await page.waitForTimeout(1500);
// an empty last part (stopped right after a new part began) only marks the end
const vids = (await page.evaluate(() => window.__videos)).sort((a, b) => a.part - b.part).filter((v, i, a) => v.size || i < a.length - 1);
if (vids.length && !vids[vids.length - 1].last && (await page.evaluate(() => window.__videos.some((v) => v.last && !v.size)))) vids[vids.length - 1].last = true;
console.log(vids.map((v) => `${v.name} ${v.size} part ${v.part}${v.last ? " last" : ""}`).join("\n"));
const playable = (v) => (v.head[0] === 0x1a && v.head[1] === 0x45 && v.head[2] === 0xdf && v.head[3] === 0xa3) || String.fromCharCode(...v.head.slice(4, 8)) === "ftyp";
ok(vids.length >= 2, `the clip came as ${vids.length} files`);
ok(vids.every(playable), "every part starts like a complete video file");
ok(vids.every((v, i) => v.part === i + 1) && vids[vids.length - 1].last && vids.slice(0, -1).every((v) => !v.last), "parts are numbered and the last one is marked");
ok(new Set(vids.map((v) => v.name)).size === vids.length && vids.every((v) => /_part\d+\.(webm|mp4)$/.test(v.name)), "each part has its own file name");
ok(vids.every((v) => v.size < 250000 * 1.6), "no part is much larger than the limit");
ok(!errors.length, "no page errors " + errors.join(" | "));
await browser.close();
console.log("OK: video parts");
