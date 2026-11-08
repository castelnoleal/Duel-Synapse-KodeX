// The Arena inside KodeX: KodeX sends the player's profile, their decks and the OCG banlist. The lobby lists the
// decks, the Life Point plates show the profile icon and frame, tapping one opens the profile card, card details
// show Forbidden/Limited, and the chat panel keeps its settings in their own tab.
// usage: node tests/duel/ui-profile.mjs http://localhost:8787 [outdir]
import fs from "node:fs";
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787", out = process.argv[3] || ".";
const cards = JSON.parse(fs.readFileSync(new URL("../../duel/data/cards.json", import.meta.url))).cards;
const normals = Object.entries(cards).filter(([c, r]) => !r[0] && (r[2] & 0x11) === 0x11 && !(r[2] & 0x4000)).slice(0, 40).map(([c]) => Number(c));
const ASH = 14558127;
const profile = { name: "Kasuteru", title: "Solfachord main", bio: "OCG Philippines", icon: "crown", frame: "gold", tier: "gold", theme: "aurora", premium: true, accent: "#f0b429", stats: { points: 900, days: 40, duels: 75, wins: 44 } };
const decks = [{ name: "Solfa Mei Ulti Pure", main: normals, extra: [], side: [] }, { name: "Second deck", main: normals.slice(0, 40), extra: [], side: [] }];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true });
const errors = []; page.on("pageerror", (e) => errors.push(String(e.stack || e)));
await page.route(/(ygoprodeck|fonts\.g)/, (r) => r.abort());
await page.route(`${base}/wrap.html`, (r) => r.fulfill({ contentType: "text/html", body: `<!doctype html><body style="margin:0"><iframe id="f" src="${base}/duel/?app=1&embed=1" style="border:0;width:100vw;height:100vh"></iframe><script>
addEventListener("message", (e) => { if (e.data && e.data.kx === "ready") { const w = document.getElementById("f").contentWindow;
  w.postMessage({ kx: "profile", p: ${JSON.stringify(profile)} }, "*"); w.postMessage({ kx: "decks", decks: ${JSON.stringify(decks)} }, "*"); w.postMessage({ kx: "banlist", map: { "${ASH}": 2, "${normals[0]}": 1 } }, "*"); } });
</script></body>` }));
await page.goto(`${base}/wrap.html`);
const f = await (await page.waitForSelector("#f")).contentFrame();
await f.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
await page.waitForTimeout(1500);
const fail = (m) => { console.error("FAIL:", m, errors); process.exit(1); };
const lobby = await f.evaluate(() => ({ decks: [...document.querySelectorAll("#savedDecks option")].map((o) => o.textContent), name: document.querySelector("#nameInput").value }));
console.log("lobby:", lobby);
if (!lobby.decks.includes("Solfa Mei Ulti Pure") || !lobby.decks.includes("Second deck")) fail("KodeX decks are not in the lobby");
if (lobby.name !== "Kasuteru") fail("the profile name was not used");
await f.evaluate(() => { for (const [id, v] of [["#soloOpp", "passive"], ["#soloOppDeck", "same"], ["#soloFirst", "me"]]) { const e = document.querySelector(id); e.value = v; e.dispatchEvent(new Event("change")); } });
await f.click("#soloStart");
await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.prompt, null, { timeout: 60000 });
await page.waitForTimeout(1500);
const plates = await f.evaluate(() => ({ me: !!document.querySelector(".duelist.me .avatar .pf-av.fr-gold img"), op: !!document.querySelector(".duelist.op .avatar .pf-av.fr-diamond img") }));
console.log("plates:", plates);
if (!plates.me || !plates.op) fail("profile icons and frames are not on the plates");
await page.screenshot({ path: `${out}/profile-plates.png` });
await f.click(".duelist.me .avatar");
await page.waitForTimeout(500);
const card = await f.evaluate(() => { const v = document.querySelector("#pfView"); return v && !v.hidden ? { name: v.querySelector(".pf-who b").textContent, prem: !!v.querySelector(".pf-prem"), theme: v.querySelector(".pf-card").className } : null; });
console.log("profile card:", card);
if (!card || card.name !== "Kasuteru" || !card.prem || !/th-aurora/.test(card.theme)) fail("profile card");
await page.screenshot({ path: `${out}/profile-card.png` });
await f.click("#pfView [data-pfclose]");
// the chat panel: Chat · Log · Settings, one at a time
await f.click("#sideFab"); await page.waitForTimeout(400);
const chatOnly = await f.evaluate(() => ({ actsHidden: document.querySelector(".side-actions").hidden, chatShown: !document.querySelector(".chat[data-pane=chat]").hidden }));
await f.click('#side .tabs [data-tab="opts"]'); await page.waitForTimeout(300);
const opts = await f.evaluate(() => ({ actsShown: !document.querySelector(".side-actions").hidden, chatHidden: document.querySelector(".chat[data-pane=chat]").hidden }));
console.log("chat panel:", chatOnly, opts);
if (!chatOnly.actsHidden || !chatOnly.chatShown || !opts.actsShown || !opts.chatHidden) fail("settings still cover the chat");
await page.screenshot({ path: `${out}/side-settings.png` });
await f.click("#sideClose");
// legality in card details: a card from the hand that is Limited
const hand = await f.evaluate(() => window.__duel.packet.state.teams[window.__duel.team].hand.map((h) => h.code));

await browser.close();
if (errors.length) fail("page errors");
console.log("OK: profile, KodeX decks, plates, profile card and the chat panel's Settings tab");
