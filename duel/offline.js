// Duel Synapse Arena: offline storage, and the hooks the KodeX app uses.
//  - registers the service worker (sw.js) that keeps the engine, card data, scripts and art on the device
//  - "Offline" panel: saves the card scripts and art for the decks stored in the Arena
//  - #prepare=<payload>: the KodeX app sends all of its decks, which are stored here and then saved for offline play
//  - ?app=1: opened from inside the KodeX app, so the "KodeX" links return to the app
import { ScriptStore } from "./engine/data.js";

const BASE = new URL("./", import.meta.url).href;
const SCRIPT_CACHE = "arena-scripts", ART_CACHE = "arena-art", SHELL_PREFIX = "arena-shell-";
const FILLER = 15025844;
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } } };
const ss = (k, v) => { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } return null; };

// ---- opened from the KodeX app
if (new URLSearchParams(location.search).get("app") === "1") { ss("kx:app", "1"); if (!ss("kx:h0")) ss("kx:h0", String(history.length)); }
const inApp = () => ss("kx:app") === "1";
function exitToApp() {
  const back = Math.max(1, history.length - (+ss("kx:h0") || 1) + 1);
  history.go(-back);
  setTimeout(() => { location.href = "/"; }, 900);
}

// ---- decks sent by the KodeX app: store them before the Arena reads its saved decks
let pending = null;
try {
  const h = new URLSearchParams(location.hash.slice(1)).get("prepare");
  if (h) {
    const s = h.replace(/-/g, "+").replace(/_/g, "/");
    const P = JSON.parse(decodeURIComponent(escape(atob(s))));
    const ids = (list) => (list || []).flatMap((x) => Array.from({ length: Math.max(1, x[2] | 0) }, () => Number(x[0]) || 0)).filter(Boolean);
    const decks = ls.get("duel:decks", []);
    for (const d of P.d || []) {
      const entry = { name: String(d.n || "KodeX deck").slice(0, 60), main: ids(d.m), extra: ids(d.e), side: ids(d.s) };
      if (!entry.main.length && !entry.extra.length) continue;
      const i = decks.findIndex((x) => x.name === entry.name);
      if (i >= 0) decks[i] = entry; else decks.unshift(entry);
    }
    ls.set("duel:decks", decks.slice(0, 30));
    pending = true;
    history.replaceState(null, "", location.pathname + location.search);
  }
} catch (e) { /* not a valid payload: ignore */ }

// ---- service worker
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});

// ---- saving decks for offline play
async function savedAlready(c, url) { try { return !!(await c.match(url)); } catch (e) { return false; } }
async function fetchInto(cacheName, url) {
  const c = await caches.open(cacheName);
  if (await savedAlready(c, url)) return true;
  for (let a = 0; a < 3; a++) {
    try { const r = await fetch(url); if (r.ok) { await c.put(url, r); return true; } if (r.status === 404) return false; } catch (e) { /* retry */ }
    await new Promise((r) => setTimeout(r, 400 * (a + 1)));
  }
  return false;
}
export async function saveForOffline(onProgress) {
  const decks = ls.get("duel:decks", []);
  if (!decks.length) throw new Error("No decks to save");
  const index = await (await fetch(BASE + "data/scripts.json")).json();
  const store = new ScriptStore(index, null);
  const codes = new Set([FILLER]);
  for (const d of decks) for (const c of [...d.main, ...d.extra, ...(d.side || [])]) codes.add(Number(c));
  const names = [...store.utilPath.keys()];
  for (const c of store.closure(codes)) names.push(`c${c}.lua`);
  const jobs = [];
  for (const n of names) { const p = store.pathFor(n); if (p) jobs.push([SCRIPT_CACHE, `${BASE}scripts/${index.commit}/${p}`]); }
  for (const c of codes) jobs.push([ART_CACHE, `${location.origin}/img/${c}.jpg`]);
  let done = 0, failed = 0, i = 0;
  const worker = async () => {
    while (i < jobs.length) {
      const [cache, url] = jobs[i++];
      const ok = await fetchInto(cache, url);
      if (!ok && cache === SCRIPT_CACHE) failed++;
      onProgress && onProgress(++done, jobs.length);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  const info = { t: Date.now(), decks: decks.length, scripts: names.length - failed, failed };
  ls.set("duel:offline", info);
  return info;
}
async function engineSaved() {
  try { for (const n of await caches.keys()) if (n.startsWith(SHELL_PREFIX)) { const c = await caches.open(n); if (await c.match(BASE + "engine/ocgcore.wasm") && await c.match(BASE + "data/cards.json")) return true; } } catch (e) { /* ignore */ }
  return false;
}

// ---- interface
const css = document.createElement("style");
css.textContent = `
.off-panel{margin:16px auto 0;max-width:1180px;padding:16px 18px;display:grid;gap:10px}
.off-panel h2{margin:0;font-size:15px}
.off-row{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.off-st{color:var(--muted);font-size:13px}
.off-bar{height:5px;border-radius:3px;background:var(--line);overflow:hidden}
.off-bar i{display:block;height:100%;width:0;background:var(--a);transition:width .15s}
.off-banner{position:fixed;left:0;right:0;bottom:0;z-index:50;text-align:center;padding:8px 12px calc(8px + env(safe-area-inset-bottom,0px));background:#2a2210;color:#f2c75c;font-size:13px}
`;
document.head.append(css);

function mount() {
  document.querySelectorAll("a.brand, a.toplink").forEach((a) => a.addEventListener("click", (e) => { if (inApp()) { e.preventDefault(); exitToApp(); } }));
  const bar = document.createElement("div");
  bar.className = "off-banner"; bar.hidden = navigator.onLine; bar.textContent = "Offline. Solo playtest only; online duels need a connection.";
  document.body.append(bar);
  addEventListener("online", () => { bar.hidden = true; refresh(); });
  addEventListener("offline", () => { bar.hidden = false; refresh(); });

  const lobby = document.querySelector("#lobby");
  if (!lobby) return;
  const panel = document.createElement("section");
  panel.className = "panel off-panel"; panel.id = "offlinePanel";
  panel.innerHTML = `<h2>Offline play</h2><div class="off-row"><span class="off-st" id="offSt"></span><span><button class="btn primary" id="offSave" type="button">Save decks for offline</button> <button class="btn ghost" id="offBack" type="button" hidden>Back to KodeX</button></span></div><div class="off-bar" id="offBarWrap" hidden><i id="offBar"></i></div>`;
  const foot = lobby.querySelector(".foot");
  lobby.insertBefore(panel, foot || null);
  const st = panel.querySelector("#offSt"), btn = panel.querySelector("#offSave"), pb = panel.querySelector("#offBar"), pw = panel.querySelector("#offBarWrap");
  if (inApp()) { const b = panel.querySelector("#offBack"); b.hidden = false; b.onclick = exitToApp; }
  let busy = false;
  async function refresh() {
    if (busy) return;
    const info = ls.get("duel:offline", null), eng = await engineSaved(), n = ls.get("duel:decks", []).length;
    btn.disabled = !navigator.onLine || !n;
    st.textContent = !n ? "No decks saved in the Arena yet."
      : info && eng ? `Ready offline · ${info.decks} deck${info.decks === 1 ? "" : "s"} · ${info.scripts} card scripts` + (info.failed ? ` · ${info.failed} missing` : "") + (n > info.decks ? ` · ${n - info.decks} new` : "")
      : eng ? "Engine saved. Decks are not saved yet." : "Not saved yet.";
    if (!navigator.onLine && !(info && eng)) st.textContent = "Connect to the internet to save decks for offline play.";
  }
  async function run() {
    if (busy) return;
    busy = true; btn.disabled = true; pw.hidden = false; pb.style.width = "0";
    try {
      await navigator.serviceWorker.ready.catch(() => {});
      const info = await saveForOffline((d, t) => { pb.style.width = Math.round(d / t * 100) + "%"; st.textContent = `Saving ${d} / ${t}`; });
      busy = false; pw.hidden = true; await refresh();
      st.textContent = `Saved for offline · ${info.decks} deck${info.decks === 1 ? "" : "s"} · ${info.scripts} card scripts` + (info.failed ? ` · ${info.failed} could not be saved, try again` : "");
    } catch (e) { busy = false; pw.hidden = true; await refresh(); st.textContent = e.message || "Could not save"; }
  }
  btn.addEventListener("click", run);
  refresh();
  if (pending) setTimeout(run, 800);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
