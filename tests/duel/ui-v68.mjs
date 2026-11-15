// Arena v68: one thing on screen at a time (chain links, cross-outs, splashes, staple moments, reveals, toasts),
// longer special animations, the chain prompt, dialogs, KodeX's buttons, and turning the screen during combos and recordings.
// (v67 header kept) Arena v67: lobby Combo Generator, combos that keep their placement, the table in landscape and when turned.
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
  await page.route(`${base}/wrap.html`, (r) => r.fulfill({ contentType: "text/html", body: `<!doctype html><body style="margin:0"><div id="kxbar" style="position:fixed;top:8px;right:6px;display:flex;gap:8px;z-index:9"><i style="width:38px;height:38px;border-radius:12px;background:#0c1022f0;border:1px solid #fff3;display:block"></i><i style="width:38px;height:38px;border-radius:12px;background:#0c1022f0;border:1px solid #fff3;display:block"></i><i style="width:38px;height:38px;border-radius:12px;background:#0c1022f0;border:1px solid #fff3;display:block"></i></div><iframe id="f" src="${base}/duel/?app=1&embed=1#deck=${payload}" style="border:0;width:100vw;height:100vh"></iframe><script>
window.__vib = [];
addEventListener("message", (e) => { const d = e.data || {}; if (d.kx === "ready") { const w = document.getElementById("f").contentWindow;
  w.postMessage({ kx: "skin", premium: true, aces: [${POT}], aceStyle: "timestop", showFx: {} }, "*");
  w.postMessage({ kx: "profile", p: { name: "Kasuteru Kun", title: "Solfachord main", icon: "crown", frame: "premium", premium: true, tier: "gold", stats: {} } }, "*"); }
  if (d.kx === "ready") { const k = document.getElementById("kxbar").getBoundingClientRect(); document.getElementById("f").contentWindow.postMessage({ kx: "chrome", w: Math.round(innerWidth - k.left), h: Math.round(k.bottom) }, "*"); }
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
const MAXX = byName('Maxx "C"'), ARS = byName("Ars Magna of Infinity and Finity"), CURTAIN = byName("Dark Magical Curtain"), VEILER = byName("Effect Veiler");
// what is on screen at a moment: the chain link stage, a splash, a staple moment, the reveal strip, a toast
const watch = (f) => f.evaluate(() => { window.__seen = []; const t0 = performance.now(); const tick = () => {
  const on = { link: !!document.querySelector("#chainFx .cl-stage:not(.out)"), splash: !!document.querySelector("#bigFx .splash:not(.out)"), staple: !!document.querySelector("#cardFx .cf-cut, #cardFx .cf-stamp"), reveal: !!document.querySelector("#revealFx .rv-strip:not(.out)"), toast: document.querySelector("#toast").classList.contains("on") };
  window.__seen.push([Math.round(performance.now() - t0), on]); if (window.__seen.length < 400) requestAnimationFrame(tick); }; tick(); });
{
  const { page, f } = await open(412, 915);
  await f.evaluate(() => { const p = JSON.parse(localStorage.getItem("duel:pref") || "{}"); p.opening = false; localStorage.setItem("duel:pref", JSON.stringify(p)); });
  await start(f, page);
  const opt = await f.evaluate(() => { const s = document.querySelector("#prefSpPace"); return s && { v: s.value, o: [...s.options].map((o) => o.value).join() }; });
  ok(opt && opt.v === "2" && opt.o === "1,2,3", "Settings: special card animations, twice as long by default " + JSON.stringify(opt));
  // a chain of two (the second is Maxx "C", a staple), with a toast sent in the middle: each waits its turn
  await watch(f);
  const wait = await f.evaluate(([A, B]) => { const w = window.__arena.fxEvents({ names: ["Mei", "Synapse AI"], events: [
    { type: 70, chain_size: 1, code: A, controller: 1, location: 2, sequence: 0, description: "0" },
    { type: 70, chain_size: 2, code: B, controller: 0, location: 2, sequence: 0, description: "0" }] }); setTimeout(() => window.__arena.toast("A notice"), 300); return w; }, [ARS, MAXX]);
  ok(wait >= 900 * 2 + 3500, "the queue takes both links and the Maxx \"C\" moment (" + wait + " ms)");
  await page.waitForTimeout(1200);
  if (shot) await page.screenshot({ path: `${out}/v68-order-1.png` });
  await page.waitForTimeout(wait - 600);
  if (shot) await page.screenshot({ path: `${out}/v68-order-2.png` });
  await page.waitForTimeout(2600);
  const seen = await f.evaluate(() => window.__seen);
  const both = seen.filter(([, o]) => [o.link, o.splash, o.staple, o.reveal, o.toast].filter(Boolean).length > 1 && !(o.link && o.staple && false));
  const kinds = new Set(seen.flatMap(([, o]) => Object.keys(o).filter((k) => o[k])));
  // a link fades out over 0.2 s while the next one comes in: allow that hand-over
  const overlapMs = both.length ? both[both.length - 1][0] - both[0][0] : 0;
  const firstStaple = (seen.find(([, o]) => o.staple) || [0])[0], lastLink = Math.max(...seen.filter(([, o]) => o.link).map(([t]) => t)), firstToast = (seen.find(([, o]) => o.toast) || [1e9])[0];
  ok(kinds.has("link") && kinds.has("staple") && kinds.has("toast"), "links, the staple moment and the toast all showed " + [...kinds]);
  ok(firstStaple > 1500, "the staple moment waits for the second link (" + firstStaple + " ms)");
  ok(firstToast > firstStaple, "the toast waits until the screen is free (" + firstToast + " ms)");
  ok(both.filter(([, o]) => o.toast && (o.link || o.staple)).length === 0, "a notice never shows on top of an animation");
  // negate: the cross-out has the screen to itself, then the next resolution
  await watch(f);
  await f.evaluate(([A, B]) => window.__arena.fxEvents({ names: ["Mei", "Synapse AI"], events: [
    { type: 70, chain_size: 1, code: A, controller: 1, location: 2, sequence: 0, description: "0" }, { type: 70, chain_size: 2, code: B, controller: 0, location: 2, sequence: 0, description: "0" },
    { type: 72, chain_size: 2 }, { type: 75, chain_size: 2 }, { type: 72, chain_size: 1 }, { type: 74 }] }), [ARS, VEILER]);
  await page.waitForTimeout(4200);
  const s2 = await f.evaluate(() => window.__seen.filter(([, o]) => o.link).length);
  ok(s2 > 20, "links, the cross-out and the resolution played");
  // the chain prompt: the chain is its own row above the choices, names on one line
  await page.waitForTimeout(800);
  await f.evaluate(([a, b, c, d]) => { const S = window.__duel; S.packet.state.chain = [{ code: a, controller: 1, location: 2, sequence: 0, description: "0" }];
    window.__arena.chainPrompt({ type: "select_chain", forced: false, spe_count: 1, selects: [{ code: b, location: 2, sequence: 0, description: "0", controller: 0 }, { code: c, location: 2, sequence: 1, description: "0", controller: 0 }, { code: d, location: 2, sequence: 2, description: "0", controller: 0 }] }); }, [ARS, CURTAIN, VEILER, MAXX]);
  await page.waitForTimeout(500);
  const cp = await f.evaluate(() => { const ol = document.querySelector("#sheet > .chain-list"), li = ol && ol.querySelector("li"), st = li && li.querySelector("strong"), body = document.querySelector("#sheetBody");
    return { row: !!ol && !body.contains(ol), w: li && Math.round(li.getBoundingClientRect().width), nameLines: st && Math.round(st.getBoundingClientRect().height / parseFloat(getComputedStyle(st).lineHeight)), opts: body.querySelectorAll(".card").length }; });
  ok(cp.row && cp.w >= 200 && cp.nameLines === 1 && cp.opts === 3, "chain prompt: the chain is a row above the choices, each name on one line " + JSON.stringify(cp));
  if (shot) await page.screenshot({ path: `${out}/v68-chainprompt-p.png` });
  await page.setViewportSize({ width: 897, height: 397 }); await page.waitForTimeout(600);
  const cl = await f.evaluate(() => { const s = document.querySelector("#sheet").getBoundingClientRect(), cards = [...document.querySelectorAll("#sheetBody .card")].map((c) => c.getBoundingClientRect());
    return { w: Math.round(s.width), inside: s.top >= 0 && s.bottom <= innerHeight + 1, cardsShown: cards.filter((r) => r.bottom <= s.bottom && r.top >= s.top && r.height > 30).length }; });
  ok(cl.w >= 500 && cl.inside && cl.cardsShown >= 2, "chain prompt in landscape: wide enough, the cards show " + JSON.stringify(cl));
  if (shot) await page.screenshot({ path: `${out}/v68-chainprompt-l.png` });
  await f.evaluate(() => document.querySelector("#sheet .btn.primary")?.click());
  await page.setViewportSize({ width: 412, height: 915 }); await page.waitForTimeout(400);
  // KodeX's buttons: the opponent's name and Life Points stay clear of them, in both orientations
  for (const [w, h] of [[412, 915], [897, 397], [740, 360]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(700);
    const k = await page.evaluate(() => { const r = document.getElementById("kxbar").getBoundingClientRect(); return { l: r.left, b: r.bottom }; });
    const op = await f.evaluate(() => { const r = document.querySelector(".duelist.op").getBoundingClientRect(); return { r: r.right, t: r.top, b: r.bottom, l: r.left }; });
    ok(op.r <= k.l + 1 || op.t >= k.b - 1, `${w}×${h}: the opponent's plate is clear of KodeX's buttons ` + JSON.stringify({ op, k }));
  }
  // dialogs: the record dialog scrolls and nothing in it overlaps
  await page.setViewportSize({ width: 412, height: 915 }); await page.waitForTimeout(300);
  await f.evaluate(() => document.querySelector("#recDlg").showModal()); await page.waitForTimeout(400);
  const rd = await f.evaluate(() => { const d = document.querySelector("#recDlg"), kids = [...d.children].map((c) => c.getBoundingClientRect()).filter((r) => r.height);
    let ov = 0; for (let i = 1; i < kids.length; i++) if (kids[i].top < kids[i - 1].bottom - 1) ov++; const p = d.querySelector("p.hint").getBoundingClientRect(), dr = d.getBoundingClientRect();
    return { ov, padL: Math.round(p.left - dr.left), scroll: getComputedStyle(d).overflowY }; });
  ok(rd.ov === 0 && rd.padL >= 12 && rd.scroll === "auto", "record dialog: padded, nothing overlaps, it scrolls " + JSON.stringify(rd));
  if (shot) await page.screenshot({ path: `${out}/v68-recdlg.png` });
  await f.evaluate(() => document.querySelector("#recDlg").close());
  await page.close();
}
// combos and recordings while the screen is turned: the whole field stays on screen
{
  const { page, f } = await open(412, 915);
  await page.evaluate((c) => document.getElementById("f").contentWindow.postMessage({ kx: "combo", combo: c, keep: false }, "*"), combo);
  await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.combo, null, { timeout: 40000 });
  await page.waitForTimeout(3500);
  const fits = () => f.evaluate(() => { const z = [...document.querySelectorAll(".mat .zone")].map((x) => x.getBoundingClientRect()), bar = document.querySelector("#replayBar").getBoundingClientRect();
    const top = Math.min(...z.map((r) => r.top)), bot = Math.max(...z.map((r) => r.bottom)), right = Math.max(...z.map((r) => r.right));
    return { top: Math.round(top), bot: Math.round(bot), H: innerHeight, under: z.some((r) => r.right > bar.left + 2 && r.left < bar.right - 2 && r.bottom > bar.top + 2 && r.top < bar.bottom - 2) }; });
  for (const [w, h] of [[897, 397], [740, 360], [667, 375], [1280, 720], [412, 915]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(800);
    const r = await fits();
    ok(r.top >= -1 && r.bot <= r.H + 1 && !r.under, `combo at ${w}×${h}: every zone on screen, none under the controls ` + JSON.stringify(r));
    if (shot) await page.screenshot({ path: `${out}/v68-combo-${w}x${h}.png` });
  }
  await f.evaluate(() => document.querySelector("#rbRec").click()); await page.waitForTimeout(300);
  await f.evaluate(() => { document.querySelector("#recUntil").value = "end"; document.querySelector("#recGo").click(); });
  await page.waitForTimeout(1200);
  for (const [w, h] of [[897, 397], [412, 915]]) {
    await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(900);
    const r = await fits(), rec = await f.evaluate(() => !!window.__duel.rec);
    ok(rec && r.top >= -1 && r.bot <= r.H + 1, `recording, turned to ${w}×${h}: it keeps recording and the field fits ` + JSON.stringify(r));
  }
  await page.close();
}
if (errors.length) fail("page errors");
console.log("OK: v68");
await browser.close();
