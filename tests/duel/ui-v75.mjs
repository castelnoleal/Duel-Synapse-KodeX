// Arena v75: quick reactions (chosen in the emote picker, optional buttons beside the emote button), the target mark
// that stays on a targeted card until its effect resolves, the column of light for a card back from the GY, and the
// short "Activate" buttons under cards in a pile.
// usage: node tests/duel/ui-v75.mjs http://localhost:8787 [outdir]
import fs from "node:fs";
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787", out = process.argv[3] || ".";
const raw = JSON.parse(fs.readFileSync(new URL("../../duel/data/cards.json", import.meta.url))).cards;
const normals = Object.entries(raw).filter(([c, r]) => !r[0] && (r[2] & 0x11) === 0x11 && !(r[2] & 0x4000)).slice(0, 40).map(([c, r]) => [Number(c), r[12], 1]);
const deck = { n: "v75", m: normals, e: [], s: [] };
const payload = Buffer.from(JSON.stringify(deck)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const browser = await chromium.launch();
const errors = [];
const fail = (m) => { console.error("FAIL:", m, errors); process.exit(1); };
const ok = (c, m) => { if (!c) fail(m); console.log("ok:", m); };
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
await page.goto(`${base}/duel/#deck=${payload}`);
await page.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
await page.evaluate(() => { localStorage.setItem("duel:pref", JSON.stringify({ opening: false })); });
await page.evaluate(() => { for (const [id, v] of [["#soloOpp", "passive"], ["#soloOppDeck", "same"], ["#soloFirst", "me"]]) { const e = document.querySelector(id); if (e) { e.value = v; e.dispatchEvent(new Event("change")); } } });
await page.click("#soloStart");
await page.waitForFunction(() => window.__duel.packet && window.__duel.packet.prompt && window.__duel.packet.waitingFor === window.__duel.team, null, { timeout: 60000 });
await page.waitForTimeout(2500);
await page.evaluate(() => document.querySelector("#opening")?.click());

// ----- quick reactions -----
await page.click("#emoteBtn");
ok(await page.isVisible("#emotePick .q-head"), "the emote picker starts with Quick reactions");
const q0 = await page.$$eval("#emotePick .em.q", (b) => b.map((x) => x.dataset.id));
ok(q0.join() === "gg,nice,wow,think", "four quick reactions by default " + q0);
await page.click("#emotePick [data-qedit]");
ok(await page.isVisible("#emotePick .q-add input"), "Edit shows the stars and a box for a phrase");
await page.click('#emotePick .em:not(.q)[data-id="fire"]');
await page.fill("#emotePick .q-add input", "Well played!");
await page.click("#emotePick .q-add .btn");
const q1 = await page.$$eval("#emotePick .em.q", (b) => b.map((x) => x.dataset.id));
ok(q1.join() === "gg,nice,wow,think,fire,t:Well played!", "an emote and a phrase are added " + q1);
await page.click('#emotePick .em.q[data-id="wow"]');
ok((await page.$$eval("#emotePick .em.q", (b) => b.map((x) => x.dataset.id))).join() === "gg,nice,think,fire,t:Well played!", "tapping a quick reaction while editing takes it out");
ok(await page.isVisible("#emotePick"), "the picker stays open while editing");
await page.click("#emotePick [data-qedit]");
ok(JSON.parse(await page.evaluate(() => localStorage.getItem("duel:pref"))).quick.length === 5, "the list is kept on this device");
await page.click('#emotePick .em.q[data-id="t:Well played!"]');
await page.waitForTimeout(300);
ok(/Well played!/.test(await page.evaluate(() => document.querySelector("#chatList").textContent)), "a phrase goes out as a chat line");
ok(await page.isHidden("#quickBar") || !(await page.$("#quickBar")), "no quick buttons until they are switched on");
await page.evaluate(() => { const c = document.querySelector("#prefQuickBar"); c.checked = true; c.dispatchEvent(new Event("change")); });
await page.waitForTimeout(200);
ok(await page.isVisible("#quickBar"), "the quick reaction buttons show beside the emote button");
const qb = await page.$$eval("#quickBar .qb", (b) => b.map((x) => x.dataset.q));
ok(qb.length === 5, "one button for each quick reaction " + qb);
const r1 = await page.$eval("#quickBar", (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
const r2 = await page.$eval("#emoteBtn", (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; });
ok(r1.r <= 412 && r1.l >= 0 && r1.t >= 0 && !(r1.l < r2.r && r1.r > r2.l && r1.t < r2.b && r1.b > r2.t), "they sit on screen and do not cover the emote button " + JSON.stringify([r1, r2]));
await page.waitForTimeout(1600);                       // reactions are spaced at least 1.5 s apart
await page.click('#quickBar .qb[data-q="gg"]');
await page.waitForTimeout(300);
ok(await page.$("#sayFx .say.me .say-emote"), "one tap sends the reaction");
if (out) await page.screenshot({ path: `${out}/v75-quick.png` });

// ----- the target mark stays until the effect has resolved -----
const st = await page.evaluate(() => { const t = window.__duel.team; return { t, n: window.__duel.packet.state.teams[t].hand.length }; });
const loc = { controller: st.t, location: 2, sequence: 0, position: 1 };
await page.evaluate((loc) => window.__arena.fxEvents({ names: ["A", "B"], events: [{ type: 70, code: 1, controller: 1 - loc.controller, location: 2, sequence: 0, chain_size: 1, description: "0" }, { type: 83, cards: [loc] }] }), loc);
await page.waitForTimeout(1400);
ok(await page.$("#myHand .card.tgt-on .tgt-ret"), "the targeted card wears a target mark");
ok((await page.$eval("#myHand .card.tgt-on .tgt-ret b", (b) => b.textContent)) === "1", "with the number of the chain link");
await page.evaluate(() => window.__duel.worker && 0);
await page.waitForTimeout(1500);
ok(await page.$("#myHand .card.tgt-on"), "it is still there before the effect resolves");
if (out) await page.screenshot({ path: `${out}/v75-target.png` });
await page.evaluate(() => window.__arena.fxEvents({ names: ["A", "B"], events: [{ type: 72, chain_size: 1 }, { type: 73, chain_size: 1 }, { type: 74 }] }));
await page.waitForTimeout(1500);
ok(!(await page.$(".card.tgt-on")), "it goes away once the effect has resolved");

// ----- back from the GY: a column of light and a glowing card in flight -----
const fl = await page.evaluate((t) => window.__arena.fly({ events: [{ type: 50, code: 89631139, from: { controller: t, location: 0x10, sequence: 0, position: 5 }, to: { controller: t, location: 4, sequence: 2, position: 1 }, reason: 0x40 }] }), st.t);
await page.waitForTimeout(60);
ok(fl && fl[0].rise === "gy" && fl[0].summon, "a card Special Summoned from the GY rises");
ok(await page.$("#flyFx .rise-src") && await page.$("#flyFx .rise-land.big"), "light at the GY and a ring where it lands");
if (out) await page.screenshot({ path: `${out}/v75-rise.png` });
await page.waitForTimeout(1500);
ok(!(await page.$("#flyFx .rise-src")), "the light is gone afterwards");

// ----- the action under a card in a pile is short -----
const h = await page.evaluate(() => {
  const o = document.createElement("div"); o.className = "opt"; o.style.position = "fixed"; o.style.left = "10px"; o.style.top = "10px";
  const b = window.__arena.actBtn('Activate: Place 2 "Yummy" monsters from your GY and/or banishment and this card on the bottom of the Deck in any order, then draw 1 card');
  o.append(b); document.body.append(o); const r = b.getBoundingClientRect(), w = o.getBoundingClientRect().width; const out = { h: r.height, w, title: b.title, bold: b.querySelector("b")?.textContent }; o.remove(); return out;
});
ok(h.bold === "Activate" && h.h < 80 && /bottom of the Deck/.test(h.title), "a long effect shows as Activate with three lines of small print " + JSON.stringify(h));
ok(!errors.length, "no page errors " + errors.join(" | "));
await browser.close();
console.log("OK: v75");
