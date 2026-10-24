// End-to-end test of the card scanner with real text recognition.
// Renders test cards, then scans them through (a) a fake camera and (b) photo upload.
// The page's Tesseract.js reader is swapped for the same engine running natively
// (tesseract 5 CLI) so this runs offline; cropping, clean-up and matching are the real code.
//
// Needs: playwright, the tesseract CLI with English data. Run: node tests/scan/scanner.e2e.mjs
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, extname } from "node:path";

const ROOT = resolve(".");
const results = [];
const assert = (ok, msg) => { if (!ok) throw new Error("FAIL: " + msg); results.push("PASS: " + msg); };
try { execFileSync("tesseract", ["--version"], { stdio: "ignore" }); } catch { console.log("SKIP: tesseract CLI not installed"); process.exit(0); }

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
function ocr(png, psm, whitelist) {
  return new Promise((res) => {
    const args = ["stdin", "stdout", "--psm", String(psm || 7), "-l", "eng"];
    if (whitelist) args.push("-c", "tessedit_char_whitelist=" + whitelist);
    const p = spawn("tesseract", args);
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("close", () => res(out));
    p.stdin.end(png);
  });
}
const server = createServer(async (req, res) => {
  if (req.url === "/__ocr" && req.method === "POST") {
    let body = ""; for await (const c of req) body += c;
    const { png, psm, whitelist } = JSON.parse(body);
    const text = await ocr(Buffer.from(png.split(",")[1], "base64"), psm, whitelist);
    res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ text }));
  }
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = join(ROOT, path.endsWith("/") ? path + "index.html" : path);
  try { const data = await readFile(file); res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }); res.end(data); }
  catch { res.writeHead(404); res.end("not found"); }
});
await new Promise((r) => server.listen(4190, "127.0.0.1", r));

// The page's reader, backed by the native engine.
const OCR_STUB = () => {
  window.KodexScanOCR = {
    p: {},
    async setParameters(p) { this.p = p; },
    async recognize(canvas) {
      const r = await fetch("/__ocr", { method: "POST", body: JSON.stringify({ png: canvas.toDataURL("image/png"), psm: this.p.tessedit_pageseg_mode, whitelist: this.p.tessedit_char_whitelist }) });
      return { data: { text: (await r.json()).text } };
    },
  };
};

// Test cards drawn like real ones: name banner, artwork, set code, text box, passcode.
const CARDS = [
  { name: "Ash Blossom & Joyous Spring", set: "MACR-EN036", pass: "14558127", frame: "#c9794a", ink: "#111" },
  { name: "Blue-Eyes White Dragon", set: "LOB-EN001", pass: "89631139", frame: "#c8a24a", ink: "#111" },
  { name: "Number 39: Utopia", set: "", pass: "84013237", frame: "#2a2a2e", ink: "#f2f2f2" },
];
const cardHtml = (c) => `<!doctype html><html><body style="margin:0;background:#888">
<div id="card" style="width:590px;height:860px;background:${c.frame};position:relative;font-family:'DejaVu Serif',Georgia,serif;border-radius:10px;overflow:hidden">
 <div style="position:absolute;left:36px;top:34px;width:518px;height:60px;background:${c.ink === "#111" ? "#f3eee2" : "#151518"};border:3px solid #5a4a2a;display:flex;align-items:center;padding-left:14px;font-weight:700;font-size:37px;color:${c.ink};white-space:nowrap;overflow:hidden">${c.name}</div>
 <div style="position:absolute;left:482px;top:38px;width:52px;height:52px;border-radius:50%;background:#7a3;"></div>
 <div style="position:absolute;left:70px;top:156px;width:450px;height:440px;background:linear-gradient(135deg,#3a6,#a36,#36a);border:4px solid #333"></div>
 ${c.set ? `<div style="position:absolute;right:62px;top:604px;font-family:'DejaVu Sans',Arial,sans-serif;font-size:24px;color:#111;font-weight:600">${c.set}</div>` : ""}
 <div style="position:absolute;left:36px;top:640px;width:518px;height:160px;background:#f3eee2;border:3px solid #5a4a2a;font-size:14px;padding:10px;color:#222">Effect text of the card goes here, several lines long.</div>
 <div style="position:absolute;left:30px;top:813px;font-family:'DejaVu Sans',Arial,sans-serif;font-size:24px;color:${c.ink}">${c.pass}</div>
</div></body></html>`;

const tmp = await mkdtemp(join(tmpdir(), "kodex-scan-"));
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  // Render the test cards.
  const r = await browser.newPage({ viewport: { width: 700, height: 900 } });
  for (const c of CARDS) {
    await r.setContent(cardHtml(c));
    c.png = join(tmp, c.pass + ".png");
    await r.locator("#card").screenshot({ path: c.png });
  }
  // A camera frame (1280×720) with the first card where the on-screen frame is on a 412×900 phone.
  await r.setViewportSize({ width: 1280, height: 720 });
  const b64 = (await readFile(CARDS[0].png)).toString("base64");
  await r.setContent(`<body style="margin:0;background:#3b3b3b"><img src="data:image/png;base64,${b64}" style="position:absolute;left:${640 - 139}px;top:${331 - 202}px;width:278px;height:404px;transform:rotate(1.2deg)"></body>`);
  const frame = await r.screenshot({ type: "jpeg", quality: 90 });
  const mjpeg = join(tmp, "camera.mjpeg");
  await writeFile(mjpeg, Buffer.concat(Array.from({ length: 30 }, () => frame)));
  await r.close();

  // (a) Live camera scan
  const camBrowser = await chromium.launch({ headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${mjpeg}`] });
  try {
    const ctx = await camBrowser.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true, permissions: ["camera"] });
    await ctx.addInitScript(OCR_STUB);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push("camera: " + e.message));
    await page.goto("http://127.0.0.1:4190/");
    await page.waitForSelector("#scanBtn");
    assert(await page.locator("#scanBtn").isVisible(), "KodeX shows a Scan button next to search");
    await page.click("#scanBtn");
    await page.waitForURL("**/scan/");
    await page.waitForFunction(() => document.querySelector("#sheet").classList.contains("on"), null, { timeout: 60000 });
    assert((await page.locator("#sheetBody").innerText()).includes("Ash Blossom & Joyous Spring"), "the live camera scan recognises the card");
    assert(/passcode|set code|name/i.test(await page.locator("#sheetSub").textContent()), "it says how the card was matched");
    await page.getByRole("button", { name: "Open card" }).click();
    await page.waitForURL("**/#card=14558127");
    await page.waitForFunction(() => /Ash Blossom/.test(document.querySelector("#detail")?.textContent || ""), null, { timeout: 30000 });
    assert(true, "Open card shows the card in KodeX");
  } finally { await camBrowser.close(); }

  // (b) Photo scans, including a dark name banner and a card without a set code
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(OCR_STUB);
  await ctx.addInitScript(() => { navigator.mediaDevices.getUserMedia = async () => { throw Object.assign(new Error("denied"), { name: "NotAllowedError" }); }; });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push("photo: " + e.message));
  await page.goto("http://127.0.0.1:4190/scan/");
  await page.waitForSelector("#msg.on");
  assert((await page.locator("#msgTitle").textContent()) === "Camera access is off", "without camera access it explains and offers a photo instead");
  await page.click("#msgActs .btn.pri").catch(() => {});
  await page.locator("#msg").evaluate((m) => m.classList.remove("on"));
  for (const c of CARDS) {
    await page.setInputFiles("#photo", c.png);
    await page.waitForFunction(() => document.querySelector("#sheet").classList.contains("on"), null, { timeout: 60000 });
    const text = await page.locator("#sheetBody").innerText();
    assert(text.includes(c.name), `a photo of ${c.name} is recognised`);
    await page.getByRole("button", { name: /Scan another|Scan again/ }).click();
    await page.waitForFunction(() => !document.querySelector("#sheet").classList.contains("on"));
  }
  // A photo with no card in it
  const blank = join(tmp, "blank.png");
  const bp = await browser.newPage({ viewport: { width: 590, height: 860 } });
  await bp.setContent('<body style="margin:0;background:linear-gradient(#556,#998)"></body>');
  await bp.screenshot({ path: blank }); await bp.close();
  await page.setInputFiles("#photo", blank);
  await page.waitForFunction(() => /No card recognised/.test(document.querySelector("#hint").textContent), null, { timeout: 60000 });
  assert(true, "a photo without a card says so instead of guessing");

  // pick=1 hands the card back to the page that opened the scanner
  const p2 = await ctx.newPage();
  await p2.goto("http://127.0.0.1:4190/scan/?pick=1");
  await p2.waitForSelector("#msg.on");
  await p2.locator("#msg").evaluate((m) => m.classList.remove("on"));
  await p2.evaluate(() => { window.__got = []; window.KodexScanResult = { onCard: (j) => window.__got.push(JSON.parse(j)) }; });
  await p2.setInputFiles("#photo", CARDS[1].png);
  await p2.waitForFunction(() => document.querySelector("#sheet").classList.contains("on"), null, { timeout: 60000 });
  await p2.getByRole("button", { name: "Use this card" }).click();
  const got = await p2.evaluate(() => window.__got);
  assert(got.length === 1 && got[0].id === 89631139 && got[0].type === "kodex-scan", "pick mode returns the card to the app");
  assert(errors.length === 0, "no page errors (" + errors.join(" | ") + ")");
} finally {
  await browser.close();
  server.close();
}
console.log(results.join("\n"));
console.log(`\n${results.length} scanner checks passed.`);
