/* ---------- card detail + rulings ---------- */
const fav=()=>S.g('fav',[]);
async function openCard(id){
  const c=M.get(String(id));if(!c)return;cur=c;
  const M2=cat(c)==='Monster',st=[['Card Type',c.type],[M2?'Monster Type':'Spell/Trap Type',c.race],['Attribute',M2?c.attr:''],['ATK',M2?c.atk:null],['DEF',M2&&c.lk==null?c.def:null],['Level',M2&&!c.rk&&!c.lk?c.lv:null],['Rank',M2?c.rk:null],['Link Rating',M2?c.lk:null],['Pendulum Scale',M2?c.sc:null],['Archetype',c.arch]].filter(x=>x[1]!==''&&x[1]!=null);
  const isF=fav().some(x=>String(x.id)===String(c.id));
  detail.innerHTML=`<div class="dbar"><button class="back" data-close><svg class="i" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>Back</button></div>
  <div class="hero">${S.g('cp',true)&&(c.img||c.sm)?`<img class="thumb" data-id="${esc(c.id)}" src="${esc(c.img||c.sm)}" alt="${esc(c.name)}">`:''}<div><h2>${esc(c.name)}</h2><div class="tags">${typeof kxLegal==='function'?kxLegal(c):''}<em class="tg ${cat(c)[0].toLowerCase()}">${esc(c.type)}</em>${M2&&c.attr?`<em class="tg">${esc(c.attr)}</em>`:''}</div></div></div>
  <div class="detail-actions"><button class="btn fav${isF?' fav-on':''}" id="bF" aria-pressed="${isF}">${favHTML(isF)}</button><button class="btn p" id="bAddDeck">${ic('plus',18)}Add to deck</button></div><div class="memb" data-membid="${esc(c.id)}"></div>
  <div class="panel"><div class="label">Details</div><div class="stats">${st.map(x=>`<div><span>${esc(x[0])}</span><strong>${esc(x[1])}</strong></div>`).join('')}</div></div>
  <div class="panel"><div class="label">Text</div><div class="effect">${esc(c.desc||'No card text available.')}</div></div>
  <div class="panel"><div class="label">Rulings</div><div id="rul" class="note">Loading rulings…</div></div>`;
  if(L[L.length-1]==='detail')view('detail',true);else{hideAll();push('detail')}
  $('bF').onclick=()=>{const on=toggleFav(c);setFavBtn($('bF'),on);toast(on?'Added to favorites':'Removed from favorites')};refreshMemb();
  $('bAddDeck').onclick=()=>addCardToDeck(c);
  rulings(c);
}
let nix;
function nameIx(){return nix||(nix=(async()=>{
  let m=await kv('get','nameix');if(m&&m.byName)return m.byName;
  const raw=await fj(NAMEIX,40000),by={};
  const walk=n=>{if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return}for(const [name,v] of Object.entries(n)){for(const it of (Array.isArray(v)?v:[v])){const d=(typeof it==='number'||/^\d+$/.test(it))?it:it&&typeof it==='object'?(it.id??it.card_id??it.cardId??it.konami_id??it.konamiId):null;if(d!=null&&!/^\d+$/.test(name))by[nt(name)]=String(d)}if(v&&typeof v==='object')walk(v)}};
  walk(raw);kv('put','nameix',{byName:by});return by})().catch(e=>{nix=null;throw e}))}
async function getRul(id,force){
  const c=await kv('get','r:'+id);
  if(c&&c.data&&!force&&Date.now()-c.t<TTL)return c;
  try{const d=await fj(RUL+encodeURIComponent(id)+'.json',15000);if(!d||!Array.isArray(d.records))throw Error('bad');const r={t:Date.now(),data:d};await kv('put','r:'+id,r);return r}
  catch(e){if(c&&c.data)return Object.assign({stale:1},c);throw e}
}
const clean=t=>{const x=String(t??'').replace(/<\s*br\s*\/?>/gi,'\n').replace(/<\/(p|div|li)>/gi,'\n').replace(/<<\s*(\d{3,})\s*>>/g,(m,i)=>KN.get(i)||m).replace(/<<\s*([^<>]+?)\s*>>/g,'$1').replace(/<[^>]*>/g,''),a=document.createElement('textarea');a.innerHTML=x;return a.value.replace(/\n{3,}/g,'\n\n').trim()};
function entries(d){return d.records.map((r,i)=>{const h=r.history||{},en=r.api?.qaData?.en||{},ja=r.api?.qaData?.ja||{};return{id:String(en.id||r.id||h.fid||i+1),t:clean(en.title||h.title||ja.title),q:clean(en.question||h.question||ja.question),a:clean(en.answer||h.answer||ja.answer),en:!!(en.question||en.answer)}}).filter(x=>x.t||x.q||x.a)}
async function rulings(c,targetId='rul'){
  const box=$(targetId);if(!box)return;let id=c.kid;
  try{if(!id)id=(await nameIx())[nt(c.name)]}catch(e){}
  if(!id){box.textContent='Rulings are not available for this card yet.';return}
  try{
    const r=await getRul(id),es=entries(r.data);
    if(cur!==c||!box.isConnected)return;
    if(!es.length){box.textContent='No Q&A rulings are recorded for this card.';return}
    box.className='';
    box.innerHTML=`<div class="note"><strong>${es.length} Q&amp;A record${es.length===1?'':'s'}</strong> • ${r.stale||!navigator.onLine?'Saved on this device':'Up to date'}</div>`+es.map((x,i)=>`<details class="qa"><summary>${esc(x.t||x.q.slice(0,200)||'Q&A')}<span class="meta"> #${esc(x.id)}${x.en?'':' • original language'}</span></summary><div class="qb">${x.q?`<p><b>Q:</b> ${esc(x.q)}</p>`:''}${x.a?`<p><b>A:</b> ${esc(x.a)}</p>`:'<p>No answer stored.</p>'}${x.en?'':`<button type="button" class="translate-btn" data-translate-index="${i}">Translate to English</button><div class="translation-slot"></div>`}</div></details>`).join('');
    box.querySelectorAll('[data-translate-index]').forEach(btn=>{const x=es[Number(btn.dataset.translateIndex)];btn.onclick=()=>translateRulingToEnglish(x,btn,btn.parentElement.querySelector('.translation-slot'))});
  }catch(e){
    if(cur!==c)return;
    box.innerHTML=/404/.test(e.message)?'No Q&amp;A rulings are recorded for this card.':`Couldn’t load rulings. Check your connection. <button class="btn" id="rr">Retry</button>`;
    const b=box.querySelector('#rr');if(b)b.onclick=()=>{box.textContent='Loading rulings…';rulings(c,targetId)};
  }
}

