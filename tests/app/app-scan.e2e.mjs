// End-to-end: the card scanner inside the KodeX app (app/Kodex_Mei_Production_v40.html).
// Run from the repository root: node tests/app/app-scan.e2e.mjs (needs playwright and the tesseract CLI).
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const APP = process.argv[2] || "app/Kodex_Mei_Production_v40.html";
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
await r.setContent(`<div id="card" style="width:590px;height:860px;background:#c9794a;position:relative;font-family:'DejaVu Serif',serif;border-radius:10px">
 <div style="position:absolute;left:36px;top:34px;width:518px;height:60px;background:#f3eee2;border:3px solid #5a4a2a;display:flex;align-items:center;padding-left:14px;font-weight:700;font-size:37px;white-space:nowrap;overflow:hidden">Ash Blossom &amp; Joyous Spring</div>
 <div style="position:absolute;left:70px;top:156px;width:450px;height:440px;background:linear-gradient(135deg,#3a6,#a36,#36a)"></div>
 <div style="position:absolute;right:62px;top:604px;font-family:'DejaVu Sans',sans-serif;font-size:24px;font-weight:600">MACR-EN036</div>
 <div style="position:absolute;left:36px;top:640px;width:518px;height:160px;background:#f3eee2;border:3px solid #5a4a2a"></div>
 <div style="position:absolute;left:30px;top:813px;font-family:'DejaVu Sans',sans-serif;font-size:24px">14558127</div></div>`);
const cardPng = join(tmp, "ash.png"); await r.locator("#card").screenshot({ path: cardPng });
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
  // kodex.meiocg.org data comes from the repository checkout
  await ctx.route("https://kodex.meiocg.org/**", async (route) => {
    const p = new URL(route.request().url()).pathname;
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
