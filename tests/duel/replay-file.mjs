// Replay files: our own .yrp and a desktop-client style .yrpX (LZMA, classic replay inside) are read back by
// duel/engine/replayfile.js and re-run on a fresh engine in replay mode; the re-run must end like the original.
// usage: node tests/duel/replay-file.mjs <CardScripts dir> [duels]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { OcgCore } from "../../duel/engine/core.js";
import { CardDB, ScriptStore } from "../../duel/engine/data.js";
import { DuelHost } from "../../duel/engine/host.js";
import { botAnswer } from "../../duel/engine/bot.js";
import { readReplay, lzmaDecode } from "../../duel/engine/replayfile.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scriptsDir = process.argv[2], N = Number(process.argv[3] || 3);
const db = new CardDB(JSON.parse(fs.readFileSync(path.join(root, "duel/data/cards.json"))), JSON.parse(fs.readFileSync(path.join(root, "duel/data/strings.json"))));
const index = JSON.parse(fs.readFileSync(path.join(root, "duel/data/scripts.json")));
const store = new ScriptStore(index, async (p) => { try { return fs.readFileSync(path.join(scriptsDir, p), "utf8"); } catch { return null; } });
const core = await OcgCore.load(fs.readFileSync(path.join(root, "duel/engine/ocgcore.wasm")));
const deck = { main: [46986414, 46986414, 89631139, 89631139, 12580477, 5318639, 83764718, 14558127, 14558127, 44095762, 26202165, 53129443,
  70781052, 91152256, 6368038, 40640057, 54652250, 31560081, 72302403, 4206964, 97077563, 24094653, 24094653, 70781052,
  91152256, 6368038, 40640057, 54652250, 31560081, 4206964, 97077563, 26202165, 46986414, 89631139, 5318639, 44095762,
  14558127, 53129443, 12580477, 83764718], extra: [11901678, 66889139, 1861629, 84013237, 44508094] };
await store.preload([...deck.main, ...deck.extra]);

// LZMA with python (raw LZMA1 the way desktop clients write it: lc3 lp0 pb2, 16 MB dictionary)
function lzma(bytes) {
  const tmp = fs.mkdtempSync("/tmp/kxlz-"), i = path.join(tmp, "in"), o = path.join(tmp, "out");
  fs.writeFileSync(i, bytes);
  execFileSync("python3", ["-c", `import lzma,sys;d=open(sys.argv[1],'rb').read();open(sys.argv[2],'wb').write(lzma.compress(d,format=lzma.FORMAT_RAW,filters=[{"id":lzma.FILTER_LZMA1,"dict_size":1<<24,"lc":3,"lp":0,"pb":2}]))`, i, o]);
  return new Uint8Array(fs.readFileSync(o));
}
const props = Uint8Array.from([93, 0, 0, 0, 1]);
function yrpx(yrp1, names) {
  // the classic replay inside, compressed like the client does
  const ib = yrp1.slice(72), ic = lzma(ib), ih = yrp1.slice(0, 72); const dv = new DataView(ih.buffer);
  dv.setUint32(8, dv.getUint32(8, true) | 1, true); dv.setUint32(16, ib.length, true); ih.set(props, 24);
  const inner = Uint8Array.from([...ih, ...ic]);
  const out = [];
  const u32 = (v) => { for (let k = 0; k < 4; k++) out.push((v >>> (8 * k)) & 0xff); };
  const name = (s) => { for (let k = 0; k < 20; k++) { const c = k < s.length ? s.charCodeAt(k) : 0; out.push(c & 0xff, c >> 8); } };
  u32(1); name(names[0]); u32(1); name(names[1]);
  for (let k = 0; k < 8; k++) out.push(0);                        // duel flags (u64)
  out.push(40); u32(2); out.push(0, 0);                             // a MSG_NEW_TURN packet
  out.push(231); u32(inner.length); out.push(...inner);             // OLD_REPLAY_MODE
  const body = Uint8Array.from(out), comp = lzma(body);
  const h = new Uint8Array(72); const hv = new DataView(h.buffer);
  hv.setUint32(0, 0x58707279, true); hv.setUint32(4, 41, true); hv.setUint32(8, 0x1 | 0x10 | 0x20 | 0x100 | 0x200, true);
  hv.setUint32(16, body.length, true); h.set(props, 24); hv.setBigUint64(32, 1n, true);
  return Uint8Array.from([...h, ...comp]);
}

let ok = 0;
for (let n = 0; n < N; n++) {
  let file = null, result = null;
  await new Promise((done) => {
    const host = new DuelHost({ core, db, scripts: store, decks: [structuredClone(deck), structuredClone(deck)], names: ["Alpha", "Beta"], options: {}, emit: (v, p) => {
      if (p.ended) { if (!result) { result = p.ended; file = host.replayFile(); host.destroy(); done(); } return; }
      if (p.prompt && v === p.waitingFor) setTimeout(() => { if (!host.ended && host.pending && host.pending.player === v) host.respond(v, botAnswer(host.pending.msg, { mode: "random", db, view: p, hint: p.prompt.hint, mem: {} })); }, 0);
    } });
    host.start();
    setTimeout(() => { if (!result) { result = { winner: -2 }; file = host.replayFile(); host.destroy(); done(); } }, 20000);
  });
  for (const [label, bytes] of [["yrp", file], ["yrpX", yrpx(file, ["Alpha", "Beta"])]]) {
    if (process.env.OUT) fs.writeFileSync(path.join(process.env.OUT, `duel${n + 1}.${label}`), bytes);
    const r = readReplay(bytes);
    let end = null;
    const h = new DuelHost({ core, db, scripts: store, decks: r.decks, names: r.names, options: { replay: r }, emit: (v, p) => {
      if (v !== 3) throw new Error("replay viewer");
      if (p.ended) { end = end || p.ended; return; }
      if (p.events.some((e) => e.type === 1)) { end = { winner: -9, reason: "desync" }; return; }
      if (h.pending && !h.ended) setTimeout(() => { if (h.ended || !h.pending) return; if (i >= r.responses.length) { h.finish(-1, "End of the replay", []); return; } h.respondRaw(r.responses[i++]); }, 0);
    } });
    let i = 0;
    h.start();
    const t0 = Date.now(); while (!end && Date.now() - t0 < 30000) await new Promise((res) => setTimeout(res, 5));
    h.destroy();
    const same = result.winner >= 0 ? end && end.winner === result.winner : end && end.winner !== -9;
    console.log(`duel ${n + 1} ${label}: original ${JSON.stringify(result)}; replay ${JSON.stringify(end)} ${same ? "OK" : "MISMATCH"}`);
    if (same) ok++;
  }
}
console.log(`${ok}/${N * 2} replays matched`);
process.exit(ok === N * 2 ? 0 : 1);
