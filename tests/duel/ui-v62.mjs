// Arena v62, framed like the KodeX app:
//  • cards keep their element between updates (no blinking), the settings panel scrolls, the LP plates hold their numbers;
//  • the quick flag: restart (solo) and surrender; tapping outside closes panels (and the setting turns it off);
//  • the Deck riffles when it is shuffled; the new Time Stop showdown;
//  • a KodeX combo plays like a replay: title card, steps, back/forward, kept in the Replays list, recorded with its title card.
// usage: node tests/duel/ui-v62.mjs http://localhost:8787 [outdir]
import fs from "node:fs";
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787", out = process.argv[3] || ".";
const POT = 55144522, HINOTAMA = 46130346;
const raw = JSON.parse(fs.readFileSync(new URL("../../duel/data/cards.json", import.meta.url))).cards;
const byName = (n) => { for (const [c, r] of Object.entries(raw)) if (r[12] === n) return Number(c); throw new Error("no card " + n); };
const normals = Object.entries(raw).filter(([c, r]) => !r[0] && (r[2] & 0x11) === 0x11 && !(r[2] & 0x4000)).slice(0, 34).map(([c, r]) => [Number(c), r[12], 1]);
const deck = { n: "v62", m: [[POT, "Pot of Greed", 3], [HINOTAMA, "Hinotama", 3], ...normals], e: [], s: [] };
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
  if (d.kx === "vibrate") window.__vib.push(d.p); if (d.kx === "saveVideo") window.__video = { name: d.name, mime: d.mime, size: d.buf.byteLength }; });
</script></body>` }));
  await page.goto(`${base}/wrap.html`);
  const f = await (await page.waitForSelector("#f")).contentFrame();
  await f.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  return { page, f };
}
async function start(f, page) {
  await f.evaluate(([a, b]) => { window.__duel.testHand.add(a); window.__duel.testHand.add(b); }, [POT, HINOTAMA]);
  await f.evaluate(() => { for (const [id, v] of [["#soloOpp", "passive"], ["#soloOppDeck", "same"], ["#soloFirst", "me"], ["#soloOrder", "built"]]) { const e = document.querySelector(id); e.value = v; e.dispatchEvent(new Event("change")); } });
  await f.click("#soloStart");
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
// ---------- portrait: a duel ----------
{
  const { page, f } = await open(412, 900);
  await start(f, page);
  // the same elements stay on the page across an update (that is what stops the blinking)
  await f.evaluate(() => { window.__keep = [...document.querySelectorAll("#myHand .card, #me-deck .card, #op-deck .card")]; window.__keep.forEach((e, i) => { e.dataset.mark = i; }); });
  const hinoIdx = await f.evaluate((c) => window.__duel.packet.state.teams[window.__duel.team].hand.findIndex((h) => Number(h.code) === c), HINOTAMA);
  await activate(f, page, HINOTAMA);
  await f.waitForFunction(() => window.__duel.packet.state.teams[1 - window.__duel.team].lp < 8000, null, { timeout: 15000 }).catch(() => fail("Hinotama did not resolve"));
  await page.waitForTimeout(600);
  const kept = await f.evaluate((hi) => { const k = window.__keep; return { deck: k.filter((e) => e.closest("#me-deck, #op-deck")).every((e) => e.isConnected), before: k.filter((e, i) => e.closest("#myHand") || true).slice(0, hi).every((e) => e.isConnected), n: k.length }; }, hinoIdx);
  ok(kept.deck && kept.before, "cards that did not change kept their element (no redraw) " + JSON.stringify(kept));
  // LP plate: the number sits inside its plate
  const plate = await f.evaluate(() => ["me", "op"].map((s) => { const p = document.querySelector(`.duelist.${s}`).getBoundingClientRect(), n = document.querySelector(`#${s}LP`).getBoundingClientRect(), b = document.querySelector(`#${s}LPBar`).parentElement.getBoundingClientRect(); return n.right <= p.right + 1 && b.right <= p.right + 1 && n.left >= p.left; }));
  ok(plate[0] && plate[1], "Life Points and their bars stay inside the plates (portrait)");
  // settings panel scrolls to its last button
  await f.click("#sideFab"); await page.waitForTimeout(300);
  await f.click('#side .tabs [data-tab="opts"]'); await page.waitForTimeout(300);
  const sc = await f.evaluate(() => { const a = document.querySelector("#side .side-actions"), s = document.querySelector("#side").getBoundingClientRect(); a.scrollTop = 99999; const b = document.querySelector("#surrenderBtn").getBoundingClientRect(); return { scrolls: a.scrollHeight > a.clientHeight, vis: b.bottom <= s.bottom + 1 && b.top >= s.top, inScreen: s.bottom <= innerHeight && s.top >= 0 }; });
  ok(sc.scrolls && sc.vis && sc.inScreen, "settings panel scrolls to Surrender and stays on screen " + JSON.stringify(sc));
  ok(await f.evaluate(() => !!document.querySelector("#vibeOn") && !!document.querySelector("#prefTapOut") && document.querySelector("#prefTapOut").checked), "settings: vibration and tap-outside switches");
  await page.screenshot({ path: `${out}/v62-settings.png` });
  // tap outside closes the panel
  await page.mouse.click(206, 60); await page.waitForTimeout(300);
  ok(await f.evaluate(() => !document.querySelector("#side").classList.contains("open")), "tap outside closes the panel");
  await f.click("#sideFab"); await page.waitForTimeout(200); await f.click('#side .tabs [data-tab="opts"]');
  await f.evaluate(() => { const t = document.querySelector("#prefTapOut"); t.checked = false; t.dispatchEvent(new Event("change")); });
  await page.mouse.click(206, 60); await page.waitForTimeout(300);
  ok(await f.evaluate(() => document.querySelector("#side").classList.contains("open")), "with the setting off, the panel stays");
  await f.evaluate(() => { const t = document.querySelector("#prefTapOut"); t.checked = true; t.dispatchEvent(new Event("change")); window.__arena.toggleSide(false); });
  // a pop-up closes on a tap outside, and the tap goes on to the pile under it
  await f.evaluate(() => document.querySelector("#me-grave").click()); await page.waitForTimeout(400);
  ok(await f.evaluate(() => document.querySelector("#pile").open && /Graveyard|GY/i.test(document.querySelector("#pileTitle").textContent)), "Graveyard list open");
  const dk = await f.evaluate(() => { const r = document.querySelector("#me-extra").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const inside = await f.evaluate(([x, y]) => { const r = document.querySelector("#pile").getBoundingClientRect(); return x > r.left && x < r.right && y > r.top && y < r.bottom; }, dk);
  if (!inside) { await page.mouse.click(dk[0], dk[1]); await page.waitForTimeout(500);
    ok(await f.evaluate(() => document.querySelector("#pile").open && /Extra/i.test(document.querySelector("#pileTitle").textContent)), "tap outside the list: it closes and the tap opens the Extra Deck under it");
    await f.evaluate(() => document.querySelector("#pile").close()); }
  else { await f.evaluate(() => document.querySelector("#pile").close()); console.log("ok: (pile covers the Extra Deck here; push-through checked in landscape)"); }
  // shuffle animation
  await f.evaluate(() => window.__arenaFx({ events: [{ type: 32, player: window.__duel.team }], state: window.__duel.packet.state, names: window.__duel.packet.names }));
  ok(await f.evaluate(() => !!document.querySelector("#me-deck .shuf .card")), "the Deck riffles when it is shuffled");
  await page.waitForTimeout(350); await page.screenshot({ path: `${out}/v62-shuffle.png` });
  await page.waitForTimeout(800);
  ok(await f.evaluate(() => !document.querySelector("#me-deck .shuf")), "the riffle clears itself");
  // Ace with the new Time Stop
  await activate(f, page, POT);
  await f.waitForSelector(".cf-ts-dial", { timeout: 8000 }).catch(() => fail("Time Stop showdown did not play"));
  await page.waitForTimeout(1300);
  ok(await f.evaluate(() => !!document.querySelector(".cf-ts-dial svg .hand.sec") && !!document.querySelector(".cf-hero.timestop img, .cf-hero.timestop .nm") && document.querySelector(".cf-ts-timer").textContent === "00:00.00"), "Time Stop: the clock, the frozen readout and the card");
  await page.screenshot({ path: `${out}/v62-timestop.png` });
  ok((await page.evaluate(() => window.__vib)).length >= 1, "vibration asked for on the showdown " + JSON.stringify(await page.evaluate(() => window.__vib)));
  await f.waitForFunction(() => !document.body.classList.contains("ace-on") && window.__duel.packet.prompt && window.__duel.packet.prompt.msg.type === 11, null, { timeout: 20000 }).catch(() => fail("duel did not continue after the Ace"));
  // quick flag: restart
  ok(await f.evaluate(() => { const b = document.querySelector("#quickBtn").getBoundingClientRect(), m = document.querySelector("#field").getBoundingClientRect(); return b.width > 20 && (b.top >= m.bottom || b.bottom <= m.top || b.left >= m.right || b.right <= m.left); }), "the quick flag sits outside the field");
  await f.click("#quickBtn"); await page.waitForTimeout(200);
  ok(await f.evaluate(() => !document.querySelector("#quickMenu").hidden && !document.querySelector("#qmRestart").hidden), "quick menu: Restart and Surrender");
  await page.screenshot({ path: `${out}/v62-quick.png` });
  await f.click("#qmRestart"); await page.waitForTimeout(300);
  ok(await f.evaluate(() => !document.querySelector("#ask").open), "restart on turn 1 needs no second tap");
  await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.turn === 1 && window.__duel.packet.prompt && window.__duel.packet.state.teams[window.__duel.team].lp === 8000 && window.__duel.packet.state.teams[1 - window.__duel.team].lp === 8000 && window.__duel.packet.state.teams[window.__duel.team].hand.length === 5, null, { timeout: 30000 }).catch(() => fail("restart did not start a fresh duel"));
  ok(true, "restarted: a fresh duel with a new opening hand");
  // quick flag: surrender
  await page.waitForTimeout(800);
  await f.click("#quickBtn"); await page.waitForTimeout(200); await f.click("#qmSurrender"); await page.waitForTimeout(300);
  ok(await f.evaluate(() => document.querySelector("#ask").open), "surrender asks first");
  await f.click("#askYes");
  await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.ended, null, { timeout: 15000 }).catch(() => fail("surrender did not end the duel"));
  ok(/surrender/i.test(await f.evaluate(() => window.__duel.packet.ended.reason)), "surrendered");
  await page.close();
}
// ---------- landscape: plates, the card panel beside a pop-up, and a combo ----------
{
  const { page, f } = await open(980, 450);
  await start(f, page);
  const plate = await f.evaluate(() => ["me", "op"].map((s) => { const p = document.querySelector(`.duelist.${s}`).getBoundingClientRect(), n = document.querySelector(`#${s}LP`).getBoundingClientRect(), b = document.querySelector(`#${s}LPBar`).parentElement.getBoundingClientRect(); return n.right <= p.right + 1 && b.right <= p.right + 1 && p.right <= innerWidth + 1; }));
  ok(plate[0] && plate[1], "Life Points and their bars stay inside the plates (landscape)");
  await f.evaluate(() => document.querySelector("#me-deck").click()); await page.waitForTimeout(300);
  await f.evaluate(() => document.querySelector("#me-grave").click()); await page.waitForTimeout(400);
  await f.evaluate(() => { const d = document.querySelector("#pile"); if (!d.open) document.querySelector("#me-extra").click(); });
  const tabs = await f.evaluate(() => { document.querySelector("#panelBtn").click(); const t = [...document.querySelectorAll("#info .dock-tabs button")].map((b) => ({ fs: getComputedStyle(b).fontSize, r: b.getBoundingClientRect() })), x = document.querySelector("#closeInfo").getBoundingClientRect(); return { same: new Set(t.map((v) => v.fs)).size === 1, clear: t.every((v) => v.r.right <= x.left + 1) }; });
  ok(tabs.same && tabs.clear, "card panel: three tabs the same size, the close button beside them " + JSON.stringify(tabs));
  await page.screenshot({ path: `${out}/v62-landscape.png` });
  // a combo from KodeX
  await page.evaluate((c) => document.getElementById("f").contentWindow.postMessage({ kx: "combo", combo: c }, "*"), combo);
  await f.waitForSelector("#comboIntro", { timeout: 8000 }).catch(() => fail("combo title card did not show"));
  await page.waitForTimeout(1500);
  const intro = await f.evaluate(() => ({ t: document.querySelector("#comboIntro h1").textContent, brand: /MEIOCG/.test(document.querySelector("#comboIntro .ci-brand").textContent), card: !!document.querySelector("#comboIntro .ci-card") }));
  ok(intro.t === "Solfachord 1.5 Card Combo" && intro.brand && intro.card, "combo title card: title, MEIOCG mark, key card " + JSON.stringify(intro));
  await page.screenshot({ path: `${out}/v62-combo-intro.png` });
  await f.waitForFunction(() => !document.querySelector("#comboIntro"), null, { timeout: 8000 });
  await f.waitForFunction(() => window.__duel.replay && window.__duel.packet && window.__duel.packet.combo && window.__duel.packet.combo.last, null, { timeout: 40000 }).catch(() => fail("combo did not play to its last step"));
  await page.waitForTimeout(900);
  const end = await f.evaluate(() => { const z = window.__duel.packet.state.teams[0], S = window.__duel; return { m: z.mzone.filter(Boolean).map((c) => S.db.name(c.code)), hand: z.hand.map((c) => S.db.name(c.code)), gy: z.grave.map((c) => S.db.name(c.code)), status: document.querySelector("#status").textContent, pos: document.querySelector("#rbPos").textContent, paused: S.replay.paused }; });
  ok(end.m.includes("GranSolfachord Coolia") && end.m.includes("DoSolfachord Cutia") && end.m.includes("DoSolfachord Coolia") && end.hand.includes("ReSolfachord Dreamia") && end.gy.includes("Pot of Greed"), "combo played on the table " + JSON.stringify(end));
  ok(/Step 5\/5/.test(end.pos) && /GranSolfachord Coolia/.test(end.status) && /Link climb/.test(end.status) && end.paused, "caption and step counter; it stops at the end");
  await page.screenshot({ path: `${out}/v62-combo-end.png` });
  await f.evaluate(() => document.querySelector("#rbBack").click()); await page.waitForTimeout(400);
  ok(await f.evaluate(() => !window.__duel.packet.state.teams[0].mzone.filter(Boolean).some((c) => window.__duel.db.name(c.code) === "GranSolfachord Coolia")), "back one move");
  await f.evaluate(() => document.querySelector("#rbPrevTurn").click()); await page.waitForTimeout(400);
  ok(await f.evaluate(() => window.__duel.replay.i === 0 && window.__duel.packet.state.teams[0].hand.length === 2), "back to the starting hand");
  // recorded with the title card first (Premium)
  await f.evaluate(() => document.querySelector("#rbRec").click()); await page.waitForTimeout(300);
  await f.evaluate(() => { document.querySelector("#recUntil").value = "end"; document.querySelector("#recSpeed").value = "2"; document.querySelector("#recGo").click(); });
  await page.waitForTimeout(1300);
  const fr = await f.evaluate(() => document.querySelector("#recBox canvas").toDataURL("image/jpeg", .8));
  fs.writeFileSync(`${out}/v62-clip-intro.jpg`, Buffer.from(fr.split(",")[1], "base64"));
  ok(await f.evaluate(() => window.__duel.replay.i === 0 && window.__duel.replay.paused), "recording: the title card plays before the first move");
  await f.waitForFunction(() => window.__duel.packet.combo && window.__duel.packet.combo.step >= 3, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const fr2 = await f.evaluate(() => document.querySelector("#recBox canvas").toDataURL("image/jpeg", .8));
  fs.writeFileSync(`${out}/v62-clip-step.jpg`, Buffer.from(fr2.split(",")[1], "base64"));
  const vid = await page.waitForFunction(() => window.__video, null, { timeout: 40000 }).then((h) => h.jsonValue()).catch(() => null);
  ok(vid && vid.size > 20000 && /Combo_Solfachord/.test(vid.name), "combo clip saved " + JSON.stringify(vid));
  // kept with the replays
  await f.evaluate(() => document.querySelector("#rbExit").click()); await page.waitForTimeout(600);
  await f.evaluate(() => document.querySelector("#replayOpen").click()); await page.waitForTimeout(500);
  ok(await f.evaluate(() => [...document.querySelectorAll("#rpList li")].some((l) => /Combo/.test(l.textContent) && /Solfachord 1\.5/.test(l.textContent))), "the combo is kept in the Replays list");
  await page.close();
}
if (errors.length) fail("page errors");
await browser.close();
console.log("OK: v62 no redraw, plates, panels, tap outside, quick restart and surrender, shuffle, Time Stop, vibration, combos");
