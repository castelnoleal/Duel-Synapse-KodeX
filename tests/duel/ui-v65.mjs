// Arena v65: chain link animations that hold the duel, cards leaving play, no zoom in the app, replay to combo.
// (v64 header kept) Arena v64, framed like the KodeX app: status effects in the card details, the chain-prompt button, the coin toss and
// player showcase before a duel, coin tosses from effects, showdowns without their printed name.
// (older header kept below)
//  • cards keep their element between updates (no blinking), the settings panel scrolls, the LP plates hold their numbers;
//  • the quick flag: restart (solo) and surrender; tapping outside closes panels (and the setting turns it off);
//  • the Deck riffles when it is shuffled; the new Time Stop showdown;
//  • a KodeX combo plays like a replay: title card, steps, back/forward, kept in the Replays list, recorded with its title card.
// usage: node tests/duel/ui-v65.mjs http://localhost:8787 [outdir]
import fs from "node:fs";
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787", out = process.argv[3] || ".";
const POT = 55144522, HINOTAMA = 46130346, MARSH = 31305911, AXE = 40619825, CUP = 37812118;
const raw = JSON.parse(fs.readFileSync(new URL("../../duel/data/cards.json", import.meta.url))).cards;
const byName = (n) => { for (const [c, r] of Object.entries(raw)) if (r[12] === n) return Number(c); throw new Error("no card " + n); };
const normals = Object.entries(raw).filter(([c, r]) => !r[0] && (r[2] & 0x11) === 0x11 && !(r[2] & 0x4000)).slice(0, 34).map(([c, r]) => [Number(c), r[12], 1]);
const deck = { n: "v64", m: [[POT, "Pot of Greed", 3], [MARSH, "Marshmallon", 3], [AXE, "Axe of Despair", 3], [CUP, "Cup of Ace", 3], ...normals.slice(0, 28)], e: [], s: [] };
const payload = Buffer.from(JSON.stringify(deck)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const CUTIA = byName("DoSolfachord Cutia"), HARM = byName("Solfachord Harmonia"), COOLIA = byName("DoSolfachord Coolia"), DREAM = byName("ReSolfachord Dreamia"), GRAN = byName("GranSolfachord Coolia");
const combo = { id: "t1", title: "Solfachord 1.5 Card Combo", deck: "Solfachord", hand: [CUTIA, POT], extra: [GRAN],
  lines: [[{ cards: [{ c: CUTIA }] }, { cards: [{ c: HARM }] }, { cards: [{ c: COOLIA, a: "ss" }, { c: DREAM, a: "add" }] }], [{ cards: [{ c: POT }] }, { cards: [{ c: GRAN }], note: "Link climb" }]],
  intro: { ms: 2400, key: GRAN, art: GRAN } };
const browser = await chromium.launch();
const errors = [];
const fail = (m) => { console.error("FAIL:", m, errors); process.exit(1); };
const ok = (c, m) => { if (!c) fail(m); console.log("ok:", m); };
async function open(w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
  await page.route(`${base}/wrap.html`, (r) => r.fulfill({ contentType: "text/html", body: `<!doctype html><body style="margin:0"><iframe id="f" src="${base}/duel/?app=1&embed=1#deck=${payload}" style="border:0;width:100vw;height:100vh"></iframe><script>
window.__vib = [];
addEventListener("message", (e) => { const d = e.data || {}; if (d.kx === "ready") { const w = document.getElementById("f").contentWindow;
  w.postMessage({ kx: "skin", premium: true, aces: [${POT}], aceStyle: "timestop", showFx: {} }, "*");
  w.postMessage({ kx: "profile", p: { name: "Kasuteru Kun", title: "Solfachord main", icon: "crown", frame: "premium", premium: true, tier: "gold", stats: {} } }, "*"); }
  if (d.kx === "comboShown") window.__shown = (window.__shown || 0) + 1; if (d.kx === "vibrate") window.__vib.push(d.p); if (d.kx === "saveVideo") window.__video = { name: d.name, mime: d.mime, size: d.buf.byteLength }; });
</script></body>` }));
  await page.goto(`${base}/wrap.html`);
  const f = await (await page.waitForSelector("#f")).contentFrame();
  await f.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  return { page, f };
}
async function start(f, page) {
  await f.evaluate(([a, b]) => { for (const c of a) window.__duel.testHand.add(c); }, [[POT, MARSH, AXE, CUP], 0]);
  await f.evaluate(() => { for (const [id, v] of [["#soloOpp", "passive"], ["#soloOppDeck", "same"], ["#soloFirst", "me"], ["#soloOrder", "built"]]) { const e = document.querySelector(id); e.value = v; e.dispatchEvent(new Event("change")); } });
  await f.click("#soloStart");
  if (start.opening) await start.opening(f, page);
  await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.prompt && window.__duel.packet.waitingFor === window.__duel.team, null, { timeout: 60000 });
  await page.waitForTimeout(1800);
}
async function activate(f, page, code) {
  const idx = await f.evaluate((code) => window.__duel.packet.state.teams[window.__duel.team].hand.findIndex((h) => Number(h.code) === code), code);
  if (idx < 0) fail("card not in hand: " + code);
  await f.click(`#myHand .card:nth-child(${idx + 1})`, { force: true });
  await page.waitForTimeout(300);
  for (const b of await f.$$("#menu button")) { if (/^Activate/.test(await b.textContent())) { await b.click(); break; } }
  await page.waitForTimeout(400);
  const z = await f.$(".zone.free");
  if (z) { await z.click({ force: true }); await page.waitForTimeout(200); const go = await f.$("#sheetActions .btn.primary:not([disabled])"); if (go && await go.isVisible()) await go.click(); }
}

const shot = !!process.env.SHOT;
const ASH = byName("Ash Blossom & Joyous Spring");
for (const [w, h, tag] of [[412, 915, "p"], [915, 412, "l"]]) {
  const { page, f } = await open(w, h);
  await f.evaluate(() => { const p = JSON.parse(localStorage.getItem("duel:pref") || "{}"); p.opening = false; localStorage.setItem("duel:pref", JSON.stringify(p)); });
  await start(f, page);
  // ----- settings: the chain animation time -----
  const opt = await f.evaluate(() => { const s = document.querySelector("#prefChainMs"); return s && { v: s.value, n: s.options.length }; });
  ok(opt && opt.v === "900" && opt.n >= 4, "Settings: chain animation time " + JSON.stringify(opt));
  // ----- a chain of three: each link plays in turn and the duel waits for it -----
  const ev = (type, n, code, ctl) => ({ type, chain_size: n, code, controller: ctl, location: 4, sequence: 2, description: "0" });
  const t0 = Date.now();
  const wait = await f.evaluate(([POT, ASH, MARSH]) => window.__arena.fxEvents({ names: ["Kasuteru Kun", "Dummy"], events: [
    { type: 70, chain_size: 1, code: POT, controller: 0, location: 2, sequence: 0, description: "0" },
    { type: 70, chain_size: 2, code: ASH, controller: 1, location: 2, sequence: 0, description: "0" },
    { type: 70, chain_size: 3, code: MARSH, controller: 0, location: 4, sequence: 2, description: "0" }] }), [POT, ASH, MARSH]);
  ok(wait >= 2600 && wait <= 2800, "three links take three turns of the chosen time (" + wait + " ms)");
  await page.waitForTimeout(500);
  let st = await f.evaluate(() => { const s = document.querySelector("#chainFx .cl-stage"); return s && { cls: s.className, cards: s.querySelectorAll(".cl-card").length, n: s.querySelector(".cl-card.new .cl-n").textContent, word: s.querySelector(".cl-word").textContent }; });
  ok(st && st.cards === 1 && st.n === "1" && /CHAIN1/.test(st.word), "link 1 shown first " + JSON.stringify(st));
  if (shot) await page.screenshot({ path: `${out}/v65-chain1-${tag}.png` });
  await page.waitForTimeout(900);
  st = await f.evaluate(() => { const s = document.querySelector("#chainFx .cl-stage"); return s && { cls: s.className, cards: s.querySelectorAll(".cl-card").length, n: s.querySelector(".cl-card.new .cl-n").textContent, wires: s.querySelectorAll(".cl-wire").length }; });
  ok(st && st.cards === 2 && st.n === "2" && st.wires === 1 && / op/.test(st.cls), "link 2 joins link 1 only after it has finished " + JSON.stringify(st));
  if (shot) await page.screenshot({ path: `${out}/v65-chain2-${tag}.png` });
  await page.waitForTimeout(900);
  st = await f.evaluate(() => { const s = document.querySelector("#chainFx .cl-stage"); const r = s && s.querySelector(".cl-row").getBoundingClientRect(); return s && { cards: s.querySelectorAll(".cl-card").length, n: s.querySelector(".cl-card.new .cl-n").textContent, fits: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight }; });
  ok(st && st.cards === 3 && st.n === "3" && st.fits, "link 3 with both earlier links, inside the screen " + JSON.stringify(st));
  if (shot) await page.screenshot({ path: `${out}/v65-chain3-${tag}.png` });
  await page.waitForTimeout(1000);
  // resolution: link 3 is negated (crossed out), link 2 resolves
  await f.evaluate(() => window.__arena.fxEvents({ names: ["A", "B"], events: [{ type: 72, chain_size: 3 }, { type: 75, chain_size: 3 }, { type: 72, chain_size: 2 }] }));
  await page.waitForTimeout(580);
  st = await f.evaluate(() => { const s = document.querySelector("#chainFx .cl-stage"); return s && { cls: s.className, x: !!s.querySelector(".cl-x"), word: s.querySelector(".cl-word").textContent }; });
  ok(st && /negate/.test(st.cls) && st.x && /NEGATED/.test(st.word), "a negated link is crossed out " + JSON.stringify(st));
  if (shot) await page.screenshot({ path: `${out}/v65-negate-${tag}.png` });
  await page.waitForTimeout(650);
  st = await f.evaluate(() => { const s = document.querySelector("#chainFx .cl-stage"); return s && { cls: s.className, word: s.querySelector(".cl-word").textContent }; });
  ok(st && /solve/.test(st.cls) && /RESOLVE2/.test(st.word), "then the next link resolves " + JSON.stringify(st));
  await f.evaluate(() => window.__arena.fxEvents({ names: ["A", "B"], events: [{ type: 72, chain_size: 1 }, { type: 74 }] }));
  await page.waitForTimeout(1500);
  ok(await f.evaluate(() => !document.querySelector("#chainFx .cl-stage:not(.out)")), "the chain clears when it ends");
  // Off: the small banner, and nothing waits
  await f.evaluate(() => { const s = document.querySelector("#prefChainMs"); s.value = "0"; s.dispatchEvent(new Event("change")); });
  const w0 = await f.evaluate((POT) => window.__arena.fxEvents({ names: ["A", "B"], events: [{ type: 70, chain_size: 1, code: POT, controller: 0, location: 2, sequence: 0, description: "0" }, { type: 74 }] }), POT);
  ok(w0 === 0 && await f.evaluate(() => !!document.querySelector("#chainFx .chain-show.compact")), "chain animation off: the small banner, no wait");
  await f.evaluate(() => { const s = document.querySelector("#prefChainMs"); s.value = "900"; s.dispatchEvent(new Event("change")); });
  await page.waitForTimeout(1400);
  // ----- a real activation: the question that follows waits for the link -----
  await f.evaluate(() => { window.__q = []; const t = Date.now(); const iv = setInterval(() => { const s = document.querySelector("#chainFx .cl-stage:not(.out)"), sh = document.querySelector("#sheet"); window.__q.push([Date.now() - t, !!s, sh && !sh.hidden]); if (window.__q.length > 80) clearInterval(iv); }, 50); });
  await activate(f, page, CUP);
  await page.waitForTimeout(3000);
  const q = await f.evaluate(() => window.__q);
  const seen = q.some((x) => x[1]), early = q.some((x) => x[1] && x[2]);
  ok(seen && !early, "a real activation shows its link, and no question opens while it plays");
  // ----- cards leaving play -----
  for (const fx of ["destroy", "battle", "banish", "release"]) {
    const made = await f.evaluate(([fx, MARSH]) => window.__arenaLeave(fx, "me-m2", MARSH) || window.__arenaLeave(fx, "me-deck", MARSH), [fx, MARSH]);
    await page.waitForTimeout(330);
    const lf = await f.evaluate(() => { const b = document.querySelector("#flyFx .leave-fx"); return b && { cls: b.className, kids: b.children.length }; });
    ok(made && lf && lf.cls.includes(fx) && lf.kids >= (fx === "destroy" || fx === "battle" ? 7 : 3), "leaving play: " + fx + " " + JSON.stringify(lf));
    if (shot && tag === "p") await page.screenshot({ path: `${out}/v65-leave-${fx}.png` });
    await page.waitForTimeout(700);
    ok(await f.evaluate(() => !document.querySelector("#flyFx .leave-fx")), fx + " clears");
  }
  await page.close();
}
// ----- inside the app the page cannot be zoomed; a browser tab is pointed to Google Play -----
{
  const { page, f } = await open(412, 915);
  const z = await f.evaluate(() => ({ cls: document.documentElement.classList.contains("no-zoom"), vp: document.querySelector("#vp").content, ta: getComputedStyle(document.documentElement).touchAction,
    pinch: (() => { const e = new Event("touchmove", { cancelable: true, bubbles: true }); e.touches = [{}, {}]; document.body.dispatchEvent(e); return e.defaultPrevented; })() }));
  ok(z.cls && /user-scalable=no/.test(z.vp) && /pan-x/.test(z.ta) && z.pinch, "in the app the Arena cannot be zoomed " + JSON.stringify(z));
  ok(await f.evaluate(() => document.querySelector("#appOnly").hidden), "in the app there is no download page");
  await page.close();
  const p2 = await browser.newPage({ viewport: { width: 412, height: 915 } });
  await p2.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
  await p2.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
  await p2.goto(`${base}/duel/`); await p2.waitForTimeout(1500);
  const ao = await p2.evaluate(() => { const a = document.querySelector("#appOnly"), b = a.querySelector("#aoStore"), r = b.getBoundingClientRect(); return { shown: !a.hidden, href: b.href, top: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b, zoom: document.documentElement.classList.contains("no-zoom") }; });
  ok(ao.shown && /^https:\/\/play\.google\.com\//.test(ao.href) && ao.top && !ao.zoom, "a browser tab shows the Google Play page instead of the Arena " + JSON.stringify(ao));
  if (shot) await p2.screenshot({ path: `${out}/v65-apponly.png` });
  await p2.close();
}
if (errors.length) fail("page errors");
console.log("OK: v65");
await browser.close();
