
/* KodeX 9.5 (v62): the Test tab (Combo generator + Synapse Arena), combos (build, map, play, practise, image),
   more MEIOCG apps in Settings, and vibration for the Arena.
   Created by Castel Noleal, creator of MEIOCG. See app/BLUEPRINT.md. */

/* ---------- Arena: vibration asked for by showdowns and Ace cards ---------- */
addEventListener('message',e=>{const f=$('arenaFrame');if(!f||e.source!==f.contentWindow)return;const d=e.data||{};
 if(d.kx==='vibrate'){let p=d.p;if(typeof p==='number')p=[p];if(!Array.isArray(p)||p.length>12||p.some(v=>typeof v!=='number'||v<0||v>2000))return;
  try{if(navigator.vibrate)navigator.vibrate(p)}catch(x){}try{if(window.CastelApp&&CastelApp.vibrate)CastelApp.vibrate(Math.min(1200,p.reduce((a,b)=>a+b,0)))}catch(x){}}
 if(d.kx==='ready'&&cbPend){const m=cbPend;cbPend=null;setTimeout(()=>cbPost(m),250)}
});

/* ---------- Other MEIOCG apps (Settings). Change the links here when the store pages are up. ---------- */
const KX_APPS=[
 {k:'calc',name:'Duel Synapse Calculator',tag:'Life Points, duel timer, dice and coin',url:'https://meiocg.org',
  pts:['Life Points for both duelists, with a keypad and one-tap damage','40-minute duel timer with turns and phases','Dice, coin, undo, life point log and match history']},
 {k:'swiss',name:'Duel Synapse Swiss',tag:'Swiss Tournament Manager',url:'https://meiocg.org',
  pts:['Pairings for every round, made in a tap','Standings with tie-breakers, OCG 2026 rules by default','Round timer, drops and results for any size of event']},
];
function kxAppPreview(k){
 if(k==='calc')return `<div class="ap-scr ap-calc" aria-hidden="true"><div class="ap-top"><b>DUEL TIMER</b><span class="ap-time"><i>40:00</i><i>39:59</i><i>39:58</i><i>39:57</i></span><em></em></div>
  <div class="ap-lp p1"><small>Player 1</small><span class="ap-num"><i>8000</i><i>8000</i><i>6500</i><i>6500</i><i>4100</i></span><u><s></s></u><div class="ap-q"><b>−100</b><b>−500</b><b class="hit">−1K</b><b>+1K</b></div></div>
  <div class="ap-lp p2"><small>Player 2</small><span class="ap-num"><i>8000</i><i>5200</i><i>5200</i><i>2700</i><i>2700</i></span><u><s></s></u><div class="ap-q"><b>−100</b><b class="hit">−500</b><b>−1K</b><b>+1K</b></div></div>
  <div class="ap-die">⚄</div></div>`;
 return `<div class="ap-scr ap-swiss" aria-hidden="true"><div class="ap-top"><b>ROUND 3 · PAIRINGS</b><span class="ap-time"><i>50:00</i><i>49:59</i><i>49:58</i><i>49:57</i></span><em></em></div>
  ${[['1','Kasuteru','Mei','2–0'],['2','Aki','Rin','2–1'],['3','Sora','Yuu','1–2'],['4','Kai','Hana','2–0']].map(([t,a,b,r],i)=>`<div class="ap-row" style="--i:${i}"><em>${t}</em><span>${a}</span><i>vs</i><span>${b}</span><b>${r}</b></div>`).join('')}
  <div class="ap-st"><span style="--w:92%"><i>1</i>Kasuteru<b>9</b></span><span style="--w:74%"><i>2</i>Aki<b>7</b></span><span style="--w:60%"><i>3</i>Kai<b>6</b></span></div></div>`;
}
(function(){const sb=document.querySelector('#Lset .sb');if(!sb)return;
 const sec=document.createElement('div');sec.className='sec';sec.textContent='More from MEIOCG';const g=document.createElement('div');g.className='ap-list';g.id='kxApps';
 g.innerHTML=KX_APPS.map(a=>`<article class="ap-card" data-app="${a.k}">${kxAppPreview(a.k)}<div class="ap-info"><h4>${esc(a.name)}</h4><small>${esc(a.tag)}</small><ul>${a.pts.map(p=>`<li>${esc(p)}</li>`).join('')}</ul><button class="btn p" data-appgo="${a.k}">See the app ↗</button></div></article>`).join('');
 const about=[...sb.querySelectorAll('.sec')].find(x=>/^about$/i.test(x.textContent.trim()));
 if(about){sb.insertBefore(sec,about);sb.insertBefore(g,about)}else{sb.append(sec,g)}
 g.addEventListener('click',e=>{const b=e.target.closest('[data-appgo]');if(!b)return;const a=KX_APPS.find(x=>x.k===b.dataset.appgo);if(a)openLink(a.url,a.name)});
 // the previews only animate while they are on screen
 if('IntersectionObserver' in window){const io=new IntersectionObserver(es=>es.forEach(x=>x.target.classList.toggle('run',x.isIntersecting)),{threshold:.2});g.querySelectorAll('.ap-card').forEach(c=>io.observe(c))}else g.querySelectorAll('.ap-card').forEach(c=>c.classList.add('run'));
})();

/* ---------- Test tab: two doors, Combo and Synapse Arena ---------- */
const CB_ICON='<svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="17" width="11" height="15" rx="2"/><rect x="32" y="5" width="11" height="15" rx="2"/><rect x="32" y="28" width="11" height="15" rx="2"/><path d="M16 24h7m0 0c4 0 3-11 9-11m-9 11c4 0 3 11 9 11"/></svg>';
const AR_ICON='<svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 8l22 22m0 0l-5 5m5-5l5-5M30 30l9 9"/><path d="M40 8L18 30m0 0l5 5m-5-5l-5-5M18 30l-9 9"/></svg>';
function kxTestHub(){const n=cbAll().length;
 tool('Test',`<div class="th-grid"><button class="th-tile" data-th="combo"><span class="th-ic">${CB_ICON}</span><b>Combo</b><small>Combo generator: plan lines from a starting hand, save them, play them as replays, export images</small><em>${n?n+' saved':'New'}</em></button>
 <button class="th-tile th-arena" data-th="arena"><span class="th-ic">${AR_ICON}</span><b>Synapse Arena</b><small>Playtest your decks, duel online, watch and record replays</small><em>${arenaActive?'Duel in progress':'Open'}</em></button></div>`);
 $('tb').querySelector('[data-th=combo]').onclick=()=>kxCombos();
 // the hub steps aside for the Arena, so Back from the Arena returns to where you were
 $('tb').querySelector('[data-th=arena]').onclick=()=>{if(L[L.length-1]==='tool'){history.back();setTimeout(()=>openArena(''),220)}else openArena('')};
 navSync()}
$('nTest').onclick=()=>kxTestHub();
{const ns0=navSync;navSync=function(){ns0();const t=L[L.length-1]||'',tt=$('tt').textContent;$('nTest').classList.toggle('on',t==='arena'||(t==='tool'&&(tt==='Test'||tt==='Combos')))}}

/* ---------- Combos ---------- */
const CB_ACT=[['auto','Auto'],['act','Activate'],['ns','Normal Summon'],['ss','Special Summon'],['add','Add to hand'],['set','Set'],['scale','Pendulum Scale'],['eff','Use its effect'],['gy','Send to the GY'],['ban','Banish']];
const CB_SHORT={auto:'',act:'Activate',ns:'Normal',ss:'Special',add:'Add',set:'Set',scale:'Scale',eff:'Effect',gy:'To GY',ban:'Banish'};
let cbPend=null;
const cbAll=()=>{const a=S.g('combos',[]);return Array.isArray(a)?a:[]};
const cbGet=id=>cbAll().find(c=>c.id===id)||null;
function cbNew(seed){return Object.assign({id:'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),title:'',deckId:'',hand:[],lines:[],intro:{s:3,art:'',key:'',bg:false},at:Date.now()},seed||{})}
function cbStore(c){c.at=Date.now();const a=cbAll().filter(x=>x.id!==c.id);a.unshift(c);S.s('combos',a.slice(0,80))}
function cbRemove(id){S.s('combos',cbAll().filter(x=>x.id!==id));kv('put','cb_bg_'+id,null)}
const cbHas=c=>c.hand.length||c.lines.some(l=>l.length);
const cbCard=id=>M.get(String(id))||cards.find(x=>String(x.kid)===String(id))||null;
const cbName=id=>(cbCard(id)||{}).name||('Card '+id);
const cbPic=id=>{const c=cbCard(id);return c?(c.sm||c.img||''):''};
const cbIsExtra=c=>/fusion|synchro|xyz|link/i.test((c&&c.type)||'');
const cbTitle=c=>c.title||(c.hand.length?c.hand.slice(0,2).map(cbName).join(' + ')+' combo':'Untitled combo');
const cbLineText=l=>l.map(n=>n.cards.map(x=>cbName(x.c)).join(' + ')).join(' → ');
const cbUsed=c=>[...new Set([...c.hand,...c.lines.flatMap(l=>l.flatMap(n=>n.cards.map(x=>x.c)))].map(String))];
function cbThumb(id,cls=''){const p=cbPic(id);return `<span class="cb-th ${cls}">${p&&S.g('sp',true)?`<img src="${esc(p)}" alt="" loading="lazy" decoding="async">`:`<i>${esc(cbName(id).slice(0,18))}</i>`}</span>`}
/** The cards of the combo's deck, one entry per different card. */
function cbDeck(c){const d=c.deckId?deckById(c.deckId):null;if(!d)return null;const seen=new Map();
 for(const x of d.cards||[]){if(x.section==='side')continue;const live=resolveDeckCard(x);if(!live)continue;const k=String(live.id);if(seen.has(k))seen.get(k).q+=x.qty||1;else seen.set(k,{id:k,card:live,q:x.qty||1,extra:x.section==='extra'})}
 return{deck:d,list:[...seen.values()]}}
/** What could come next after these cards: cards named in their text (and that name them), the same archetype,
 *  and Extra Deck monsters. From the deck when there is one, otherwise from every card. */
function cbSuggest(c,fromIds,max=12){
 const src=fromIds.map(cbCard).filter(Boolean);if(!src.length)return[];
 const dk=cbDeck(c),quoted=new Set();
 for(const s of src)for(const m of String(s.desc||'').matchAll(/"([^"]{2,60})"/g))quoted.add(m[1].toLowerCase());
 const has=(t,n)=>n&&String(t||'').toLowerCase().includes('"'+String(n).toLowerCase()+'"');
 const score=x=>{let v=0;for(const s of src){if(String(s.id)===String(x.id))continue;
   if(has(s.desc,x.name))v+=6;else if(x.arch&&has(s.desc,x.arch))v+=4;else if([...quoted].some(q=>q.length>3&&String(x.name).toLowerCase().includes(q)))v+=3;
   if(has(x.desc,s.name))v+=3;else if(s.arch&&has(x.desc,s.arch))v+=2;
   if(x.arch&&s.arch&&x.arch===s.arch)v+=2;
   if(cbIsExtra(x)&&cat(s)==='Monster')v+=1}
  return v};
 let pool;
 if(dk)pool=dk.list.map(e=>e.card);
 else{const arch=new Set(src.map(s=>s.arch).filter(Boolean));pool=cards.filter(x=>(x.arch&&arch.has(x.arch))||quoted.has(String(x.name).toLowerCase())||[...quoted].some(q=>q.length>3&&(String(x.arch||'').toLowerCase()===q||String(x.name).toLowerCase().includes(q)))).slice(0,400)}
 const srcIds=new Set(src.map(s=>String(s.id)));
 return pool.map(x=>[score(x),x]).filter(v=>v[0]>0&&!srcIds.has(String(v[1].id))).sort((a,b)=>b[0]-a[0]||String(a[1].name).localeCompare(b[1].name)).slice(0,max).map(v=>String(v[1].id))}
function cbSearch(q,max=30){const k=nz(q);if(k.length<2)return[];const a=[],b=[];for(const c of cards){const n=nz(c.name);if(n.startsWith(k))a.push(c);else if(n.includes(k))b.push(c);if(a.length>=max)break}return a.concat(b).slice(0,max)}

/* ----- the list of combos ----- */
function kxCombos(){
 const a=cbAll();
 tool('Combos',`<div class="cb-top"><p class="note">Plan a line from a starting hand, then play it in the Arena as a replay, practise it for real, or save it as an image.</p><button class="btn p" data-cbnew>${ic('plus',18)}New combo</button></div>
 <div class="cb-list">${a.length?a.map(c=>`<article class="cb-item" data-cbid="${esc(c.id)}"><button class="cb-open" data-cbopen><span class="cb-ths">${cbUsed(c).slice(0,5).map(id=>cbThumb(id)).join('')}</span><span class="cb-meta"><b>${esc(cbTitle(c))}</b><small>${esc([(c.deckId&&(deckById(c.deckId)||{}).name)||'Any card',c.hand.length+' in hand',c.lines.reduce((n,l)=>n+l.length,0)+' steps'].join(' · '))}</small><small class="cb-l1">${esc(c.lines[0]?cbLineText(c.lines[0]):'No steps yet')}</small></span></button>
 <div class="cb-row"><button class="btn sm" data-cbplay>${ic('play',15)}Play</button><button class="btn sm" data-cbimg>${ic('image',15)}Image</button><button class="btn sm" data-cbdup>Copy</button><button class="btn sm dng" data-cbdel aria-label="Delete">${ic('trash',15)}</button></div></article>`).join(''):`<div class="empty"><b>⇢</b>No combos yet. Start one here, or open any card and tap <b>Combo</b>.</div>`}</div>`);
 const tb=$('tb');
 tb.querySelector('[data-cbnew]').onclick=()=>cbEdit(cbNew());
 tb.querySelectorAll('.cb-item').forEach(it=>{const id=it.dataset.cbid;
  it.querySelector('[data-cbopen]').onclick=()=>{const c=cbGet(id);if(c)cbEdit(c)};
  it.querySelector('[data-cbplay]').onclick=()=>{const c=cbGet(id);if(c)cbPlay(c)};
  it.querySelector('[data-cbimg]').onclick=()=>cbImage([id]);
  it.querySelector('[data-cbdup]').onclick=()=>{const c=cbGet(id);if(!c)return;const n=cbNew(JSON.parse(JSON.stringify(c)));n.id=cbNew().id;n.title=(cbTitle(c)+' (copy)').slice(0,60);n.intro.bg=false;cbStore(n);kxCombos();toast('Combo copied')};
  it.querySelector('[data-cbdel]').onclick=()=>{const m=openModal(`<h3>Delete this combo?</h3><p class="note">${esc(cbTitle(cbGet(id)||cbNew()))}</p><div class="dact"><button class="btn" data-close>Keep</button><button class="btn p" data-yes>Delete</button></div>`);m.querySelector('[data-yes]').onclick=()=>{cbRemove(id);closeModal();setTimeout(kxCombos,120);toast('Combo deleted')}}});
 navSync()}
const cbRefreshList=()=>{if(L.includes('tool')&&$('tt').textContent==='Combos')kxCombos()};

/* ----- the editor ----- */
function cbEdit(c){
 c.intro=Object.assign({s:3,art:'',key:'',bg:false},c.intro||{});
 const m=openModal(`<div class="dk-hd"><h3>Combo</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div><div class="cb-ed"></div>`,'big xl','cbe');
 const box=m.querySelector('.cb-ed');
 const keep=()=>{if(cbHas(c)||c.title){cbStore(c);cbRefreshList()}};
 const chip=(x,l,n,i)=>`<button class="cb-chip" data-chip="${l},${n},${i}">${cbThumb(x.c)}<span>${esc(cbName(x.c))}</span>${CB_SHORT[x.a]?`<em>${CB_SHORT[x.a]}</em>`:''}</button>`;
 const draw=()=>{
  const decks=deckStore().filter(d=>deckTotal(d)>0),used=cbUsed(c);
  const map=c.hand.length?[...new Set(c.hand.map(String))].map(h=>[h,cbSuggest(c,[h],6)]).filter(v=>v[1].length):[];
  box.innerHTML=`<label class="cb-f"><span>Title</span><input data-cb="title" maxlength="60" placeholder="e.g. Solfachord 1.5 card combo" value="${esc(c.title)}"></label>
  <label class="cb-f"><span>Deck</span><select data-cb="deck"><option value="">Any card (no deck)</option>${decks.map(d=>`<option value="${esc(d.id)}"${String(d.id)===String(c.deckId)?' selected':''}>${esc(d.name)}</option>`).join('')}</select></label>
  <div class="cb-sec"><b>Starting hand</b><small>${c.hand.length} card${c.hand.length===1?'':'s'}</small></div>
  <div class="cb-hand">${c.hand.map((id,i)=>`<button class="cb-chip" data-hand="${i}">${cbThumb(id)}<span>${esc(cbName(id))}</span><em class="x">×</em></button>`).join('')}<button class="cb-add" data-add="hand">${ic('plus',16)}Add cards</button></div>
  ${map.length?`<div class="cb-sec"><b>Possible plays from this hand</b><small>tap one to start a line</small></div><div class="cb-map">${map.map(([h,s])=>`<div class="cb-mrow"><span class="cb-mfrom">${cbThumb(h)}<b>${esc(cbName(h))}</b></span><i>→</i><span class="cb-mto">${s.map(id=>`<button class="cb-mini" data-start="${esc(h)},${esc(id)}" title="${esc(cbName(id))}">${cbThumb(id)}<span>${esc(cbName(id))}</span></button>`).join('')}</span></div>`).join('')}</div>`:''}
  <div class="cb-sec"><b>Steps</b><small>tap a card to change what it does</small></div>
  <div class="cb-lines">${c.lines.map((l,li)=>`<div class="cb-line"><span class="cb-ln">${li+1}</span><div class="cb-flow">${l.map((n,ni)=>`${ni?'<i class="cb-arrow">→</i>':''}<span class="cb-node">${n.cards.map((x,i)=>(i?'<i class="cb-plus">+</i>':'')+chip(x,li,ni,i)).join('')}<button class="cb-nadd" data-add="node:${li},${ni}" aria-label="Add a card to this step">+</button>${n.note?`<small class="cb-note">${esc(n.note)}</small>`:''}</span>`).join('')}<button class="cb-next" data-add="next:${li}">→ Next</button></div><button class="cb-ldel" data-ldel="${li}" aria-label="Delete line ${li+1}">${ic('trash',15)}</button></div>`).join('')}
  <button class="cb-add wide" data-add="line">${ic('plus',16)}New line</button></div>
  <details class="cb-intro"${c._io?' open':''}><summary>Title card <small>shown before the replay or video</small></summary>
   <div class="cb-i2"><label class="cb-f"><span>Seconds</span><select data-cb="s">${[0,2,3,4,5,6,8,10].map(s=>`<option value="${s}"${+c.intro.s===s?' selected':''}>${s?s+' s':'No title card'}</option>`).join('')}</select></label>
   <label class="cb-f"><span>Card shown</span><select data-cb="key"><option value="">Last card of the combo</option>${used.map(id=>`<option value="${esc(id)}"${String(c.intro.key)===id?' selected':''}>${esc(cbName(id))}</option>`).join('')}</select></label></div>
   <label class="cb-f"><span>Background</span><select data-cb="art"><option value="">Same as the card shown</option>${used.map(id=>`<option value="${esc(id)}"${!c.intro.bg&&String(c.intro.art)===id?' selected':''}>${esc(cbName(id))}</option>`).join('')}<option value="__pic"${c.intro.bg?' selected':''}>${c.intro.bg?'My picture':'Choose my own picture…'}</option></select></label>
   <input type="file" accept="image/*" data-cbfile hidden></details>
  <div class="cb-acts"><button class="btn p" data-go="play">${ic('play',17)}Play in Arena</button><button class="btn" data-go="practice" ${c.deckId?'':'disabled title="Choose a deck first"'}>Practise</button><button class="btn" data-go="img">${ic('image',17)}Image</button><button class="btn" data-go="done">Done</button></div>
  <p class="note cb-hint">Play shows the combo on the table as a replay (step back, change speed${PREMIUM?', record a video':''}). Practise starts a real playtest with this hand.</p>`;
  bind()};
 const pushNode=(li,id)=>{c.lines[li].push({cards:[{c:String(id),a:'auto'}],note:''})};
 const bind=()=>{
  box.querySelector('[data-cb=title]').oninput=e=>{c.title=e.target.value.slice(0,60);keep()};
  box.querySelector('[data-cb=deck]').onchange=e=>{c.deckId=e.target.value;keep();draw()};
  box.querySelector('[data-cb=s]').onchange=e=>{c.intro.s=+e.target.value;keep()};
  box.querySelector('[data-cb=key]').onchange=e=>{c.intro.key=e.target.value;keep()};
  const fi=box.querySelector('[data-cbfile]');
  box.querySelector('[data-cb=art]').onchange=e=>{if(e.target.value==='__pic'){fi.click();return}c.intro.art=e.target.value;if(c.intro.bg){c.intro.bg=false;kv('put','cb_bg_'+c.id,null)}keep();c._io=1;draw()};
  fi.onchange=async()=>{const u=await cbShrink(fi.files&&fi.files[0],1600);if(!u){toast('Choose a picture');c._io=1;draw();return}await kv('put','cb_bg_'+c.id,{d:u});c.intro.bg=true;keep();c._io=1;draw();toast('Background set')};
  box.querySelector('.cb-intro').ontoggle=e=>{c._io=e.target.open?1:0};
  box.querySelectorAll('[data-hand]').forEach(b=>b.onclick=()=>{c.hand.splice(+b.dataset.hand,1);keep();draw()});
  box.querySelectorAll('[data-start]').forEach(b=>b.onclick=()=>{const [h,n]=b.dataset.start.split(',');c.lines.push([{cards:[{c:h,a:'auto'}],note:''},{cards:[{c:n,a:'auto'}],note:''}]);keep();draw();toast('Line started')});
  box.querySelectorAll('[data-ldel]').forEach(b=>b.onclick=()=>{c.lines.splice(+b.dataset.ldel,1);keep();draw()});
  box.querySelectorAll('[data-chip]').forEach(b=>b.onclick=()=>{const [l,n,i]=b.dataset.chip.split(',').map(Number);cbChip(c,l,n,i,()=>{keep();draw()})});
  box.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{const [w,arg]=b.dataset.add.split(':'),p=(arg||'').split(',').map(Number);
   if(w==='hand')cbPick(c,{title:'Starting hand',many:true,from:[]},id=>{if(c.hand.length<12){c.hand.push(String(id));keep();draw()}});
   else if(w==='line'){const from=c.hand.slice();cbPick(c,{title:'First card of the line',from,handFirst:true},id=>{c.lines.push([{cards:[{c:String(id),a:'auto'}],note:''}]);keep();draw()})}
   else if(w==='next'){const last=c.lines[p[0]][c.lines[p[0]].length-1];cbPick(c,{title:'Next: after '+last.cards.map(x=>cbName(x.c)).join(' + '),from:last.cards.map(x=>x.c)},id=>{if(c.lines[p[0]].length<12){pushNode(p[0],id);keep();draw()}})}
   else if(w==='node'){const nd=c.lines[p[0]][p[1]];cbPick(c,{title:'Together with '+nd.cards.map(x=>cbName(x.c)).join(' + '),from:nd.cards.map(x=>x.c)},id=>{if(nd.cards.length<6){nd.cards.push({c:String(id),a:'auto'});keep();draw()}})}});
  box.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{const g=b.dataset.go;
   if(g==='done'){keep();closeModal();if(cbHas(c))toast('Combo saved');return}
   if(!cbHas(c)){toast('Add a starting hand or a step first');return}
   keep();
   if(g==='img'){cbImage([c.id]);return}
   closeModal();setTimeout(()=>g==='play'?cbPlay(c):cbPractice(c),160)})};
 draw();return m}
/** One card in a step: what it does, a note for the step, remove. */
function cbChip(c,l,n,i,done){const nd=c.lines[l][n],x=nd.cards[i];
 const m=openModal(`<div class="dk-hd"><h3>${esc(cbName(x.c))}</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
 <label class="cb-f"><span>What it does</span><select data-a>${CB_ACT.map(([k,t])=>`<option value="${k}"${x.a===k?' selected':''}>${t}${k==='auto'?' (decided by where the card is)':''}</option>`).join('')}</select></label>
 <label class="cb-f"><span>Note for this step</span><input data-n maxlength="80" placeholder="Optional, e.g. search the Field Spell" value="${esc(nd.note||'')}"></label>
 <div class="dact"><button class="btn" data-view>Card</button><button class="btn dng" data-rm>Remove</button><button class="btn p" data-ok>Done</button></div>`,'','cbc');
 m.querySelector('[data-ok]').onclick=()=>{x.a=m.querySelector('[data-a]').value;nd.note=m.querySelector('[data-n]').value.trim().slice(0,80);closeModal();setTimeout(done,60)};
 m.querySelector('[data-rm]').onclick=()=>{nd.cards.splice(i,1);if(!nd.cards.length)c.lines[l].splice(n,1);if(!c.lines[l].length)c.lines.splice(l,1);closeModal();setTimeout(done,60)};
 m.querySelector('[data-view]').onclick=()=>quickView(String(x.c))}
/** Choosing a card: what could come next first, then the deck, then any card by name. */
function cbPick(c,o,add){
 const dk=cbDeck(c),sug=o.from&&o.from.length?cbSuggest(c,o.from,12):[];
 const tile=(id,q)=>`<button class="cb-pk" data-pk="${esc(id)}">${cbThumb(id)}<span>${esc(cbName(id))}</span>${q>1?`<em>×${q}</em>`:''}</button>`;
 const m=openModal(`<div class="dk-hd"><h3>${esc(o.title)}</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
 <label class="cb-find">${ic('search',18)}<input type="search" data-q placeholder="Search any card by name" autocomplete="off" enterkeyhint="search"></label>
 <div class="cb-pbody"><div data-res hidden></div>
 ${o.handFirst&&c.hand.length?`<div class="cb-sec"><b>From the starting hand</b></div><div class="cb-grid">${[...new Set(c.hand)].map(id=>tile(id)).join('')}</div>`:''}
 ${sug.length?`<div class="cb-sec"><b>Possible next plays</b><small>from the card text${dk?' and your deck':''}</small></div><div class="cb-grid">${sug.map(id=>tile(id)).join('')}</div>`:''}
 ${dk?`<div class="cb-sec"><b>${esc(dk.deck.name)}</b><small>Main Deck</small></div><div class="cb-grid">${dk.list.filter(e=>!e.extra).map(e=>tile(e.id,e.q)).join('')}</div>${dk.list.some(e=>e.extra)?`<div class="cb-sec"><b>Extra Deck</b></div><div class="cb-grid">${dk.list.filter(e=>e.extra).map(e=>tile(e.id,e.q)).join('')}</div>`:''}`:`<p class="note">No deck chosen: search any card above${sug.length?', or pick a suggestion':''}.</p>`}</div>
 ${o.many?`<div class="dact"><span class="cb-cnt" data-cnt></span><button class="btn p" data-close>Done</button></div>`:''}`,'big xl','cbp');
 let n=0;const res=m.querySelector('[data-res]'),q=m.querySelector('[data-q]');
 const pick=id=>{add(id);if(o.many){n++;m.querySelector('[data-cnt]').textContent=n+' added';toast(cbName(id)+' added')}else closeModal()};
 m.addEventListener('click',e=>{const b=e.target.closest('[data-pk]');if(b)pick(b.dataset.pk)});
 let tm=0;q.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>{const r=cbSearch(q.value);res.hidden=!q.value.trim();res.innerHTML=q.value.trim()?`<div class="cb-sec"><b>Search</b><small>${r.length?r.length+' found':'no card found'}</small></div><div class="cb-grid">${r.map(x=>tile(String(x.id))).join('')}</div>`:''},140)}}
function cbShrink(file,max){return new Promise(ok=>{if(!file||!/^image\//.test(file.type)){ok('');return}const im=new Image(),u=URL.createObjectURL(file);im.onload=()=>{const k=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight)),cv=document.createElement('canvas');cv.width=Math.round(im.naturalWidth*k);cv.height=Math.round(im.naturalHeight*k);cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);URL.revokeObjectURL(u);let d=cv.toDataURL('image/jpeg',.84);if(d.length>2.2e6)d=cv.toDataURL('image/jpeg',.6);ok(d.length>2.3e6?'':d)};im.onerror=()=>{URL.revokeObjectURL(u);ok('')};im.src=u})}

/* ----- from a card: the Combo button beside Favorite and Add to deck ----- */
function cbFromCard(card){const id=String(card.id),a=cbAll().slice(0,6);
 const m=openModal(`<div class="dk-hd"><h3>Add to a combo</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div><p class="note">${esc(card.name)}</p>
 <button class="btn p cb-wide" data-new>${ic('plus',18)}New combo starting with this card</button>
 ${a.length?`<div class="cb-sec"><b>Or add it to</b></div>${a.map(c=>`<div class="cb-fc" data-id="${esc(c.id)}"><b>${esc(cbTitle(c))}</b><small>${esc(c.lines.length?cbLineText(c.lines[c.lines.length-1]):'Starting hand: '+(c.hand.map(cbName).join(' + ')||'empty'))}</small><div class="cb-row"><button class="btn sm" data-how="hand">Starting hand</button><button class="btn sm" data-how="next">→ Next step</button><button class="btn sm" data-how="with">+ Same step</button></div></div>`).join('')}`:''}`,'big','cbf');
 m.querySelector('[data-new]').onclick=()=>{const c=cbNew({hand:[id]});cbStore(c);closeModal();setTimeout(()=>cbEdit(c),140)};
 m.querySelectorAll('.cb-fc').forEach(r=>r.querySelectorAll('[data-how]').forEach(b=>b.onclick=()=>{const c=cbGet(r.dataset.id);if(!c)return;const how=b.dataset.how;
  if(how==='hand'){if(c.hand.length>=12){toast('That hand is full');return}c.hand.push(id)}
  else{if(!c.lines.length)c.lines.push([]);const l=c.lines[c.lines.length-1];
   if(how==='with'&&l.length){const nd=l[l.length-1];if(nd.cards.length>=6){toast('That step is full');return}nd.cards.push({c:id,a:'auto'})}else{if(l.length>=12){toast('That line is full');return}l.push({cards:[{c:id,a:'auto'}],note:''})}}
  cbStore(c);closeModal();cbRefreshList();toast('Added to '+cbTitle(c))}))}
function cbCardButton(){const act=detail.querySelector('.detail-actions');if(!act||act.querySelector('#bCombo')||typeof cur==='undefined'||!cur)return;
 const b=document.createElement('button');b.className='btn';b.id='bCombo';b.innerHTML=CB_ICON.replace('width="44" height="44"','width="18" height="18"')+'Combo';b.onclick=()=>cbFromCard(cur);act.append(b);act.classList.add('three')}
new MutationObserver(cbCardButton).observe(detail,{childList:true});cbCardButton();

/* ----- to the Arena ----- */
function cbPost(msg){try{$('arenaFrame').contentWindow.postMessage(msg,'*')}catch(e){}}
async function cbPayload(c){const d=c.deckId?deckById(c.deckId):null,pc=id=>Number(pcode(String(id)))||0,used=cbUsed(c);
 const key=c.intro.key||used[used.length-1]||'',bg=c.intro.bg?((await kv('get','cb_bg_'+c.id))||{}).d||'':'';
 return{id:c.id,title:cbTitle(c),deck:d?d.name:'',by:(typeof kxpRaw==='function'&&kxpRaw().name)||'',hand:c.hand.map(pc).filter(Boolean),
  extra:d?copies(d,'extra').map(x=>Number(pcOf(x))||0).filter(Boolean).slice(0,15):[],deckSize:d?Math.max(c.hand.length,copies(d,'main').length):40,
  lines:c.lines.map(l=>l.map(n=>({cards:n.cards.map(x=>({c:pc(x.c),a:x.a})).filter(x=>x.c),note:n.note||''})).filter(n=>n.cards.length)).filter(l=>l.length),
  intro:{ms:Math.round((+c.intro.s||0)*1000),art:pc(c.intro.art||key),key:pc(key),bg}}}
/** Opens the Arena and hands it a message once it is ready. */
function cbSend(msg,hash){const f=$('arenaFrame'),was=L.includes('arena')&&f.dataset.ready;
 if(was){cbPost(msg);return}
 cbPend=msg;if(hash!=null)hash();else openArena('');
 // already loaded in the background: it will not say "ready" again
 setTimeout(()=>{if(cbPend===msg&&f.dataset.ready){cbPend=null;cbPost(msg)}},900)}
async function cbPlay(c){if(!cbHas(c)){toast('This combo is empty');return}const p=await cbPayload(c);if(!p.hand.length&&!p.lines.length){toast('These cards cannot be shown in the Arena');return}cbSend({kx:'combo',combo:p,keep:true})}
async function cbPractice(c){const d=c.deckId?deckById(c.deckId):null;if(!d){toast('Choose a deck for this combo first');return}const p=await cbPayload(c),msg={kx:'practice',hand:p.hand};
 cbPend=msg;openPlaytest(d);setTimeout(()=>{if(cbPend===msg)cbPend=null;cbPost(msg)},1400)}

/* ----- combo image: one or several combos on a square sheet, MEIOCG-branded like the deck image ----- */
function buildComboSvg(list,meta,bg){
 const W=DI_SIZE,H=DI_SIZE,P=DI_PAL[meta.design]||DI_PAL.night,X=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
 const F="'Chakra Petch','Plus Jakarta Sans',Arial,sans-serif",B="'Plus Jakarta Sans','Chakra Petch',Arial,sans-serif",pad=56,pf=meta.profile?diProfile():null;
 const acc=meta.design==='clean'?P.accent:P.gold,title=String(meta.title||'Combos'),right=pf?430:0,ts=Math.max(40,Math.min(76,Math.floor((W-pad*2-right)/(title.length*.62))));
 // rows: for each combo a heading (when there are several), the starting hand, then its lines
 const rows=[];
 list.forEach((c,ci)=>{if(list.length>1)rows.push({k:'head',t:cbTitle(c),n:ci+1});
  rows.push({k:'hand',items:c.hand.map(id=>({id,a:''}))});
  c.lines.forEach((l,li)=>{const items=[];l.forEach((n,ni)=>{if(ni)items.push({sep:'→'});n.cards.forEach((x,i)=>{if(i)items.push({sep:'+'});items.push({id:x.c,a:CB_SHORT[x.a]||''})})});rows.push({k:'line',n:li+1,items,note:l.map(n=>n.note).filter(Boolean).join(' · ')})})});
 const top=206+ts,bottom=H-92,lab=118,availW=W-pad*2-lab;
 const unit=it=>it.sep?(it.sep==='→'?.5:.3):1;
 let L=null;
 for(let cw=168;cw>=40;cw-=4){const ch=Math.round(cw*86/59),gap=Math.max(6,cw*.08),nameH=Math.max(18,cw*.2),rowH=ch+nameH+gap*1.6+12;let h=0;const lay=[];
  for(const r of rows){if(r.k==='head'){h+=58;lay.push({r,y:h-58,parts:[]});continue}
   // wrap the items of a row into as many strips as it needs
   const strips=[[]];let w=0;for(const it of r.items){const u=unit(it)*(cw+gap);if(w+u>availW&&strips[strips.length-1].length){strips.push([]);w=0;if(it.sep)continue}strips[strips.length-1].push(it);w+=u}
   lay.push({r,y:h,strips});h+=Math.max(1,strips.length)*rowH+(r.note?24:0)+(r.k==='hand'?10:0)}
  if(h<=bottom-top||cw<=40){L={cw,ch,gap,nameH,rowH,lay};break}}
 const {cw,ch,gap,nameH,rowH,lay}=L;
 const o=[`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
 `<defs><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.bg2}"/><stop offset=".6" stop-color="${P.bg}"/><stop offset="1" stop-color="${P.bg}"/></linearGradient><linearGradient id="da" x1="0" x2="1"><stop offset="0" stop-color="${P.accent}"/><stop offset=".6" stop-color="${P.accent2}"/><stop offset="1" stop-color="${P.gold}"/></linearGradient>`+
 (pf?`<linearGradient id="dfr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${(DI_FRAME[pf.frame]||DI_FRAME.none)[0]}"/><stop offset="1" stop-color="${(DI_FRAME[pf.frame]||DI_FRAME.none)[1]}"/></linearGradient><clipPath id="dav"><circle cx="0" cy="0" r="44"/></clipPath>`:'')+
 `<linearGradient id="dsh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.bg}" stop-opacity="${meta.design==='clean'?.9:.55}"/><stop offset=".3" stop-color="${P.bg}" stop-opacity="${meta.design==='clean'?.86:.8}"/><stop offset="1" stop-color="${P.bg}" stop-opacity="${meta.design==='clean'?.94:.93}"/></linearGradient><clipPath id="dcc"><rect width="${cw}" height="${ch}" rx="${Math.max(3,cw*.05)}"/></clipPath></defs>`,
 `<rect width="${W}" height="${H}" fill="${meta.design==='clean'?P.bg:'url(#dg)'}"/>`];
 if(bg)o.push(`<image href="${X(bg)}" xlink:href="${X(bg)}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/><rect width="${W}" height="${H}" fill="url(#dsh)"/>`);
 if(meta.design==='clean')o.push(`<rect x="0" y="0" width="${W}" height="10" fill="url(#da)"/>`);else o.push(`<rect x="16" y="16" width="${W-32}" height="${H-32}" rx="28" fill="none" stroke="url(#da)" stroke-width="3"/>`);
 o.push(`<g font-family="${F}" fill="${P.ink}"><text x="${pad}" y="70" font-size="20" font-weight="700" letter-spacing="5" fill="${P.gold}">DUEL SYNAPSE · KODEX · COMBO</text>`,
  `<text x="${pad}" y="${80+ts}" font-size="${ts}" font-weight="800">${X(title.slice(0,60))}</text>`,
  `<text x="${pad}" y="${120+ts}" font-family="${B}" font-size="24" font-weight="700" fill="${P.sub}">${X([meta.sub,meta.player].filter(Boolean).join('  ·  '))}</text>`,
  `<text x="${pad}" y="${156+ts}" font-family="${B}" font-size="22" fill="${P.mute}">${X([meta.note,diDateText(meta.date)].filter(Boolean).join('  ·  '))}</text></g>`);
 if(pf){const ax=W-pad-44,ay=96;o.push(`<g transform="translate(${ax},${ay})"><circle r="52" fill="url(#dfr)"/><circle r="46" fill="${P.bg}"/><image href="${X(pf.src)}" xlink:href="${X(pf.src)}" x="-44" y="-44" width="88" height="88" clip-path="url(#dav)" preserveAspectRatio="xMidYMid slice"/></g>`,
  `<g font-family="${F}" text-anchor="end"><text x="${ax-66}" y="${ay-12}" font-size="28" font-weight="800" fill="${P.ink}">${X(pf.name)}</text><text x="${ax-66}" y="${ay+18}" font-family="${B}" font-size="19" fill="${P.sub}">${X(pf.title||((KXPF.tierName(pf.tier)||'')+' duelist'))}</text><text x="${ax-66}" y="${ay+44}" font-size="16" font-weight="700" letter-spacing="2" fill="${P.gold}">MEIOCG${pf.rank?' PLAYERS #'+pf.rank:' PROFILE'}${pf.premium?' · PREMIUM':''}</text></g>`)}
 const cardAt=(it,x,y)=>{const c=cbCard(it.id)||{name:cbName(it.id)},url=deckCardImageUrl(c);
  o.push(`<rect x="${x}" y="${y+2}" width="${cw}" height="${ch}" rx="5" fill="#000" opacity="${meta.design==='clean'?.16:.5}"/>`);
  if(url){let a=url;try{a=new URL(url,document.baseURI).href}catch(e){}o.push(`<g transform="translate(${x},${y})" clip-path="url(#dcc)"><rect width="${cw}" height="${ch}" fill="${P.slot}"/><image href="${X(a)}" xlink:href="${X(a)}" width="${cw}" height="${ch}" preserveAspectRatio="none"/></g>`)}
  else o.push(`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="5" fill="${P.slot}" stroke="${P.line}"/>`);
  const nm=String(c.name||''),fs=Math.max(11,Math.min(17,cw*.115)),mx=Math.floor(cw/(fs*.56));
  o.push(`<text x="${x+cw/2}" y="${y+ch+fs+3}" font-family="${B}" font-size="${fs}" font-weight="700" fill="${P.ink}" text-anchor="middle">${X(nm.length>mx?nm.slice(0,mx-1)+'…':nm)}</text>`);
  if(it.a&&cw>=70)o.push(`<g transform="translate(${x+cw/2},${y-2})"><rect x="${-it.a.length*4.6-9}" y="-11" width="${it.a.length*9.2+18}" height="22" rx="11" fill="${acc}"/><text y="5" font-family="${F}" font-size="13" font-weight="800" fill="${meta.design==='clean'?'#fff':'#16110a'}" text-anchor="middle">${X(it.a.toUpperCase())}</text></g>`)};
 for(const l of lay){const y0=top+l.y,r=l.r;
  if(r.k==='head'){o.push(`<rect x="${pad}" y="${y0+6}" width="${W-pad*2}" height="42" rx="10" fill="${P.head}"/><rect x="${pad}" y="${y0+6}" width="6" height="42" rx="3" fill="url(#da)"/><text x="${pad+20}" y="${y0+35}" font-family="${F}" font-size="22" font-weight="800" fill="${P.ink}">${X(r.n+' · '+r.t)}</text>`);continue}
  o.push(`<text x="${pad}" y="${y0+ch/2+gap}" font-family="${F}" font-size="${r.k==='hand'?18:26}" font-weight="800" fill="${r.k==='hand'?P.sub:acc}">${r.k==='hand'?'STARTING':r.n}</text>`+(r.k==='hand'?`<text x="${pad}" y="${y0+ch/2+gap+22}" font-family="${F}" font-size="18" font-weight="800" fill="${P.sub}">HAND</text>`:''));
  if(r.k==='hand'&&!r.items.length)o.push(`<text x="${pad+lab}" y="${y0+ch/2+gap}" font-family="${B}" font-size="20" fill="${P.mute}">Any hand</text>`);
  l.strips.forEach((st,si)=>{let x=pad+lab;const y=y0+gap+si*rowH;
   for(const it of st){if(it.sep){const w=unit(it)*(cw+gap);o.push(`<text x="${x+w/2-gap/2}" y="${y+ch/2+(it.sep==='→'?cw*.14:cw*.1)}" font-family="${F}" font-size="${it.sep==='→'?cw*.42:cw*.3}" font-weight="800" fill="${it.sep==='→'?acc:P.sub}" text-anchor="middle">${it.sep}</text>`);x+=w}else{cardAt(it,x,y);x+=cw+gap}}});
  if(r.note)o.push(`<text x="${pad+lab}" y="${y0+l.strips.length*rowH+14}" font-family="${B}" font-size="17" font-style="italic" fill="${P.mute}">${X(r.note.slice(0,120))}</text>`)}
 o.push(`<g font-family="${F}"><text x="${pad}" y="${H-44}" font-size="18" fill="${P.mute}">Made with Duel Synapse: KodeX · a project of Meta Insider OCG</text><text x="${W-pad}" y="${H-44}" font-size="18" fill="${P.gold}" text-anchor="end" font-weight="700">kodex.meiocg.org</text></g></svg>`);
 return o.join('')}
function cbImage(ids){
 const all=cbAll().filter(cbHas);if(!all.length){toast('Save a combo first');return}
 let sel=new Set(ids.filter(id=>all.some(c=>c.id===id)));if(!sel.size)sel.add(all[0].id);
 const first=all.find(c=>sel.has(c.id)),pm=S.g('combo_img',{})||{},pf=diProfile();
 let design=DI_DESIGNS.some(x=>x[0]===pm.design)?pm.design:'night',bgPic='',bgMode='';
 const m=openModal(`<div class="dk-hd"><h3>Combo image</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
 <div class="di-wrap"><div class="di-prev" aria-label="Preview"><div class="di-svg"></div><small>Square · ${DI_SIZE}×${DI_SIZE} · saved larger</small></div>
 <div class="pm-f di-f"><div class="di-des" role="radiogroup" aria-label="Design">${DI_DESIGNS.map(([k,l,t])=>`<button type="button" role="radio" data-dsg="${k}" title="${esc(t)}" class="${design===k?'on':''}"><i class="di-sw di-${k}"></i>${l}</button>`).join('')}</div>
 <label><span>Title</span><input data-pm="title" maxlength="60" value="${esc(sel.size>1?((first.deckId&&(deckById(first.deckId)||{}).name)||'My')+' combos':cbTitle(first))}"></label>
 <label><span>Subtitle</span><input data-pm="sub" maxlength="60" placeholder="e.g. deck or format" value="${esc((first.deckId&&(deckById(first.deckId)||{}).name)||'')}"></label>
 <div class="di-2"><label><span>Player</span><input data-pm="player" maxlength="32" value="${esc(pm.player||(pf?pf.name:''))}"></label><label><span>Date</span><input data-pm="date" type="date" value="${diToday()}"></label></div>
 <label><span>Note</span><input data-pm="note" maxlength="80" placeholder="Optional"></label>
 <label><span>Background</span><select data-bg><option value="">Plain</option>${cbUsed(first).map(id=>`<option value="${esc(id)}">${esc(cbName(id))}</option>`).join('')}<option value="__pic">Choose my own picture…</option></select></label><input type="file" accept="image/*" data-bgfile hidden>
 ${all.length>1?`<div class="cb-sec"><b>Combos in this image</b></div><div class="cb-chk">${all.map(c=>`<label class="pm-c"><input type="checkbox" data-sel="${esc(c.id)}"${sel.has(c.id)?' checked':''}><span>${esc(cbTitle(c))}</span></label>`).join('')}</div>`:''}
 <label class="pm-c"><input type="checkbox" data-pm="profile"${pm.profile!==false?' checked':''}${pf?'':' disabled'}><span>${pf?'Show my MEIOCG profile ('+esc(pf.name)+')':'MEIOCG profile: set one up in Settings to show it here'}</span></label>
 <button class="btn p" data-pmgo>${ic('image',18)}Make image</button></div></div>`,'big','pm');
 const read=()=>{const o={design};m.querySelectorAll('[data-pm]').forEach(x=>o[x.dataset.pm]=x.type==='checkbox'?x.checked&&!x.disabled:x.value.trim());if(!o.date)o.date=diToday();return o};
 const bgUrl=()=>bgMode==='__pic'?bgPic:bgMode?(()=>{const c=cbCard(bgMode);return c?(c.img||c.sm||''):''})():'';
 const chosen=()=>all.filter(c=>sel.has(c.id));
 const box=m.querySelector('.di-svg');let tm=0;const draw=()=>{clearTimeout(tm);tm=setTimeout(()=>{box.innerHTML=buildComboSvg(chosen(),read(),bgUrl())},120)};
 m.querySelectorAll('[data-dsg]').forEach(b=>b.onclick=()=>{design=b.dataset.dsg;m.querySelectorAll('[data-dsg]').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-checked',x===b)});draw()});
 m.querySelectorAll('[data-pm]').forEach(x=>x.addEventListener(x.type==='checkbox'||x.type==='date'?'change':'input',draw));
 m.querySelectorAll('[data-sel]').forEach(x=>x.onchange=()=>{x.checked?sel.add(x.dataset.sel):sel.delete(x.dataset.sel);if(!sel.size){sel.add(x.dataset.sel);x.checked=true;toast('Keep at least one combo')}draw()});
 const bs=m.querySelector('[data-bg]'),bf=m.querySelector('[data-bgfile]');
 bs.onchange=()=>{if(bs.value==='__pic'){bf.click();return}bgMode=bs.value;draw()};
 bf.onchange=async()=>{const u=await cbShrink(bf.files&&bf.files[0],1600);if(!u){toast('Choose a picture');bs.value=bgMode==='__pic'?'__pic':bgMode;return}bgPic=u;bgMode='__pic';draw()};
 m.querySelector('[data-pmgo]').onclick=()=>{const o=read(),list=chosen(),bg=bgUrl();S.s('combo_img',{design:o.design,player:o.player,profile:o.profile});closeModal();
  setTimeout(async()=>{let svg=buildComboSvg(list,o,bg);const name=(String(o.title).replace(/[^\w -]/g,'').trim()||'combo')+'-'+o.date;
   const urls=[...new Set([...svg.matchAll(/<image href="(https:[^"]+)"/g)].map(x=>x[1].replace(/&amp;/g,'&')))];const got=await Promise.all(urls.map(u=>icGet(u).then(v=>[u,v],()=>[u,null])));
   for(const [u,v] of got){const e=u.replace(/&/g,'&amp;');svg=svg.split(`href="${e}"`).join(`href="${v||artSrc(u).replace(/&/g,'&amp;')}"`)}deckViewer(svg,name,null);icWarm(urls)},140)};
 draw()}
