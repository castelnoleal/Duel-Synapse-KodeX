/* ---------- search + filters ---------- */
const FG=[['types','Card Type',['Monster','Spell','Trap']],['attrs','Attribute',['DARK','LIGHT','EARTH','WATER','FIRE','WIND','DIVINE'],'Monster'],['races','Monster Type',['Aqua','Beast','Beast-Warrior','Cyberse','Dinosaur','Divine-Beast','Dragon','Fairy','Fiend','Fish','Insect','Machine','Plant','Psychic','Pyro','Reptile','Rock','Sea Serpent','Spellcaster','Thunder','Warrior','Winged Beast','Wyrm','Zombie'],'Monster'],['msub','Monster Details',['Normal','Effect','Fusion','Synchro','Xyz','Link','Ritual','Pendulum','Flip','Tuner','Gemini','Spirit','Toon','Union'],'Monster'],['ssub','Spell Type',['Normal','Continuous','Equip','Field','Quick-Play','Ritual'],'Spell'],['tsub','Trap Type',['Normal','Continuous','Counter'],'Trap']];
const RG=[['atk','ATK'],['def','DEF'],['lv','Level'],['rk','Rank'],['lk','Link Rating'],['sc','Pendulum Scale']];
const fresh=()=>{const f={};FG.forEach(g=>f[g[0]]=[]);RG.forEach(r=>f[r[0]]=['','']);return f};
let F=Object.assign(fresh(),S.g('filters',{}));
const nActive=()=>FG.reduce((n,g)=>n+F[g[0]].length,0)+RG.reduce((n,r)=>n+(F[r[0]][0]!==''||F[r[0]][1]!==''?1:0),0);
function renderActive(){const a=[];FG.forEach(g=>F[g[0]].forEach(v=>a.push([g[0],v,v])));RG.forEach(r=>{const [x,y]=F[r[0]];if(x!==''||y!=='')a.push([r[0],'',`${r[1]} ${x||'0'}–${y||'∞'}`])});$('af').hidden=!a.length;$('af').innerHTML=a.map(([g,v,l])=>`<button class="ac" data-g="${esc(g)}" data-v="${esc(v)}">${esc(l)} ×</button>`).join('')}
$('af').addEventListener('click',e=>{const b=e.target.closest('.ac');if(!b)return;const g=b.dataset.g;if(RG.some(r=>r[0]===g))F[g]=['','']; else F[g]=F[g].filter(x=>x!==b.dataset.v);S.s('filters',F);run()});
const hasM=()=>F.attrs.length||F.races.length||F.msub.length||RG.some(r=>F[r[0]][0]!==''||F[r[0]][1]!=='');
const cat=c=>{const t=c.type.toLowerCase();return t.includes('spell')?'Spell':t.includes('trap')?'Trap':'Monster'};
function match(c){
  const ct=cat(c),al=F.types.length?F.types:[...(hasM()?['Monster']:[]),...(F.ssub.length?['Spell']:[]),...(F.tsub.length?['Trap']:[])];
  if(al.length&&!al.includes(ct))return false;
  if(ct==='Monster'){
    const t=c.type.toLowerCase();
    if(F.attrs.length&&!F.attrs.some(a=>nz(a)===nz(c.attr)))return false;
    if(F.races.length&&!F.races.some(a=>nz(a)===nz(c.race)))return false;
    if(F.msub.length&&!F.msub.some(s=>s==='Normal'?t.includes('normal')&&!t.includes('effect'):t.includes(s.toLowerCase())))return false;
    for(const [k] of RG){const [a,b]=F[k];if(a===''&&b==='')continue;const v=c[k];if(v==null||v===''||isNaN(v))return false;if(a!==''&&+v<+a)return false;if(b!==''&&+v>+b)return false}
  }else if(ct==='Spell'){if(F.ssub.length&&!F.ssub.some(s=>nz(s)===nz(c.race)))return false}
  else if(F.tsub.length&&!F.tsub.some(s=>nz(s)===nz(c.race)))return false;
  return true;
}
function row(c){
  const im=S.g('sp',true)&&(c.sm||c.img)?`<img data-id="${esc(c.id)}" src="${esc(c.sm||c.img)}" alt="" loading="lazy" decoding="async">`:'';
  const ct=cat(c),l=c.lk?'Link '+c.lk:c.rk?'Rank '+c.rk:c.lv?'Level '+c.lv:'',st=[c.atk!=null&&c.atk!==''?'ATK '+c.atk:'',c.lk==null&&c.def!=null&&c.def!==''?'DEF '+c.def:''].filter(Boolean).join(' • ');
  return `<button class="card" data-id="${esc(c.id)}">${im}<span class="ci"><b class="cn">${esc(c.name)}${isFav(c)?` <span class="fm" aria-label="Favorite">${ic('star',13)}</span>`:''}</b><span class="tags"><em class="tg ${ct[0].toLowerCase()}">${esc(c.type||'Card')}</em>${c.attr?`<em class="tg">${esc(c.attr)}</em>`:''}</span><span class="meta">${[c.race,l].filter(Boolean).map(esc).join(' • ')}</span>${st?`<span class="meta">${esc(st)}</span>`:''}</span><span class="chev" aria-hidden="true">›</span></button>`;
}
function show(items,msg){list.innerHTML=items.length?items.map(row).join(''):`<div class="empty"><b>⌕</b>${msg}</div>`}
function home(){
  const f=nActive()>0;
  if(!cards.length){return}
  if(f)show(cards.filter(match).slice(0,300),'No cards match these filters.');
  else if(S.g('lh',true))show(cards.filter(c=>c.date).sort((a,b)=>b.date.localeCompare(a.date)||Number(b.id)-Number(a.id)).slice(0,50),'Search for a card');
  else show([],'Search for a card');
  $('fc').hidden=!f;$('fc').textContent=nActive();renderActive();
}
function run(){
  const s=nt(q.value);$('bClr').hidden=!q.value;
  if(!s){home();return}
  const w=s.split(' ').filter(Boolean),out=[];
  for(const k of K){const sc=score(k,s,w);if(sc&&match(k.c))out.push([sc,k.c])}
  out.sort((a,b)=>b[0]-a[0]||a[1].name.localeCompare(b[1].name));
  show(out.slice(0,80).map(x=>x[1]),'No cards found');
  set(`${src} • ${out.length} result${out.length===1?'':'s'}${nActive()?' • filters active':''}`,!navigator.onLine);
  $('fc').hidden=!nActive();$('fc').textContent=nActive();renderActive();
}
let tm;q.addEventListener('input',()=>{clearTimeout(tm);tm=setTimeout(run,150)});
q.addEventListener('change',()=>{const t=q.value.trim();if(t){const h=S.g('hist',[]).filter(x=>x!==t);h.unshift(t);S.s('hist',h.slice(0,30))}});
$('bClr').onclick=()=>{q.value='';run();q.focus()};
list.addEventListener('click',e=>{const b=e.target.closest('.card');if(b)openCard(b.dataset.id)});
document.addEventListener('error',e=>{const i=e.target;if(i.tagName!=='IMG'||i.dataset.f)return;i.dataset.f=1;const c=M.get(i.dataset.id);if(c&&c.img&&i.src!==c.img)i.src=c.img;else{i.style.visibility='hidden';const o=i.src;if(/^https:/.test(o))icGet(o).then(v=>{if(v){i.src=v;i.style.visibility=''}})}},true);

