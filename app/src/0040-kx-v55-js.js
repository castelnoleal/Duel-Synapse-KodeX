
/* ---------- KodeX 8.8: entrances, attacks and emotes (Premium), deck image, Synapse Deck Analyzer ---------- */
const ENT_T=[['rise','Rise'],['portal','Portal'],['storm','Storm'],['inferno','Inferno'],['nova','Nova'],['glitch','Glitch']];
const ATK_T=[['lunge','Lunge'],['beam','Beam'],['comet','Comet'],['claw','Claw'],['phantom','Phantom']];
const MV_ICON={
 rise:'<svg viewBox="0 0 48 48" aria-hidden="true"><path class="beam" d="M18 4h12l-2 30h-8z" fill="currentColor" opacity=".35"/><rect class="cd" x="15" y="20" width="18" height="24" rx="3" fill="none" stroke="currentColor" stroke-width="2.6"/></svg>',
 portal:'<svg viewBox="0 0 48 48" aria-hidden="true"><g class="spin" fill="none" stroke="currentColor" stroke-width="2.6"><circle cx="24" cy="24" r="17" stroke-dasharray="8 5"/><circle cx="24" cy="24" r="9"/></g></svg>',
 storm:'<svg viewBox="0 0 48 48" aria-hidden="true"><path class="bolt" d="M26 3 12 25h10l-4 20 18-26H26z" fill="currentColor"/></svg>',
 inferno:'<svg viewBox="0 0 48 48" aria-hidden="true"><path class="fl" d="M24 44c-9 0-14-6-14-13 0-8 7-11 8-20 5 4 6 9 5 12 3-2 4-6 4-9 6 5 11 11 11 18 0 7-6 12-14 12z" fill="currentColor"/></svg>',
 nova:'<svg viewBox="0 0 48 48" aria-hidden="true"><g class="spin" fill="currentColor"><path d="M24 2l4 16 16 6-16 6-4 16-4-16-16-6 16-6z"/></g></svg>',
 glitch:'<svg viewBox="0 0 48 48" aria-hidden="true"><g class="gl" fill="currentColor"><rect x="10" y="8" width="26" height="6"/><rect x="14" y="17" width="26" height="6"/><rect x="8" y="26" width="26" height="6"/><rect x="12" y="35" width="26" height="6"/></g></svg>',
 lunge:'<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path class="ar" d="M8 40 36 12M24 12h12v12"/></g><circle cx="38" cy="10" r="5" fill="none" stroke="#ff6a7a" stroke-width="2"/></svg>',
 beam:'<svg viewBox="0 0 48 48" aria-hidden="true"><rect class="bm" x="4" y="20" width="40" height="8" rx="4" fill="currentColor"/></svg>',
 comet:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 42 30 18" stroke="currentColor" stroke-width="6" stroke-linecap="round" opacity=".4"/><circle class="rock" cx="33" cy="15" r="8" fill="currentColor"/></svg>',
 claw:'<svg viewBox="0 0 48 48" aria-hidden="true"><g class="cl" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M14 8 8 40M26 6 20 42M38 8 32 40"/></g></svg>',
 phantom:'<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="currentColor"><rect x="6" y="14" width="14" height="20" rx="2" opacity=".25"/><rect x="14" y="14" width="14" height="20" rx="2" opacity=".5"/><rect class="ph" x="24" y="14" width="14" height="20" rx="2"/></g></svg>'};
const entStyle=()=>{const v=S.g('ent_style','rise');return ENT_T.some(x=>x[0]===v)?v:'rise'};
const atkStyle=()=>{const v=S.g('atk_style','lunge');return ATK_T.some(x=>x[0]===v)?v:'lunge'};
function perCardFx(key,T){const o=S.g(key,{}),out={};if(o&&typeof o==='object')for(const k of sigCards())if(T.some(x=>x[0]===o[k]))out[k]=o[k];return out}
function mvTiles(kind,sel){const T=kind==='ent'?ENT_T:ATK_T;return `<div class="fin-row mv-row" role="radiogroup" aria-label="${kind==='ent'?'Entrance':'Attack'}">${T.map(([k,l])=>`<button type="button" class="fin-t mv-t mv-${k}${sel===k?' on':''}" role="radio" aria-checked="${sel===k}" data-mv="${kind}" data-mvk="${k}">${MV_ICON[k]}<span>${l}</span></button>`).join('')}</div>`}
function previewMove(kind,k){const T=kind==='ent'?ENT_T:ATK_T,l=(T.find(x=>x[0]===k)||['',''])[1];openModal(`<div class="dk-hd"><h3>${esc(l)} · ${kind==='ent'?'entrance':'attack'}</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div><iframe class="pv-wrap" title="Preview" src="${ARENA_URL}preview.html#${kind==='ent'?'entrance':'attack'}:${k}"></iframe><p class="note">${kind==='ent'?'How your monsters arrive on the field.':'How your monsters attack. The target is always marked so both players see what is attacked.'}${PREMIUM?'':' Free edition: Rise and Lunge. The others come with KodeX Premium.'}</p>`,'','pv')}
function emotesOwn(){const a=S.g('emotes',[]);return Array.isArray(a)?a.filter(x=>x&&typeof x.src==='string'&&/^data:image\/(png|jpe?g|webp|gif);base64,/.test(x.src)).slice(0,8):[]}
function emotesSection(){const a=emotesOwn();return `<section class="sk-sec"><div class="sk-hd"><h4>Emotes</h4></div><p class="note">Up to 8 of your own pictures to send during a duel, at any time. Animated GIFs keep moving (GIFs up to 150 KB).</p><div class="em-row">${a.map(x=>`<span class="em-t"><img src="${x.src}" alt="${esc(x.name)}"><i data-emdel="${esc(x.id)}" role="button" aria-label="Delete">×</i></span>`).join('')}${a.length<8?`<label class="em-t em-add" aria-label="Add an emote"><span>+</span><input type="file" accept="image/*" data-emadd hidden></label>`:''}</div></section>`}
function readDataUrl(f){return new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(f)})}
function shrinkPng(file,max){return new Promise((ok,no)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{const k=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement('canvas');c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);let d=c.toDataURL('image/png');if(d.length>190000)d=c.toDataURL('image/webp',.85);ok(d)};im.onerror=()=>{URL.revokeObjectURL(u);no(new Error('image'))};im.src=u})}
function movesPanel(tb){
 tb.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{const kind=b.dataset.mv;S.s(kind==='ent'?'ent_style':'atk_style',b.dataset.mvk);tb.querySelectorAll(`[data-mv="${kind}"]`).forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-checked',String(x===b))});const pv=tb.querySelector(`[data-mvpv="${kind}"]`);if(pv)pv.textContent='Preview '+b.textContent.trim();skinsToArena()});
 tb.querySelectorAll('[data-mvpv]').forEach(b=>b.onclick=()=>previewMove(b.dataset.mvpv,b.dataset.mvpv==='ent'?entStyle():atkStyle()));
 tb.querySelectorAll('[data-emdel]').forEach(b=>b.onclick=e=>{e.stopPropagation();S.s('emotes',emotesOwn().filter(x=>x.id!==b.dataset.emdel));skinsToArena();openSkins()});
 const ea=tb.querySelector('[data-emadd]');if(ea)ea.onchange=async()=>{const f=ea.files&&ea.files[0];if(!f)return;try{let src;if(/gif$/i.test(f.type)){if(f.size>150000){toast('That GIF is too large (up to 150 KB)');return}src=await readDataUrl(f)}else src=await shrinkPng(f,160);if(src.length>200000){toast('That picture is too large');return}const a=emotesOwn();a.push({id:'e'+Date.now().toString(36),name:f.name.replace(/\.\w+$/,'').slice(0,24)||'Emote',src});S.s('emotes',a);skinsToArena();openSkins()}catch(e){toast('That picture could not be used')}};
}

/* ---------- testing data from the Arena (for the Synapse Deck Analyzer) ---------- */
function deckMainCodes(d){return copies(d,'main').map(c=>Number(pcOf(c))).filter(Boolean)}
function recordStats(m){
 if(!m||!m.result||!m.deck||!Array.isArray(m.deck.main))return;
 const want=m.deck.main.map(Number).sort((a,b)=>a-b),all=deckStore();let best=null,bs=0;
 for(const d of all){const have=deckMainCodes(d).sort((a,b)=>a-b);if(!have.length)continue;const set=new Map();for(const c of have)set.set(c,(set.get(c)||0)+1);let hit=0;for(const c of want){const n=set.get(c)||0;if(n){hit++;set.set(c,n-1)}}let sc=hit/Math.max(have.length,want.length);if(d.name===m.deck.name)sc+=.25;if(sc>bs){bs=sc;best=d}}
 if(!best||bs<.6)return;
 const st=S.g('dstats',{}),r=m.result,clean={at:+r.at||Date.now(),win:!!r.win,draw:!!r.draw,turns:+r.turns||0,dead:!!r.dead,otk:!!r.otk,first:!!r.first,vs:r.vs==='online'?'online':'ai',used:{},drawn:{}};
 for(const k of ['used','drawn'])if(r[k]&&typeof r[k]==='object')for(const [c,n] of Object.entries(r[k]).slice(0,120))if(/^\d{3,10}$/.test(c))clean[k][c]=Math.min(99,+n||0);
 const e=st[best.id]||{games:[]};e.games.push(clean);e.games=e.games.slice(-150);st[best.id]=e;
 const ks=Object.keys(st);if(ks.length>60)delete st[ks[0]];S.s('dstats',st);
}

/* ---------- Synapse Deck Analyzer ---------- */
const AZ_RX={
 search:/add[^.]*from your (deck|gy|graveyard)[^.]*to your hand|add[^.]*from your deck/i,
 deckSS:/special summon[^.]*from your deck/i,
 selfSS:/(you can )?special summon this card(?! from)|special summon this card from your (hand|gy|graveyard)/i,
 extender:/special summon[^.]*from your (hand|gy|graveyard)/i,
 draw:/\bdraw (\d|one|two|three|1|2|3) cards?\b|\bdraw 1 card\b/i,
 remove:/destroy|banish|return[^.]*(to the hand|to the deck)|send[^.]*(your opponent controls|on the field) to the (gy|graveyard)|take control/i,
 mass:/(destroy|banish|return|send) all|each (card|monster) your opponent controls/i,
 negate:/\bnegate\b/i,
 quick:/\(quick effect\)|quick-play|counter trap|\btrap\b/i,
 handtrap:/discard this card[^.]*;|\(quick effect\)[^.]*(from your hand|discard this card)/i,
 protect:/cannot be destroyed|unaffected by|cannot be targeted|cannot be (banished|tributed)/i,
 floodgate:/your opponent cannot|neither player can|monsters your opponent controls cannot|cannot (special summon|activate)/i,
 recur:/from your (gy|graveyard)[^.]*(add|special summon|to your hand)|(add|special summon)[^.]*from your (gy|graveyard)|shuffle[^.]*(gy|graveyard)[^.]*into the deck/i,
 grave:/if this card is sent to the (gy|graveyard)|if this card is (destroyed|banished)|while this card is in your (gy|graveyard)/i,
 burn:/inflict[^.]*damage/i,
 lifegain:/gain[^.]*life ?points|gain \d+ lp/i,
 swarm:/special summon (up to )?(\d|two|three|as many)/i,
 lock:/(cannot|can't) special summon[^.]*except/i,
 boost:/gains? \d+ atk|atk becomes|double[^.]*atk/i,
 piercing:/piercing|attack (twice|all monsters)|direct(ly)? attack/i,
};
function azCard(c){const live=resolveDeckCard(c)||{},t=String(live.type||'').toLowerCase(),x=String(live.desc||'');const f={};for(const k in AZ_RX)f[k]=AZ_RX[k].test(x);f.mon=/monster/.test(t);f.spell=/spell/.test(t);f.trap=/trap/.test(t);f.ex=/fusion|synchro|xyz|link/.test(t);f.atk=+live.atk||0;f.def=+live.def||0;f.lv=+(live.lv||live.rk||live.lk)||0;f.name=c.name||live.name||'';f.id=String(c.id);f.code=pcOf(c);f.len=x.length;f.qp=/quick-play/.test(t);f.cont=/continuous/.test(t);f.field=/field/.test(t);f.equip=/equip/.test(t);f.normal=/normal monster/.test(t);f.link=/link/.test(t);f.starter=(f.search||f.deckSS)&&!f.handtrap&&!f.trap;f.text=x;return f}
function hyper(N,K,n,k){const C=(a,b)=>{if(b<0||b>a)return 0;let r=1;for(let i=1;i<=b;i++)r=r*(a-b+i)/i;return r};let p=0;for(let i=k;i<=Math.min(K,n);i++)p+=C(K,i)*C(N-K,n-i)/C(N,n);return Math.max(0,Math.min(1,p))}
const clamp100=v=>Math.max(0,Math.min(100,Math.round(v)));
function analyzeDeckV1(d){
 normalizeDeck(d);const main=copies(d,'main').map(azCard),extra=copies(d,'extra').map(azCard),all=[...main,...extra],N=main.length||1;
 const cntF=(arr,k)=>arr.filter(x=>x[k]).length,uniq=a=>[...new Map(a.map(x=>[x.id,x])).values()];
 const m={};for(const k of Object.keys(AZ_RX).concat(['mon','spell','trap','starter','qp']))m[k]=cntF(main,k);
 const ex={};for(const k of Object.keys(AZ_RX))ex[k]=cntF(extra,k);
 const mons=all.filter(x=>x.mon),atks=mons.map(x=>x.atk).sort((a,b)=>b-a),top3=atks.slice(0,3),avgTop=top3.length?top3.reduce((a,b)=>a+b,0)/top3.length:0,big=atks.filter(a=>a>=2500).length;
 const pStart=hyper(N,m.starter,5,1),pStart2=hyper(N,m.starter+m.extender,5,2),pHT=hyper(N,m.handtrap,5,1),pBrick=1-hyper(N,N-Math.max(0,N-m.starter-m.extender-m.handtrap-m.quick),5,1);
 const sizePen=Math.max(0,N-40)*1.6;
 const stat=[];
 const add=(k,label,v,why)=>stat.push({k,label,v:clamp100(v),why});
 add('atk','Attack',avgTop/40+big*5+(m.boost+m.piercing)*3+(m.burn)*2,[`Top 3 ATK average ${Math.round(avgTop)} → ${Math.round(avgTop/40)}`,`${big} monsters with 2500+ ATK × 5`,`${m.boost+m.piercing} ATK boost / piercing cards × 3, ${m.burn} burn cards × 2`]);
 add('ctl','Control',(m.remove+ex.remove)*4+(m.negate+ex.negate)*4+m.floodgate*5+m.handtrap*4,[`Removal ${m.remove+ex.remove} × 4`,`Negation ${m.negate+ex.negate} × 4`,`Locks on the opponent ${m.floodgate} × 5`,`Hand traps ${m.handtrap} × 4`]);
 add('con','Consistency',pStart*80+pStart2*25-sizePen+(m.draw)*1.5,[`Chance to open a starter (searcher / summons from Deck, ${m.starter} copies) in 5 cards: ${(pStart*100).toFixed(1)}% × 0.8`,`Chance to open 2+ starters or extenders (${m.starter+m.extender}): ${(pStart2*100).toFixed(1)}% × 0.25`,`Deck size ${N}: −${sizePen.toFixed(1)} (above 40)`,`Draw cards ${m.draw} × 1.5`]);
 add('brk','Board Breaking',m.mass*12+(m.remove)*3+m.handtrap*3+m.qp*2+(m.negate)*2,[`Mass removal ${m.mass} × 12`,`Removal ${m.remove} × 3`,`Hand traps ${m.handtrap} × 3, Quick-Play ${m.qp} × 2, negation ${m.negate} × 2`]);
 const kinds=new Set(all.map(x=>x.mon?(x.ex?(x.link?'L':'E'):'M'):x.spell?(x.qp?'Q':x.cont?'C':x.field?'F':x.equip?'Q2':'S'):'T')).size;
 add('ver','Versatility',kinds*8+Math.min(15,extra.length)*1.6+(m.quick)*1.2,[`${kinds} kinds of cards × 8`,`Extra Deck ${extra.length} (up to 15) × 1.6`,`Cards usable on the opponent's turn ${m.quick} × 1.2`]);
 add('res','Resilience',(m.protect+ex.protect)*5+(m.grave+ex.grave)*3+(m.negate+ex.negate)*2+m.floodgate*2,[`Protection ${m.protect+ex.protect} × 5`,`Effects from the GY / when destroyed ${m.grave+ex.grave} × 3`,`Negation ${m.negate+ex.negate} × 2, locks ${m.floodgate} × 2`]);
 add('rec','Recovery',(m.recur+ex.recur)*5+m.draw*5+m.search*1.5+m.lifegain*2,[`Cards back from the GY ${m.recur+ex.recur} × 5`,`Draw ${m.draw} × 5`,`Searches ${m.search} × 1.5, life gain ${m.lifegain} × 2`]);
 const star=(v,max)=>Math.max(1,Math.min(5,Math.round(v/max*5)));
 const stars=[['Draw power',star(m.draw*2+m.search,14),`${m.draw} draw + ${m.search} search cards`],['Control',star(stat[1].v,100),`Control score ${stat[1].v}`],['Search',star(m.search+m.deckSS,14),`${m.search} searchers, ${m.deckSS} summon from the Deck`],['Layered end board',star((ex.negate+ex.protect)*2+m.quick+m.floodgate*2,24),`${ex.negate} Extra Deck negators, ${m.quick} cards for the opponent's turn`],['Beatdown',star(stat[0].v,100),`Attack score ${stat[0].v}`],['Stamina',star(stat[6].v+stat[5].v/2,110),`Recovery ${stat[6].v} + half of Resilience`],['Comeback',star(m.mass*4+m.recur*2+m.handtrap*2,30),`${m.mass} board wipes, ${m.recur} recursion, ${m.handtrap} hand traps`],['Swarm',star(m.swarm*3+m.extender*2+m.deckSS*2+extra.length,40),`${m.extender} extenders, ${m.deckSS} Deck summons, ${extra.length} Extra Deck`]];
 const effectShare=all.filter(x=>x.len>120).length/Math.max(1,all.length),avgLen=all.reduce((a,x)=>a+x.len,0)/Math.max(1,all.length);
 const diffV=clamp100(effectShare*45+avgLen/12+extra.length*1.5+(m.quick)*1+m.lock*4);
 const difficulty=diffV>=75?'Expert':diffV>=55?'Hard':diffV>=35?'Medium':'Easy';
 const staminaV=clamp100(stat[6].v*.6+stat[5].v*.4);
 const stamina=staminaV>=60?'Long game':staminaV>=35?'Balanced':'Short game';
 // testing data
 const games=((S.g('dstats',{})||{})[d.id]||{games:[]}).games||[];
 const T={n:games.length};
 if(games.length){T.wins=games.filter(g=>g.win).length;T.rate=T.wins/games.length;T.dead=games.filter(g=>g.dead).length;T.otk=games.filter(g=>g.otk).length;T.turns=games.reduce((a,g)=>a+g.turns,0)/games.length;const f=games.filter(g=>g.first),s2=games.filter(g=>!g.first);T.first=f.length?f.filter(g=>g.win).length/f.length:null;T.second=s2.length?s2.filter(g=>g.win).length/s2.length:null;
  const used={},drawn={};for(const g of games){for(const [c,n] of Object.entries(g.used||{}))used[c]=(used[c]||0)+n;for(const [c,n] of Object.entries(g.drawn||{}))drawn[c]=(drawn[c]||0)+n}
  const nm=c=>{const x=all.find(v=>String(v.code)===String(c)||v.id===String(c));return x?x.name:(M.get(String(c))||{}).name||('#'+c)};
  const inDeck=uniq(all);T.most=Object.entries(used).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([c,n])=>[nm(c),n]);
  T.least=inDeck.map(x=>[x.name,used[x.code]||0,drawn[x.code]||0]).sort((a,b)=>a[1]-b[1]||b[2]-a[2]).slice(0,5)}
 const base=stat.reduce((a,x)=>a+x.v,0)/stat.length;
 const final=clamp100(T.n>=5?base*.7+T.rate*100*.3:base);
 const rank=final>=90?'S+':final>=80?'S':final>=70?'A':final>=58?'B':final>=45?'C':'D';
 const order=[...stat].sort((a,b)=>b.v-a.v),topK=order.slice(0,2).map(x=>x.k);
 const rec=[];if(topK.includes('con')&&stat[2].v>=60)rec.push('Competitive play');if(topK.includes('ctl'))rec.push('Control players');if(topK.includes('atk')||topK.includes('brk'))rec.push('Aggressive players (OTK)');if(topK.includes('rec')||topK.includes('res'))rec.push('Grind-game lovers');if(difficulty==='Easy'||difficulty==='Medium')rec.push('New duelists');if(difficulty==='Expert')rec.push('Experienced combo players');if(!rec.length)rec.push('Casual duels');
 // key cards
 const U=uniq(all),score=x=>(x.starter?30:0)+(x.negate?18:0)+(x.mass?20:0)+(x.protect?10:0)+(x.handtrap?14:0)+x.atk/150+(x.recur?8:0)+(x.ex&&x.atk>=3000?10:0)+all.filter(v=>v.text.includes(x.name)&&v.id!==x.id).length*12;
 const key={beaters:U.filter(x=>x.mon).sort((a,b)=>b.atk-a.atk).slice(0,3),keys:[...U].sort((a,b)=>score(b)-score(a)).slice(0,4),defenders:U.filter(x=>x.mon&&(x.protect||x.negate||x.def>=2500)).sort((a,b)=>(b.protect+b.negate)*1000+b.def-((a.protect+a.negate)*1000+a.def)).slice(0,3),starters:U.filter(x=>x.starter).slice(0,4)};
 key.best=[...U].sort((a,b)=>score(b)-score(a))[0]||null;
 const comp=[['Monsters',m.mon,'#e8b25a'],['Spells',m.spell,'#38c9a6'],['Traps',m.trap,'#d9729f']];
 return {d,N,extra:extra.length,stat,stars,difficulty,diffV,stamina,staminaV,final,rank,rec,key,T,comp,odds:{pStart,pStart2,pHT,pBrick},m,ex};
}
function azRadar(stat){const cx=150,cy=140,R=104,n=stat.length,pt=(i,r)=>{const a=-Math.PI/2+i*2*Math.PI/n;return [cx+Math.cos(a)*r,cy+Math.sin(a)*r]};
 let g='';for(const f of [.25,.5,.75,1])g+=`<polygon points="${stat.map((_,i)=>pt(i,R*f).join(',')).join(' ')}" fill="none" stroke="#ffffff" stroke-opacity="${f===1?.25:.1}"/>`;
 stat.forEach((_,i)=>{const [x,y]=pt(i,R);g+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#ffffff" stroke-opacity=".1"/>`});
 const poly=stat.map((s,i)=>pt(i,R*s.v/100).join(',')).join(' ');
 g+=`<polygon class="az-poly" points="${poly}" fill="url(#azg)" fill-opacity=".45" stroke="#8d99ff" stroke-width="2.5" stroke-linejoin="round"/>`;
 stat.forEach((s,i)=>{const [x,y]=pt(i,R*s.v/100),[lx,ly]=pt(i,R+22);g+=`<circle cx="${x}" cy="${y}" r="4" fill="#f0b429"/><text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#c9d0f2">${s.label}</text><text x="${lx}" y="${ly+13}" text-anchor="middle" font-size="11" font-weight="700" fill="#f0b429">${s.v}</text>`});
 return `<svg class="az-radar" viewBox="0 0 300 290" role="img" aria-label="Main stats radar chart"><defs><linearGradient id="azg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3347f0"/><stop offset="1" stop-color="#7a4fd6"/></linearGradient></defs>${g}</svg>`}
function azDonut(parts){const tot=parts.reduce((a,p)=>a+p[1],0)||1;let a0=-Math.PI/2,out='';for(const [l,v,c] of parts){if(!v)continue;const a1=a0+v/tot*2*Math.PI,lg=a1-a0>Math.PI?1:0,R=52,r=34,p=(a,rr)=>[60+Math.cos(a)*rr,60+Math.sin(a)*rr];const [x0,y0]=p(a0,R),[x1,y1]=p(a1-.0001,R),[x2,y2]=p(a1-.0001,r),[x3,y3]=p(a0,r);out+=`<path d="M${x0} ${y0}A${R} ${R} 0 ${lg} 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 ${lg} 0 ${x3} ${y3}Z" fill="${c}"><title>${l}: ${v}</title></path>`;a0=a1}
 return `<svg viewBox="0 0 120 120" class="az-donut" role="img" aria-label="Card types">${out}<text x="60" y="58" text-anchor="middle" font-size="20" font-weight="800" fill="#fff">${tot}</text><text x="60" y="74" text-anchor="middle" font-size="9" fill="#9aa4bd">MAIN</text></svg>`}
function azRing(v,label,col){const C=2*Math.PI*42,o=C*(1-Math.max(0,Math.min(1,v)));return `<svg viewBox="0 0 100 100" class="az-ring" role="img" aria-label="${label}"><circle cx="50" cy="50" r="42" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="10"/><circle cx="50" cy="50" r="42" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${o.toFixed(1)}" transform="rotate(-90 50 50)"/><text x="50" y="55" text-anchor="middle" font-size="18" font-weight="800" fill="#fff">${Math.round(v*100)}%</text></svg>`}
function azCurve(N,K){const pts=[];for(let n=1;n<=10;n++)pts.push([n,hyper(N,K,n,1)]);const X=n=>20+(n-1)*28,Y=p=>100-p*84;return `<svg viewBox="0 0 290 120" class="az-curve" role="img" aria-label="Chance to see a starter by cards seen"><path d="M${pts.map(([n,p])=>X(n)+' '+Y(p)).join('L')}" fill="none" stroke="#8d99ff" stroke-width="2.5"/>${pts.map(([n,p])=>`<circle cx="${X(n)}" cy="${Y(p)}" r="${n===5||n===6?4.5:3}" fill="${n===5||n===6?'#f0b429':'#8d99ff'}"><title>${n} cards: ${(p*100).toFixed(1)}%</title></circle><text x="${X(n)}" y="116" text-anchor="middle" font-size="9" fill="#9aa4bd">${n}</text>`).join('')}<text x="20" y="12" font-size="9" fill="#9aa4bd">chance to see a starter · cards seen →</text></svg>`}
function openAnalyzer(id){
 const d=deckById(id);if(!d)return;if(!d.cards.length){toast('Add cards to the deck first');return}
 const A=analyzeDeck(d),stars=n=>'<span class="az-st" aria-label="'+n+' of 5">'+'★'.repeat(n)+'<i>'+'★'.repeat(5-n)+'</i></span>';
 const kc=(t,arr)=>arr&&arr.length?`<div class="az-kc"><h5>${t}</h5><div class="az-kr">${arr.map(x=>{const u=deckCardImageUrl({id:x.id});return `<button type="button" class="az-k" data-quickview="${esc(x.id)}"><img src="${esc(u||'')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span>${esc(x.name)}</span></button>`}).join('')}</div></div>`:'';
 const T=A.T,pct=v=>v==null?'–':Math.round(v*100)+'%';
 const html=`<div class="dk-hd"><h3>Synapse Deck Analyzer</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
<div class="az">
<div class="az-hero"><div class="az-rank r-${A.rank.replace('+','p')}"><b>${A.rank}</b><small>${A.final}/100</small></div><div class="az-ht"><small>FINAL SCORE</small><h4>${esc(d.name)}</h4><p>${A.N} Main · ${A.extra} Extra · ${A.difficulty} · ${A.stamina}</p></div></div>
<label class="az-calc"><input type="checkbox" data-azcalc><span>Show the calculations</span></label>
<section class="az-sec"><h5>Main stats</h5><div class="az-main">${azRadar(A.stat)}<div class="az-bars">${A.stat.map(s=>`<div class="az-bar"><span>${s.label}</span><i><b style="width:${s.v}%"></b></i><em>${s.v}</em><ul class="az-why">${s.why.map(w=>`<li>${esc(w)}</li>`).join('')}<li>Capped at 100</li></ul></div>`).join('')}</div></div></section>
<section class="az-sec"><h5>More stats</h5><div class="az-stars">${A.stars.map(([l,n,w])=>`<div class="az-sr"><span>${l}</span>${stars(n)}<small class="az-why">${esc(w)}</small></div>`).join('')}</div></section>
<section class="az-sec az-3"><div class="az-box"><h5>Deck difficulty</h5><b class="az-big">${A.difficulty}</b><i class="az-meter"><b style="width:${A.diffV}%"></b></i><small class="az-why">Long effect texts ${Math.round(A.diffV)} pts: share of cards with long texts, average text length, Extra Deck size, cards for the opponent's turn and summon locks.</small></div><div class="az-box"><h5>Deck stamina</h5><b class="az-big">${A.stamina}</b><i class="az-meter"><b style="width:${A.staminaV}%"></b></i><small class="az-why">Recovery × 0.6 + Resilience × 0.4 = ${A.staminaV}</small></div><div class="az-box"><h5>Card types</h5>${azDonut(A.comp)}<small>${A.comp.map(c=>`<span style="color:${c[2]}">●</span> ${c[0]} ${c[1]}`).join(' · ')}</small></div></section>
<section class="az-sec"><h5>Opening hand</h5><div class="az-odds"><div>${azCurve(A.N,A.m.starter)}</div><ul><li><b>${(A.odds.pStart*100).toFixed(1)}%</b> open a starter in 5 cards</li><li><b>${(A.odds.pStart2*100).toFixed(1)}%</b> open 2+ starters or extenders</li><li><b>${(A.odds.pHT*100).toFixed(1)}%</b> open a hand trap</li></ul></div><small class="az-why">Hypergeometric odds: ${A.N} cards, ${A.m.starter} starters, ${A.m.extender} extenders, ${A.m.handtrap} hand traps, 5 cards drawn.</small></section>
<section class="az-sec"><h5>Recommended for</h5><div class="az-chips">${A.rec.map(r=>`<span>${esc(r)}</span>`).join('')}</div></section>
<section class="az-sec"><h5>Key cards</h5>${A.key.best?`<div class="az-best"><button type="button" class="az-k big" data-quickview="${esc(A.key.best.id)}"><img src="${esc(deckCardImageUrl({id:A.key.best.id})||'')}" alt="" onerror="this.style.visibility='hidden'"></button><div><small>BEST CARD</small><b>${esc(A.key.best.name)}</b><p class="az-why">Most impact: starts plays, stops the opponent, is named by other cards or hits hard.</p></div></div>`:''}${kc('Starters',A.key.starters)}${kc('Main beaters',A.key.beaters)}${kc('Key cards',A.key.keys)}${kc('Defenders',A.key.defenders)}</section>
<section class="az-sec"><h5>Testing data</h5>${T.n?`<div class="az-test"><div class="az-tr">${azRing(T.rate,'Win ratio','#38c9a6')}<small>Win ratio · ${T.wins} of ${T.n}</small></div><div class="az-tg"><div><b>${T.n}</b><small>duels</small></div><div><b>${T.otk}</b><small>OTKs</small></div><div><b>${pct(T.dead/T.n)}</b><small>dead hands</small></div><div><b>${T.turns.toFixed(1)}</b><small>avg. turns</small></div><div><b>${pct(T.first)}</b><small>win going first</small></div><div><b>${pct(T.second)}</b><small>win going second</small></div></div></div><div class="az-2"><div><h6>Most used</h6><ol>${T.most.map(([n,c])=>`<li>${esc(n)} <em>${c}×</em></li>`).join('')||'<li>–</li>'}</ol></div><div><h6>Least used</h6><ol>${T.least.map(([n,c,dr])=>`<li>${esc(n)} <em>${c}× used · ${dr}× drawn</em></li>`).join('')}</ol></div></div>${T.n>=5?'<small class="az-why">With 5+ duels the final score is 70% card stats + 30% win ratio.</small>':''}`:`<p class="note">No duels with this deck yet. Playtest it in the Duel Arena: every duel adds its win, OTKs, dead hands and the cards you used.</p><button class="btn" data-playtest="${esc(d.id)}">${ic('play',18)}Playtest now</button>`}</section>
<p class="note az-foot">Card stats come from the card texts and are a guide, not a rule. A dead hand is a first turn with no summon and no activation.</p>
</div>`;
 const m=openModal(html,'big','az');const box=m.querySelector('.az'),cb=m.querySelector('[data-azcalc]');cb.checked=!!S.g('az_calc',false);box.classList.toggle('calc',cb.checked);cb.onchange=()=>{S.s('az_calc',cb.checked);box.classList.toggle('calc',cb.checked)};
}

