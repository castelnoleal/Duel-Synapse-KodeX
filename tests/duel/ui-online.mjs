// Two-browser online test through the relay: host + guest + spectator.
// usage: node tests/duel/ui-online.mjs http://localhost:8787 [outdir]
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787";
const out = process.argv[3] || ".";
const enc = (d) => Buffer.from(JSON.stringify(d)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deckA = { n: "Host Deck", m: [[46986414, "Dark Magician", 3], [70781052, "Summoned Skull", 3], [91152256, "Celtic Guardian", 3], [6368038, "Gaia The Fierce Knight", 3],
  [40640057, "Kuriboh", 3], [54652250, "Man-Eater Bug", 3], [26202165, "Sangan", 3], [14558127, "Ash Blossom & Joyous Spring", 3], [44095762, "Mirror Force", 3],
  [4206964, "Trap Hole", 3], [5318639, "Mystical Space Typhoon", 3], [53129443, "Dark Hole", 3], [83764718, "Monster Reborn", 1], [12580477, "Raigeki", 1], [31560081, "Magician of Faith", 2]], e: [[84013237, "Number 39: Utopia", 1]], s: [] };
const deckB = { ...deckA, n: "Guest Deck" };
const browser = await chromium.launch();
const errors = [];
async function open(name, deck, hash = "") {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } });
  const page = await ctx.newPage();
  await page.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
  page.on("pageerror", (e) => errors.push(`${name}: ${e}`));
  page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(`${name}: ${m.text()}`); });
  await page.goto(`${base}/duel/${hash || (deck ? "#deck=" + enc(deck) : "")}`);
  if (!hash.startsWith("#watch")) { await page.fill("#nameInput", name); await page.dispatchEvent("#nameInput", "change"); }
  return page;
}
const host = await open("Hosty", deckA);
await host.waitForFunction(() => document.querySelector("#engineStatus").textContent.includes("ready"), null, { timeout: 60000 });
await host.click('.seg [data-mode="host"]');
await host.click("#hostOpen");
await host.waitForFunction(() => /^[A-Z0-9]{6}$/.test(document.querySelector("#roomCode").textContent));
const code = await host.textContent("#roomCode");
console.log("room", code);

const guest = await open("Guesty", deckB);
await guest.waitForFunction(() => window.__duel.deck);
// Use the invite link format
await guest.goto(`${base}/duel/#join=${code}`);
await guest.fill("#nameInput", "Guesty");
await guest.waitForFunction(() => !document.querySelector("#joinBtn").disabled, null, { timeout: 30000 });
await guest.click("#joinBtn");
await host.waitForFunction(() => !document.querySelector("#hostStart").disabled, null, { timeout: 20000 });
console.log("host sees:", await host.textContent("#guestInfo"));

const spec = await open("Watcher", null, `#watch=${code}`);
await host.click("#hostStart");
await host.waitForFunction(() => window.__duel.packet && window.__duel.packet.state, null, { timeout: 60000 });
await guest.waitForFunction(() => window.__duel.packet && window.__duel.packet.state, null, { timeout: 60000 });
await spec.waitForFunction(() => window.__duel.packet && window.__duel.packet.state, null, { timeout: 60000 });

// Hidden information: the guest must not see the host's hand.
const leak = await guest.evaluate(() => { const p = window.__duel.packet; const opp = p.state.teams[1 - p.viewer]; return opp.hand.filter((c) => c && !c.hidden).length; });
const specLeak = await spec.evaluate(() => window.__duel.packet.state.teams.flatMap((t) => t.hand).filter((c) => c && !c.hidden).length);
console.log("guest sees opponent hand cards:", leak, " spectator sees hand cards:", specLeak);

// Play: whoever must act ends their turn or picks the first option, for a few turns.
async function act(page) {
  const st = await page.evaluate(() => { const p = window.__duel.packet; return { mine: p.waitingFor === window.__duel.team && !p.ended, t: p.prompt && p.prompt.msg.type }; });
  if (!st.mine) return false;
  if (await page.$(".zone.free")) { await page.click(".zone.free"); return true; }
  if (await page.isVisible("#sheet")) {
    const prim = await page.$("#sheetActions .btn.primary:not([disabled])");
    const tile = await page.$("#sheetBody .card");
    if (st.t === 16 && prim) await prim.click(); else if (tile) await tile.click({ force: true }); else if (prim) await prim.click();
    return true;
  }
  const acts = await page.$$("#myHand .card.act");
  if (acts.length && Math.random() < 0.5) { await acts[0].click(); if (await page.isVisible("#menu")) await page.click("#menu button"); return true; }
  const go = await page.$$("#phases button.go");
  if (go.length) { await go[go.length - 1].click(); return true; }
  return false;
}
let turn = 0;
for (let i = 0; i < 160 && turn < 6; i++) {
  await act(host); await act(guest);
  await host.waitForTimeout(150);
  turn = await host.evaluate(() => window.__duel.packet.turn);
}
const hs = await host.evaluate(() => ({ turn: window.__duel.packet.turn, lp: window.__duel.packet.state.teams.map((t) => t.lp) }));
const gs = await guest.evaluate(() => ({ turn: window.__duel.packet.turn, lp: window.__duel.packet.state.teams.map((t) => t.lp) }));
const ss = await spec.evaluate(() => ({ turn: window.__duel.packet.turn }));
console.log("host", hs, "guest", gs, "spec", ss);
// chat
await guest.click('.tabs [data-tab="chat"]');
await guest.fill("#chatInput", "gg wp");
await guest.press("#chatInput", "Enter");
await host.waitForFunction(() => [...document.querySelectorAll("#chatList li")].some((l) => l.textContent.includes("gg wp")), null, { timeout: 10000 });
console.log("chat delivered");
// surrender from guest
guest.on("dialog", (d) => d.accept());
await guest.click("#surrenderBtn");
await host.waitForFunction(() => window.__duel.packet.ended, null, { timeout: 15000 });
console.log("result on host:", await host.evaluate(() => window.__duel.packet.ended));
await host.waitForTimeout(900);
await host.screenshot({ path: `${out}/online-host.png` });
await guest.screenshot({ path: `${out}/online-guest.png` });
await spec.screenshot({ path: `${out}/online-spec.png` });
console.log("errors:", errors);
await browser.close();
process.exit(errors.length || leak || specLeak ? 1 : 0);
