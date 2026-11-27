// Arena v79: take back moves in a solo duel (Premium as often as you like; free in 3 duels a day), the duel menu
// (save a replay at any time; leave with a replay or a combo), and COMBO COMPLETE only after the finished board has
// been on screen for a few seconds.
// usage: node tests/duel/ui-v79.mjs http://localhost:8787 [outdir]
import fs from "node:fs";
import zlib from "node:zlib";
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787", out = process.argv[3] || ".";
const raw = JSON.parse(fs.readFileSync(new URL("../../duel/data/cards.json", import.meta.url))).cards;
const byName = (n) => { for (const [c, r] of Object.entries(raw)) if (r[12] === n) return Number(c); throw new Error("no card " + n); };
const normals = Object.entries(raw).filter(([c, r]) => !r[0] && (r[2] & 0x11) === 0x11 && !(r[2] & 0x4000)).slice(0, 40).map(([c, r]) => [Number(c), r[12], 1]);
const payload = Buffer.from(JSON.stringify({ n: "v79", m: normals, e: [], s: [] })).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const browser = await chromium.launch();
const errors = [];
const fail = (m) => { console.error("FAIL:", m, errors); process.exit(1); };
const ok = (c, m) => { if (!c) fail(m); console.log("ok:", m); };
async function open(premium, w = 412, h = 915) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
  await page.route(`${base}/wrap.html`, (r) => r.fulfill({ contentType: "text/html", body: `<!doctype html><body style="margin:0"><iframe id="f" src="${base}/duel/?app=1&embed=1#deck=${payload}" style="border:0;width:100vw;height:100vh"></iframe><script>
window.__msgs = [];
addEventListener("message", (e) => { const d = e.data || {}; window.__msgs.push(d.kx); if (d.kx === "ready") { const f = document.getElementById("f").contentWindow; f.postMessage({ kx: "host", app: true }, "*"); f.postMessage({ kx: "skin", premium: ${premium}, showFx: {} }, "*"); } });
</script></body>` }));
  await page.goto(`${base}/wrap.html`);
  const f = await (await page.waitForSelector("#f")).contentFrame();
  await f.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await f.evaluate(() => { localStorage.setItem("duel:pref", JSON.stringify({ opening: false })); for (const [id, v] of [["#soloOpp", "passive"], ["#soloOppDeck", "same"], ["#soloFirst", "me"]]) { const e = document.querySelector(id); if (e) { e.value = v; e.dispatchEvent(new Event("change")); } } });
  await f.click("#soloStart");
  await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.prompt && window.__duel.packet.waitingFor === window.__duel.team, null, { timeout: 60000 });
  await page.waitForTimeout(2600); await f.evaluate(() => document.querySelector("#opening")?.click()); await page.waitForTimeout(400);
  return { page, f };
}
/** Normal Summon the first monster in hand that can be summoned. */
async function summon(page, f) {
  const n0 = await f.evaluate(() => window.__duel.packet.state.teams[window.__duel.team].mzone.filter(Boolean).length);
  const act = await f.$("#myHand .card.act"); if (!act) fail("nothing to summon");
  await act.click();
  await f.waitForSelector("#menu:not([hidden])");
  const btns = await f.$$("#menu button"); let hit = false;
  for (const b of btns) if (/Normal Summon|Summon/.test(await b.textContent())) { await b.click(); hit = true; break; }
  if (!hit) await btns[0].click();
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(500);
    const n = await f.evaluate(() => window.__duel.packet.state.teams[window.__duel.team].mzone.filter(Boolean).length);
    if (n > n0 && await f.evaluate(() => window.__duel.packet.prompt && window.__duel.packet.prompt.msg.type === 11)) return true;
    if (await f.$(".zone.free")) await f.click(".zone.free");
    else if (await f.isVisible("#sheet")) { const t = await f.$("#sheetBody .card"); if (t) await t.click(); else { const b = await f.$("#sheetActions .btn.primary"); if (b) await b.click(); } }
  }
  return (await f.evaluate(() => window.__duel.packet.state.teams[window.__duel.team].mzone.filter(Boolean).length)) > n0;
}
const mons = (f) => f.evaluate(() => window.__duel.packet.state.teams[window.__duel.team].mzone.filter(Boolean).length);
const hand = (f) => f.evaluate(() => window.__duel.packet.state.teams[window.__duel.team].hand.length);

// ----- Premium: take back a summon, and go back to a chosen move
{
  const { page, f } = await open(true);
  ok(await f.isHidden("#undoBtn"), "no take-back before a move");
  const h0 = await hand(f);
  ok(await summon(page, f), "a monster is summoned");
  await page.waitForTimeout(1200);
  ok(await f.isVisible("#undoBtn"), "the take-back button shows after a move");
  const at = await f.evaluate(() => window.__duel.packet.at);
  ok(at > 0 && (await f.evaluate(() => window.__duel.moves.length)) === 1, "the move is remembered " + at);
  ok(await f.evaluate(() => !!window.__duel.moves[0].label), "with what it did: " + await f.evaluate(() => window.__duel.moves[0].label));
  await f.click("#undoBtn");
  await f.waitForFunction(() => !window.__duel.tbBusy && !window.__duel.tbNext, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  ok((await mons(f)) === 0 && (await hand(f)) === h0, "taken back: the monster is in the hand again");
  ok(await f.evaluate(() => window.__duel.packet.prompt && window.__duel.packet.prompt.msg.type === 11 && window.__duel.packet.at === 0), "and it is my move again");
  ok(await f.isHidden("#undoBtn"), "nothing left to take back");
  await page.screenshot({ path: `${out}/v79-undo.png` });
  // the duel goes on from there, and the replay keeps only the moves that stood
  ok(await summon(page, f), "a different line can be played");
  await page.waitForTimeout(900);
  await f.click("#quickBtn");
  ok(await f.isVisible("#qmUndo") && await f.isVisible("#qmSave"), "the flag's menu: take back moves and save replay");
  await page.screenshot({ path: `${out}/v79-menu.png` });
  await f.click("#qmUndo");
  ok(await f.isVisible("#movesDlg"), "the list of moves opens");
  const items = await f.$$eval("#movesList .mv", (b) => b.map((x) => x.textContent));
  ok(items.length === 1 && /Turn 1/.test(items[0]), "with each move " + JSON.stringify(items));
  await page.screenshot({ path: `${out}/v79-moves.png` });
  await f.click("#movesList .mv");
  await f.waitForFunction(() => !window.__duel.tbBusy && !window.__duel.tbNext, null, { timeout: 20000 });
  await page.waitForTimeout(500);
  ok((await mons(f)) === 0, "back to before it");
  // leave: save the replay first
  await summon(page, f); await page.waitForTimeout(700);
  await f.click("#quickBtn"); await f.click("#qmSurrender");
  ok(await f.isVisible("#leaveDlg") && await f.isVisible("#leaveCombo"), "leaving offers a replay or a combo");
  await page.screenshot({ path: `${out}/v79-leave.png` });
  await f.click("#leaveSave");
  await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.ended, null, { timeout: 20000 });
  await page.waitForTimeout(800);
  const rp = await f.evaluate(async () => { const req = indexedDB.open("arena-replays"); return await new Promise((res) => { req.onsuccess = () => { try { const t = req.result.transaction(req.result.objectStoreNames[0]).objectStore(req.result.objectStoreNames[0]).getAll(); t.onsuccess = () => res(t.result.map((r) => ({ how: r.how, size: r.size }))); } catch (e) { res(String(e)); } }; req.onerror = () => res("no db"); }); });
  ok(Array.isArray(rp) && rp.some((r) => r.how === "playtest" && r.size > 100), "the replay is kept " + JSON.stringify(rp));
  await f.waitForSelector("#result:not([hidden])", { timeout: 15000 }).catch(() => {});
  ok(await f.isVisible("#result") && await f.isVisible("#resultCombo"), "the result offers Make a combo");
  await page.close();
}
// ----- free: take-backs in 3 duels a day
{
  const { page, f } = await open(false);
  await f.evaluate(() => localStorage.setItem("duel:undo", JSON.stringify({ day: (() => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; })(), ids: ["a", "b"] })));
  await summon(page, f); await page.waitForTimeout(900);
  ok(/1 left today/.test(await f.getAttribute("#undoBtn", "title")), "free: it says how many are left");
  await f.click("#undoBtn");
  ok(await f.isVisible("#ask") && /1 of your 1/.test(await f.textContent("#askText")), "free: asks before spending one");
  await f.click("#askYes");
  await f.waitForFunction(() => !window.__duel.tbBusy && !window.__duel.tbNext, null, { timeout: 20000 });
  ok((await mons(f)) === 0, "free: taken back");
  await summon(page, f); await page.waitForTimeout(900);
  await f.click("#undoBtn");
  await page.waitForTimeout(400);
  ok(await f.isHidden("#ask"), "free: no second ask in the same duel");
  await f.waitForFunction(() => !window.__duel.tbBusy && !window.__duel.tbNext, null, { timeout: 20000 });
  ok((await mons(f)) === 0, "free: taken back again in the same duel");
  // a new duel: none left
  await f.evaluate(() => { const u = JSON.parse(localStorage.getItem("duel:undo")); u.ids.push("c"); localStorage.setItem("duel:undo", JSON.stringify(u)); window.__duel.duelId = "new"; });
  await summon(page, f); await page.waitForTimeout(900);
  await f.click("#undoBtn"); await page.waitForTimeout(500);
  ok(await f.isHidden("#ask") && (await mons(f)) === 1 && /No take-backs left today/.test(await f.evaluate(() => [...document.querySelectorAll(".toast")].map((t) => t.textContent).join(" "))), "free: none left after 3 duels");
  // free players can save the replay too
  await f.click("#quickBtn"); await f.click("#qmSave"); await page.waitForTimeout(800);
  ok(/Replay saved/.test(await f.evaluate(() => [...document.querySelectorAll(".toast")].map((t) => t.textContent).join(" "))), "free: Save replay keeps it");
  await page.close();
}
// ----- a combo: COMBO COMPLETE waits until the board has been on screen for a while
{
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
  await page.route(`${base}/wrap2.html`, (r) => r.fulfill({ contentType: "text/html", body: `<!doctype html><body style="margin:0"><iframe id="f" src="${base}/duel/?app=1&embed=1#deck=${payload}" style="border:0;width:100vw;height:100vh"></iframe><script>
addEventListener("message", (e) => { const d = e.data || {}; if (d.kx === "ready") document.getElementById("f").contentWindow.postMessage({ kx: "skin", premium: true, showFx: {} }, "*"); });</script></body>` }));
  await page.goto(`${base}/wrap2.html`);
  const f = await (await page.waitForSelector("#f")).contentFrame();
  await f.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  const CUTIA = byName("DoSolfachord Cutia"), HARM = byName("Solfachord Harmonia"), COOLIA = byName("DoSolfachord Coolia"), GRAN = byName("GranSolfachord Coolia");
  const combo = { id: "t79", title: "Solfachord", hand: [CUTIA], extra: [GRAN], fx: "lightning", lines: [[{ cards: [{ c: CUTIA, a: "ss" }] }, { cards: [{ c: HARM }] }, { cards: [{ c: COOLIA, a: "ss" }] }]], intro: { ms: 800, key: GRAN } };
  await page.evaluate((c) => document.getElementById("f").contentWindow.postMessage({ kx: "combo", combo: c, keep: false }, "*"), combo);
  await f.waitForFunction(() => window.__duel.packet?.combo?.last, null, { timeout: 60000 });
  const t0 = Date.now();
  await f.evaluate(() => { window.__fin = 0; const t = performance.now(); new MutationObserver(() => { const l = [...document.querySelectorAll(".cbfx-layer")].find((x) => x.dataset.finale === "1"); if (l && !window.__fin) window.__fin = performance.now() - t; }).observe(document.body, { childList: true, subtree: true }); window.__busyAt = []; const iv = setInterval(() => { if (window.__fin) clearInterval(iv); }, 50); });
  await f.waitForFunction(() => window.__fin > 0, null, { timeout: 20000 }).catch(() => fail("no COMBO COMPLETE"));
  const fin = await f.evaluate(() => window.__fin);
  ok(fin >= 2800, "COMBO COMPLETE waits until the board has been shown for a few seconds (" + Math.round(fin) + " ms)");
  await page.close();
}
// ----- a combo shared as a link plays in any browser
{
  const CUTIA = byName("DoSolfachord Cutia"), HARM = byName("Solfachord Harmonia"), COOLIA = byName("DoSolfachord Coolia");
  const c = { v: 1, id: "lnk", title: "Shared line", deck: "Solfachord", hand: [CUTIA], extra: [], lines: [[{ cards: [{ c: CUTIA, a: "ss" }] }, { cards: [{ c: HARM }] }, { cards: [{ c: COOLIA, a: "ss" }] }]], intro: { ms: 600, key: COOLIA, art: COOLIA }, speed: 2 };
  const z = "z" + zlib.deflateRawSync(Buffer.from(JSON.stringify(c))).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
  await page.goto(`${base}/duel/#combo=${z}`);
  await page.waitForFunction(() => window.__duel && window.__duel.packet && window.__duel.packet.combo, null, { timeout: 60000 }).catch(() => fail("the shared combo did not play"));
  ok(await page.evaluate(() => window.__duel.mode === "replay" && window.__duel.replay.combo.title === "Shared line" && window.__duel.replay.speed === 2), "a combo link plays the combo in the browser (" + z.length + " characters)");
  await page.goto(`${base}/duel/#combo=zNOTACOMBO`);
  await page.waitForTimeout(3000);
  ok(/could not be read/.test(await page.evaluate(() => [...document.querySelectorAll(".toast")].map((t) => t.textContent).join(" "))), "a broken link says so");
  await page.close();
}
ok(!errors.length, "no page errors " + errors.join(" | "));
await browser.close();
console.log("OK: v79");
