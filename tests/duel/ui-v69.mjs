// Arena v69: combos follow the rules on both sides (a card summoned to the opponent's field, the opponent discarding),
// Extra Deck monsters never reach the hand, practice uses the combo's hand size, the finishing emote, chat on screen,
// the small offline pill, the deck stats in the lobby, the title banner in the app, and nearby duels with no internet.
// (v70: chat bubbles on the field are as before v69: Premium, or from a Premium player.)
// usage: node tests/duel/ui-v69.mjs http://localhost:8787 [outdir]
import fs from "node:fs";
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787", out = process.argv[3] || ".";
const raw = JSON.parse(fs.readFileSync(new URL("../../duel/data/cards.json", import.meta.url))).cards;
const byName = (n) => { for (const [c, r] of Object.entries(raw)) if (r[12] === n) return Number(c); throw new Error("no card " + n); };
const isX = (c) => !!(raw[c][2] & (0x40 | 0x2000 | 0x800000 | 0x4000000));
const normals = Object.entries(raw).filter(([c, r]) => !r[0] && (r[2] & 0x11) === 0x11 && !(r[2] & 0x4000)).slice(0, 40).map(([c]) => Number(c));
const PALADIN = byName("Dark Paladin"), IBLEE = byName("Knightmare Corruptor Iblee"), CUTIA = byName("DoSolfachord Cutia"), ASH = byName("Ash Blossom & Joyous Spring"), ACCESS = byName("Accesscode Talker");
const payload = Buffer.from(JSON.stringify({ n: "v69", m: normals.map((c) => [c, "", 1]), e: [], s: [] })).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
const browser = await chromium.launch();
const errors = [];
const fail = (m) => { console.error("FAIL:", m, errors); process.exit(1); };
const ok = (c, m) => { if (!c) fail(m); console.log("ok:", m); };
const ready = (p) => p.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
async function wrap(w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
  await page.route(`${base}/wrap.html`, (r) => r.fulfill({ contentType: "text/html", body: `<!doctype html><body style="margin:0"><div id="kxbar" style="position:fixed;top:8px;right:6px;display:flex;gap:8px;z-index:9"><i style="width:38px;height:38px;display:block;background:#123"></i><i style="width:38px;height:38px;display:block;background:#123"></i><i style="width:38px;height:38px;display:block;background:#123"></i></div><iframe id="f" src="${base}/duel/?app=1&embed=1#deck=${payload}" style="border:0;width:100vw;height:100vh"></iframe><script>
addEventListener("message", (e) => { const d = e.data || {}; if (d.kx === "ready") { const k = document.getElementById("kxbar").getBoundingClientRect(); document.getElementById("f").contentWindow.postMessage({ kx: "chrome", w: Math.round(innerWidth - k.left), h: Math.round(k.bottom) }, "*"); } });
</script></body>` }));
  await page.goto(`${base}/wrap.html`);
  const f = await (await page.waitForSelector("#f")).contentFrame();
  await ready(f); await page.waitForTimeout(800);
  return { page, f };
}
// ---- the app (KodeX frame): title banner, deck stats, Extra Deck cards, practice, finishing emote
{
  const { page, f } = await wrap(412, 915);
  // v70: the banner is fixed at the top while the lobby scrolls: logo and title beside KodeX's buttons, Combo Generator under it
  const ban = await f.evaluate(async () => { const h = document.querySelector(".hero"), l = document.querySelector(".hero-logo"), t = document.querySelector(".hero h1"), kb = innerWidth - parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--kx-right"));
    scrollTo(0, 600); await new Promise((r) => setTimeout(r, 200)); const hr = h.getBoundingClientRect(), tr = t.getBoundingClientRect(); scrollTo(0, 0);
    return { logo: getComputedStyle(l).display !== "none" && l.getBoundingClientRect().height >= 28, titleClear: tr.right <= kb + 1 && t.scrollWidth <= t.clientWidth + 1, fixed: Math.abs(hr.top) < 2, height: Math.round(hr.height) }; });
  ok(ban.logo && ban.titleClear && ban.fixed && ban.height < 130, "the title banner in the app stays at the top, compact, beside KodeX's buttons " + JSON.stringify(ban));
  ok(await f.evaluate(() => !!document.querySelector(".deck-sum .ds-mr") && document.querySelector(".deck-cards").hidden), "the lobby shows the deck's stats; the card list is folded");
  await f.click(".deck-show");
  ok(await f.evaluate(() => !document.querySelector(".deck-cards").hidden), "Show the cards opens the list");
  await page.screenshot({ path: `${out}/v69-lobby-app.png` });
  // a deck synced from KodeX with an Extra Deck monster listed in the Main Deck
  await page.evaluate(([n, pal]) => document.getElementById("f").contentWindow.postMessage({ kx: "decks", decks: [{ name: "Synced", main: [...n.slice(0, 39), pal], extra: [] }] }, "*"), [normals, PALADIN]);
  await page.waitForTimeout(500);
  const syn = await f.evaluate((pal) => { const d = window.__duel.decks.find((x) => x.name === "Synced"); return { inMain: d.main.includes(pal), inExtra: d.extra.includes(pal) }; }, PALADIN);
  ok(!syn.inMain && syn.inExtra, "an Extra Deck monster listed in the Main Deck goes to the Extra Deck " + JSON.stringify(syn));
  // practice a 2-card combo: the opening hand is those 2 cards only
  await page.evaluate((h) => document.getElementById("f").contentWindow.postMessage({ kx: "practice", hand: h }, "*"), normals.slice(0, 2));
  await page.waitForTimeout(400);
  ok(await f.evaluate(() => window.__arena.options().start === 2), "practising a 2-card combo starts with 2 cards");
  await f.evaluate(() => { for (const [id, v] of [["#soloOpp", "passive"], ["#soloOppDeck", "same"], ["#soloFirst", "me"]]) { const e = document.querySelector(id); e.value = v; e.dispatchEvent(new Event("change")); } });
  await f.click("#soloStart");
  await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.state && window.__duel.packet.state.teams[0].hand.length > 0, null, { timeout: 60000 });
  await page.waitForTimeout(3500);
  const hand = await f.evaluate(() => window.__duel.packet.state.teams[window.__duel.team].hand.map((c) => c.code));
  ok(hand.length === 2, "the duel opens with the combo's 2 cards " + JSON.stringify(hand));
  ok(!hand.some((c) => c && isXCheck(c)), "no Extra Deck monster in the hand");
  // the finishing emote (Premium): fills the field, then the showdown
  await page.evaluate((g) => document.getElementById("f").contentWindow.postMessage({ kx: "skin", premium: true, emotes: [{ name: "Win", src: g }], finEmote: 0 }, "*"), GIF);
  await page.waitForTimeout(400);
  const ms = await f.evaluate(() => window.__arena.finishEmote(window.__duel.team));
  await page.waitForTimeout(500);   // after its pop-in
  const fe = await f.evaluate((ms) => { const n = document.querySelector(".fin-emote"); const r = n && n.getBoundingClientRect(), fr = document.querySelector("#field").getBoundingClientRect(); return { ms, over: !!n && Math.abs(r.width - fr.width) < 3 && Math.abs(r.top - fr.top) < 3 }; }, ms);
  ok(fe.ms >= 1500 && fe.over, "the finishing emote covers the field before the showdown " + JSON.stringify(fe));
  await page.screenshot({ path: `${out}/v69-finish-emote.png` });
  await page.close();
}
function isXCheck(c) { return raw[c] ? isX(c) : false; }
// ---- combos keep to the rules: a card summoned to the opponent's field stands there; the opponent discards
{
  const { page, f } = await wrap(412, 915);
  const combo = { id: "o1", title: "Opponent side", hand: [CUTIA, IBLEE], extra: [ACCESS], lines: [[{ cards: [{ c: CUTIA, a: "ns" }] }], [{ cards: [{ c: IBLEE, a: "ss", o: 1, p: 2 }], note: "Iblee to the opponent" }], [{ cards: [{ c: ASH, a: "dis", o: 1 }] }]] };
  await page.evaluate((c) => document.getElementById("f").contentWindow.postMessage({ kx: "combo", combo: c }, "*"), combo);
  await f.waitForFunction(() => window.__duel.mode === "replay", null, { timeout: 20000 });
  await page.waitForTimeout(2500);
  const st = await f.evaluate(([ib, ash]) => { const r = window.__duel.replay; const last = r.packets ? r.packets[r.packets.length - 1] : window.__duel.packet; const t = last.state.teams; return { oppHasIblee: t[1].mzone.some((c) => c && c.code === ib), meHasIblee: t[0].mzone.some((c) => c && c.code === ib), oppGy: t[1].grave.map((c) => c.code).includes(ash), oppHand: t[1].hand.length }; }, [IBLEE, ASH]);
  ok(st.oppHasIblee && !st.meHasIblee, "Iblee is Special Summoned to the opponent's field " + JSON.stringify(st));
  ok(st.oppGy && st.oppHand === 4, "the opponent's discard comes from their hand to their GY");
  await page.close();
}
// ---- offline: a small pill at the top that never covers the table
{
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(String(e)));
  await p.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
  await p.goto(`${base}/duel/#deck=${payload}`); await ready(p);
  await ctx.setOffline(true); await p.waitForTimeout(400);
  const pill = await p.evaluate(() => { const b = document.querySelector(".off-banner"); const r = b.getBoundingClientRect(); return { shown: !b.hidden, h: r.height, top: r.top, w: r.width, pe: getComputedStyle(b).pointerEvents }; });
  ok(pill.shown && pill.h <= 22 && pill.top <= 6 && pill.w < 160 && pill.pe === "none", "offline shows a small pill at the top that taps go through " + JSON.stringify(pill));
  await ctx.setOffline(false);
  await ctx.close();
}
// ---- nearby duel (no internet): swap the two codes, duel, chat shows on screen
{
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const open = async (name) => { const p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(name + ": " + e)); await p.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort()); await p.goto(`${base}/duel/#deck=${payload}`); await ready(p); await p.fill("#nameInput", name); return p; };
  const H = await open("HostPhone"), G = await open("GuestPhone");
  await H.evaluate(() => document.querySelector('[data-mode="host"]').click());
  await H.click("#nearbyHost");
  await H.waitForFunction(() => document.querySelector("#nbQr")?.dataset.code, null, { timeout: 15000 });
  const invite = await H.evaluate(() => document.querySelector("#nbQr").dataset.code);
  ok(/^DSN1\|o\|/.test(invite) && invite.length < 300 && (await H.evaluate(() => !!document.querySelector("#nbQr svg path"))), "the host shows a QR invite (" + invite.length + " characters)");
  await H.screenshot({ path: `${out}/v69-nearby-host.png` });
  await G.evaluate(() => document.querySelector('[data-mode="join"]').click());
  await G.click("#nearbyJoin");
  await G.evaluate(() => { document.querySelector(".nb-paste").open = true; });
  await G.fill("#nbCode", invite); await G.click("#nbUse");
  await G.waitForFunction(() => document.querySelector("#nbQr")?.dataset.code?.includes("|a|"), null, { timeout: 15000 });
  const ans = await G.evaluate(() => document.querySelector("#nbQr").dataset.code);
  await H.evaluate(() => { document.querySelector(".nb-paste").open = true; });
  await H.fill("#nbCode", ans); await H.click("#nbUse");
  await H.waitForFunction(() => !document.querySelector("#hostStart").disabled, null, { timeout: 20000 });
  ok(/GuestPhone/.test(await H.textContent("#guestInfo")), "the phones connect with no server");
  await H.click("#hostStart");
  await G.waitForFunction(() => window.__duel && window.__duel.packet && window.__duel.packet.names, null, { timeout: 60000 });
  ok((await G.evaluate(() => window.__duel.packet.names.join(","))).includes("HostPhone"), "the duel runs on both phones");
  await H.waitForTimeout(2500);
  await G.evaluate(() => { const i = document.querySelector("#chatInput"); i.value = "gg nearby"; i.form.requestSubmit(); });
  await H.waitForTimeout(1200);
  ok(/gg nearby/.test(await H.evaluate(() => document.querySelector("#chatList").textContent)), "chat arrives over the nearby connection");
  await ctx.close();
}
// ---- v70: the lobby turned sideways fits the screen (phones and tablets)
for (const [w, h] of [[860, 390], [1288, 580], [915, 412], [1180, 820]]) {
  const { page, f } = await wrap(w, h);
  const fit = await f.evaluate(() => { const g = document.querySelector(".lobby-grid").getBoundingClientRect(), o = document.querySelector("#lobby > .off-panel"), or = o && o.getBoundingClientRect(), hero = document.querySelector(".hero").getBoundingClientRect();
    return { gridBottom: Math.round(g.bottom), offTop: or ? Math.round(or.top) : null, offBottom: or ? Math.round(or.bottom) : null, H: innerHeight, W: innerWidth, right: Math.round(g.right), hero: Math.round(hero.height), z: getComputedStyle(document.documentElement).getPropertyValue("--lz") }; });
  ok(fit.gridBottom <= (fit.offTop ?? fit.H) + 1 && (fit.offBottom ?? 0) <= fit.H + 1 && fit.right <= fit.W + 1 && fit.hero <= 70, `the lobby at ${w}×${h} fits the screen ` + JSON.stringify(fit));
  if (w === 860) await page.screenshot({ path: `${out}/v70-lobby-landscape.png` });
  await page.close();
}
if (errors.length) fail("page errors");
console.log("OK: v69");
await browser.close();
