// Arena v78: the Quick reactions dialog stays hidden until it is opened (it used to sit over the lobby and push the
// table out of shape), own picture emotes keep a small tile in landscape, combos play gently (effects in a soft circle
// around the card, a small summon banner), the step of a combo stays on screen, and the replay speed can be chosen.
// usage: node tests/duel/ui-v78.mjs http://localhost:8787 [outdir]
import fs from "node:fs";
import zlib from "node:zlib";
import { chromium } from "playwright";
const base = process.argv[2] || "http://localhost:8787", out = process.argv[3] || ".";
const raw = JSON.parse(fs.readFileSync(new URL("../../duel/data/cards.json", import.meta.url))).cards;
const byName = (n) => { for (const [c, r] of Object.entries(raw)) if (r[12] === n) return Number(c); throw new Error("no card " + n); };
const normals = Object.entries(raw).filter(([c, r]) => !r[0] && (r[2] & 0x11) === 0x11 && !(r[2] & 0x4000)).slice(0, 40).map(([c, r]) => [Number(c), r[12], 1]);
const payload = Buffer.from(JSON.stringify({ n: "v78", m: normals, e: [], s: [] })).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const CUTIA = byName("DoSolfachord Cutia"), HARM = byName("Solfachord Harmonia"), COOLIA = byName("DoSolfachord Coolia"), GRAN = byName("GranSolfachord Coolia");
const combo = { id: "t78", title: "Solfachord Test", deck: "Solfachord", hand: [CUTIA], extra: [GRAN], fx: "lightning", speed: 0.5,
  lines: [[{ cards: [{ c: CUTIA, a: "ss" }] }, { cards: [{ c: HARM }] }, { cards: [{ c: COOLIA, a: "ss" }] }]], intro: { ms: 900, key: GRAN, art: GRAN } };
// a big picture, like a GIF someone made their own emote
const big = (() => {                     // a 400×400 PNG, made here
  const W = 400, H = 400, rows = [];
  for (let y = 0; y < H; y++) { const r = Buffer.alloc(1 + W * 3); for (let x = 0; x < W; x++) { const on = (x - 200) ** 2 + (y - 200) ** 2 < 150 ** 2; r[1 + x * 3] = on ? 255 : 200; r[2 + x * 3] = on ? 220 : 40; r[3 + x * 3] = 40; } rows.push(r); }
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
  return "data:image/png;base64," + png.toString("base64");
})();
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
window.__videos = [];
addEventListener("message", (e) => { const d = e.data || {}; if (d.kx === "ready") document.getElementById("f").contentWindow.postMessage({ kx: "skin", premium: true, showFx: {} }, "*");
  if (d.kx === "saveVideo") window.__videos.push({ size: d.buf.byteLength }); });
</script></body>` }));
  await page.goto(`${base}/wrap.html`);
  const f = await (await page.waitForSelector("#f")).contentFrame();
  await f.waitForFunction(() => document.querySelector("#engineDot")?.classList.contains("ready"), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  return { page, f };
}

// ----- portrait: the dialog is not there until it is opened, and the table keeps its shape
{
  const { page, f } = await open(412, 915);
  ok(await f.evaluate(() => getComputedStyle(document.querySelector("#quickDlg")).display === "none"), "the closed Quick reactions dialog is not shown over the lobby");
  await f.evaluate(() => { for (const [id, v] of [["#soloOpp", "passive"], ["#soloOppDeck", "same"], ["#soloFirst", "me"]]) { const e = document.querySelector(id); if (e) { e.value = v; e.dispatchEvent(new Event("change")); } } });
  await f.click("#soloStart");
  await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.prompt && window.__duel.packet.waitingFor === window.__duel.team, null, { timeout: 60000 });
  await page.waitForTimeout(2500); await f.evaluate(() => document.querySelector("#opening")?.click()); await page.waitForTimeout(500);
  const g = await f.evaluate(() => { const d = document.querySelector("#quickDlg").getBoundingClientRect(), z = document.querySelector("#field .zone, #field [id^=z]")?.getBoundingClientRect(); return { dlg: d.height, zw: z && z.width, zh: z && z.height, disp: getComputedStyle(document.querySelector("#quickDlg")).display }; });
  ok(g.disp === "none" && g.dlg === 0, "nor in a duel " + JSON.stringify(g));
  await page.screenshot({ path: `${out}/v78-duel.png` });
  await page.close();
}

// ----- landscape: an own picture emote keeps a small tile and the chooser is usable
{
  const { page, f } = await open(900, 405);
  await page.evaluate((src) => { const w = document.getElementById("f").contentWindow; w.postMessage({ kx: "skin", premium: true, showFx: {}, emotes: [{ name: "Big", src }] }, "*"); w.postMessage({ kx: "quick", list: ["c0", "t:GGEZ"], bar: true }, "*"); }, big);
  await page.waitForTimeout(300);
  await f.evaluate(() => { for (const [id, v] of [["#soloOpp", "passive"], ["#soloOppDeck", "same"], ["#soloFirst", "me"]]) { const e = document.querySelector(id); if (e) { e.value = v; e.dispatchEvent(new Event("change")); } } });
  await f.click("#soloStart");
  await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.prompt && window.__duel.packet.waitingFor === window.__duel.team, null, { timeout: 60000 });
  await page.waitForTimeout(2500); await f.evaluate(() => document.querySelector("#opening")?.click()); await page.waitForTimeout(400);
  await f.evaluate(() => { window.__duel && 0; const d = document.querySelector("#quickDlg"); document.querySelector("#quickEdit").click(); });
  await page.waitForTimeout(400);
  const q = await f.evaluate(() => { const t = document.querySelector('#quickPicked [data-qid="c0"]'); const r = t && t.getBoundingClientRect(), dr = document.querySelector("#quickDlg").getBoundingClientRect(), done = document.querySelector("#quickDone").getBoundingClientRect(), inp = document.querySelector("#quickPhrase").getBoundingClientRect();
    return { w: r && r.width, h: r && r.height, top: dr.top, bottom: dr.bottom, H: innerHeight, done: done.bottom <= innerHeight && done.height > 0, inp: inp.bottom <= dr.bottom && inp.height > 0 }; });
  ok(q.w && q.w <= 50 && q.h <= 50, "the picture emote has a small tile " + JSON.stringify(q));
  ok(q.top >= 0 && q.bottom <= q.H + 1 && q.done && q.inp, "the chooser fits, with its phrase box and Done in reach");
  await page.screenshot({ path: `${out}/v78-quick.png` });
  await f.click("#quickDone");
  ok(await f.evaluate(() => getComputedStyle(document.querySelector("#quickDlg")).display === "none"), "Done closes it");
  // ----- a combo: gentle, its step on screen, at the speed it came with
  await page.evaluate((c) => document.getElementById("f").contentWindow.postMessage({ kx: "combo", combo: c, keep: false }, "*"), combo);
  await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.combo && window.__duel.packet.combo.step >= 1, null, { timeout: 40000 });
  ok(await f.evaluate(() => window.__duel.replay.speed === 0.5), "the combo plays at the speed set in KodeX");
  const st = await f.evaluate(() => { const b = document.querySelector("#cbStep"); const r = b.getBoundingClientRect(); return { on: !b.hidden && r.height > 0, txt: b.textContent, top: r.top, bottom: r.bottom }; });
  ok(st.on && /STEP 1\/3/.test(st.txt) && /Cutia/.test(st.txt), "the step is on screen " + JSON.stringify(st));
  await f.waitForFunction(() => !!document.querySelector(".cbfx-layer"), null, { timeout: 20000 }).catch(() => fail("no effect"));
  await page.waitForTimeout(350);
  const px = await f.evaluate(() => { const c = document.querySelector(".cbfx-layer"); const g = c.getContext("2d"), W = c.width, H = c.height; let lit = 0, far = 0;
    const d = g.getImageData(0, 0, W, H).data; for (let i = 3; i < d.length; i += 4 * 7) { if (d[i] > 8) lit++; } const s = 8, corners = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]]; for (const [x, y] of corners) if (g.getImageData(x, y, 1, 1).data[3] > 0) far++; return { share: lit / (d.length / 4 / 7), far }; });
  ok(px.share < .35 && px.far === 0, "the effect stays around the card, not over the whole screen " + JSON.stringify(px));
  ok(await f.evaluate(() => !document.body.classList.contains("cbfx-shake")), "nothing shakes");
  await page.screenshot({ path: `${out}/v78-fx.png` });
  // the speed list
  await f.evaluate(() => document.querySelector("#replayBar").classList.remove("dim"));
  await f.click("#rbSpeed");
  ok(await f.isVisible("#rbSpeedMenu"), "the speed button opens a list of speeds");
  const sm = await f.evaluate(() => { const r = document.querySelector("#rbSpeedMenu").getBoundingClientRect(); return { n: document.querySelectorAll("#rbSpeedMenu [data-sp]").length, in: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, cur: document.querySelector('#rbSpeedMenu [aria-checked="true"]').dataset.sp }; });
  ok(sm.n >= 6 && sm.in && sm.cur === "0.5", "with the current one marked " + JSON.stringify(sm));
  await page.screenshot({ path: `${out}/v78-speed.png` });
  await f.click('#rbSpeedMenu [data-sp="2"]');
  ok(await f.evaluate(() => window.__duel.replay.speed === 2 && document.querySelector("#rbSpeed").textContent === "2×" && JSON.parse(localStorage.getItem("duel:pref")).rpSpeed === 2), "choosing 2× speeds it up and is kept");
  ok(await f.isHidden("#rbSpeedMenu"), "the list closes");
  await f.waitForFunction(() => window.__duel.packet && window.__duel.packet.combo && window.__duel.packet.combo.last, null, { timeout: 40000 });
  await page.waitForTimeout(400);
  ok(/STEP 3\/3/.test(await f.evaluate(() => document.querySelector("#cbStep").textContent)), "the last step is shown");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/v78-finale.png` });
  // a recording keeps the step and fits the gentle effect in
  await page.waitForTimeout(2200);
  await f.evaluate(() => document.querySelector("#rbRec").click()); await page.waitForTimeout(300);
  await f.evaluate(() => { document.querySelector("#recUntil").value = "end"; document.querySelector("#recSize").value = "720"; document.querySelector("#recGo").click(); });
  await f.waitForFunction(() => window.__duel.rec && window.__duel.packet?.combo?.step >= 2, null, { timeout: 60000 }).catch(() => fail("the recording did not reach step 2"));
  await page.waitForTimeout(400);
  const shot = await f.evaluate(() => window.__duel.rec && window.__duel.rec.clip.cv.toDataURL("image/jpeg", .8));
  if (shot) fs.writeFileSync(`${out}/v78-video.jpg`, Buffer.from(shot.split(",")[1], "base64"));
  ok(await f.evaluate(() => !document.querySelector("#cbStep").hidden), "the step stays on screen while recording");
  await page.waitForFunction(() => window.__videos.some((v) => v.size > 1000), null, { timeout: 60000 }).catch(() => fail("no video"));
  ok(true, "the video is saved");
  await page.close();
}
ok(!errors.length, "no page errors " + errors.join(" | "));
await browser.close();
console.log("OK: v78");
