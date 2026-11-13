// Arena v64, framed like the KodeX app: status effects in the card details, the chain-prompt button, the coin toss and
// player showcase before a duel, coin tosses from effects, showdowns without their printed name.
// (older header kept below)
//  • cards keep their element between updates (no blinking), the settings panel scrolls, the LP plates hold their numbers;
//  • the quick flag: restart (solo) and surrender; tapping outside closes panels (and the setting turns it off);
//  • the Deck riffles when it is shuffled; the new Time Stop showdown;
//  • a KodeX combo plays like a replay: title card, steps, back/forward, kept in the Replays list, recorded with its title card.
// usage: node tests/duel/ui-v63.mjs http://localhost:8787 [outdir]
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


const shot = process.env.SHOT;
async function menu(f, page, code, re) {
  const idx = await f.evaluate((code) => window.__duel.packet.state.teams[window.__duel.team].hand.findIndex((h) => Number(h.code) === code), code);
  if (idx < 0) fail("card not in hand: " + code);
  await f.click(`#myHand .card:nth-child(${idx + 1})`, { force: true });
  await page.waitForTimeout(300);
  let hit = false;
  for (const b of await f.$$("#menu button")) { if (re.test(await b.textContent())) { await b.click(); hit = true; break; } }
  if (!hit) fail("no menu entry " + re + " for " + code);
  await page.waitForTimeout(500);
}
const settle = async (f, page) => { for (let i = 0; i < 8; i++) { const z = await f.$(".zone.free"); if (z) { await z.click({ force: true }); await page.waitForTimeout(350); continue; } const pk = await f.$("#sheetBody .card"); if (pk && await pk.isVisible() && !(await f.$("#sheetBody .picked, #sheetBody .sel, #sheetBody [aria-pressed=true]"))) { await pk.click({ force: true }); await page.waitForTimeout(350); } const go = await f.$("#sheetActions .btn.primary:not([disabled])"); if (go && await go.isVisible()) { await go.click(); await page.waitForTimeout(350); continue; } break; } };
for (const [w, h, tag] of [[412, 915, "p"], [915, 412, "l"]]) {
  const { page, f } = await open(w, h);
  // ----- the opening: coin toss, both players, who goes first; a tap skips it -----
  await f.evaluate(() => localStorage.setItem("duel:opening:test", "true"));
  start.opening = async (f, page) => {
    await f.waitForSelector("#opening .coin", { timeout: 20000 }).catch(() => fail("no coin toss before the duel"));
    await f.waitForSelector("#opening.show-line", { timeout: 6000 }).catch(() => fail("the showcase did not reach 'goes first'"));
    const o = await f.evaluate(() => { const o = document.querySelector("#opening"), r = (e) => e.getBoundingClientRect(); const pl = [...o.querySelectorAll(".op-pl")].map((p) => ({ in: r(p).left >= -1 && r(p).right <= innerWidth + 1, first: p.classList.contains("first"), nm: p.querySelector(".op-nm").textContent })); return { pl, line: o.querySelector(".op-line b").textContent, table: !document.querySelector("#table").hidden, hand: document.querySelectorAll("#myHand .card").length }; });
    ok(o.pl.length === 2 && o.pl.every((p) => p.in) && o.pl.filter((p) => p.first).length === 1 && /first/i.test(o.line), "opening: both players on screen, one goes first " + JSON.stringify(o));
    ok(o.hand === 0, "the duel waits behind the opening");
    if (shot) await page.screenshot({ path: `${out}/v64-opening-${tag}.png` });
    await f.click("#opening"); await page.waitForTimeout(600);
    ok(!(await f.$("#opening")), "a tap skips the opening");
  };
  await start(f, page);
  await f.evaluate(() => localStorage.removeItem("duel:opening:test"));
  // ----- the chain button: always there, three settings, mirrored in Settings -----
  const cb = await f.evaluate(() => { const b = document.querySelector("#chainBtn"), r = b.getBoundingClientRect(), q = document.querySelector("#quickBtn").getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const ph = [...document.querySelectorAll("#phases button")].map((x) => x.getBoundingClientRect()); return { vis: r.width > 30 && r.height >= 24 && r.left >= 0 && r.right <= innerWidth, top: !!(hit && hit.closest("#chainBtn")), clearQ: r.right <= q.left + 1 || r.left >= q.right - 1 || r.bottom <= q.top || r.top >= q.bottom, clearP: ph.every((p) => r.right <= p.left + 1 || r.left >= p.right - 1 || r.bottom <= p.top + 1 || r.top >= p.bottom - 1), t: b.textContent.trim() }; });
  ok(cb.vis && cb.top && cb.clearQ && cb.clearP && cb.t === "ALL", `chain button on screen, clear of the phases and the flag (${tag}) ` + JSON.stringify(cb));
  const modes = [];
  for (let i = 0; i < 3; i++) { await f.click("#chainBtn"); await page.waitForTimeout(150); modes.push(await f.evaluate(() => [document.querySelector("#chainBtn").dataset.mode, document.querySelector("#chainMode").value, window.__duel.chainMode].join("/"))); }
  ok(modes.join(" ") === "smart/smart/smart off/off/off all/all/all", "chain button cycles Less, Off, All and Settings follows " + modes.join(" "));
  // ----- status effects: Marshmallon protects itself, Axe of Despair changes its ATK -----
  await menu(f, page, MARSH, /Summon/); await settle(f, page);
  await f.waitForFunction((c) => window.__duel.packet.state.teams[window.__duel.team].mzone.some((x) => x && x.code === c), MARSH, { timeout: 15000 }).catch(() => fail("Marshmallon was not summoned"));
  await page.waitForTimeout(900);
  await menu(f, page, AXE, /^Activate/); await settle(f, page);
  await f.waitForFunction((c) => window.__duel.packet.state.teams[window.__duel.team].mzone.some((x) => x && x.fx && x.fx.some((v) => v.k === "atk" && v.by === c)), AXE, { timeout: 15000 }).catch(async () => { await page.screenshot({ path: `${out}/v64-dbg.png` }); console.log(await f.evaluate(() => JSON.stringify({ mz: window.__duel.packet.state.teams[window.__duel.team].mzone, sz: window.__duel.packet.state.teams[window.__duel.team].szone.map((c) => c && c.code), pr: window.__duel.packet.prompt && window.__duel.packet.prompt.type }))); fail("no ATK status from Axe of Despair"); });
  await page.waitForTimeout(700);
  await f.click("#myField .zone.mz.filled .card, .zone.me.mz.filled .card", { force: true }); await page.waitForTimeout(500);
  const st = await f.evaluate(() => { const b = document.querySelector("#infoBody .info-status"); if (!b) return null; return { rows: [...b.querySelectorAll(".is-row")].map((r) => r.textContent), src: [...b.querySelectorAll(".is-src:not(:disabled)")].map((x) => x.textContent) }; });
  ok(st && st.rows.some((r) => /Cannot be destroyed by battle.*its own effect/.test(r)) && st.rows.some((r) => /ATK is changed.*Axe of Despair/.test(r)) && st.src.includes("Axe of Despair"), "card details: status effects with their source " + JSON.stringify(st));
  if (shot) await page.screenshot({ path: `${out}/v64-status-${tag}.png` });
  await f.evaluate(() => { const s = [...document.querySelectorAll(".is-src:not(:disabled)")][0]; s.click(); }); await page.waitForTimeout(400);
  ok(await f.evaluate(() => /Axe of Despair/.test(document.querySelector("#infoBody .info-name").textContent)), "tapping the source opens that card");
  await f.evaluate(() => { const c = document.querySelector("#info .close, #infoClose"); if (c) c.click(); }); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  // ----- an effect tosses a coin -----
  await menu(f, page, CUP, /^Activate/); await settle(f, page);
  await f.waitForSelector("#tossFx .toss.coin .coin", { timeout: 15000 }).catch(() => fail("no coin toss animation for Cup of Ace"));
  await f.waitForSelector("#tossFx .toss.landed", { timeout: 5000 }).catch(() => fail("the coin did not land"));
  const ts = await f.evaluate(() => document.querySelector("#tossFx .toss-cap b").textContent);
  ok(/^(Heads|Tails)$/.test(ts), "coin toss shows its result: " + ts);
  if (shot) await page.screenshot({ path: `${out}/v64-coin-${tag}.png` });
  await f.waitForFunction(() => !document.querySelector("#tossFx .toss"), null, { timeout: 6000 }).catch(() => fail("the coin stayed on screen"));
  if (tag === "p") {
    // dice use the same stage
    await f.evaluate(() => window.__arena.tossShow("dice", [5, 2], "Kasuteru")); await page.waitForTimeout(1500);
    ok(await f.evaluate(() => document.querySelectorAll("#tossFx .die").length === 2 && document.querySelectorAll("#tossFx .die i.on").length === 7), "dice show their pips");
    if (shot) await page.screenshot({ path: `${out}/v64-dice.png` });
    await page.waitForTimeout(1800);
    // ----- showdowns: animation, card name and line stay; the showdown's own name is gone -----
    await activate(f, page, POT);
    await f.waitForSelector(".cf, .cardfx, [class^=cf-]", { timeout: 8000 }).catch(() => fail("no showdown for the Ace card"));
    await page.waitForTimeout(900);
    const sd = await f.evaluate(() => ({ word: [...document.querySelectorAll(".cf-word2, .cf-cutout")].map((e) => e.textContent), text: document.body.innerText.includes("TIME STOP"), dial: !!document.querySelector(".cf-ts-dial"), name: /Pot of Greed/i.test(document.body.innerText) }));
    ok(!sd.word.length && !sd.text && sd.dial && sd.name, "showdown: no printed title, the animation and the card name stay " + JSON.stringify(sd));
    if (shot) await page.screenshot({ path: `${out}/v64-showdown.png` });
  }
  await page.close();
}
if (errors.length) fail("page errors");
console.log("OK: v64");
await browser.close();
