// A desktop client's .yrpX opened in the Arena plays as recorded: it runs to its real end even when the answers in it no
// longer fit this Arena's card scripts (here: garbled on purpose), and the table at the end is the duel's own.
// usage: node tests/duel/ui-stream.mjs http://localhost:8787 <file.yrpX> [outdir]
import fs from "node:fs";
import { chromium } from "playwright";
import { readReplay } from "../../duel/engine/replayfile.js";
const base = process.argv[2] || "http://localhost:8787", file = process.argv[3], out = process.argv[4] || ".";
if (!file) { console.error("usage: ui-stream.mjs <base> <file.yrpX>"); process.exit(2); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
// no card scripts at all: a recorded replay must not need them (works offline)
let scripts = 0;
await page.route(/\/scripts\/|cdn\.jsdelivr/, (r) => { scripts++; r.abort(); });
await page.goto(`${base}/duel/`);
const fail = (m) => { console.error("FAIL:", m, errors); process.exit(1); };
const ok = (c, m) => { if (!c) fail(m); console.log("ok:", m); };
await page.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
await page.setInputFiles("#replayFile2", file);
await page.waitForFunction(() => window.__duel.packet && window.__duel.packet.state, null, { timeout: 30000 });
ok(true, "the replay started");
await page.evaluate(() => window.__duel.worker.postMessage({ cmd: "replayCtl", speed: 40 }));
await page.waitForFunction(() => window.__duel.packet && window.__duel.packet.ended, null, { timeout: 240000 });
const end = await page.evaluate(() => ({ ended: window.__duel.packet.ended, state: window.__duel.packet.state, info: window.__duel.replayInfo }));
ok(!/out of step/i.test(end.ended.reason || ""), `it ran to its end (${JSON.stringify(end.ended)})`);
ok(end.info && end.info.mode === "recorded", "it is played as recorded");
ok(scripts === 0, "no card script was fetched");
// the last recorded table: LP and every zone as in the file
const r = readReplay(new Uint8Array(fs.readFileSync(file)));
const { StreamHost } = await import("../../duel/engine/stream.js");
let last = null; const db = { get: () => null, victory: () => "" };
const h = new StreamHost({ r, db, emit: (v, p) => { last = p; } }); h.start(); while (!h.ended) h.respondRaw();
const sig = (s) => s.teams.map((t) => [t.lp, t.deck, t.hand.length, t.mzone.map((c) => c && c.code), t.szone.map((c) => c && c.code), t.grave.map((c) => c.code), t.banished.length, t.extra.length]);
ok(JSON.stringify(sig(end.state)) === JSON.stringify(sig(last.state)), "the table on screen is the recorded one");
await page.screenshot({ path: `${out}/stream-end.png` });
ok(!errors.length, "no page errors " + errors.join(" | "));
await browser.close();
console.log("OK: recorded replay");
