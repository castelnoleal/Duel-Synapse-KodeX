// Arena v60, in a real duel framed like the KodeX app:
//  • playtest settings: deck order, a turn timer (red under 1:30, lose at 0), match mode (best of 3);
//  • revealed cards show in a small glowing strip that leaves after the chosen time (no dialog);
//  • an Ace card's showdown plays before anything else in its packet and nothing covers it;
//  • the end: the loser's profile icon cracks and shatters, a comeback gets its moment, then the result with the
//    winner's profile, finishing card and "Winner via Comeback".
// usage: node tests/duel/ui-v60.mjs http://localhost:8787 [outdir]
import fs from "node:fs";
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787", out = process.argv[3] || ".";
const POT = 55144522, HINOTAMA = 46130346;
const cards = JSON.parse(fs.readFileSync(new URL("../../duel/data/cards.json", import.meta.url))).cards;
const normals = Object.entries(cards).filter(([c, r]) => !r[0] && (r[2] & 0x11) === 0x11 && !(r[2] & 0x4000)).slice(0, 34).map(([c, r]) => [Number(c), r[12], 1]);
const deck = { n: "v60", m: [[POT, "Pot of Greed", 3], [HINOTAMA, "Hinotama", 3], ...normals], e: [], s: [] };
const payload = Buffer.from(JSON.stringify(deck)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
await page.route(`${base}/wrap.html`, (r) => r.fulfill({ contentType: "text/html", body: `<!doctype html><body style="margin:0"><iframe id="f" src="${base}/duel/?app=1&embed=1#deck=${payload}" style="border:0;width:100vw;height:100vh"></iframe><script>
addEventListener("message", (e) => { if (e.data && e.data.kx === "ready") { const w = document.getElementById("f").contentWindow;
  w.postMessage({ kx: "skin", premium: true, signature: [${POT}], aces: [${POT}], aceStyle: "menacing", finale: "domain", finaleMs: 3000, showFx: {} }, "*");
  w.postMessage({ kx: "profile", p: { name: "Kasuteru Kun", title: "Solfachord main", icon: "crown", frame: "premium", theme: "aurora", premium: true, tier: "gold", stats: { points: 900, days: 20, duels: 30, wins: 18 } } }, "*"); } });
</script></body>` }));
await page.goto(`${base}/wrap.html`);
const f = await (await page.waitForSelector("#f")).contentFrame();
const fail = (m) => { console.error("FAIL:", m, errors); process.exit(1); };
const ok = (c, m) => { if (!c) fail(m); console.log("ok:", m); };
await f.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
await page.waitForTimeout(800);
// settings: reveal time 0.5 s; playtest: as built, 1 min timer, match
await f.evaluate(() => { const t = document.querySelector("#prefFxMs"); t.value = "500"; t.dispatchEvent(new Event("change")); });
await f.evaluate(() => document.querySelector(".pt-opts").open = true);
await f.selectOption("#soloOrder", "built"); await f.selectOption("#soloTimer", "60"); await f.check("#soloMatch");
ok(/No shuffle/.test(await f.textContent("#ptSummary")) && /Best of 3/.test(await f.textContent("#ptSummary")), "playtest summary");
await page.screenshot({ path: `${out}/v60-lobby.png` });
await f.evaluate(([a, b]) => { window.__duel.testHand.add(a); window.__duel.testHand.add(b); }, [POT, HINOTAMA]);
await f.evaluate(() => { const l = document.querySelector("#optLP"); l.value = "500"; l.dispatchEvent(new Event("change")); });
await f.evaluate(() => { for (const [id, v] of [["#soloOpp", "passive"], ["#soloOppDeck", "same"], ["#soloFirst", "me"]]) { const e = document.querySelector(id); e.value = v; e.dispatchEvent(new Event("change")); } });
await f.click("#soloStart");
await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.prompt && window.__duel.packet.waitingFor === window.__duel.team, null, { timeout: 60000 });
await page.waitForTimeout(2200);
const tm = await f.evaluate(() => ({ shown: !document.querySelector("#turnTimer").hidden, t: document.querySelector("#turnTimer").textContent, alert: document.body.classList.contains("timer-alert") }));
ok(tm.shown && /^0:5\d$/.test(tm.t) && tm.alert, "turn timer runs, red alert under 1:30 " + JSON.stringify(tm));
// reveal strip
await f.evaluate((c) => window.__arena.showReveal([{ player: 1, cards: [{ code: c, controller: 1, location: 2, sequence: 0 }] }], window.__duel.packet), HINOTAMA);
ok(await f.evaluate(() => !!document.querySelector(".rv-strip") && !document.querySelector("#reveal").open), "revealed card in the small strip, no dialog");
await page.screenshot({ path: `${out}/v60-reveal.png` });
await page.waitForTimeout(1200);
ok(await f.evaluate(() => !document.querySelector(".rv-strip")), "reveal leaves on its own after the chosen time");
async function activate(code) {
  const idx = await f.evaluate((code) => window.__duel.packet.state.teams[window.__duel.team].hand.findIndex((h) => Number(h.code) === code), code);
  if (idx < 0) fail("card not in hand: " + code);
  await f.click(`#myHand .card:nth-child(${idx + 1})`, { force: true });
  await page.waitForTimeout(300);
  for (const b of await f.$$("#menu button")) { if (/^Activate/.test(await b.textContent())) { await b.click(); break; } }
  await page.waitForTimeout(400);
  const z = await f.$(".zone.free");
  if (z) { await z.click({ force: true }); await page.waitForTimeout(200); const go = await f.$("#sheetActions .btn.primary:not([disabled])"); if (go && await go.isVisible()) await go.click(); }
}
// Ace: plays first, nothing covers it
await activate(POT);
const ace = await f.waitForFunction(() => { const t = document.querySelector(".cf-ace-tag"); if (!t) return null;
  const vis = (s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).visibility !== "hidden" && !!e.children.length; };
  return { on: document.body.classList.contains("ace-on"), chain: vis("#chainFx"), toast: document.querySelector("#toast").classList.contains("on") && getComputedStyle(document.querySelector("#toast")).visibility !== "hidden" }; }, null, { timeout: 8000 }).then((h) => h.jsonValue()).catch(() => null);
ok(ace && ace.on && !ace.chain && !ace.toast, "Ace showdown alone on screen " + JSON.stringify(ace));
await page.screenshot({ path: `${out}/v60-ace.png` });
await f.waitForFunction(() => !document.body.classList.contains("ace-on") && window.__duel.packet.prompt && window.__duel.packet.waitingFor === window.__duel.team && window.__duel.packet.prompt.msg.type === 11, null, { timeout: 20000 }).catch(() => fail("duel did not continue after the Ace"));
// comeback win: mark me as having been far behind, then burn for the win
await f.evaluate(() => { window.__duel.behind = [true, true]; });
await activate(HINOTAMA);
const brk = await f.waitForFunction(() => document.querySelector("#endFx .ef-pf") ? { result: !document.querySelector("#result").hidden } : null, null, { timeout: 20000 }).then((h) => h.jsonValue()).catch(() => null);
ok(brk && !brk.result, "loser's profile icon breaks before the result");
await page.waitForTimeout(900); await page.screenshot({ path: `${out}/v60-break.png` });
const cb = await f.waitForFunction(() => document.querySelector("#endFx .ef-cb") ? { result: !document.querySelector("#result").hidden } : null, null, { timeout: 10000 }).then((h) => h.jsonValue()).catch(() => null);
ok(cb && !cb.result, "comeback moment before the result");
await page.screenshot({ path: `${out}/v60-comeback.png` });
await f.waitForFunction(() => !document.querySelector("#result").hidden, null, { timeout: 10000 });
await page.waitForTimeout(400);
const res = await f.evaluate(() => ({ title: document.querySelector("#resultTitle").textContent, who: document.querySelector("#resultWinner").textContent, fin: !!document.querySelector("#resultWinner .rw-fin img, #resultWinner .rw-fin .nm"), match: document.querySelector("#resultMatch").textContent, next: document.querySelector("#rematchBtn").textContent }));
ok(res.title === "You win" && /Kasuteru Kun/.test(res.who) && /Winner via Comeback/.test(res.who) && res.fin, "winner screen: profile, finishing card, comeback " + JSON.stringify(res));
ok(/Match 1–0/.test(res.match) && /Game 2/.test(res.next), "match score and next duel " + JSON.stringify(res));
await page.screenshot({ path: `${out}/v60-result.png` });
// game 2: the timer runs out
await f.click("#rematchBtn");
await f.waitForFunction(() => window.__duel.packet && !window.__duel.packet.ended && window.__duel.packet.prompt, null, { timeout: 30000 });
await page.waitForTimeout(1500);
await f.evaluate(() => { window.__duel.timerLeft = 2; });
await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.ended, null, { timeout: 15000 }).catch(() => fail("timer did not end the duel"));
const t2 = await f.evaluate(() => window.__duel.packet.ended);
ok(/ran out of time/.test(t2.reason), "losing on time " + JSON.stringify(t2));
if (errors.length) fail("page errors");
await browser.close();
console.log("OK: v60 playtest settings, reveal strip, Ace first, profile break, comeback, winner screen, match, timer");
