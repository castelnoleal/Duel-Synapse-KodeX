const CACHE='meiocg-kodex-v2';
const CORE=['./','./Duel_Synapse_Kodex.html'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(u.origin!==location.origin||e.request.method!=='GET')return;
 const isData=u.pathname.includes('/indexes/search.json')||u.pathname.includes('/data/rulings/cards/');
 if(!isData)return;
 e.respondWith(caches.match(e.request).then(hit=>{
  const refresh=fetch(e.request).then(r=>{if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r}).catch(()=>hit);
  return hit||refresh;
 }));
});