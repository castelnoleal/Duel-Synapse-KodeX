// KodeX web app (kodex.meiocg.org/app/): keeps the app itself on the phone so it opens offline, and the card data it
// has used. Pages: the newest from the network, the saved one when offline. The Arena (/duel/) has its own worker.
const VERSION = "kx-web-1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/kodex-180.png", "./icons/kodex-192.png", "./icons/kodex-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("kx-web-") && k !== VERSION && k !== VERSION + "-data").map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/")) return;
  // the app page: the network first (new versions show at once), the saved copy offline
  if (r.mode === "navigate" || u.pathname === "/app/" || u.pathname === "/app/index.html") {
    e.respondWith(fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(VERSION).then((ca) => ca.put("./index.html", c)); } return res; })
      .catch(() => caches.match("./index.html")));
    return;
  }
  // card data and search indexes: the saved copy at once, refreshed in the background
  if (/^\/(data|indexes)\//.test(u.pathname) || u.pathname.startsWith("/app/icons/")) {
    e.respondWith(caches.open(VERSION + "-data").then(async (c) => {
      const hit = await c.match(r);
      const net = fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
