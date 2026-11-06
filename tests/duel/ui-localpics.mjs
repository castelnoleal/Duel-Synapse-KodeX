// Inside the KodeX app the Arena uses card pictures saved on the phone (the app's offline database, served by
// instApped at https://appassets.androidplatform.net/castel-files/...). This plays the app's part: it frames the
// Arena, sends {kx:"pics"} and checks the cards are drawn from the phone, with no internet for art.
// usage: node tests/duel/ui-localpics.mjs http://localhost:8787
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");
const deck = { n: "Phone pictures", m: [[46986414, "Dark Magician", 3], [89631139, "Blue-Eyes White Dragon", 3], [14558127, "Ash Blossom & Joyous Spring", 3]], e: [], s: [] };
const payload = Buffer.from(JSON.stringify(deck)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const local = new Set(), net = [];
await page.route("https://appassets.androidplatform.net/castel-files/**", (r) => { const m = /\/(\d+)\.jpg$/.exec(r.request().url()); if (m) local.add(Number(m[1])); r.fulfill({ body: PNG, contentType: "image/png", headers: { "access-control-allow-origin": "*" } }); });
await page.route(/(ygoprodeck|\/img\/)/, (r) => { net.push(r.request().url()); r.abort(); });
await page.route(`${base}/wrap.html`, (r) => r.fulfill({ contentType: "text/html", body: `<!doctype html><body style="margin:0"><iframe id="f" src="${base}/duel/?app=1&embed=1#deck=${payload}" style="border:0;width:100vw;height:100vh"></iframe><script>
addEventListener("message", (e) => { if (e.data && e.data.kx === "ready") document.getElementById("f").contentWindow.postMessage({ kx: "pics", base: "https://appassets.androidplatform.net/castel-files/KodeX/pics/", ids: [46986414, 89631139, 14558127] }, "*"); });
</script></body>` }));
await page.goto(`${base}/wrap.html`);
const frame = await (await page.waitForSelector("#f")).contentFrame();
await frame.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
await page.waitForTimeout(800);
await frame.waitForSelector(".deck-grid img", { timeout: 30000 });
await page.waitForTimeout(1500);
const lobby = await frame.$$eval(".deck-grid img", (imgs) => imgs.map((i) => ({ src: i.currentSrc, ok: i.complete && i.naturalWidth > 0 })));
const fromPhone = lobby.filter((x) => x.ok && x.src.startsWith("https://appassets.androidplatform.net/castel-files/KodeX/pics/")).length;
console.log("lobby pictures from the phone:", fromPhone, "of", lobby.length, "· asked the phone for", [...local]);
await browser.close();
if (!fromPhone || fromPhone < lobby.length || local.size !== 3) { console.error("FAIL: the Arena did not use the pictures saved on the phone"); process.exit(1); }
console.log("OK: the Arena draws cards from the phone's offline database");
