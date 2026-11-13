// Arena v63, framed like the KodeX app:
//  • cards keep their element between updates (no blinking), the settings panel scrolls, the LP plates hold their numbers;
//  • the quick flag: restart (solo) and surrender; tapping outside closes panels (and the setting turns it off);
//  • the Deck riffles when it is shuffled; the new Time Stop showdown;
//  • a KodeX combo plays like a replay: title card, steps, back/forward, kept in the Replays list, recorded with its title card.
// usage: node tests/duel/ui-v63.mjs http://localhost:8787 [outdir]
import fs from "node:fs";
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787", out = process.argv[3] || ".";
const POT = 55144522, HINOTAMA = 46130346;
const raw = JSON.parse(fs.readFileSync(new URL("../../duel/data/cards.json", import.meta.url))).cards;
const byName = (n) => { for (const [c, r] of Object.entries(raw)) if (r[12] === n) return Number(c); throw new Error("no card " + n); };
const normals = Object.entries(raw).filter(([c, r]) => !r[0] && (r[2] & 0x11) === 0x11 && !(r[2] & 0x4000)).slice(0, 34).map(([c, r]) => [Number(c), r[12], 1]);
const deck = { n: "v63", m: [[POT, "Pot of Greed", 3], [HINOTAMA, "Hinotama", 3], ...normals], e: [], s: [] };
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

const shot = process.env.SHOT;
for (const [w, h, tag] of [[412, 915, "p"], [915, 412, "l"]]) {
  const { page, f } = await open(w, h);
  await start(f, page);
  // summon something so zones are filled
  await f.evaluate(() => { window.__flySeen = 0; new MutationObserver(() => { window.__flySeen += document.querySelectorAll("#flyFx .fly-card").length; }).observe(document.body, { childList: true, subtree: true }); });
  await activate(f, page, HINOTAMA);
  await f.waitForFunction(() => window.__duel.packet.state.teams[1 - window.__duel.team].lp < 8000, null, { timeout: 15000 }).catch(() => fail("Hinotama did not resolve"));
  await page.waitForTimeout(2500);
  const seen = await f.evaluate(() => window.__flySeen);
  ok(seen > 0, "cards travel to where they go (" + tag + ") " + seen);
  ok(await f.evaluate(() => !document.querySelector("#flyFx .fly-card") && ![...document.querySelectorAll(".card")].some((c) => c.style.visibility === "hidden")), "the travelling copies clear and every card is shown");
  for (const k of ["synapse", "felt", "void", "frost", "neon", "royal", "dojo", "emerald"]) {
    await f.evaluate((k) => { document.querySelector(`#ftGrid [data-ft=${k}]`).click(); }, k);
    await page.waitForTimeout(250);
    const cur = await f.evaluate(() => document.body.dataset.ft || "synapse");
    ok(cur === k, "theme " + k);
    if (shot) await page.screenshot({ path: `${out}/ft-${tag}-${k}.png` });
  }
  if (tag === "p") {
    // the picker in Settings: eight swatches, the chosen one marked, and it is remembered
    await f.evaluate(() => { document.querySelector("#ftGrid [data-ft=frost]").click(); });
    await f.click("#sideFab"); await page.waitForTimeout(300);
    await f.click('#side .tabs [data-tab="opts"]'); await page.waitForTimeout(300);
    await f.evaluate(() => document.querySelector(".ft-opts").scrollIntoView({ block: "center" }));
    await page.waitForTimeout(500);
    const pk = await f.evaluate(() => { const g = document.querySelector("#ftGrid"), r = g.getBoundingClientRect(); return { n: g.children.length, on: g.querySelector("[aria-pressed=true]").dataset.ft, vis: r.width > 200 && r.height > 60, saved: JSON.parse(localStorage.getItem("duel:ftheme")) }; });
    ok(pk.n === 8 && pk.on === "frost" && pk.vis && pk.saved === "frost", "Settings: field theme picker " + JSON.stringify(pk));
    if (shot) await page.screenshot({ path: `${out}/ft-picker.png` });
    await f.evaluate(() => window.__arena.toggleSide(false));
  }
  if (tag === "l") {
    // ----- a combo, recorded in each shape on the Royal Gold field: play-by-play, the card in play, sound -----
    await f.evaluate(() => document.querySelector("#ftGrid [data-ft=royal]").click());
    await page.evaluate((c) => document.getElementById("f").contentWindow.postMessage({ kx: "combo", combo: c }, "*"), combo);
    await f.waitForSelector("#comboIntro", { timeout: 8000 }).catch(() => fail("combo title card did not show"));
    const ci = await f.evaluate(() => { const i = document.querySelector("#comboIntro"); return { filt: [...i.querySelectorAll("*")].some((e) => /blur/.test(getComputedStyle(e).filter)), cover: !!document.querySelector(".combo-cover"), img: !!i.querySelector(".ci-img") }; });
    ok(!ci.filt, "title card: the artwork without a live blur filter " + JSON.stringify(ci));
    ok((await page.evaluate(() => window.__shown)) >= 1, "KodeX is told when the title card is up");
    await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.combo && window.__duel.packet.combo.last, null, { timeout: 40000 }).catch(() => fail("combo did not play"));
    for (const fmt of ["landscape", "portrait", "square"]) {
      await page.evaluate(() => { window.__video = null; });
      await f.evaluate(() => document.querySelector("#rbRec").click()); await page.waitForTimeout(300);
      const opts = await f.evaluate(() => ["#recFeed", "#recInfo", "#recSound", "#recTitle"].every((i) => !!document.querySelector(i)));
      ok(opts, "record options: play-by-play, card details, sound, headline");
      await f.evaluate((fmt) => { document.querySelector(`input[name=recFmt][value=${fmt}]`).checked = true; document.querySelector("#recUntil").value = "end"; document.querySelector("#recSpeed").value = "1"; document.querySelector("#recGo").click(); }, fmt);
      await f.waitForFunction(() => window.__duel.packet.combo && window.__duel.packet.combo.step >= 3, null, { timeout: 30000 }).catch(() => fail("recording did not play " + fmt));
      await page.waitForTimeout(700);
      const st = await f.evaluate(() => { const c = window.__duel.rec && window.__duel.rec.clip; return c && { notes: c.notes.length, cur: c.cur && c.cur.code, sound: c.sound, th: c.th.e, tracks: c.stream.getTracks().map((t) => t.kind) }; });
      ok(st && st.notes >= 2 && st.cur && st.th === "#e6b94a", `${fmt}: play-by-play and the card in play, on the chosen theme ` + JSON.stringify(st));
      ok(st.sound && st.tracks.includes("audio"), fmt + ": the clip carries the game sound");
      const fr = await f.evaluate(() => document.querySelector("#recBox canvas").toDataURL("image/jpeg", .85));
      fs.writeFileSync(`${out}/v63-clip-${fmt}.jpg`, Buffer.from(fr.split(",")[1], "base64"));
      const vid = await page.waitForFunction(() => window.__video, null, { timeout: 40000 }).then((h) => h.jsonValue()).catch(() => null);
      ok(vid && vid.size > 200000, fmt + " clip saved " + JSON.stringify(vid));
      await page.waitForTimeout(600);
    }
  }
  await page.close();
}
if (errors.length) fail("page errors");
console.log("OK: v63");
await browser.close();
