// Duel Synapse Arena: keeps the rules engine, card data, card scripts and card art on the device
// so solo playtests work without a connection. Online rooms always need the network.
const VERSION = "v1";                       // bump when engine/UI files change so the new files are saved
const SHELL = "arena-shell-" + VERSION;
const SCRIPTS = "arena-scripts";            // card scripts are pinned to a commit, so they never change
const ART = "arena-art";
const FILES = [
  "./", "./index.html", "./app.js", "./offline.js", "./deck.js", "./net.js", "./host-worker.js", "./arena.css",
  "./engine/bot.js", "./engine/constants.js", "./engine/core.js", "./engine/data.js", "./engine/host.js", "./engine/rules.js",
  "./engine/ocgcore.wasm", "./data/cards.json", "./data/strings.json", "./data/scripts.json",
  "./assets/meiocg-64.png", "./assets/meiocg-64.webp", "./assets/meiocg-192.png", "./assets/meiocg-192.webp", "./assets/meiocg-512.webp",
];

const key = (req) => { const u = new URL(req.url || req); return u.origin + u.pathname; };

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await Promise.all(FILES.map((f) => c.add(new Request(f, { cache: "reload" })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const n of await caches.keys()) if (n.startsWith("arena-shell-") && n !== SHELL) await caches.delete(n);
    await self.clients.claim();
  })());
});

async function cacheFirst(req, name) {
  const c = await caches.open(name);
  const hit = await c.match(key(req));
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) c.put(key(req), res.clone());
  return res;
}

// Shell files: take the network answer when it arrives quickly, otherwise (or offline) the saved copy.
async function networkFirst(e, ms) {
  const req = e.request, c = await caches.open(SHELL), k = req.mode === "navigate" ? new URL("./", self.registration.scope).href : key(req);
  const net = fetch(req).then((res) => { if (res.ok) c.put(k, res.clone()); return res; });
  e.waitUntil(net.catch(() => {}));
  const saved = await c.match(k);
  if (!saved) return net;
  return Promise.race([net.catch(() => saved), new Promise((r) => setTimeout(() => r(saved), ms))]);
}

// Large data: answer from the saved copy right away and refresh it in the background.
async function staleWhileRevalidate(e) {
  const req = e.request, c = await caches.open(SHELL), saved = await c.match(key(req));
  const net = fetch(req).then((res) => { if (res.ok) c.put(key(req), res.clone()); return res; });
  e.waitUntil(net.catch(() => {}));
  return saved || net;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin !== location.origin) return;
  const p = u.pathname;
  if (p.startsWith("/duel/scripts/")) return e.respondWith(cacheFirst(req, SCRIPTS));
  if (/^\/img\/\d+\.jpg$/.test(p)) return e.respondWith(cacheFirst(req, ART));
  if (p.endsWith(".wasm") && p.startsWith("/duel/")) return e.respondWith(cacheFirst(req, SHELL));
  if (p.startsWith("/duel/data/")) return e.respondWith(staleWhileRevalidate(e));
  if (p.startsWith("/duel/")) return e.respondWith(networkFirst(e, 4000));
});
