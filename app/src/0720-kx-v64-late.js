/* KodeX 9.7 (v64). Created by Castel Noleal, creator of MEIOCG. A project of Meta Insider OCG since 2023. */
/* ---------- Closing the Arena comes back to the Test tab ---------- */
{let wasArena=false;const ns0=navSync;navSync=function(){ns0();if(L.includes('arena'))wasArena=true};
 addEventListener('popstate',()=>{if(!wasArena||L.includes('arena'))return;wasArena=false;
  if(typeof arenaMin!=='undefined'&&arenaMin)return;
  // something is open underneath (the Test tab, the combos, the deck you were playtesting): that is where you land
  if(L.length)return;
  setTimeout(()=>{if(!L.includes('arena'))kxTestHub()},40)})}

/* ---------- Combos that know the cards: what a card can do next, read from its text ---------- */
const CBX_RACES=['Beast-Warrior','Divine-Beast','Sea Serpent','Winged Beast','Spellcaster','Aqua','Beast','Cyberse','Dinosaur','Dragon','Fairy','Fiend','Fish','Illusion','Insect','Machine','Plant','Psychic','Pyro','Reptile','Rock','Thunder','Warrior','Wyrm','Zombie'];
const CBX_ATTR=['LIGHT','DARK','EARTH','WATER','FIRE','WIND','DIVINE'];
const CBX_SUB=['Tuner','Pendulum','Ritual','Fusion','Synchro','Xyz','Link','Normal','Effect','Field','Equip','Quick-Play','Continuous','Counter','Flip','Union','Gemini','Spirit','Toon'];
const CBX_ST=['Field','Equip','Quick-Play','Continuous','Counter','Ritual','Normal'];
const CBX_LOC='(?:hand|Main Deck|Extra Deck|Deck|GY|Graveyard|banishment|field|side of the field|Pendulum Zone)';
const cbxWord=(k,t)=>new RegExp('(^|[^-A-Za-z])'+k.replace(/[-]/g,'\\-')+'(?![-A-Za-z])').test(t);
/** "1 Level 4 or lower "Solfachord" Pendulum Monster" → a test for cards. */
function cbxFilter(ph,sent){
 const q=[...ph.matchAll(/"([^"]+)"/g)].map(m=>m[1].toLowerCase()),rest=ph.replace(/"[^"]+"/g,' ');
 let r2=rest;const races=[];for(const r of CBX_RACES)if(cbxWord(r,r2)){races.push(r);r2=r2.replace(r,' ')}
 const attrs=CBX_ATTR.filter(a=>cbxWord(a,rest));
 const kind=/Spell\s*\/\s*Trap|Spell or Trap|Spells?\/Traps?/i.test(rest)?'ST':/\bSpells?\b/.test(rest)?'S':/\bTraps?\b/.test(rest)?'T':/\bmonsters?\b/i.test(rest)?'M':'';
 const non=/non-Tuner/i.test(rest),sub=CBX_SUB.filter(k=>cbxWord(k,r2)&&!(k==='Tuner'&&non));
 let lvMax=null,lvMin=null,lvEq=null,m;
 if((m=rest.match(/Level (\d+) or lower/i)))lvMax=+m[1];else if((m=rest.match(/Level (\d+) or higher/i)))lvMin=+m[1];else if((m=rest.match(/Level (\d+)/i)))lvEq=+m[1];
 const exc=[...String(sent).matchAll(/except "([^"]+)"/g)].map(m=>m[1].toLowerCase());
 const exact=q.length&&!kind&&!races.length&&!sub.length&&!attrs.length;
 const test=x=>{const t=String(x.type||''),k=cat(x),isM=k==='Monster',nm=String(x.name).toLowerCase();
  if(exc.includes(nm))return false;
  if(q.length&&!q.some(n=>exact?nm===n:(String(x.arch||'').toLowerCase()===n||nm.includes(n))))return false;
  if(kind==='M'&&!isM)return false;if(kind==='S'&&k!=='Spell')return false;if(kind==='T'&&k!=='Trap')return false;if(kind==='ST'&&isM)return false;
  if(races.length&&!(isM&&races.includes(x.race)))return false;
  if(attrs.length&&!attrs.includes(String(x.attr).toUpperCase()))return false;
  for(const s of sub){if(!isM&&CBX_ST.includes(s)){if(String(x.race)!==s)return false}else if(!new RegExp(s,'i').test(t))return false}
  if(non&&/tuner/i.test(t))return false;
  if(lvMax!=null&&!(isM&&x.lv!=null&&x.lv<=lvMax))return false;
  if(lvMin!=null&&!(isM&&x.lv!=null&&x.lv>=lvMin))return false;
  if(lvEq!=null&&!(isM&&x.lv===lvEq))return false;
  return true};
 return{test,any:!q.length&&!kind&&!races.length&&!attrs.length&&!sub.length&&lvMax==null&&lvMin==null&&lvEq==null}}
/** When an effect can be used, from the part of the sentence before the colon. */
function cbxWhen(cond,s,card,zone){const c=cond||'',isM=cat(card)==='Monster';
 if(zone==='pend')return{on:['scale'],t:'while it is in the Pendulum Zone'};
 if(/Normal or Special Summoned|Normal Summoned or Special Summoned/i.test(c))return{on:['ns','ss'],t:'when it is Normal or Special Summoned'};
 if(/Normal or Flip Summoned|Normal Summoned/i.test(c))return{on:['ns'],t:'when it is Normal Summoned'};
 if(/(Special|Link|Synchro|Xyz|Fusion|Ritual|Pendulum) Summoned/i.test(c)&&/this card/i.test(c))return{on:['ss'],t:'when it is Special Summoned'};
 if(/this card is (sent|discarded) to the GY|this card is sent there|this card is sent from .{2,40} to the GY/i.test(c))return{on:['gy'],t:'when it is sent to the GY'};
 if(/this card is banished/i.test(c))return{on:['ban'],t:'when it is banished'};
 if(/this card is added to your hand/i.test(c))return{on:['add'],t:'when it is added to the hand'};
 if(/this card is Tributed/i.test(c))return{on:['trib'],t:'when it is Tributed'};
 if(/this card .{0,24}is destroyed/i.test(c))return{on:['des'],t:'when it is destroyed'};
 if(/this card is (used|sent to the GY) as .{0,20}Material/i.test(c))return{on:['gy'],t:'when it is used as material'};
 if(/this card is in your GY/i.test(c)||/banish this card from your GY/i.test(s))return{on:['gy'],t:'while it is in the GY'};
 if(/this card is in your hand/i.test(c)||/(discard|reveal) this card|send this card from your hand|Special Summon this card from your hand|Special Summon this card \(from your hand\)/i.test(s))return{on:['hand'],t:'from the hand'};
 if(!isM)return{on:['act'],t:'when you activate it'};
 if(c&&/^(If|When|During)\b/i.test(c)&&!/this card/i.test(c)&&!/Main Phase/i.test(c))return{on:['ns','ss','field'],t:'on the field, when: '+c.replace(/\s+/g,' ').slice(0,70)};
 return{on:['ns','ss','field'],t:'while it is on the field'}}
const CBX_ACT={add:'add',send:'gy','special summon':'ss',banish:'ban',set:'set'};
/** Every play a card's text allows: what moves, from where, which cards qualify, and when. */
function cbxPlays(card){
 const out=[],raw=String(card.desc||'');
 let parts=[['',raw]];const pm=raw.match(/\[\s*Pendulum Effect\s*\]([\s\S]*?)(?:-{5,}\s*)?\[\s*(?:Monster Effect|Flavor Text)\s*\]([\s\S]*)/i);
 if(pm)parts=[['pend',pm[1]],['mon',pm[2]]];
 const RE=new RegExp('(add|send|Special Summon|banish|Set)\\s+(?:up to\\s+)?(?:(\\d+|an?|both)\\s+)?([^.;:]*?)\\s+(?:directly\\s+)?from\\s+(?:your|either|the)\\s+('+CBX_LOC+'(?:(?:\\s*,\\s*(?:or\\s+|and\\s+)?|\\s+or\\s+|\\s+and\\/or\\s+|\\s+and\\s+)(?:your\\s+)?'+CBX_LOC+')*)','gi');
 for(const [zone,txt] of parts){
  for(const s0 of txt.replace(/\s+/g,' ').split(/(?<=\.)\s+|●/)){const s=s0.trim();if(s.length<12)continue;
   const ci=s.indexOf(':'),cond=ci>0?s.slice(0,ci):'',body=ci>0?s.slice(ci+1):s,semi=body.indexOf(';'),when=cbxWhen(cond,s,card,zone);
   let found=0,m;RE.lastIndex=0;
   while((m=RE.exec(body))){const verb=m[1].toLowerCase(),act=CBX_ACT[verb],ph=m[3].trim(),after=body.slice(m.index+m[0].length,m.index+m[0].length+40);
    if(act==='gy'&&!/^\s*(?:,[^,]{0,30},)?\s*to the (GY|Graveyard)/i.test(after))continue;
    if(act==='add'&&!/to (your|the|their) hand/i.test(after)&&!/to (your|the) hand/i.test(body))continue;
    const src=[];const L4=m[4].toLowerCase();if(/hand/.test(L4))src.push('hand');if(/extra deck/.test(L4))src.push('extra');if(/(^|[^a-z])(main )?deck/.test(L4.replace(/extra deck/g,'')))src.push('deck');if(/gy|graveyard/.test(L4))src.push('gy');if(/banish/.test(L4))src.push('ban');if(/field|zone/.test(L4))src.push('field');
    const cost=semi>=0&&m.index<semi;
    if(/^(this card|it|them|that (card|monster|target)|those|the (revealed|excavated|discarded))\b/i.test(ph)||!ph){
     if(/^this card/i.test(ph)&&act==='ss'){out.push({act:'ss',self:true,when:{on:src.includes('gy')?['gy']:src.includes('ban')?['ban']:['hand','add'],t:src.includes('gy')?'while it is in the GY':src.includes('ban')?'while it is banished':'from the hand'},label:'Special Summon itself'+(cond?' ('+cond.replace(/\s+/g,' ').slice(0,60)+')':''),zone});found++}
     continue}
    const where=m[4].replace(/Graveyard/g,'GY');
    out.push({act,cost,when,zone,src,n:m[2]||'',ph,filt:cbxFilter(ph,s),
     label:(cost?'Cost: ':'')+({add:'Add',gy:'Send',ss:'Special Summon',ban:'Banish',set:'Set'})[act]+' '+(m[2]?m[2]+' ':'')+ph+' from the '+where+(act==='add'?' to the hand':act==='gy'?' to the GY':'')});found++}
   if(!found&&ci>0&&!/^You can only|^\(/i.test(s)){const dm=body.match(/draw (\d+) cards?/i);
    out.push({act:'eff',none:true,when,zone,label:dm?`Draw ${dm[1]} card${dm[1]==='1'?'':'s'}`:body.replace(/^\s*You can\s*/i,'').trim().replace(/^./,x=>x.toUpperCase()).slice(0,110)})}}}
 return out}
/** How a card can be played from the hand (or the Extra Deck). */
function cbxOpen(card){const k=cat(card),t=String(card.type||''),d=String(card.desc||''),o=[];
 if(cbIsExtra(card))return[{a:'ss',label:'Special Summon from the Extra Deck'}];
 if(k==='Monster'){
  o.push({a:'ns',label:card.lv>4?`Tribute Summon (Level ${card.lv})`:'Normal Summon'});
  if(/Special Summon this card(?: \(from your hand\)| from your hand)|Special Summon this card in|you can Special Summon this card/i.test(d)||/Special Summoned? \(from your hand\)/i.test(d))o.push({a:'ss',label:'Special Summon itself (its own condition)'});
  if(/(discard|reveal) this card|send this card from your hand|this card is in your hand/i.test(d))o.push({a:'eff',label:'Use its effect from the hand'});
  if(/pendulum/i.test(t))o.push({a:'scale',label:'Place it in the Pendulum Zone'});
  o.push({a:'set',label:'Set'})}
 else if(k==='Spell'){o.push({a:'act',label:'Activate'});o.push({a:'set',label:'Set'})}
 else{o.push({a:'set',label:'Set'});if(/activate this card from your hand|the turn it was Set/i.test(d))o.push({a:'act',label:'Activate'})}
 return o}
const cbxAuto=card=>cbIsExtra(card)?'ss':cat(card)==='Monster'?'ns':cat(card)==='Spell'?'act':'set';
function cbxOk(ctx,p,card){const on=p.when.on,isM=cat(card)==='Monster';
 if(ctx==='any')return true;
 if(ctx==='eff')return on.some(k=>['field','act','ns','ss','hand'].includes(k));
 if(ctx==='add')return on.includes('add')||on.includes('hand');
 if(ctx==='act')return on.includes('act')||(isM&&on.includes('field'));
 if(ctx==='set')return false;
 return on.includes(ctx)}
const CBX_CTX={ns:'Normal Summoned',ss:'Special Summoned',act:'activated',add:'added to the hand',gy:'sent to the GY',ban:'banished',set:'Set',scale:'placed in the Pendulum Zone',eff:'using its effect',any:''};
/** The cards a play can take: from the combo's deck by default, or from every card. */
function cbxPool(c,p,all){
 const dk=cbDeck(c),wantX=p.src.includes('extra'),wantM=p.src.some(k=>k!=='extra');
 const locOk=x=>cbIsExtra(x)?wantX||!p.src.includes('deck')&&wantM:wantM||!p.src.length;
 if(dk&&!all)return dk.list.filter(e=>locOk(e.card)&&p.filt.test(e.card)).map(e=>e.id);
 if(p.filt.any)return[];
 const o=[];for(const x of cards){if(locOk(x)&&p.filt.test(x)){o.push(String(x.id));if(o.length>=80)break}}return o}
function cbxPush(c,li,node){if(c.lines[li].length>=12){toast('That line is full');return false}c.lines[li].push(node);return true}
/** First card of a line: how it is played. One way: it is used; several: you choose. */
function cbFirstStep(c,id,done){const card=cbCard(id),o=card?cbxOpen(card):[];
 const add=a=>{c.lines.push([{cards:[{c:String(id),a}],note:''}]);done()};
 if(o.length<2){add(o.length?o[0].a:'auto');if(o.length)toast(cbName(id)+': '+o[0].label);return}
 setTimeout(()=>{const m=openModal(`<div class="dk-hd"><h3>${esc(cbName(id))}</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
 <div class="cbn"><p class="note">How do you play it?</p>${o.map((x,i)=>`<button class="cbn-play" data-o="${i}"><b>${esc(x.label)}</b></button>`).join('')}</div>`,'','cbf');
 m.querySelectorAll('[data-o]').forEach(b=>b.onclick=()=>{closeModal();setTimeout(()=>add(o[+b.dataset.o].a),80)})},160)}
/** Next step of a line: the plays the last card(s) allow right now. */
function cbNextStep(c,li,done){
 const line=c.lines[li],ni=line.length-1,last=line[ni],groups=[];
 for(const x of last.cards){const card=cbCard(x.c);if(!card)continue;
  const ctx=x.a!=='auto'?x.a:(ni===0?cbxAuto(card):cbIsExtra(card)?'ss':'any'),plays=cbxPlays(card);
  const yes=[],no=[];
  if(ctx==='add')for(const o of cbxOpen(card))yes.push({open:o,label:o.label,when:{t:'it is in your hand'}});
  for(const p of plays)(cbxOk(ctx,p,card)?yes:no).push(p);
  for(const p of yes)if(p.filt)p.pool=cbxPool(c,p,false);
  groups.push({x,card,ctx,yes,no})}
 const free=()=>cbPick(c,{title:'Next: after '+last.cards.map(x=>cbName(x.c)).join(' + '),from:last.cards.map(x=>x.c)},id=>{if(cbxPush(c,li,{cards:[{c:String(id),a:'auto'}],note:''}))done()});
 const total=groups.reduce((n,g)=>n+g.yes.length,0);
 if(!total&&!groups.some(g=>g.no.length)){free();return}
 const choose=(g,p)=>{const id=String(g.x.c);
  if(p.open){if(cbxPush(c,li,{cards:[{c:id,a:p.open.a}],note:''}))done();return}
  if(p.none||p.self){if(cbxPush(c,li,{cards:[{c:id,a:p.self?'ss':'eff'}],note:p.none?p.label.slice(0,80):''}))done();return}
  cbxPick(c,g,p,pid=>{if(cbxPush(c,li,{cards:[{c:String(pid),a:p.act}],note:''}))done()},total===1)};
 // exactly one thing it can do, and it needs a card: go straight to the cards
 if(total===1){const g=groups.find(v=>v.yes.length),p=g.yes[0];if(p.filt){choose(g,p);return}}
 const cnt=p=>p.open||p.none||p.self?'':(p.pool.length?(p.pool.length===1?'1 card':p.pool.length+' cards'):(cbDeck(c)?'none in deck':'search'));
 const m=openModal(`<div class="dk-hd"><h3>Next step</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
 <div class="cbn">${total===1?'<div class="cbn-only">Only one option right now</div>':''}${groups.map((g,gi)=>`<div class="cbn-src">${cbThumb(g.x.c)}<span>${esc(g.card.name)}${CBX_CTX[g.ctx]?` <small class="note">· ${CBX_CTX[g.ctx]}</small>`:''}</span></div>
 ${g.yes.length?g.yes.map((p,pi)=>`<button class="cbn-play" data-g="${gi}" data-p="${pi}"><b>${esc(p.label)}</b><small>${esc(p.when.t)}</small>${cnt(p)?`<em>${cnt(p)}</em>`:''}</button>`).join(''):`<p class="note">Its text gives it nothing to do right after being ${esc(CBX_CTX[g.ctx]||'played')}.</p>`}
 ${g.no.length?`<details><summary>Not available now (${g.no.length})</summary>${g.no.map(p=>`<div class="cbn-play off"><b>${esc(p.label)}</b><small>Only ${esc(p.when.t)}</small><em>later</em></div>`).join('')}</details>`:''}`).join('')}
 <button class="btn" data-free>${ic('search',16)}Another card</button></div>`,'big','cbn');
 m.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{const g=groups[+b.dataset.g],p=g.yes[+b.dataset.p];closeModal();setTimeout(()=>choose(g,p),140)});
 m.querySelector('[data-free]').onclick=()=>{closeModal();setTimeout(free,140)}}
/** The cards that qualify for a play: in the deck first, every card on request, any card by search. */
function cbxPick(c,g,p,add,only){
 const dk=cbDeck(c),tile=id=>`<button class="cb-pk" data-pk="${esc(id)}">${cbThumb(id)}<span>${esc(cbName(id))}</span></button>`;
 const pool=p.pool||cbxPool(c,p,false);
 const m=openModal(`<div class="dk-hd"><h3>${esc(g.card.name)}</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
 <div class="cbn">${only?'<div class="cbn-only">Only option right now</div>':''}<p class="note"><b>${esc(p.label)}</b><br>${esc(p.when.t)}</p></div>
 <label class="cb-find">${ic('search',18)}<input type="search" data-q placeholder="Search any card by name" autocomplete="off" enterkeyhint="search"></label>
 <div class="cb-pbody"><div data-res hidden></div>
 <div class="cb-sec"><b>${dk?'In '+esc(dk.deck.name):'Cards that qualify'}</b><small>${pool.length?pool.length+' qualify':'none qualify'}</small></div><div class="cb-grid" data-pool>${pool.map(tile).join('')}</div>
 ${dk?`<button class="btn" data-all>Show every card that qualifies</button><div data-allres></div>`:''}
 ${!pool.length&&!dk&&p.filt.any?'<p class="note">Any card qualifies: search for it by name.</p>':''}</div>`,'big xl','cbx');
 m.addEventListener('click',e=>{const b=e.target.closest('[data-pk]');if(b){closeModal();setTimeout(()=>add(b.dataset.pk),80)}});
 const all=m.querySelector('[data-all]');if(all)all.onclick=()=>{const r=cbxPool(c,p,true);all.hidden=true;m.querySelector('[data-allres]').innerHTML=`<div class="cb-sec"><b>Every card</b><small>${r.length?(r.length>=80?'first 80':r.length+' qualify'):'none: search by name'}</small></div><div class="cb-grid">${r.map(tile).join('')}</div>`};
 const res=m.querySelector('[data-res]'),q=m.querySelector('[data-q]');let tm=0;
 q.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>{const r=cbSearch(q.value);res.hidden=!q.value.trim();res.innerHTML=q.value.trim()?`<div class="cb-sec"><b>Search</b><small>${r.length?r.length+' found':'no card found'}</small></div><div class="cb-grid">${r.map(x=>tile(String(x.id))).join('')}</div>`:''},140)}}
