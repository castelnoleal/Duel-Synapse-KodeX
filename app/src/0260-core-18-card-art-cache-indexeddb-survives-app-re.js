/* ---------- card art cache (IndexedDB, survives app restarts) ---------- */
const IC_MAX=800,icMem=new Map();
const kvDel=async k=>{try{const d=await db();return await new Promise((ok,no)=>{const t=d.transaction('kv','readwrite');t.objectStore('kv').delete(k);t.oncomplete=()=>ok(true);t.onerror=()=>no(t.error)})}catch(e){return false}};
const svcBase=()=>IMG_BASE;
const artSrc=u=>{const b=svcBase(),m=b&&/^https:\/\/images\.ygoprodeck\.com\/images\/cards(?:_small|_cropped)?\/(\d{3,10})\.jpg$/.exec(u||'');return m?b+'/img/'+m[1]+'.jpg':u};
async function icGet(u){if(!u||u.startsWith('data:'))return u||null;if(icMem.has(u))return icMem.get(u);const r=await kv('get','i:'+u);const v=r&&r.d||null;if(v)icMem.set(u,v);return v}
const icInflight=new Map();
let icAct=0;const icQ=[];const icSlot=()=>new Promise(r=>{const go=()=>{icAct++;r()};icAct<4?go():icQ.push(go)});const icFree=()=>{icAct--;const n=icQ.shift();if(n)n()};
const icFetch=src=>new Promise((ok,no)=>{const i=new Image();i.crossOrigin='anonymous';let t=setTimeout(()=>no(new Error('timeout')),7000);i.onload=()=>{clearTimeout(t);try{const w=Math.min(300,i.naturalWidth),h=Math.round(i.naturalHeight*w/i.naturalWidth),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(i,0,0,w,h);ok(c.toDataURL('image/jpeg',.82))}catch(e){no(e)}};i.onerror=()=>{clearTimeout(t);no(new Error('img'))};i.src=src});
function icLoad(u){
  if(icInflight.has(u))return icInflight.get(u);
  const p=(async()=>{const hit=await icGet(u);if(hit)return hit;
    await icSlot();let d=null,err=null;try{for(const src of [artSrc(u),artSrc(u),u]){try{d=await icFetch(src);break}catch(e){err=e;await new Promise(r=>setTimeout(r,500))}}}finally{icFree()}if(!d)throw err||new Error('img');
    icMem.set(u,d);await kv('put','i:'+u,{d,t:Date.now()});icTrim();icStat();return d})();
  icInflight.set(u,p);p.then(()=>icInflight.delete(u),()=>icInflight.delete(u));return p
}
let icTrimT=0;async function icTrim(){if(Date.now()-icTrimT<20000)return;icTrimT=Date.now();try{const k=await kvCur('i:',false);if(k.length<=IC_MAX)return;const rows=[];for(const key of k){const r=await kv('get',key);rows.push([key,r&&r.t||0])}rows.sort((a,b)=>a[1]-b[1]);for(const [key] of rows.slice(0,k.length-IC_MAX+100)){await kvDel(key);icMem.delete(key.slice(2))}}catch(e){}}
async function icStat(){const e=$('icv');if(!e)return;try{const k=await kvCur('i:',false);e.textContent=k.length?k.length.toLocaleString()+' images saved':'Empty'}catch(x){e.textContent='Empty'}}
function icWarm(urls){[...new Set(urls.filter(u=>/^https:/.test(u||'')))].slice(0,120).reduce((p,u)=>p.then(()=>icLoad(u).catch(()=>{})),Promise.resolve())}
icStat();$('icClr').onclick=async()=>{const k=await kvCur('i:',false);for(const x of k)await kvDel(x);icMem.clear();icStat();toast('Image cache cleared')};
/* offline / failed thumbnails fall back to the saved copy */
function kxHydrate(im){if(im.dataset.h||!im.dataset.u)return;im.dataset.h='1';const u=im.dataset.u;icGet(u).then(v=>{im.src=v||u},()=>{im.src=u})}
new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes){if(n.nodeType!==1)continue;if(n.tagName==='IMG')kxHydrate(n);else n.querySelectorAll&&n.querySelectorAll('img[data-u]').forEach(kxHydrate)}}).observe(document.body,{childList:true,subtree:true});
function kxImgErr(im){return kxImgErr0(im)}
async function kxImgErr0(im){const u=im.dataset.u||im.src;if(!im.dataset.icTried&&/^https:/.test(u)){im.dataset.icTried='1';const v=await icGet(u);if(v&&im.src!==v){im.style.visibility='';im.src=v;return}if(im.dataset.u&&im.src!==im.dataset.u&&!im.src.startsWith('data:')){im.style.visibility='';im.src=im.dataset.u;return}}const b=im.closest('button');if(b)b.classList.add('image-missing');im.remove()}
document.addEventListener('load',e=>{const im=e.target;if(im&&im.tagName==='IMG'&&im.style.visibility==='hidden')im.style.visibility='';if(im&&im.tagName==='IMG'&&im.closest('.deck-card-thumb')&&im.dataset.u&&!(im.currentSrc||'').startsWith('data:')&&!im.dataset.icQ){im.dataset.icQ='1';icLoad(im.dataset.u).catch(()=>{})}},true);
function applySab(){const u=S.g('sab',null);let v;if(u!==null&&u!==undefined)v=+u;else{const p=document.createElement('div');p.style.cssText='position:fixed;bottom:0;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)';document.body.appendChild(p);const e=parseFloat(getComputedStyle(p).paddingBottom)||0;p.remove();v=e>0?e:0}document.documentElement.style.setProperty('--sab',v+'px');$('sab').value=v;$('sabv').textContent=(u===null||u===undefined)?'Auto · '+v+' px':v+' px'}

$('sab').oninput=e=>{S.s('sab',+e.target.value);applySab()};$('sabAuto').onclick=()=>{S.s('sab',null);applySab()};
$('sat').oninput=e=>{S.s('sat',+e.target.value);applySat()};$('satAuto').onclick=()=>{S.s('sat',null);applySat()};

