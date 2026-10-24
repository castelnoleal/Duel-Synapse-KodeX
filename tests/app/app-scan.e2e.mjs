// End-to-end: the card scanner inside the KodeX app (app/Kodex_Mei_Production_v43.html).
// Run from the repository root: node tests/app/app-scan.e2e.mjs (needs playwright and the tesseract CLI).
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP = process.argv[2] || "app/Kodex_Mei_Production_v43.html";
const REPO = process.cwd();
const results = [];
const assert = (ok, msg) => { if (!ok) throw new Error("FAIL: " + msg); results.push("PASS: " + msg); };
const ocr = (png, psm, wl) => new Promise((res) => { const a = ["stdin", "stdout", "--psm", String(psm || 7), "-l", "eng"]; if (wl) a.push("-c", "tessedit_char_whitelist=" + wl); const p = spawn("tesseract", a); let o = ""; p.stdout.on("data", (d) => (o += d)); p.on("close", () => res(o)); p.stdin.end(png); });
const html = await readFile(APP, "utf8");
const server = createServer(async (req, res) => {
  if (req.url === "/__ocr") { let b = ""; for await (const c of req) b += c; const { png, psm, whitelist } = JSON.parse(b); res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" }); return res.end(JSON.stringify({ text: await ocr(Buffer.from(png.split(",")[1], "base64"), psm, whitelist) })); }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html);
});
await new Promise((r) => server.listen(4192, "127.0.0.1", r));

const tmp = await mkdtemp(join(tmpdir(), "kodex-app-"));
const b0 = await chromium.launch();
const r = await b0.newPage({ viewport: { width: 700, height: 900 } });
const ART = (seed) => `<div id="art" style="width:450px;height:450px;position:relative;overflow:hidden;background:hsl(${seed * 47 % 360},55%,45%)">${Array.from({ length: 9 }, (_, i) => `<div style="position:absolute;left:${(seed * 37 + i * 53) % 380}px;top:${(seed * 61 + i * 97) % 380}px;width:${60 + ((seed + i) * 29) % 120}px;height:${60 + ((seed * 3 + i) * 41) % 120}px;border-radius:${(i % 3) * 40}px;background:hsl(${(seed * 47 + i * 70) % 360},70%,${30 + (i * 13) % 50}%)"></div>`).join("")}</div>`;
const artPngs = {};
for (const [id, seed] of [[14558127, 3], [89631139, 11], [84013237, 19]]) { await r.setContent(ART(seed)); artPngs[id] = join(tmp, `art-${id}.png`); await r.locator("#art").screenshot({ path: artPngs[id] }); }
await r.setContent(`<div id="card" style="width:590px;height:860px;background:#c9794a;position:relative;font-family:'DejaVu Serif',serif;border-radius:10px">
 <div style="position:absolute;left:36px;top:34px;width:518px;height:60px;background:#f3eee2;border:3px solid #5a4a2a;display:flex;align-items:center;padding-left:14px;font-weight:700;font-size:37px;white-space:nowrap;overflow:hidden">Ash Blossom &amp; Joyous Spring</div>
 <div style="position:absolute;left:70px;top:156px;width:450px;height:450px;overflow:hidden">${ART(3)}</div>
 <div style="position:absolute;right:62px;top:604px;font-family:'DejaVu Sans',sans-serif;font-size:24px;font-weight:600">MACR-EN036</div>
 <div style="position:absolute;left:36px;top:640px;width:518px;height:160px;background:#f3eee2;border:3px solid #5a4a2a"></div>
 <div style="position:absolute;left:30px;top:813px;font-family:'DejaVu Sans',sans-serif;font-size:24px">14558127</div></div>`);
const cardPng = join(tmp, "ash.png"); await r.locator("#card").screenshot({ path: cardPng });
await r.setContent(`<div id="card" style="width:590px;height:860px;background:#c8a24a;position:relative;font-family:'Noto Sans CJK JP','DejaVu Sans',sans-serif;border-radius:10px">
 <div style="position:absolute;left:36px;top:34px;width:518px;height:60px;background:#f3eee2;border:3px solid #5a4a2a;display:flex;align-items:center;padding-left:14px;font-weight:700;font-size:34px">青眼の白龍</div>
 <div style="position:absolute;left:70px;top:156px;width:450px;height:450px;overflow:hidden">${ART(11)}</div>
 <div style="position:absolute;left:36px;top:640px;width:518px;height:160px;background:#f3eee2;border:3px solid #5a4a2a"></div>
 <div style="position:absolute;left:0;top:780px;width:300px;height:80px;background:radial-gradient(#fff,#fff0 70%)"></div></div>`);
const jpPng = join(tmp, "blue-eyes-jp.png"); await r.locator("#card").screenshot({ path: jpPng });
// Camera frame: the guide on a 412×900 phone is 62vh tall → 558px; video 1280×720 shown with cover (scale 1.25).
const gh = Math.min(0.62 * 900, 0.84 * 412 * 86 / 59), gw = gh * 59 / 86, scale = 1.25;
await r.setViewportSize({ width: 1280, height: 720 });
const b64 = (await readFile(cardPng)).toString("base64");
await r.setContent(`<body style="margin:0;background:#3b3b3b"><img src="data:image/png;base64,${b64}" style="position:absolute;left:${640 - gw / scale / 2}px;top:${(0.46 * 900) / scale - gh / scale / 2}px;width:${gw / scale}px;height:${gh / scale}px;transform:rotate(1deg)"></body>`);
const frame = await r.screenshot({ type: "jpeg", quality: 90 });
const mjpeg = join(tmp, "cam.mjpeg"); await writeFile(mjpeg, Buffer.concat(Array.from({ length: 30 }, () => frame)));
await b0.close();

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${mjpeg}`] });
const errors = [], cspViolations = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true, permissions: ["camera"] });
  const { execFileSync } = await import("node:child_process");
  const artJson = execFileSync("python3", ["-c", `
import sys,json,random
sys.path.insert(0,'scripts')
from PIL import Image
import build_art_index as B
pairs=json.loads(sys.argv[1]);random.seed(5)
ids=[int(k) for k in pairs];h=[B.phash_image(Image.open(v)) for v in pairs.values()]
for i in range(3000):ids.append(90000000+i);h.append('%016x'%random.getrandbits(64))
print(json.dumps({"v":1,"bits":64,"count":len(ids),"ids":ids,"h":"".join(h)}))`, JSON.stringify(artPngs)], { encoding: "utf8" });
  // kodex.meiocg.org data comes from the repository checkout
  await ctx.route("https://kodex.meiocg.org/**", async (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/scan/art.json") return route.fulfill({ status: 200, body: artJson, headers: { "access-control-allow-origin": "*", "content-type": "application/json" } });
    try { const body = await readFile(join(REPO, p)); return route.fulfill({ status: 200, body, headers: { "access-control-allow-origin": "*", "content-type": p.endsWith(".json") ? "application/json" : "application/octet-stream" } }); }
    catch { return route.fulfill({ status: 404, body: "", headers: { "access-control-allow-origin": "*" } }); }
  });
  await ctx.route("https://images.ygoprodeck.com/**", (route) => route.fulfill({ status: 404, body: "" }));
  await ctx.addInitScript(() => {
    window.KodexScanOCR = { p: {}, async setParameters(p) { this.p = p; }, async recognize(c) { const r = await fetch("http://127.0.0.1:4192/__ocr", { method: "POST", body: JSON.stringify({ png: c.toDataURL("image/png"), psm: this.p.tessedit_pageseg_mode, whitelist: this.p.tessedit_char_whitelist }) }); return { data: { text: (await r.json()).text } }; } };
    document.addEventListener("securitypolicyviolation", (e) => (window.__csp = (window.__csp || []).concat(e.violatedDirective + " " + e.blockedURI)));
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4192/");
  await page.waitForFunction(() => typeof M !== "undefined" && M.size > 10000, null, { timeout: 60000 });
  assert(await page.locator("#bScan").isVisible(), "the app's search box has a Scan button");
  await page.click("#bScan");
  await page.waitForSelector(".scan #scVideo");
  await page.waitForFunction(() => document.querySelector("#scVideo")?.videoWidth > 0, null, { timeout: 20000 });
  assert(true, "the scanner opens the camera inside the app");
  await page.waitForFunction(() => document.querySelector("#scSheet")?.classList.contains("on"), null, { timeout: 60000 });
  assert((await page.locator("#scB").innerText()).includes("Ash Blossom & Joyous Spring"), "the camera scan recognises the card");
  await page.getByRole("button", { name: "Open card" }).click();
  await page.waitForFunction(() => !document.querySelector(".scan") && !document.querySelector("#detail").hidden && /Ash Blossom/.test(document.querySelector("#detail").textContent), null, { timeout: 20000 });
  assert(true, "Open card shows the card's page in the app and closes the scanner");
  const live = await page.evaluate(() => [...document.querySelectorAll("video")].length);
  assert(live === 0, "the camera is released after opening the card");
  await page.goBack(); await page.waitForTimeout(400);
  assert(await page.evaluate(() => document.querySelector("#detail").hidden && !document.querySelector(".scan")), "back from the card returns to the search screen, not the scanner");
  // Back button closes the scanner
  await page.click("#bScan");
  await page.waitForSelector(".scan #scVideo");
  await page.waitForTimeout(500);
  await page.goBack(); await page.waitForTimeout(400);
  assert(await page.evaluate(() => !document.querySelector(".scan")), "the back button closes the scanner");
  // Close button
  await page.click("#bScan"); await page.waitForSelector(".scan [data-close]");
  await page.click(".scan [data-close]"); await page.waitForTimeout(400);
  assert(await page.evaluate(() => !document.querySelector(".scan")), "the close button closes the scanner");
  // Photo scan
  await page.click("#bScan"); await page.waitForSelector("#scPhoto", { state: "attached" });
  await page.evaluate(() => { const s = document.querySelector("#scAuto"); if (s.getAttribute("aria-pressed") === "true") s.click(); });
  await page.setInputFiles("#scPhoto", cardPng);
  await page.waitForFunction(() => document.querySelector("#scSheet")?.classList.contains("on"), null, { timeout: 60000 });
  assert((await page.locator("#scB").innerText()).includes("Ash Blossom"), "a photo scan works in the app");
  cspViolations.push(...((await page.evaluate(() => window.__csp)) || []));
  assert(cspViolations.length === 0, "the app's security rules allow the scanner (" + cspViolations.join(" | ") + ")");
  assert(errors.length === 0, "no page errors (" + errors.join(" | ") + ")");
  // A WebView that hands over the camera but never plays the <video> (seen on a real phone):
  // the scanner must show frames another way and still read the card.
  const ctx3 = await browser.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true, permissions: ["camera"] });
  await ctx3.route("https://kodex.meiocg.org/**", async (route) => { const p = new URL(route.request().url()).pathname; try { return route.fulfill({ status: 200, body: await readFile(join(REPO, p)), headers: { "access-control-allow-origin": "*" } }); } catch { return route.fulfill({ status: 404, body: "" }); } });
  await ctx3.route("https://images.ygoprodeck.com/**", (route) => route.fulfill({ status: 404, body: "" }));
  await ctx3.addInitScript(() => {
    window.KodexScanOCR = { p: {}, async setParameters(p) { this.p = p; }, async recognize(c) { const r = await fetch("http://127.0.0.1:4192/__ocr", { method: "POST", body: JSON.stringify({ png: c.toDataURL("image/png"), psm: this.p.tessedit_pageseg_mode, whitelist: this.p.tessedit_char_whitelist }) }); return { data: { text: (await r.json()).text } }; } };
    HTMLMediaElement.prototype.play = function () { return new Promise(() => {}); }; // never starts
    Object.defineProperty(HTMLMediaElement.prototype, "readyState", { get: () => 0 });
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { get: () => 0 });
  });
  const p3 = await ctx3.newPage();
  p3.on("pageerror", (e) => errors.push("stuck-video: " + e.message));
  await p3.goto("http://127.0.0.1:4192/");
  await p3.waitForFunction(() => typeof M !== "undefined" && M.size > 10000, null, { timeout: 60000 });
  await p3.click("#bScan");
  await p3.waitForFunction(() => { const c = document.querySelector("#scPrev"); return c && !c.hidden && c.width > 0; }, null, { timeout: 20000 });
  const shown = await p3.waitForFunction(() => { const c = document.querySelector("#scPrev"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let mn = 255, mx = 0; for (let i = 0; i < d.length; i += 4) { mn = Math.min(mn, d[i]); mx = Math.max(mx, d[i]); } return mx - mn > 10; }, null, { timeout: 10000 }).then(() => true, () => false);
  assert(shown, "when the video won't play, the camera picture is still shown");
  await p3.waitForFunction(() => document.querySelector("#scSheet")?.classList.contains("on"), null, { timeout: 60000 });
  assert((await p3.locator("#scB").innerText()).includes("Ash Blossom"), "and the card is still recognised");
  assert(errors.length === 0, "no page errors with a stuck video (" + errors.join(" | ") + ")");

  // Choosing a photo turns the camera off while it's searched, shows the photo, and "Scan another" turns it back on.
  await page.evaluate(() => history.back()); await page.waitForTimeout(400);
  await page.click("#bScan");
  await page.waitForFunction(() => document.querySelector("#scVideo")?.videoWidth > 0, null, { timeout: 20000 });
  await page.evaluate(() => { window.__tracks = []; const g = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); });
  const liveBefore = await page.evaluate(() => { const s = document.querySelector("#scVideo").srcObject; return s ? s.getVideoTracks().filter((t) => t.readyState === "live").length : 0; });
  const trackRef = await page.evaluateHandle(() => document.querySelector("#scVideo").srcObject.getVideoTracks()[0]);
  await page.setInputFiles("#scPhoto", cardPng);
  await page.waitForFunction(() => !document.querySelector("#scStill").hidden, null, { timeout: 5000 });
  const off = await trackRef.evaluate((t) => t.readyState);
  assert(liveBefore === 1 && off === "ended", "choosing a photo turns the camera off");
  assert(await page.locator("#scStill").isVisible(), "the chosen photo is shown while it's searched");
  await page.waitForFunction(() => document.querySelector("#scSheet")?.classList.contains("on"), null, { timeout: 60000 });
  assert((await page.locator("#scB").innerText()).includes("Ash Blossom"), "the photo is recognised");
  await page.getByRole("button", { name: "Scan another" }).click();
  await page.waitForFunction(() => document.querySelector("#scStill").hidden && document.querySelector("#scVideo").srcObject?.getVideoTracks()[0]?.readyState === "live", null, { timeout: 20000 });
  assert(true, "Scan another turns the camera back on");

  // Japanese card: recognised by its artwork alone
  await page.bringToFront();
  await page.evaluate(() => history.back()); await page.waitForTimeout(400);
  await page.click("#bScan"); await page.waitForSelector("#scPhoto", { state: "attached" });
  await page.evaluate(() => { const s = document.querySelector("#scAuto"); if (s.getAttribute("aria-pressed") === "true") s.click(); });
  const t0 = Date.now();
  await page.setInputFiles("#scPhoto", jpPng);
  await page.waitForFunction(() => document.querySelector("#scSheet")?.classList.contains("on"), null, { timeout: 60000 });
  const jpText = await page.locator("#scSheet").innerText();
  assert(jpText.includes("Blue-Eyes White Dragon") && /Matched by artwork/.test(jpText), "a Japanese card with its passcode hidden is recognised by its artwork");
  console.log("   Japanese photo recognised in " + (Date.now() - t0) + " ms");

  // Camera permission denied
  const ctx2 = await browser.newContext({ viewport: { width: 412, height: 900 }, isMobile: true });
  await ctx2.route("https://kodex.meiocg.org/**", async (route) => { const p = new URL(route.request().url()).pathname; try { return route.fulfill({ status: 200, body: await readFile(join(REPO, p)), headers: { "access-control-allow-origin": "*" } }); } catch { return route.fulfill({ status: 404, body: "" }); } });
  await ctx2.addInitScript(() => { window.KodexScanOCR = { setParameters: async () => {}, recognize: async () => ({ data: { text: "" } }) }; navigator.mediaDevices.getUserMedia = async () => { throw Object.assign(new Error("x"), { name: "NotAllowedError" }); }; });
  const p2 = await ctx2.newPage();
  await p2.goto("http://127.0.0.1:4192/");
  await p2.waitForFunction(() => typeof M !== "undefined" && M.size > 10000, null, { timeout: 60000 });
  await p2.click("#bScan");
  await p2.waitForSelector("#scMsg.on");
  assert((await p2.locator("#scMT").textContent()) === "Camera access is off", "without camera permission it explains how to allow it and offers a photo");
} finally { await browser.close(); server.close(); }
console.log(results.join("\n")); console.log(`\n${results.length} app scanner checks passed.`);
