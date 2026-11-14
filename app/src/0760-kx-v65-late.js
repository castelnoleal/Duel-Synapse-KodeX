/* KodeX 9.8 (v65): app screens do not zoom; the Arena is part of the app (a browser is pointed to Google Play);
   combo images carry their combo, so an image can be read back into a combo and its replay; replays from the Arena
   arrive as combos. Created by Castel Noleal, creator of MEIOCG. A project of Meta Insider OCG since 2023. */
const KX_STORE='https://play.google.com/store/search?q=Duel%20Synapse%20KodeX&c=apps';   // replace with the store listing link once it is live
/** Running as the installed app (bundle, native bridge or an Android WebView), not in a browser tab. */
function kxInApp(){if(window.__kxWeb)return false;
 return ARENA_LOCAL||!!(window.CastelApp||window.KodexBridge||window.AndroidBridge)||/; wv\)/.test(navigator.userAgent)||navigator.webdriver===true||/[?&]app=1/.test(location.search)}
/* ---------- no zoom in the app ---------- */
if(kxInApp()){document.documentElement.classList.add('kx-app');
 const vp=document.querySelector('meta[name=viewport]');if(vp)vp.setAttribute('content','width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover');
 addEventListener('touchmove',e=>{if(e.touches.length>1)e.preventDefault()},{passive:false});
 for(const g of ['gesturestart','gesturechange'])addEventListener(g,e=>e.preventDefault(),{passive:false});
 addEventListener('wheel',e=>{if(e.ctrlKey)e.preventDefault()},{passive:false})}
/* ---------- the Arena is in the app ---------- */
function kxGetApp(){const m=openModal(`<div class="ga-card"><img src="${esc((document.querySelector('link[rel=icon]')||{}).href||'')}" alt="" onerror="this.remove()"><h3>Synapse Arena is in the app</h3>
 <p>Playtests, online duels, replays and combo replays run inside <b>Duel Synapse: KodeX</b> for Android.</p>
 <ul><li>Works offline once installed</li><li>Replays become combos, combo images become replays</li><li>Your decks and combos come with you</li></ul>
 <a class="btn p" href="${esc(KX_STORE)}" target="_blank" rel="noopener" data-store>Get it on Google Play</a><button class="btn" data-close>Not now</button></div>`,'','getapp');return m}
{const oa=openArena;openArena=function(){if(!kxInApp()){kxGetApp();return}return oa.apply(this,arguments)}}
{const th=kxTestHub;kxTestHub=function(){th.apply(this,arguments);if(kxInApp())return;const tb=$('tb'),g=tb.querySelector('.th-grid');if(!g||tb.querySelector('.ga-strip'))return;
  const em=tb.querySelector('[data-th=arena] em');if(em)em.textContent='In the app';
  const b=document.createElement('button');b.type='button';b.className='ga-strip';b.innerHTML='<i>▶</i><span><b>Get Duel Synapse: KodeX on Google Play</b><small>Synapse Arena, replays and combo replays are part of the Android app</small></span>';b.onclick=()=>kxGetApp();g.after(b)};
 $('nTest').onclick=()=>kxTestHub()}
/* ---------- the combo code: a strip of cells in every combo image that holds the combo itself ---------- */
const CBQ={cell:8,cal:6,maxRows:26,foot:74,acts:['auto','act','ns','ss','add','set','scale','eff','gy','ban']};
const cbqCrc=b=>{let c=~0;for(let i=0;i<b.length;i++){c^=b[i];for(let k=0;k<8;k++)c=c>>>1^(0xEDB88320&-(c&1))}return ~c>>>0};
function cbqPack(list,withExtra){
 const bits=[],put=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push(Math.floor(v/2**i)%2)},num=id=>{const n=Number(pcode(String(id)));return Number.isInteger(n)&&n>0&&n<2**34?n:0};
 const dict=[],ref=id=>{const n=num(id);if(!n)return -1;let i=dict.indexOf(n);if(i<0){if(dict.length>=127)return -1;dict.push(n);i=dict.length-1}return i};
 const cs=list.slice(0,7).map(c=>{const d=c.deckId?deckById(c.deckId):null;
  return{t:[...new TextEncoder().encode(cbTitle(c))].slice(0,40),size:d?Math.max(c.hand.length,copies(d,'main').length):40,
   hand:c.hand.map(ref).filter(i=>i>=0).slice(0,12),extra:withExtra&&d?copies(d,'extra').map(x=>ref(pcOf(x))).filter(i=>i>=0).slice(0,15):[],
   lines:c.lines.slice(0,16).map(l=>l.slice(0,12).map(n=>n.cards.map(x=>[ref(x.c),Math.max(0,CBQ.acts.indexOf(x.a))]).filter(x=>x[0]>=0).slice(0,6)).filter(n=>n.length)).filter(l=>l.length)}});
 put(1,4);put(dict.length,7);for(const n of dict)put(n,34);put(cs.length,3);
 for(const c of cs){put(c.t.length,6);for(const b of c.t)put(b,8);put(Math.min(60,c.size),6);put(c.hand.length,4);for(const i of c.hand)put(i,7);put(c.extra.length,4);for(const i of c.extra)put(i,7);
  put(c.lines.length,5);for(const l of c.lines){put(l.length,4);for(const n of l){put(n.length,3);for(const [i,a] of n){put(i,7);put(a,4)}}}}
 while(bits.length%8)bits.push(0);
 const body=new Uint8Array(bits.length/8);for(let i=0;i<body.length;i++){let v=0;for(let k=0;k<8;k++)v=v*2+bits[i*8+k];body[i]=v}
 const out=new Uint8Array(body.length+8);out[0]=0x4D;out[1]=0x43;out[2]=body.length>>8;out[3]=body.length&255;out.set(body,4);
 const crc=cbqCrc(out.subarray(0,body.length+4));out.set([crc>>>24,crc>>>16&255,crc>>>8&255,crc&255],body.length+4);return out}
function cbqUnpack(bytes){
 if(bytes.length<9||bytes[0]!==0x4D||bytes[1]!==0x43)return null;const len=bytes[2]<<8|bytes[3];if(bytes.length<len+8)return null;
 const crc=cbqCrc(bytes.subarray(0,len+4)),got=(bytes[len+4]<<24|bytes[len+5]<<16|bytes[len+6]<<8|bytes[len+7])>>>0;if(crc!==got)return null;
 let p=32;const end=(len+4)*8,get=n=>{let v=0;for(let i=0;i<n;i++){if(p>=end)throw new Error('short');v=v*2+(bytes[p>>3]>>(7-(p&7))&1);p++}return v};
 try{if(get(4)!==1)return null;const dict=[];for(let n=get(7);n>0;n--)dict.push(get(34));const at=i=>dict[i]||0,out=[];
  for(let n=get(3);n>0;n--){const tb=[];for(let k=get(6);k>0;k--)tb.push(get(8));const c={title:new TextDecoder().decode(new Uint8Array(tb)),deckSize:get(6),hand:[],extra:[],lines:[]};
   for(let k=get(4);k>0;k--)c.hand.push(at(get(7)));for(let k=get(4);k>0;k--)c.extra.push(at(get(7)));
   for(let l=get(5);l>0;l--){const line=[];for(let k=get(4);k>0;k--){const cards=[];for(let j=get(3);j>0;j--){const id=at(get(7)),a=CBQ.acts[get(4)]||'auto';if(id)cards.push({c:id,a})}if(cards.length)line.push({cards,note:''})}if(line.length)c.lines.push(line)}
   c.hand=c.hand.filter(Boolean);c.extra=c.extra.filter(Boolean);if(c.hand.length||c.lines.length)out.push(c)}
  return out.length?out:null}catch(e){return null}}
/** The strip for a combo image: { h (space it needs above the footer), svg }. Null when the combos are too big to carry. */
function cbqBand(list,W,H,pad,P){
 const cols=Math.floor((W-pad*2)/CBQ.cell),per=cols-CBQ.cal;let bytes=null,rows=0;
 for(const [n,ex] of [[list.length,true],[list.length,false],[1,true],[1,false]]){const b=cbqPack(list.slice(0,n),ex),r=Math.ceil(b.length*8/per);if(r<=CBQ.maxRows){bytes=b;rows=r;break}}
 if(!bytes)return null;
 const y1=H-CBQ.foot,c=CBQ.cell,bit=i=>i<bytes.length*8?bytes[i>>3]>>(7-(i&7))&1:(i*7+3)%5<2?1:0;let d='';
 for(let r=0;r<rows;r++){const y=y1-c*(r+1);let run=-1;
  for(let i=0;i<=cols;i++){const on=i<cols&&(i<CBQ.cal?i%2===0:bit(r*per+i-CBQ.cal));if(on&&run<0)run=i;if(!on&&run>=0){d+=`M${pad+run*c} ${y}h${(i-run)*c}v${c}h${-(i-run)*c}z`;run=-1}}}
 const top=y1-rows*c;
 return{h:rows*c+46,svg:`<g><rect x="${pad-10}" y="${top-10}" width="${cols*c+20}" height="${rows*c+20}" rx="8" fill="${P.bg}"/><path d="${d}" fill="${P.ink}"/><text x="${pad-10}" y="${top-18}" font-family="'Chakra Petch',Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="3" fill="${P.mute}">COMBO CODE · OPEN THIS IMAGE IN KODEX TO LOAD THE COMBO AND ITS REPLAY</text></g>`}}
/** Reads the strip back from a picture (a saved combo image, also after being resized). Returns the combos or null. */
function cbqRead(img){
 const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;if(!w||!h||Math.abs(w/h-1)>.03)return null;
 const N=DI_SIZE,cv=document.createElement('canvas');cv.width=cv.height=N;const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0,N,N);
 let px;try{px=g.getImageData(0,0,N,N).data}catch(e){return null}
 const pad=56,c=CBQ.cell,cols=Math.floor((N-pad*2)/c),per=cols-CBQ.cal,y1=N-CBQ.foot;
 const lum=(x,y)=>{let s=0;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const X=Math.max(0,Math.min(N-1,Math.round(x)+a)),Y=Math.max(0,Math.min(N-1,Math.round(y)+b)),i=(Y*N+X)*4;s+=px[i]*.3+px[i+1]*.59+px[i+2]*.11}return s/9};
 const row=(r,dx,dy,sc)=>{const y=(y1-c*(r+.5)-N/2)*sc+N/2+dy,X=i=>(pad+c*(i+.5)-N/2)*sc+N/2+dx;let on=0,off=0;
  for(let i=0;i<CBQ.cal;i++){const v=lum(X(i),y);if(i%2===0)on+=v;else off+=v}on/=3;off/=3;if(Math.abs(on-off)<36)return null;
  const th=(on+off)/2,pos=on>off,out=[];for(let i=CBQ.cal;i<cols;i++){const v=lum(X(i),y);out.push((v>th)===pos?1:0)}return out};
 const toBytes=bits=>{const b=new Uint8Array(bits.length>>3);for(let i=0;i<b.length;i++){let v=0;for(let k=0;k<8;k++)v=v*2+bits[i*8+k];b[i]=v}return b};
 for(const sc of [1,.997,1.003,.994,1.006])for(let dy=0;Math.abs(dy)<=8;dy=dy>0?-dy:-dy+2)for(let dx=0;Math.abs(dx)<=8;dx=dx>0?-dx:-dx+2){
  const r0=row(0,dx,dy,sc);if(!r0)continue;const hd=toBytes(r0.slice(0,32));if(hd[0]!==0x4D||hd[1]!==0x43)continue;
  const need=Math.ceil(((hd[2]<<8|hd[3])+8)*8/per);if(need<1||need>CBQ.maxRows)continue;
  let bits=r0,okRows=true;for(let r=1;r<need;r++){const x=row(r,dx,dy,sc);if(!x){okRows=false;break}bits=bits.concat(x)}if(!okRows)continue;
  const got=cbqUnpack(toBytes(bits));if(got)return got}
 return null}
/* ---------- a combo image read back into combos (and their replays) ---------- */
const cbqId=code=>{const c=M.get(String(code));return c?String(c.id):String(code)};
function cbAdopt(raw,from){const c=cbNew({title:String(raw.title||'').slice(0,60),hand:(raw.hand||[]).map(cbqId).slice(0,12),
  lines:(raw.lines||[]).slice(0,16).map(l=>l.slice(0,12).map(n=>({cards:(n.cards||[]).slice(0,6).map(x=>({c:cbqId(x.c),a:CBQ.acts.includes(x.a)?x.a:'auto'})),note:String(n.note||'').slice(0,80)})).filter(n=>n.cards.length)).filter(l=>l.length)});
 if(from)c.from=from;if(!cbHas(c))return null;cbStore(c);return c}
/** Keeps the combo in the Arena's Replays list too (when the Arena is loaded; otherwise it is kept the first time it is played). */
async function cbKeepReplay(c){try{const f=$('arenaFrame');if(!kxInApp()||!f||!f.dataset.ready)return false;const p=await cbPayload(c);cbPost({kx:'comboKeep',combo:p});return true}catch(e){return false}}
function cbImportImage(file){
 if(!file||!/^image\//.test(file.type||'')||file.size>3e7){toast('Choose a MEIOCG combo image (PNG or JPG)');return}
 const im=new Image(),u=URL.createObjectURL(file);
 im.onerror=()=>{URL.revokeObjectURL(u);toast('That picture could not be opened')};
 im.onload=async()=>{let got=null;try{got=cbqRead(im)}catch(e){}URL.revokeObjectURL(u);
  if(!got){openModal(`<div class="cb-in"><h3>Not a MEIOCG combo image</h3><p class="note">No combo code was found. Use the whole image exactly as KodeX saved it (9.8 or newer): cropped pictures, screenshots with borders and heavily compressed copies cannot be read. Sending the image as a file keeps it intact.</p><div class="dact"><button class="btn p" data-close>OK</button></div></div>`);return}
  const made=got.map(r=>cbAdopt(r,'image')).filter(Boolean);if(!made.length){toast('That combo image is empty');return}
  let kept=false;for(const c of made)kept=await cbKeepReplay(c)||kept;
  cbRefreshList();
  const m=openModal(`<div class="cb-in"><h3>${made.length>1?made.length+' combos loaded':'Combo loaded'}</h3><p class="note">${kept?'Saved to Combos, and to Replays in the Synapse Arena.':'Saved to Combos. Play it once to keep its replay in the Synapse Arena.'}</p>
  <div class="cb-in-l">${made.map(c=>`<div class="cb-in-i"><span><b>${esc(cbTitle(c))}</b><small>${c.hand.length} in hand · ${c.lines.reduce((n,l)=>n+l.length,0)} steps</small></span><button class="btn sm" data-inplay="${esc(c.id)}">${ic('play',15)}Play</button><button class="btn sm" data-inedit="${esc(c.id)}">Edit</button></div>`).join('')}</div>
  <div class="dact"><button class="btn p" data-close>Done</button></div></div>`);
  m.querySelectorAll('[data-inplay]').forEach(b=>b.onclick=()=>{const c=cbGet(b.dataset.inplay);closeModal();if(c)setTimeout(()=>cbPlay(c),150)});
  m.querySelectorAll('[data-inedit]').forEach(b=>b.onclick=()=>{const c=cbGet(b.dataset.inedit);closeModal();if(c)setTimeout(()=>cbEdit(c),150)})};
 im.src=u}
{const kc=kxCombos;kxCombos=function(){kc.apply(this,arguments);const top=$('tb').querySelector('.cb-top'),nw=top&&top.querySelector('[data-cbnew]');if(!nw||top.querySelector('[data-cbimp]'))return;
  const two=document.createElement('div');two.className='cb-two';nw.replaceWith(two);
  const im=document.createElement('button');im.type='button';im.className='btn';im.dataset.cbimp='1';im.innerHTML=ic('image',18)+'From a combo image';
  const fi=document.createElement('input');fi.type='file';fi.accept='image/png,image/jpeg,image/webp';fi.hidden=true;fi.dataset.cbfile='1';
  im.onclick=()=>fi.click();fi.onchange=()=>{const f=fi.files&&fi.files[0];fi.value='';cbImportImage(f)};two.append(nw,im,fi)}}
/* ---------- a replay turned into a combo in the Arena arrives here ---------- */
window.addEventListener('message',e=>{const d=e.data||{};if(d.kx!=='comboNew'||!d.combo||typeof d.combo!=='object')return;
 const f=$('arenaFrame');if(!f||e.source!==f.contentWindow)return;
 const id='r'+String(d.combo.id||'').replace(/[^\w-]/g,'').slice(0,40),old=cbGet(id),c=cbAdopt(d.combo,'replay');if(!c)return;
 if(id.length>1){cbRemove(c.id);if(old)cbRemove(old.id);c.id=id;cbStore(c)}
 toast('Replay saved as a combo: '+cbTitle(c));cbRefreshList()});
