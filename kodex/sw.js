const CACHE='meiocg-kodex-v4';
const CORE=['./','./index.html'];
const BRAND='<div class="brand">Duel Synapse</div><h1>KodeX</h1><div class="sub">Yu-Gi-Oh! card rulings search engine by MEIOCG</div>';
const UI_CSS=`
<style id="kodex-v4-ui">
/* Kodex V4 presentation overrides */
.hero .brand{font-size:clamp(24px,5vw,38px);font-weight:900;letter-spacing:-.035em;color:#f5f7ff;text-transform:none}
.hero h1{font-size:clamp(30px,6vw,52px);margin:5px 0 8px;color:#8fb9ff;letter-spacing:-.04em}
.hero .sub{font-size:clamp(11px,2.5vw,15px);font-weight:650;letter-spacing:.02em}
.wall-controls{position:fixed;right:16px;bottom:16px;z-index:9999;display:block;padding:0;background:transparent;border:0;backdrop-filter:none}
.wall-controls .wall-toggle{width:44px;height:44px;border:1px solid #35445c;border-radius:50%;background:#111827eF;color:#eef4ff;box-shadow:0 10px 30px #0008;cursor:pointer;font-size:18px;display:grid;place-items:center}
.wall-controls .wall-panel{display:none;position:absolute;right:0;bottom:54px;width:250px;padding:12px;background:#101722f7;border:1px solid #334158;border-radius:15px;box-shadow:0 18px 50px #000b;backdrop-filter:blur(18px)}
.wall-controls.open .wall-panel{display:block}
.wall-controls .wall-panel-title{font-weight:800;font-size:12px;margin-bottom:9px}
.wall-controls .wall-row{display:flex;align-items:center;gap:7px;margin:7px 0}
.wall-controls button,.wall-controls label{font:inherit;cursor:pointer}
.wall-controls .wall-action{border:1px solid #303c50;background:#151e2b;color:#eaf0fb;border-radius:9px;padding:7px 9px;font-size:11px}
.wall-controls .wall-opacity{flex:1;width:auto}
.wall-controls .wall-file{display:none}
@media(max-width:600px){.wall-controls{right:10px;bottom:10px}.wall-controls .wall-panel{width:230px}}
</style>`;
const UI_JS=`
<script id="kodex-v4-ui-script">
(()=>{
 const apply=()=>{
  const old=document.querySelector('.hero .brand');
  const h=document.querySelector('.hero h1');
  const sub=document.querySelector('.hero .sub');
  if(old)old.textContent='Duel Synapse';
  if(h)h.textContent='KodeX';
  if(sub)sub.textContent='Yu-Gi-Oh! card rulings search engine by MEIOCG';
  const box=document.querySelector('.wall-controls');
  if(!box||box.dataset.kodexV4)return;
  box.dataset.kodexV4='1';
  const file=box.querySelector('#wallFile'), clear=box.querySelector('#wallClear'), opacity=box.querySelector('#wallOpacity');
  box.innerHTML='';
  const toggle=document.createElement('button');toggle.className='wall-toggle';toggle.type='button';toggle.title='Wallpaper settings';toggle.setAttribute('aria-label','Wallpaper settings');toggle.textContent='⚙';
  const panel=document.createElement('div');panel.className='wall-panel';panel.innerHTML='<div class="wall-panel-title">Wallpaper settings</div><div class="wall-row"><label class="wall-action">Choose wallpaper<input class="wall-file" id="kodexWallFile" type="file" accept="image/*"></label><button class="wall-action" id="kodexWallClear" type="button">Clear</button></div><div class="wall-row"><span style="font-size:11px;color:#9aa8bd">Opacity</span><input id="kodexWallOpacity" class="wall-opacity" type="range" min="0" max="100" value="55"></div>';
  box.append(toggle,panel);
  const nf=panel.querySelector('#kodexWallFile'),nc=panel.querySelector('#kodexWallClear'),no=panel.querySelector('#kodexWallOpacity');
  if(opacity)no.value=opacity.value||localStorage.getItem('kodex:wall:opacity')||55;
  nf?.addEventListener('change',()=>file?.dispatchEvent(new Event('change')));
  if(file)Object.defineProperty(file,'files',{configurable:true,value:[]});
  // Rebind to the original wallpaper implementation without exposing its controls.
  nf?.addEventListener('change',e=>{
   const f=e.target.files?.[0]; if(!f)return;
   const reader=new FileReader();reader.onload=()=>{localStorage.setItem('kodex:wall:url',reader.result);localStorage.setItem('kodex:wall:opacity',no.value);const w=document.getElementById('wallpaper');if(w){w.style.backgroundImage='url("'+reader.result.replaceAll('"','%22')+'")';w.style.opacity=no.value/100;}};reader.readAsDataURL(f);
  });
  nc?.addEventListener('click',()=>{localStorage.removeItem('kodex:wall:url');const w=document.getElementById('wallpaper');if(w){w.style.backgroundImage='none';w.style.opacity='0'};toggle.focus()});
  no?.addEventListener('input',()=>{localStorage.setItem('kodex:wall:opacity',no.value);const w=document.getElementById('wallpaper');if(w)w.style.opacity=no.value/100});
  toggle.addEventListener('click',e=>{e.stopPropagation();box.classList.toggle('open');});
  document.addEventListener('click',e=>{if(!box.contains(e.target))box.classList.remove('open')});
  const saved=localStorage.getItem('kodex:wall:url');if(saved){const w=document.getElementById('wallpaper');if(w){w.style.backgroundImage='url("'+saved.replaceAll('"','%22')+'")';w.style.opacity=(localStorage.getItem('kodex:wall:opacity')||55)/100}}
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
})();
</script>`;
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url); if(u.origin!==location.origin)return;
 const important=u.pathname.includes('/indexes/')||u.pathname.includes('/data/rulings/')||u.pathname.endsWith('/kodex/')||u.pathname.endsWith('/kodex/index.html');
 if(!important)return;
 e.respondWith(caches.match(e.request).then(hit=>{
  const refresh=fetch(e.request).then(async r=>{
   if(!r.ok)return r;
   if(u.pathname.endsWith('/kodex/')||u.pathname.endsWith('/kodex/index.html')){
    const text=await r.clone().text();
    if(/<html/i.test(text)){
     let out=text;
     out=out.replace(/<div class="brand">MEIOCG DATABASE<\/div><h1>Kodex<\/h1><div class="sub">Yu-Gi-Oh! card, ID, archetype & ruling search<\/div>/,BRAND);
     if(!out.includes('id="kodex-v4-ui"'))out=out.replace('</head>',UI_CSS+'</head>');
     if(!out.includes('id="kodex-v4-ui-script"'))out=out.replace('</body>',UI_JS+'</body>');
     r=new Response(out,{status:r.status,statusText:r.statusText,headers:new Headers(r.headers)});
    }
   }
   await caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r;
  }).catch(()=>hit);
  return hit||refresh;
 }));
});