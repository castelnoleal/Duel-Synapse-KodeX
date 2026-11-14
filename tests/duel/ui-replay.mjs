// Replays: play a three-turn duel, save its replay (KodeX Premium), find it in the Replays list, watch it to the
// real winner (no "out of step"), go back a move and a turn, skip ahead a turn, use the slider, switch sides.
// usage: node tests/duel/ui-replay.mjs http://localhost:8787 [outdir]
import fs from "node:fs";
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787", out = process.argv[3] || ".";
const HINOTAMA = 46130346;
const cards = JSON.parse(fs.readFileSync(new URL("../../duel/data/cards.json", import.meta.url))).cards;
const normals = Object.entries(cards).filter(([c, r]) => !r[0] && (r[2] & 0x11) === 0x11 && !(r[2] & 0x4000)).slice(0, 34).map(([c, r]) => [Number(c), r[12], 1]);
const deck = { n: "Replay test", m: [[HINOTAMA, "Hinotama", 3], ...normals], e: [], s: [] };
const payload = Buffer.from(JSON.stringify(deck)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
await page.route(`${base}/wrap.html`, (r) => r.fulfill({ contentType: "text/html", body: `<!doctype html><body style="margin:0"><iframe id="f" src="${base}/duel/?app=1&embed=1#deck=${payload}" style="border:0;width:100vw;height:100vh"></iframe><script>
let saved=null;addEventListener("message", (e) => { if (e.data && e.data.kx === "ready") document.getElementById("f").contentWindow.postMessage({ kx: "skin", premium: true, showFx: {} }, "*"); if (e.data && e.data.kx === "save") window.__saved = e.data.name; if (e.data && e.data.kx === "saveVideo") window.__video = { name: e.data.name, mime: e.data.mime, size: e.data.buf.byteLength }; });
</script></body>` }));
await page.goto(`${base}/wrap.html`);
const f = await (await page.waitForSelector("#f")).contentFrame();
const fail = (m) => { console.error("FAIL:", m, errors); process.exit(1); };
const ok = (c, m) => { if (!c) fail(m); console.log("ok:", m); };
await f.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
await page.waitForTimeout(800);
await f.evaluate((c) => window.__duel.testHand.add(c), HINOTAMA);
await f.evaluate(() => { const l = document.querySelector("#optLP"); l.value = "1000"; l.dispatchEvent(new Event("change")); });
await f.evaluate(() => { for (const [id, v] of [["#soloOpp", "passive"], ["#soloOppDeck", "same"], ["#soloFirst", "me"], ["#soloOrder", "built"]]) { const e = document.querySelector(id); e.value = v; e.dispatchEvent(new Event("change")); } });
await f.click("#soloStart");
const myIdle = () => f.waitForFunction(() => { const p = window.__duel.packet; return p && p.prompt && p.waitingFor === window.__duel.team && p.prompt.msg.type === 11 && !document.body.classList.contains("ace-on"); }, null, { timeout: 60000 });
async function burn() {
  await myIdle(); await page.waitForTimeout(600);
  const idx = await f.evaluate((code) => window.__duel.packet.state.teams[window.__duel.team].hand.findIndex((h) => Number(h.code) === code), HINOTAMA);
  if (idx < 0) fail("no Hinotama in hand " + JSON.stringify(await f.evaluate(() => ({ team: window.__duel.team, turn: window.__duel.packet.turn, hands: window.__duel.packet.state.teams.map((t) => t.hand.map((h) => h.code)), opts: window.__duel.lastSolo && window.__duel.lastSolo.names }))));
  await f.click(`#myHand .card:nth-child(${idx + 1})`, { force: true }); await page.waitForTimeout(300);
  for (const b of await f.$$("#menu button")) if (/^Activate/.test(await b.textContent())) { await b.click(); break; }
  await page.waitForTimeout(400);
  const z = await f.$(".zone.free"); if (z) { await z.click({ force: true }); await page.waitForTimeout(200); const go = await f.$("#sheetActions .btn.primary:not([disabled])"); if (go && await go.isVisible()) await go.click(); }
}
async function endTurn() { await myIdle(); await page.waitForTimeout(500); await f.evaluate(() => { const b = document.querySelector('#phases button.go[data-k="EP"]') || [...document.querySelectorAll("#phases button.go")].pop(); b.click(); }); }
await burn(); await endTurn();
await burn();
await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.ended, null, { timeout: 60000 });
const live = await f.evaluate(() => ({ w: window.__duel.packet.ended.winner, turn: window.__duel.packet.turn }));
ok(live.turn >= 3, "a duel over " + live.turn + " turns");
await f.waitForFunction(() => !document.querySelector("#result").hidden, null, { timeout: 20000 });
await f.click("#resultReplay");
await page.waitForFunction(() => window.__saved, null, { timeout: 8000 }).catch(() => fail("replay not saved"));
await f.click("#leaveBtn");
await page.waitForTimeout(1200);
// Replays list
await f.evaluate(() => document.querySelector("#replayOpen").click());
await page.waitForTimeout(500);
const n = await f.evaluate(() => document.querySelectorAll("#rpList li:not(.empty)").length);
ok(n >= 1, "saved replay is in the Replays list (" + n + ")");
await page.screenshot({ path: `${out}/replay-list.png` });
// v65: a replay mapped out as a combo (the engine re-runs it out of sight; one turn's plays become the combo)
await page.evaluate(() => { addEventListener("message", (e) => { if (e.data && e.data.kx === "comboNew") window.__combo = e.data.combo; }); });
await f.evaluate(() => [...document.querySelectorAll("#rpList .rp-ac .btn")].find((b) => b.textContent === "Combo").click());
await f.waitForFunction(() => document.querySelector("#rpTurn").open, null, { timeout: 30000 }).catch(() => fail("turn picker did not open"));
const tl = await f.evaluate(() => [...document.querySelectorAll("#rpTurnList li")].map((l) => l.querySelector(".rp-t").textContent));
ok(tl.length >= 2 && /Turn 1/.test(tl[0]) && /1 play/.test(tl[0]), "turns with plays are listed " + JSON.stringify(tl));
await page.screenshot({ path: `${out}/replay-turns.png` });
await f.evaluate(() => document.querySelector("#rpTurnList .btn.primary").click());
const cb = await page.waitForFunction(() => window.__combo, null, { timeout: 8000 }).then((h) => h.jsonValue()).catch(() => fail("combo not sent to KodeX"));
ok(cb.hand.length === 5 && cb.hand.includes(HINOTAMA) && cb.lines.length === 1 && cb.lines[0][0].cards[0].c === HINOTAMA && cb.lines[0][0].cards[0].a === "act" && /Turn 1/.test(cb.title), "the turn as a combo: starting hand, Hinotama activated " + JSON.stringify(cb.lines) + " " + cb.title);
await page.waitForTimeout(500);
ok(await f.evaluate(() => !!document.querySelector("#rpList .rp-tag")), "the combo is also kept in the Replays list");
await f.evaluate(() => { const li = [...document.querySelectorAll("#rpList li")].find((l) => !l.querySelector(".rp-tag")); li.parentNode.prepend(li); });
await f.evaluate(() => document.querySelector("#rpList .btn.primary").click());
await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.ended, null, { timeout: 90000 });
const end = await f.evaluate(() => window.__duel.packet.ended);
ok(end.winner === live.w && !/out of step/.test(end.reason), "replay plays to the real winner " + JSON.stringify(end));
await f.waitForFunction(() => !document.querySelector("#result").hidden, null, { timeout: 20000 });
ok(await f.evaluate(() => /wins/.test(document.querySelector("#resultTitle").textContent)), "replay result names the winner");
await page.screenshot({ path: `${out}/replay-end.png` });
// back one move: the result goes away, the duel is a move earlier
const before = await f.evaluate(() => window.__duel.replay.i);
await f.evaluate(() => document.querySelector("#rbBack").click());
await f.waitForFunction((b) => window.__duel.replay.i === b - 1 && window.__duel.packet && !window.__duel.packet.ended, before, { timeout: 20000 }).catch(() => fail("back a move"));
ok(await f.evaluate(() => document.querySelector("#result").hidden), "back a move: " + before + " → " + (before - 1));
// start of the previous turn
await f.evaluate(() => document.querySelector("#rbPrevTurn").click());
await page.waitForTimeout(1500);
const t1 = await f.evaluate(() => ({ turn: window.__duel.packet.turn, i: window.__duel.replay.i }));
ok(t1.turn <= live.turn, "back to a turn start " + JSON.stringify(t1));
await f.evaluate(() => { const s = document.querySelector("#rbSeek"); s.value = "1"; s.dispatchEvent(new Event("change")); });
await f.waitForFunction(() => window.__duel.replay.i === 1, null, { timeout: 20000 }).catch(() => fail("slider"));
ok(true, "slider jumps to move 1");
await f.evaluate(() => document.querySelector("#rbNextTurn").click());
await f.waitForFunction(() => window.__duel.packet.turn >= 2, null, { timeout: 20000 }).catch(() => fail("next turn"));
ok(true, "skip to the next turn");
const nm = await f.evaluate(() => document.querySelector("#meName").textContent);
await f.evaluate(() => document.querySelector("#rbView").click()); await page.waitForTimeout(400);
const nm2 = await f.evaluate(() => document.querySelector("#meName").textContent);
ok(nm !== nm2, `switch view: ${nm} → ${nm2}`);
await page.screenshot({ path: `${out}/replay-view.png` });
// KodeX Premium: record a video clip from here to the end (1080p landscape)
await f.evaluate(() => document.querySelector("#rbRec").click());
await page.waitForTimeout(300);
ok(await f.evaluate(() => document.querySelector("#recDlg").open), "video clip options open");
await page.screenshot({ path: `${out}/replay-recdlg.png` });
await f.evaluate(() => { document.querySelector("#recUntil").value = "end"; document.querySelector("#recSpeed").value = "2"; document.querySelector("#recGo").click(); });
await page.waitForTimeout(2500);
const cv = await f.evaluate(() => { const c = document.querySelector("#recBox canvas"); return c && { w: c.width, h: c.height }; });
ok(cv && cv.w === 1920 && cv.h === 1080, "drawing the clip at 1920×1080 " + JSON.stringify(cv));
await page.screenshot({ path: `${out}/replay-recording.png` });
await f.evaluate(() => { const c = document.querySelector("#recBox canvas"); window.__frame = c.toDataURL("image/jpeg", .8); });
const frame = await f.evaluate(() => window.__frame);
fs.writeFileSync(`${out}/replay-clipframe.jpg`, Buffer.from(frame.split(",")[1], "base64"));
await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.ended, null, { timeout: 90000 }).catch(() => fail("play on to the end"));
const vid = await page.waitForFunction(() => window.__video, null, { timeout: 20000 }).then((h) => h.jsonValue()).catch(() => null);
// the other shapes, drawn from the same moment
for (const fmt of ["portrait", "square"]) {
  const data = await f.evaluate(async (fmt) => { const { Clip } = await import("./video.js"); const S = window.__duel;
    const c = new Clip({ format: fmt, size: 1080, fps: 30, watermark: true, packet: () => S.packet, team: () => S.team, art: () => "", name: (x) => S.db.name(Number(x)), kind: () => "spell", profile: () => null, logo: "./assets/meiocg-192.webp", aces: () => new Set() });
    await new Promise((r) => setTimeout(r, 400)); c.frame(); await new Promise((r) => setTimeout(r, 200)); c.frame(); return { w: c.W, h: c.H, url: c.cv.toDataURL("image/jpeg", .8) }; }, fmt);
  ok(fmt === "portrait" ? data.w === 1080 && data.h === 1920 : data.w === 1080 && data.h === 1080, `${fmt} clip is ${data.w}×${data.h}`);
  fs.writeFileSync(`${out}/clip-${fmt}.jpg`, Buffer.from(data.url.split(",")[1], "base64"));
}
ok(vid && vid.size > 20000 && /^video\//.test(vid.mime), "video clip saved " + JSON.stringify(vid));
ok(await f.evaluate(() => window.__duel.packet.ended.winner) === live.w, "plays on to the same winner after going back");
if (errors.length) fail("page errors");
await browser.close();
console.log("OK: replays saved, listed, played to the end, back/forward by move and turn, slider, switch view");
