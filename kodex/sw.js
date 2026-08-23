const CACHE='meiocg-kodex-v3';
const CORE=['./','./index.html'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;
  const important=u.pathname.includes('/indexes/')||u.pathname.includes('/data/rulings/')||u.pathname.endsWith('/kodex/')||u.pathname.endsWith('/kodex/index.html');
  if(!important)return;
  e.respondWith(caches.match(e.request).then(hit=>{
    const refresh=fetch(e.request).then(r=>{if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r}).catch(()=>hit);
    return hit||refresh;
  }));
});