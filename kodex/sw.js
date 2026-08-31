const CACHE='meiocg-kodex-v6';
const CORE=['./','./index.html'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url);
 if(u.origin!==location.origin)return;
 // KodeX card data is now private and served through the Cloudflare API.
 // Never cache or intercept the old public index/ruling paths.
 if(u.pathname.includes('/indexes/')||u.pathname.includes('/data/rulings/')||u.pathname.includes('/data/cards.min.json'))return;
});
