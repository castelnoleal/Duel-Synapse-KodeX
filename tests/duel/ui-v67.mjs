// Arena v67: lobby Combo Generator, combos that keep their placement, the table in landscape and when turned.
// (v65 header kept) Arena v65: chain link animations that hold the duel, cards leaving play, no zoom in the app, replay to combo.
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
// ----- lobby: the strip says little, the Combo Generator is one tap away -----
for (const [w, h, tag] of [[412, 915, "p"], [915, 412, "l"]]) {
  const { page, f } = await open(w, h);
  await page.evaluate(() => { window.__got = []; addEventListener("message", (e) => { if (e.data && (e.data.kx === "combos" || e.data.kx === "comboAd")) window.__got.push(e.data.kx); }); });
  const lob = await f.evaluate(() => { const b = document.querySelector("#comboGen"), r = b.getBoundingClientRect(), t = [...document.querySelectorAll(".ticker li")].map((l) => l.textContent);
    return { vis: r.width > 80 && r.height > 22 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, top: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2).closest("#comboGen") === b, long: t.filter((x) => x.length > 22).length, n: t.length, txt: b.textContent }; });
  ok(lob.vis && lob.top && /Combo Generator/.test(lob.txt), `lobby (${tag}): the Combo Generator button is on screen ` + JSON.stringify(lob));
  ok(lob.long === 0 && lob.n >= 6, `lobby (${tag}): the strip is short words, nothing explained at length`);
  if (shot) await page.screenshot({ path: `${out}/v67-lobby-${tag}.png` });
  await f.click("#comboGen"); await page.waitForTimeout(300);
  ok((await page.evaluate(() => window.__got.join())) === "combos", "in the app the button opens Combos in KodeX (no advert)");
  await page.evaluate(() => document.getElementById("f").contentWindow.postMessage({ kx: "host", app: false }, "*")); await page.waitForTimeout(200);
  await f.click("#comboGen"); await page.waitForTimeout(300);
  ok((await page.evaluate(() => window.__got.join())) === "combos,comboAd", "in a browser the button shows the Combo advert");
  await page.close();
}
// ----- a combo with placement plays on the zones it names; the step is written in the replay bar -----
{
  const { page, f } = await open(412, 915);
  const combo = { id: "t67", title: "Placement", hand: [MARSH, POT], deckSize: 40, intro: { ms: 0 }, lines: [[{ cards: [{ c: MARSH, a: "ss", z: 4, p: 2, f: 1 }] }], [{ cards: [{ c: POT, a: "act", z: 0, f: 1 }] }, { cards: [{ c: AXE, a: "add", f: 2 }] }]] };
  await page.evaluate((c) => document.getElementById("f").contentWindow.postMessage({ kx: "combo", combo: c, keep: false }, "*"), combo);
  await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.combo && window.__duel.packet.combo.last, null, { timeout: 40000 }).catch(() => fail("combo did not play"));
  await page.waitForTimeout(600);
  const st = await f.evaluate(() => { const t = window.__duel.packet.state.teams[0], cap = document.querySelector("#rbCap"), s = document.querySelector("#status");
    return { m: t.mzone.map((x) => (x ? x.code : 0)).join(), pos: t.mzone[4] && t.mzone[4].position, hand: t.hand.length, cap: !cap.hidden && cap.textContent, status: getComputedStyle(s).visibility, def: !!document.querySelector("#me-m4 .card.def, #me-m4 .card[data-pos='def'], #me-m4 .def") }; });
  ok(st.m.split(",")[4] === String(MARSH) && st.pos === 4, "a combo card goes to the zone and position it names " + JSON.stringify(st));
  ok(st.cap && st.cap.length > 4 && st.status === "hidden", "the step is written in the replay bar, not under it");
  if (shot) await page.screenshot({ path: `${out}/v67-combo-place.png` });
  await page.close();
}
// ----- the table turned on its side, on phones, tablets and desktop windows; and turned during a duel -----
{
  const { page, f } = await open(412, 915);
  await f.evaluate(() => { const p = JSON.parse(localStorage.getItem("duel:pref") || "{}"); p.opening = false; localStorage.setItem("duel:pref", JSON.stringify(p)); });
  await start(f, page);
  const probe = () => f.evaluate(() => {
    const W = innerWidth, H = innerHeight, R = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
    const hit = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const zones = [...document.querySelectorAll(".mat .zone")].map((z) => z.getBoundingClientRect());
    const over = (s) => { const r = R(s); return !!r && zones.some((z) => hit(r, z)); };
    const inside = (s, slack = 2) => { const r = R(s); return !!r && r.left >= -slack && r.top >= -slack && r.right <= W + slack && r.bottom <= H + slack; };
    const mat = R(".mat"), hand = [...document.querySelectorAll("#myHand .card")].map((c) => c.getBoundingClientRect());
    return { chainOver: over("#chainBtn"), quickOver: over("#quickBtn"), plates: inside(".duelist.me") && inside(".duelist.op"), turn: inside(".turnbar"), end: inside(".phases"), matIn: mat.left >= -2 && mat.right <= W + 2 && mat.top >= -2,
      matMid: Math.round(((mat.top + mat.bottom) / 2 / H) * 100), handShown: hand.length ? Math.round((Math.min(H, hand[0].bottom) - hand[0].top) / hand[0].height * 100) : 0, scroll: document.documentElement.scrollWidth > W + 1 };
  });
  for (const [w, h, name] of [[667, 375, "small phone"], [740, 360, "phone"], [915, 412, "tall phone"], [1024, 768, "tablet"], [1280, 720, "laptop"], [1366, 1024, "large tablet"], [1920, 1080, "desktop"]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(450);
    const r = await probe();
    ok(!r.chainOver && !r.quickOver && r.plates && r.turn && r.end && r.matIn && !r.scroll, `landscape ${w}×${h} (${name}): nothing sits on the field or off the screen ` + JSON.stringify(r));
    if (w / h < 1.6) ok(r.matMid >= 36 && r.matMid <= 60 && r.handShown >= 95, `landscape ${w}×${h}: the field stands in the middle and the hand is shown whole (${r.matMid}%, ${r.handShown}%)`);
    if (shot) await page.screenshot({ path: `${out}/v67-land-${w}x${h}.png` });
  }
  for (const [w, h] of [[412, 915], [915, 412], [412, 915]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(450);
    const r = await probe();
    ok(r.plates && r.turn && r.matIn && !r.scroll && !r.chainOver, `turned during a duel to ${w}×${h}: the table rearranges`);
  }
  // still playable after turning
  await activate(f, page, CUP); await page.waitForTimeout(2500);
  ok(await f.evaluate(() => window.__duel.packet.state.teams[window.__duel.team].hand.length !== 5 || window.__duel.packet.state.teams[window.__duel.team].grave.length > 0), "the duel plays on after the screen was turned");
  await page.close();
}
if (errors.length) fail("page errors");
console.log("OK: v67");
await browser.close();
