// Arena v80: a combo over two turns: the opponent's turn starts on the table ("Turn 2"), their plays come from their
// side (a hand trap shown from their hand), and the step banner says which turn it is.
// usage: node tests/duel/ui-v80.mjs http://localhost:8787 [outdir]
import fs from "node:fs";
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787", out = process.argv[3] || ".";
const raw = JSON.parse(fs.readFileSync(new URL("../../duel/data/cards.json", import.meta.url))).cards;
const byName = (n) => { for (const [c, r] of Object.entries(raw)) if (r[12] === n) return Number(c); throw new Error("no card " + n); };
const browser = await chromium.launch();
const errors = [];
const fail = (m) => { console.error("FAIL:", m, errors); process.exit(1); };
const ok = (c, m) => { if (!c) fail(m); console.log("ok:", m); };
const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
page.on("pageerror", (e) => errors.push(String(e)));
await page.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
await page.goto(`${base}/duel/`);
await page.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
const CUTIA = byName("DoSolfachord Cutia"), HARM = byName("Solfachord Harmonia"), ASH = byName("Ash Blossom & Joyous Spring"), BARONNE = byName("Baronne de Fleur"), COOLIA = byName("DoSolfachord Coolia");
const combo = { title: "Two turns", hand: [CUTIA], extra: [BARONNE], t2: 2, speed: 1,
  lines: [[{ cards: [{ c: CUTIA, a: "ss" }] }, { cards: [{ c: HARM }] }], [{ cards: [{ c: COOLIA, a: "ss" }] }],
    [{ cards: [{ c: ASH, a: "eff", b: 1 }] }, { cards: [{ c: ASH, a: "gy", b: 1 }] }], [{ cards: [{ c: BARONNE, a: "eff" }], note: "negate it" }]], intro: { ms: 0 } };
await page.evaluate((c) => window.__arena.watchCombo(c), combo);
await page.waitForFunction(() => window.__duel.packet && window.__duel.packet.combo && window.__duel.packet.combo.turnStart, null, { timeout: 60000, polling: 50 }).catch(async () => { console.log(await page.evaluate(() => JSON.stringify({ mode: window.__duel.mode, c: window.__duel.packet && window.__duel.packet.combo, r: window.__duel.replay && [window.__duel.replay.i, window.__duel.replay.n, window.__duel.replay.paused, window.__duel.replay.combo.t2] }))); fail("no turn 2"); });
await page.waitForTimeout(250);
const t2 = await page.evaluate(() => ({ turn: window.__duel.packet.turn, tp: window.__duel.packet.turnPlayer, step: document.querySelector("#cbStep").textContent, opHand: getComputedStyle(document.querySelector("#opHand")).visibility, n: window.__duel.packet.state.teams[1].hand.length }));
ok(t2.turn === 2 && t2.tp === 1 && /TURN 2/.test(t2.step) && /opponent's turn/i.test(t2.step), "the opponent's turn starts on the table " + JSON.stringify(t2));
ok(t2.opHand === "visible" && t2.n === 6, "their hand shows: 5 and the card they drew");
await page.screenshot({ path: `${out}/v80-turn2.png` });
await page.waitForFunction(() => window.__duel.packet && window.__duel.packet.combo && window.__duel.packet.combo.by === 1, null, { timeout: 30000, polling: 50 });
const ash = await page.evaluate(() => ({ what: window.__duel.packet.combo.what, step: document.querySelector("#cbStep").textContent, ev: window.__duel.packet.events.find((e) => e.type === 70) }));
ok(/Your opponent/.test(ash.what) && /T2 · STEP/.test(ash.step) && ash.ev && ash.ev.controller === 1, "their hand trap is theirs, in turn 2 " + JSON.stringify(ash));
await page.waitForFunction(() => window.__duel.packet && window.__duel.packet.combo && window.__duel.packet.combo.last, null, { timeout: 30000 });
ok(await page.evaluate(() => window.__duel.packet.state.teams[1].grave.some((c) => c.code > 0)), "it ends in their GY");
await page.screenshot({ path: `${out}/v80-end.png` });
ok(!errors.length, "no page errors " + errors.join(" | "));
await browser.close();
console.log("OK: v80");
