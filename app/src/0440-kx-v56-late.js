
/* ---------- KodeX 8.9 (loaded last: these replace earlier versions) ---------- */
/** Everything Premium the Arena needs: skins, moves, finale, Ace cards, emotes (HD GIFs), sound emotes, card voices. */
function skinsToArena(){const f=$('arenaFrame');if(!PREMIUM||!f||!f.contentWindow)return;const voices={};for(const id of sigCards()){const v=MEDIA.voices[id];if(v&&v.snd)voices[/^\d{3,10}$/.test(id)?id:String(id)]=v.snd}
 try{f.contentWindow.postMessage({kx:'skin',premium:PREMIUM,sleeve:skinImg('sleeve'),xsleeve:skinImg('xsleeve'),field:fieldSkin(),signature:sigCards().map(Number),finisher:finStyle(),sigFx:sigFx(),entrance:entStyle(),attack:atkStyle(),entFx:perCardFx('sig_ent',ENT_T),atkFx:perCardFx('sig_atk',ATK_T),finale:finaleStyle(),aceStyle:aceStyle(),aces:aceCards().map(Number),emotes:MEDIA.emotes.map(x=>({name:x.name,src:x.src,snd:x.snd||''})),sounds:MEDIA.sounds.map(x=>({name:x.name,snd:x.snd})),voices},'*')}catch(e){}audioToArena()}
function movesPanel(tb){
 tb.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{const kind=b.dataset.mv;S.s(kind==='ent'?'ent_style':'atk_style',b.dataset.mvk);tb.querySelectorAll(`[data-mv="${kind}"]`).forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-checked',String(x===b))});const pv=tb.querySelector(`[data-mvpv="${kind}"]`);if(pv)pv.textContent='Preview '+b.textContent.trim();skinsToArena()});
 tb.querySelectorAll('[data-mvpv]').forEach(b=>b.onclick=()=>previewMove(b.dataset.mvpv,b.dataset.mvpv==='ent'?entStyle():atkStyle()));
 tb.querySelectorAll('[data-show]').forEach(b=>b.onclick=()=>{const kind=b.dataset.show;S.s(kind==='finale'?'finale_style':'ace_style',b.dataset.showk);tb.querySelectorAll(`[data-show="${kind}"]`).forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-checked',String(x===b))});const pv=tb.querySelector(`[data-showpv="${kind}"]`);if(pv)pv.textContent='Preview '+b.textContent.trim();skinsToArena()});
 tb.querySelectorAll('[data-showpv]').forEach(b=>b.onclick=()=>previewShow(b.dataset.showpv,b.dataset.showpv==='finale'?finaleStyle():aceStyle()));
 tb.querySelectorAll('[data-emdel]').forEach(b=>b.onclick=async e=>{e.stopPropagation();MEDIA.emotes=MEDIA.emotes.filter(x=>x.id!==b.dataset.emdel);await mediaSave();skinsToArena();openSkins()});
 tb.querySelectorAll('[data-emsnd]').forEach(b=>b.onclick=e=>{e.stopPropagation();soundFor(async snd=>{const x=MEDIA.emotes.find(v=>v.id===b.dataset.emsnd);if(!x)return;x.snd=snd||'';await mediaSave();skinsToArena();openSkins()},true)});
 const ea=tb.querySelector('[data-emadd]');if(ea)ea.onchange=async()=>{const f=ea.files&&ea.files[0];if(!f)return;try{let src;if(/gif$/i.test(f.type)){if(f.size>IMG_MAX){toast('That GIF is too large (up to 3.3 MB)');return}src=await fileToDataUrl(f)}else if(f.size<=1.2e6&&/png|webp/i.test(f.type)){src=await fileToDataUrl(f)}else src=await shrinkPng(f,512);if(src.length>4.5e6){toast('That picture is too large');return}MEDIA.emotes.push({id:'e'+Date.now().toString(36),name:f.name.replace(/\.\w+$/,'').slice(0,24)||'Emote',src,snd:''});await mediaSave();skinsToArena();openSkins()}catch(e){toast('That picture could not be used')}};
 tb.querySelectorAll('[data-sndplay]').forEach(b=>b.onclick=()=>{const x=MEDIA.sounds.find(v=>v.id===b.dataset.sndplay);if(x)playData(x.snd)});
 tb.querySelectorAll('[data-snddel2]').forEach(b=>b.onclick=async()=>{MEDIA.sounds=MEDIA.sounds.filter(v=>v.id!==b.dataset.snddel2);await mediaSave();skinsToArena();openSkins()});
 const sf=tb.querySelector('[data-sndfile]');if(sf)sf.onchange=async()=>{const r=await pickAudio(sf.files&&sf.files[0]);if(!r)return;MEDIA.sounds.push({id:'s'+Date.now().toString(36),...r});await mediaSave();skinsToArena();openSkins()};
 const sr=tb.querySelector('[data-sndrec]');if(sr)sr.onclick=async()=>{const u=await recordSound(6);if(!u)return;MEDIA.sounds.push({id:'s'+Date.now().toString(36),name:'Recording '+(MEDIA.sounds.length+1),snd:u});await mediaSave();skinsToArena();setTimeout(openSkins,120)};
 if(!tb.dataset.v56){tb.dataset.v56='1';tb.addEventListener('click',async e=>{const a=e.target.closest('[data-sigace]'),v=e.target.closest('[data-sigvoice]');
  if(a){const id=a.dataset.sigace,s=new Set(S.g('ace_cards',[]).map(String));if(s.has(id))s.delete(id);else{if(aceCards().length>=12){toast('Up to 12 Ace cards');return}s.add(id)}S.s('ace_cards',[...s]);a.classList.toggle('on',s.has(id));a.setAttribute('aria-pressed',String(s.has(id)));skinsToArena();if(s.has(id))previewShow('ace',aceStyle())}
  if(v){const id=v.dataset.sigvoice;soundFor(async snd=>{if(snd)MEDIA.voices[id]={snd};else delete MEDIA.voices[id];await mediaSave();v.classList.toggle('on',!!snd);skinsToArena();toast(snd?'Card voice saved':'Card voice removed')},!!MEDIA.voices[id])}})}
}
/** Choose a sound: an audio file or a recording (and "no sound" when one is set). */
function soundFor(cb,has){const m=openModal(`<div class="dk-hd"><h3>Sound</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div><div class="snd-pick"><label class="btn">${ic('plus',16)}Choose an audio file<input type="file" accept="audio/*" data-sp-file hidden></label><button type="button" class="btn" data-sp-rec>🎙 Record (up to 6 s)</button>${has?'<button type="button" class="btn" data-sp-none>No sound</button>':''}<p class="note">Up to 650 KB. Everyone in the duel hears it, unless they mute you.</p></div>`,'','snd');
 m.querySelector('[data-sp-file]').onchange=async e=>{const r=await pickAudio(e.target.files&&e.target.files[0]);if(!r)return;closeModal();cb(r.snd)};
 m.querySelector('[data-sp-rec]').onclick=async()=>{closeModal();setTimeout(async()=>{const u=await recordSound(6);if(u)cb(u)},150)};
 const n=m.querySelector('[data-sp-none]');if(n)n.onclick=()=>{closeModal();cb('')}}

/* ---------- testing data: the Arena's results per deck, now with openers and combo links ---------- */
function recordStats(m){
 if(!m||!m.result||!m.deck||!Array.isArray(m.deck.main))return;
 const want=m.deck.main.map(Number).sort((a,b)=>a-b),all=deckStore();let best=null,bs=0;
 for(const d of all){const have=deckMainCodes(d).sort((a,b)=>a-b);if(!have.length)continue;const set=new Map();for(const c of have)set.set(c,(set.get(c)||0)+1);let hit=0;for(const c of want){const n=set.get(c)||0;if(n){hit++;set.set(c,n-1)}}let sc=hit/Math.max(have.length,want.length);if(d.name===m.deck.name)sc+=.25;if(sc>bs){bs=sc;best=d}}
 if(!best||bs<.6)return;
 const st=S.g('dstats',{}),r=m.result,clean={at:+r.at||Date.now(),win:!!r.win,draw:!!r.draw,turns:+r.turns||0,dead:!!r.dead,otk:!!r.otk,first:!!r.first,vs:r.vs==='online'?'online':'ai',used:{},drawn:{},open:{},links:{}};
 for(const k of ['used','drawn','open'])if(r[k]&&typeof r[k]==='object')for(const [c,n] of Object.entries(r[k]).slice(0,120))if(/^\d{3,10}$/.test(c))clean[k][c]=Math.min(99,+n||0);
 if(r.links&&typeof r.links==='object')for(const [k,n] of Object.entries(r.links).slice(0,120))if(/^\d{3,10}>\d{3,10}$/.test(k))clean.links[k]=Math.min(99,+n||0);
 const e=st[best.id]||{games:[]};e.games.push(clean);e.games=e.games.slice(-150);st[best.id]=e;
 const ks=Object.keys(st);if(ks.length>60)delete st[ks[0]];S.s('dstats',st);
}

/* ---------- Synapse Deck Analyzer 2: real starters, combo links, a probability lab and performance graphs ---------- */
function azPmf(N,K,n){const C=(a,b)=>{if(b<0||b>a)return 0;let r=1;for(let i=1;i<=b;i++)r=r*(a-b+i)/i;return r};const out=[];for(let k=0;k<=Math.min(n,K);k++)out.push(C(K,k)*C(N-K,n-k)/C(N,n));return out}
function azMonte(pool,n,runs,test){let hit=0;const a=pool.slice();for(let r=0;r<runs;r++){for(let i=0;i<n;i++){const j=i+Math.floor(Math.random()*(a.length-i));[a[i],a[j]]=[a[j],a[i]]}if(test(a.slice(0,n)))hit++}return hit/runs}
function azLine(vals,{h=110,w=300,max=1,col='#8d99ff',label=''}={}){if(vals.length<2)return '';const X=i=>14+i*(w-28)/(vals.length-1),Y=v=>h-16-(v/max)*(h-32);const d=vals.map((v,i)=>`${i?'L':'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('');return `<svg viewBox="0 0 ${w} ${h}" class="az-line" role="img" aria-label="${esc(label)}"><path d="M14 ${Y(max*.5)}H${w-14}" stroke="#ffffff" stroke-opacity=".12" stroke-dasharray="4 4"/><path d="${d}L${X(vals.length-1)} ${h-16}L14 ${h-16}Z" fill="${col}" opacity=".14"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/>${vals.map((v,i)=>`<circle cx="${X(i)}" cy="${Y(v)}" r="2.6" fill="${col}"/>`).join('')}<text x="14" y="10" font-size="9" fill="#9aa4bd">${esc(label)}</text></svg>`}
function azBars(rows,{max,col='#8d99ff',fmt=v=>v}={}){max=max||Math.max(1,...rows.map(r=>r[1]));return `<div class="az-hb">${rows.map(([l,v,c])=>`<div class="az-hr"><span>${esc(l)}</span><i><b style="width:${Math.max(2,v/max*100)}%;background:${c||col}"></b></i><em>${fmt(v)}</em></div>`).join('')}</div>`}
function azCols(vals,labels,{h=100,col='#38c9a6'}={}){const max=Math.max(1e-9,...vals),w=Math.max(160,vals.length*34);return `<svg viewBox="0 0 ${w} ${h}" class="az-cols" role="img">${vals.map((v,i)=>{const bh=(v/max)*(h-30),x=8+i*(w-16)/vals.length,bw=(w-16)/vals.length-8;return `<rect x="${x}" y="${h-18-bh}" width="${bw}" height="${bh}" rx="4" fill="${col}" opacity="${.45+.55*v/max}"/><text x="${x+bw/2}" y="${h-6}" text-anchor="middle" font-size="9" fill="#9aa4bd">${esc(labels[i])}</text><text x="${x+bw/2}" y="${h-22-bh}" text-anchor="middle" font-size="9" fill="#fff">${typeof v==='number'&&v<1.0001&&v>0&&String(labels[0]).length<3?Math.round(v*100)+'%':v}</text>`}).join('')}</svg>`}
function analyzeDeck(d){
 normalizeDeck(d);const main=copies(d,'main').map(azCard),extra=copies(d,'extra').map(azCard),all=[...main,...extra],N=main.length||1;
 const cntF=(arr,k)=>arr.filter(x=>x[k]).length,uniq=a=>[...new Map(a.map(x=>[x.id,x])).values()];
 const m={};for(const k of Object.keys(AZ_RX).concat(['mon','spell','trap','starter','qp']))m[k]=cntF(main,k);
 const ex={};for(const k of Object.keys(AZ_RX))ex[k]=cntF(extra,k);
 const games=((S.g('dstats',{})||{})[d.id]||{games:[]}).games||[];
 const sum=(k)=>{const o={};for(const g of games)for(const [c,n] of Object.entries(g[k]||{}))o[c]=(o[c]||0)+n;return o};
 const used=sum('used'),drawn=sum('drawn'),opens=sum('open'),links=sum('links');
 // --- the deck's real starters: searchers / summoners ranked by how much of THIS deck they reach, copies, and how
 //     often they actually opened a turn in your duels
 const U=uniq(main),copiesOf=x=>main.filter(v=>v.id===x.id).length,nm=x=>String(x.name||'').toLowerCase();
 const reach=x=>{const q=[...x.text.matchAll(/"([^"]{3,40})"/g)].map(r=>r[1].toLowerCase()).filter(s=>s!==nm(x));if(!q.length)return 0;return main.filter(v=>v.id!==x.id&&q.some(s=>nm(v).includes(s))).length};
 const cand=U.map(x=>{const r=reach(x),o=opens[x.code]||0,u=used[x.code]||0;const can=(x.search||x.deckSS)&&!x.handtrap;const sc=(x.search?10:0)+(x.deckSS?8:0)+Math.min(r,20)*1.2+copiesOf(x)*2.5+o*7+(x.selfSS?2:0)-(x.trap?6:0);return {x,r,o,u,sc,can}}).filter(c=>c.can||c.o>0).sort((a,b)=>b.sc-a.sc);
 const starters=cand.slice(0,6);
 const starterIds=new Set(cand.filter(c=>c.sc>=14||c.o>0).map(c=>c.x.id));
 const K=main.filter(x=>starterIds.has(x.id)).length,E=main.filter(x=>!starterIds.has(x.id)&&(x.extender||x.selfSS)&&!x.handtrap).length,H=m.handtrap,nonEngine=main.filter(x=>x.handtrap||(!x.text.match(/"[^"]{3,40}"/)&&(x.remove||x.negate))).length;
 // --- probability lab
 const pmf5=azPmf(N,K,5),pmf6=azPmf(N,K,6);
 const pool=main.map(x=>starterIds.has(x.id)?'S':(x.extender||x.selfSS)&&!x.handtrap?'E':x.handtrap?'H':'O');
 const runs=12000;
 const mc={playable5:azMonte(pool,5,runs,h=>h.includes('S')),strong5:azMonte(pool,5,runs,h=>h.includes('S')&&(h.filter(v=>v==='S').length>=2||h.includes('E'))),brick5:azMonte(pool,5,runs,h=>!h.includes('S')&&!h.includes('E')),sh5:azMonte(pool,5,runs,h=>h.includes('S')&&h.includes('H')),playable6:azMonte(pool,6,runs,h=>h.includes('S')),brick6:azMonte(pool,6,runs,h=>!h.includes('S')&&!h.includes('E'))};
 const expect5=5*K/N,sd5=Math.sqrt(5*(K/N)*(1-K/N)*(N-5)/(N-1||1));
 // --- combo links seen in your duels
 const name=c=>{const x=all.find(v=>String(v.code)===String(c)||v.id===String(c));return x?x.name:(M.get(String(c))||{}).name||('#'+c)};
 const combo=Object.entries(links).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,n])=>{const [a,b]=k.split('>');return [name(a),name(b),n]});
 // --- the v1 stats, with consistency from the real starters
 const base=analyzeDeckV1(d);const st=base.stat.find(s=>s.k==='con');
 if(st){const sizePen=Math.max(0,N-40)*1.6;st.v=clamp100(mc.playable5*72+mc.strong5*30-sizePen+m.draw*1.2);st.why=[`Your deck's starters (${K} cards: ${starters.slice(0,3).map(c=>c.x.name).join(', ')}${starters.length>3?'…':''})`,`Playable opening (a starter in 5 cards): ${(mc.playable5*100).toFixed(1)}% × 0.72`,`Strong opening (2 starters, or a starter + an extender): ${(mc.strong5*100).toFixed(1)}% × 0.30`,`Deck size ${N}: −${sizePen.toFixed(1)}`,`Draw cards ${m.draw} × 1.2`]}
 const baseScore=base.stat.reduce((a,x)=>a+x.v,0)/base.stat.length;
 const T=base.T;const final=clamp100(T.n>=5?baseScore*.7+T.rate*100*.3:baseScore);
 const rank=final>=90?'S+':final>=80?'S':final>=70?'A':final>=58?'B':final>=45?'C':'D';
 // --- performance (decks you play often)
 const perf=games.length>=3?(()=>{const g=games.slice(-60),roll=[];let w=0;g.forEach((x,i)=>{w+=x.win?1:0;if(i>=5)w-=g[i-5].win?1:0;roll.push(w/Math.min(i+1,5))});
  const bins=[0,0,0,0,0,0];const bl=['1-3','4-5','6-7','8-9','10-13','14+'];for(const x of g){const t=x.turns;bins[t<=3?0:t<=5?1:t<=7?2:t<=9?3:t<=13?4:5]++}
  const rate=a=>a.length?a.filter(x=>x.win).length/a.length:0;
  const openers=Object.entries(opens).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([c,n])=>[name(c),n]);
  const wins=g.filter(x=>x.win),avgWinT=wins.length?wins.reduce((a,x)=>a+x.turns,0)/wins.length:0;
  return {g,roll,bins,bl,first:rate(g.filter(x=>x.first)),second:rate(g.filter(x=>!x.first)),ai:rate(g.filter(x=>x.vs==='ai')),online:rate(g.filter(x=>x.vs==='online')),nAi:g.filter(x=>x.vs==='ai').length,nOn:g.filter(x=>x.vs==='online').length,openers,avgWinT,deadRoll:g.map((x,i)=>{const s=g.slice(Math.max(0,i-4),i+1);return s.filter(y=>y.dead).length/s.length})}})():null;
 return {...base,stat:base.stat,final,rank,starters,K,E,H,nonEngine,pmf5,pmf6,mc,expect5,sd5,combo,perf,used,drawn,opens,N};
}
function openAnalyzer(id){
 const d=deckById(id);if(!d)return;if(!d.cards.length){toast('Add cards to the deck first');return}
 const A=analyzeDeck(d),stars=n=>'<span class="az-st" aria-label="'+n+' of 5">'+'★'.repeat(n)+'<i>'+'★'.repeat(5-n)+'</i></span>',pc=v=>(v*100).toFixed(1)+'%';
 const kimg=x=>`<button type="button" class="az-k" data-quickview="${esc(x.id)}"><img src="${esc(deckCardImageUrl({id:x.id})||'')}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span>${esc(x.name)}</span></button>`;
 const kc=(t,arr)=>arr&&arr.length?`<div class="az-kc"><h5>${t}</h5><div class="az-kr">${arr.map(kimg).join('')}</div></div>`:'';
 const T=A.T,pct=v=>v==null?'–':Math.round(v*100)+'%',P=A.perf;
 const html=`<div class="dk-hd"><h3>Synapse Deck Analyzer</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
<div class="az">
<div class="az-hero"><div class="az-rank r-${A.rank.replace('+','p')}"><b>${A.rank}</b><small>${A.final}/100</small></div><div class="az-ht"><small>FINAL SCORE</small><h4>${esc(d.name)}</h4><p>${A.N} Main · ${A.extra} Extra · ${A.difficulty} · ${A.stamina}${T.n?` · ${T.n} duels tested`:''}</p></div></div>
<label class="az-calc"><input type="checkbox" data-azcalc><span>Show the calculations</span></label>
<section class="az-sec"><h5>Main stats</h5><div class="az-main">${azRadar(A.stat)}<div class="az-bars">${A.stat.map(s=>`<div class="az-bar"><span>${s.label}</span><i><b style="width:${s.v}%"></b></i><em>${s.v}</em><ul class="az-why">${s.why.map(w=>`<li>${esc(w)}</li>`).join('')}<li>Capped at 100</li></ul></div>`).join('')}</div></div></section>
<section class="az-sec"><h5>Starters in this deck</h5>${A.starters.length?`<div class="az-starters">${A.starters.map((c,i)=>`<div class="az-sti${i?'':' top'}">${kimg(c.x)}<div><b>${i?'#'+(i+1):'TOP STARTER'}</b><span>${esc(c.x.name)}</span><small>${[c.x.search?'searches':'',c.x.deckSS?'summons from the Deck':'',c.r?`reaches ${c.r} card${c.r===1?'':'s'} of this deck`:'',c.o?`opened ${c.o} of your turns`:''].filter(Boolean).join(' · ')}</small></div></div>`).join('')}</div>`:'<p class="note">No card in this deck searches or summons from the Deck.</p>'}<small class="az-why">Ranked by: searches (+10) or summons from the Deck (+8), how many cards of this deck it can reach (×1.2), copies (×2.5) and how often it opened your turns in Arena duels (×7).</small></section>
${A.combo.length?`<section class="az-sec"><h5>Combo links from your duels</h5><ol class="az-combo">${A.combo.map(([a,b,n])=>`<li><span>${esc(a)}</span><i>→</i><span>${esc(b)}</span><em>${n}×</em></li>`).join('')}</ol><small class="az-why">Plays that followed each other in the same turn, counted over every Arena duel with this deck.</small></section>`:''}
<section class="az-sec"><h5>Probability lab</h5>
<div class="az-pl"><div class="az-big2"><b>${pc(A.mc.playable5)}</b><small>playable hand going first</small></div><div class="az-big2"><b>${pc(A.mc.playable6)}</b><small>playable hand going second</small></div><div class="az-big2"><b>${pc(A.mc.strong5)}</b><small>strong hand (2 starters or starter + extender)</small></div><div class="az-big2 bad"><b>${pc(A.mc.brick5)}</b><small>brick going first</small></div><div class="az-big2"><b>${pc(A.mc.sh5)}</b><small>starter + hand trap</small></div><div class="az-big2"><b>${A.expect5.toFixed(2)}</b><small>starters per opening hand (±${A.sd5.toFixed(2)})</small></div></div>
<div class="az-2"><div><h6>Starters in 5 cards</h6>${azCols(A.pmf5.slice(0,5).concat(A.pmf5.length>5?[A.pmf5.slice(5).reduce((a,b)=>a+b,0)]:[]).map(v=>+v.toFixed(3)),['0','1','2','3','4','5'].slice(0,Math.min(6,A.pmf5.length)))}</div><div><h6>Seeing a starter by cards seen</h6>${azCurve(A.N,A.K)}</div></div>
<div class="az-2"><div><h6>What the Main Deck is made of</h6>${azDonut([['Starters',A.K,'#f0b429'],['Extenders',A.E,'#8d99ff'],['Hand traps',A.H,'#e0566b'],['Other',Math.max(0,A.N-A.K-A.E-A.H),'#38c9a6']])}<small class="az-leg"><span style="color:#f0b429">●</span> Starters ${A.K} · <span style="color:#8d99ff">●</span> Extenders ${A.E} · <span style="color:#e0566b">●</span> Hand traps ${A.H} · <span style="color:#38c9a6">●</span> Other ${Math.max(0,A.N-A.K-A.E-A.H)}</small></div><div><h6>Card types</h6>${azDonut(A.comp)}<small class="az-leg">${A.comp.map(c=>`<span style="color:${c[2]}">●</span> ${c[0]} ${c[1]}`).join(' · ')}</small></div></div>
<small class="az-why">Exact hypergeometric odds for the bars and curve (${A.N} cards, ${A.K} starters); the other figures from 12,000 shuffled opening hands. A playable hand has a starter; a brick has neither a starter nor an extender.</small></section>
<section class="az-sec"><h5>More stats</h5><div class="az-stars">${A.stars.map(([l,n,w])=>`<div class="az-sr"><span>${l}</span>${stars(n)}<small class="az-why">${esc(w)}</small></div>`).join('')}</div></section>
<section class="az-sec az-3"><div class="az-box"><h5>Deck difficulty</h5><b class="az-big">${A.difficulty}</b><i class="az-meter"><b style="width:${A.diffV}%"></b></i><small class="az-why">Long effect texts, Extra Deck size, cards for the opponent's turn and summon locks: ${Math.round(A.diffV)} pts.</small></div><div class="az-box"><h5>Deck stamina</h5><b class="az-big">${A.stamina}</b><i class="az-meter"><b style="width:${A.staminaV}%"></b></i><small class="az-why">Recovery × 0.6 + Resilience × 0.4 = ${A.staminaV}</small></div><div class="az-box"><h5>Recommended for</h5><div class="az-chips">${A.rec.map(r=>`<span>${esc(r)}</span>`).join('')}</div></div></section>
<section class="az-sec"><h5>Key cards</h5>${A.key.best?`<div class="az-best"><button type="button" class="az-k big" data-quickview="${esc(A.key.best.id)}"><img src="${esc(deckCardImageUrl({id:A.key.best.id})||'')}" alt="" onerror="this.style.visibility='hidden'"></button><div><small>BEST CARD</small><b>${esc(A.key.best.name)}</b><p class="az-why">Most impact: starts plays, stops the opponent, is named by other cards or hits hard.</p></div></div>`:''}${kc('Main beaters',A.key.beaters)}${kc('Key cards',A.key.keys)}${kc('Defenders',A.key.defenders)}</section>
<section class="az-sec"><h5>Testing data</h5>${T.n?`<div class="az-test"><div class="az-tr">${azRing(T.rate,'Win ratio','#38c9a6')}<small>Win ratio · ${T.wins} of ${T.n}</small></div><div class="az-tg"><div><b>${T.n}</b><small>duels</small></div><div><b>${T.otk}</b><small>OTKs</small></div><div><b>${pct(T.dead/T.n)}</b><small>dead hands</small></div><div><b>${T.turns.toFixed(1)}</b><small>avg. turns</small></div><div><b>${pct(T.first)}</b><small>win going first</small></div><div><b>${pct(T.second)}</b><small>win going second</small></div></div></div><div class="az-2"><div><h6>Most used</h6><ol>${T.most.map(([n,c])=>`<li>${esc(n)} <em>${c}×</em></li>`).join('')||'<li>–</li>'}</ol></div><div><h6>Least used</h6><ol>${T.least.map(([n,c,dr])=>`<li>${esc(n)} <em>${c}× used · ${dr}× drawn</em></li>`).join('')}</ol></div></div>${T.n>=5?'<small class="az-why">With 5+ duels the final score is 70% card stats + 30% win ratio.</small>':''}`:`<p class="note">No duels with this deck yet. Playtest it in the Duel Arena: every duel adds its win, OTKs, dead hands, openers, combo links and the cards you used.</p><button class="btn" data-playtest="${esc(d.id)}">${ic('play',18)}Playtest now</button>`}</section>
${P?`<section class="az-sec az-perf"><h5>Performance · ${P.g.length} recent duels</h5>
<div class="az-res">${P.g.slice(-40).map(x=>`<i class="${x.win?'w':x.draw?'d':'l'}" title="${x.win?'Win':x.draw?'Draw':'Loss'} · ${x.turns} turns${x.otk?' · OTK':''}${x.first?' · went first':' · went second'}"></i>`).join('')}</div>
<div class="az-2"><div>${azLine(P.roll,{label:'Win rate (last 5 duels)',col:'#38c9a6'})}</div><div>${azLine(P.deadRoll,{label:'Dead-hand rate (last 5 duels)',col:'#e0566b'})}</div></div>
<div class="az-2"><div><h6>Win rate</h6>${azBars([['Going first',P.first,'#8d99ff'],['Going second',P.second,'#7a4fd6'],[`Vs Synapse AI (${P.nAi})`,P.ai,'#38c9a6'],[`Online (${P.nOn})`,P.online,'#f0b429']],{max:1,fmt:v=>Math.round(v*100)+'%'})}</div><div><h6>How long duels last (turns)</h6>${azCols(P.bins,P.bl,{col:'#8d99ff'})}<small class="az-leg">Average win on turn ${P.avgWinT?P.avgWinT.toFixed(1):'–'}</small></div></div>
${P.openers.length?`<div><h6>What opened your turns</h6>${azBars(P.openers.map(([n,c])=>[n,c]),{col:'#f0b429',fmt:v=>v+'×'})}</div>`:''}
</section>`:''}
<p class="note az-foot">Card stats come from the card texts and are a guide, not a rule. A dead hand is a first turn with no summon and no activation.</p>
</div>`;
 const m=openModal(html,'big','az');const box=m.querySelector('.az'),cb=m.querySelector('[data-azcalc]');cb.checked=!!S.g('az_calc',false);box.classList.toggle('calc',cb.checked);cb.onchange=()=>{S.s('az_calc',cb.checked);box.classList.toggle('calc',cb.checked)};
}

/* ---------- deck image 2: exaggerated MEIOCG labels ---------- */
function buildDeckPosterSvg(d,W,H,bg,meta){
 meta=meta||{};const X=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
 const F="'Chakra Petch','Plus Jakarta Sans',Arial,sans-serif",sections=[['MAIN DECK',copies(d,'main')],['EXTRA DECK',copies(d,'extra')],['SIDE DECK',copies(d,'side')]].filter(([l,a],i)=>i<2||a.length);
 const cols=13,pad=40,gap=8,cw=Math.floor((W-pad*2-gap*(cols-1))/cols),ch=Math.round(cw*86/59),head=64,top=300;
 const kind=c=>{const t=String((resolveDeckCard(c)||{}).type||'').toLowerCase();return /spell/.test(t)?'S':/trap/.test(t)?'T':'M'};
 const date=new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
 const pc=PLACE_COL[meta.place],pl=(PLACES.find(x=>x[0]===meta.place)||['',''])[1];
 const logo=(()=>{const i=document.querySelector('header .logo img');return i&&/^data:image\//.test(i.src)?i.src:''})();
 const o=[`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
 `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#141c55"/><stop offset=".5" stop-color="#0b0e1f"/><stop offset="1" stop-color="#22123f"/></linearGradient>`+
 `<radialGradient id="b1" cx=".82" cy=".04" r=".6"><stop offset="0" stop-color="#3347f0" stop-opacity=".65"/><stop offset="1" stop-color="#3347f0" stop-opacity="0"/></radialGradient>`+
 `<radialGradient id="b2" cx=".04" cy=".92" r=".55"><stop offset="0" stop-color="#7a4fd6" stop-opacity=".55"/><stop offset="1" stop-color="#7a4fd6" stop-opacity="0"/></radialGradient>`+
 `<radialGradient id="b3" cx=".5" cy=".18" r=".35"><stop offset="0" stop-color="#f0b429" stop-opacity=".16"/><stop offset="1" stop-color="#f0b429" stop-opacity="0"/></radialGradient>`+
 `<linearGradient id="gd" x1="0" x2="1"><stop offset="0" stop-color="#3347f0"/><stop offset=".5" stop-color="#7a4fd6"/><stop offset="1" stop-color="#f0b429"/></linearGradient>`+
 `<linearGradient id="rib" x1="0" x2="1"><stop offset="0" stop-color="#2b3be0"/><stop offset=".6" stop-color="#6a3fd0"/><stop offset="1" stop-color="#1a1f4f" stop-opacity=".9"/></linearGradient>`+
 `<linearGradient id="nm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#d9d0ff"/><stop offset="1" stop-color="#8d99ff"/></linearGradient>`+
 `<linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c4"/><stop offset=".5" stop-color="#f0b429"/><stop offset="1" stop-color="#b67a12"/></linearGradient>`+
 `<linearGradient id="holo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`+
 (pc?`<linearGradient id="pl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pc[1]}"/><stop offset="1" stop-color="${pc[0]}"/></linearGradient>`:'')+
 `<filter id="glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`+
 `<filter id="sh" x="-10%" y="-30%" width="120%" height="160%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000" flood-opacity=".75"/></filter>`+
 `<pattern id="dia" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="46" height="46" fill="none" stroke="#ffffff" stroke-opacity=".035"/></pattern><clipPath id="cc"><rect width="${cw}" height="${ch}" rx="5"/></clipPath><clipPath id="lg"><circle cx="60" cy="60" r="56"/></clipPath></defs>`,
 `<rect width="100%" height="100%" fill="url(#bg)"/>`];
 if(bg)o.push(`<image href="${X(bg)}" xlink:href="${X(bg)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" opacity=".3"/>`);
 o.push(`<rect width="100%" height="100%" fill="url(#b1)"/><rect width="100%" height="100%" fill="url(#b2)"/><rect width="100%" height="100%" fill="url(#b3)"/><rect width="100%" height="100%" fill="url(#dia)"/>`,
 `<path d="M${W*.55} 0 L${W*.75} 0 L${W*.35} ${H} L${W*.15} ${H}Z" fill="#ffffff" opacity=".025"/><path d="M${W*.8} 0 L${W*.86} 0 L${W*.46} ${H} L${W*.4} ${H}Z" fill="#ffffff" opacity=".02"/>`,
 `<rect x="12" y="12" width="${W-24}" height="${H-24}" rx="28" fill="none" stroke="url(#gd)" stroke-width="4"/><rect x="22" y="22" width="${W-44}" height="${H-44}" rx="22" fill="none" stroke="#ffffff" stroke-opacity=".08"/>`);
 // corner diamonds
 for(const [x,y] of [[12,12],[W-12,12],[12,H-12],[W-12,H-12]])o.push(`<path d="M${x} ${y-9}l9 9-9 9-9-9z" fill="url(#gold)"/>`);
 // header: logo, brand line, the deck's name
 const lx=pad,ly=44;
 if(logo)o.push(`<g transform="translate(${lx},${ly})"><circle cx="60" cy="60" r="64" fill="#0c0f1f" stroke="url(#gd)" stroke-width="4" filter="url(#glow)"/><image href="${logo}" xlink:href="${logo}" x="4" y="4" width="112" height="112" clip-path="url(#lg)"/></g>`);
 const tx=logo?lx+150:lx;
 o.push(`<g font-family="${F}"><text x="${tx}" y="${ly+26}" font-size="17" font-weight="800" letter-spacing="6" fill="url(#gold)">MEIOCG ◆ PROJECT: DUEL SYNAPSE ◆ KODEX</text>`,
 `<text x="${tx}" y="${ly+88}" font-size="58" font-weight="900" font-style="italic" fill="url(#nm)" stroke="#0b0e1f" stroke-width="6" paint-order="stroke" filter="url(#sh)" letter-spacing="1">${X(String(d.name||'Deck').slice(0,26))}</text>`,
 `<text x="${tx}" y="${ly+126}" font-size="20" font-weight="700" fill="#c9d0f2">${[meta.player?X(meta.player):'',meta.event?X(meta.event):''].filter(Boolean).join('  ◆  ')||X(deckTotal(d)+' cards')}</text>`,
 `<text x="${tx}" y="${ly+156}" font-size="15" fill="#9aa4bd" letter-spacing="2">${X(date.toUpperCase())}${meta.player||meta.event?'  ◆  '+deckTotal(d)+' CARDS':''}</text></g>`);
 o.push(`<g transform="translate(${pad},${top-52})"><rect width="${W-pad*2}" height="4" rx="2" fill="url(#gd)"/><rect width="${W-pad*2}" height="4" rx="2" fill="url(#holo)"/><path d="M${(W-pad*2)/2-10} 2l10-10 10 10-10 10z" fill="url(#gold)"/></g>`);
 if(pc){const bx=W-pad-230;o.push(`<g transform="translate(${bx},34)" font-family="${F}"><path d="M115 0 L230 34 L230 120 Q230 170 115 196 Q0 170 0 120 L0 34Z" fill="#0c0f1f" fill-opacity=".85" stroke="url(#pl)" stroke-width="5" filter="url(#glow)"/><path d="M115 14 L214 44 L214 118 Q214 158 115 180 Q16 158 16 118 L16 44Z" fill="none" stroke="url(#pl)" stroke-opacity=".5" stroke-width="2"/>`+
  (meta.place==='champ'?`<path transform="translate(85,36) scale(1.25)" d="M8 0h32v8h8v8c0 9-6 15-14 16-2 5-6 8-10 9v7h10v6H14v-6h10v-7c-4-1-8-4-10-9C6 31 0 25 0 16V8h8zM6 13v3c0 5 3 9 8 10-2-4-2-8-2-13zm36 0h-6c0 5 0 9-2 13 5-1 8-5 8-10z" fill="url(#pl)"/>`:`<text x="115" y="96" font-size="${meta.place==='play'?44:52}" font-weight="900" font-style="italic" fill="url(#pl)" text-anchor="middle" stroke="#0b0e1f" stroke-width="3" paint-order="stroke">${meta.place==='play'?'★':X(pl.replace(/\D+/g,''))}</text>`)+
  `<text x="115" y="${meta.place==='champ'?132:126}" font-size="${pl.length>12?20:24}" font-weight="900" fill="url(#pl)" text-anchor="middle" letter-spacing="3">${X(pl.split(' · ')[0].toUpperCase())}</text><text x="115" y="156" font-size="11" font-weight="700" fill="#c9d0f2" text-anchor="middle" letter-spacing="3">${meta.event?X(String(meta.event).toUpperCase().slice(0,24)):'PLACEMENT'}</text></g>`)}
 let y=top;
 for(const [label,arr] of sections){
  const n={M:0,S:0,T:0};arr.forEach(c=>n[kind(c)]++);
  const showTypes=meta.types!==false&&label!=='EXTRA DECK',rw=W-pad*2;
  o.push(`<g transform="translate(${pad},${y})" font-family="${F}">`,
   `<path d="M0 0 H${rw-40} L${rw} ${head} H0 Z" fill="#0c0f1f" fill-opacity=".55"/>`,
   `<path d="M0 0 H${Math.min(520,rw*.5)} L${Math.min(520,rw*.5)+34} ${head} H0 Z" fill="url(#rib)" filter="url(#sh)"/>`,
   `<path d="M0 0 H${Math.min(520,rw*.5)} L${Math.min(520,rw*.5)+34} ${head} H0 Z" fill="url(#holo)" opacity=".6"/>`,
   `<rect x="0" y="0" width="8" height="${head}" fill="url(#gold)"/><path d="M0 ${head-3} H${rw}" stroke="url(#gd)" stroke-width="3"/>`,
   `<path d="M34 ${head/2-12}l12 12-12 12-12-12z" fill="url(#gold)" filter="url(#glow)"/>`,
   `<text x="62" y="${head/2+11}" font-size="30" font-weight="900" font-style="italic" fill="#fff" letter-spacing="4" stroke="#0b0e1f" stroke-width="4" paint-order="stroke">${label}</text>`,
   `<g transform="translate(${62+label.length*26+34},${head/2})"><path d="M-22 0 L-11 -19 H11 L22 0 L11 19 H-11Z" fill="#0c0f1f" stroke="url(#gold)" stroke-width="3"/><text y="9" font-size="24" font-weight="900" fill="url(#gold)" text-anchor="middle">${arr.length}</text></g>`);
  if(showTypes){let px=rw-24;for(const [k,lab,col] of [['T','TRAPS','#d9729f'],['S','SPELLS','#38c9a6'],['M','MONSTERS','#e8b25a']]){const t=`${n[k]} ${lab}`,w=t.length*10+30;px-=w;o.push(`<g transform="translate(${px},${head/2-15})"><rect width="${w-8}" height="30" rx="15" fill="${col}" fill-opacity=".18" stroke="${col}" stroke-width="2"/><text x="${(w-8)/2}" y="20" font-size="14" font-weight="800" fill="${col}" text-anchor="middle" letter-spacing="1.5">${t}</text></g>`)}}
  o.push(`</g>`);
  y+=head+14;
  arr.forEach((c,i)=>{const x=pad+(i%cols)*(cw+gap),cy=y+Math.floor(i/cols)*(ch+gap),url=deckCardImageUrl(c);
   o.push(`<rect x="${x-1}" y="${cy+4}" width="${cw+2}" height="${ch}" rx="6" fill="#000" opacity=".5"/>`);
   if(url){let a=url;try{a=new URL(url,document.baseURI).href}catch{}o.push(`<g transform="translate(${x},${cy})" clip-path="url(#cc)"><rect width="${cw}" height="${ch}" fill="#1b2147"/><image href="${X(a)}" xlink:href="${X(a)}" width="${cw}" height="${ch}" preserveAspectRatio="none"><title>${X(c.name)}</title></image></g><rect x="${x}" y="${cy}" width="${cw}" height="${ch}" rx="5" fill="none" stroke="#ffffff" stroke-opacity=".22"/>`)}
   else{const w=String(c.name||'Card').split(/\s+/);let ls=[],l='';for(const t of w){const q=l?l+' '+t:t;if(q.length>12){if(l)ls.push(l);l=t}else l=q}if(l)ls.push(l);o.push(`<rect x="${x}" y="${cy}" width="${cw}" height="${ch}" rx="5" fill="#26306a"/><text x="${x+5}" y="${cy+16}" fill="#fff" font-family="${F}" font-size="9">${ls.slice(0,7).map((t,j)=>`<tspan x="${x+5}" dy="${j?12:0}">${X(t)}</tspan>`).join('')}</text>`)}});
  y+=Math.max(1,Math.ceil(arr.length/cols))*(ch+gap)+26;
 }
 o.push(`<g transform="translate(${pad},${H-70})" font-family="${F}"><rect width="${W-pad*2}" height="3" rx="1.5" fill="url(#gd)"/><text x="0" y="36" font-size="15" font-weight="700" fill="#9aa4bd" letter-spacing="1">MADE WITH DUEL SYNAPSE: KODEX ◆ A PROJECT OF META INSIDER OCG</text><text x="${W-pad*2}" y="36" font-size="17" font-weight="900" fill="url(#gold)" text-anchor="end" letter-spacing="2">KODEX.MEIOCG.ORG</text></g></svg>`);
 return o.join('');
}
function posterHeight(d,W){const cols=13,pad=40,gap=8,cw=Math.floor((W-pad*2-gap*(cols-1))/cols),ch=Math.round(cw*86/59),sec=[copies(d,'main'),copies(d,'extra'),copies(d,'side')].filter((a,i)=>i<2||a.length);return 300+sec.reduce((h,a)=>h+64+14+Math.max(1,Math.ceil(a.length/cols))*(ch+gap)+26,0)+70}

/* ---------- minimize the duel: KodeX stays usable while the Arena keeps the duel (and the room) running ---------- */
let arenaMin=false;
(function(){const bar=document.querySelector('#Larena .arbar'),x=bar&&bar.querySelector('[data-close]');if(!bar||!x)return;
 const b=document.createElement('button');b.className='ibtn ar-min';b.id='arMin';b.setAttribute('aria-label','Minimize the duel (it keeps running)');b.title='Minimize: switch to KodeX, come back any time';b.innerHTML='<svg class="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 14h14"/><path d="M8 19h8"/></svg>';
 bar.insertBefore(b,x);b.onclick=()=>{arenaMin=true;history.back()};
 const p=document.createElement('button');p.id='duelPill';p.className='duel-pill';p.hidden=true;p.innerHTML='<i></i><span>Duel in progress</span><b>Return</b>';p.onclick=()=>{p.hidden=true;arenaHash='';if(!L.includes('arena'))push('arena')};document.body.append(p);})();
let arenaMinimized=false;
function arenaSet(on){const p=$('duelPill');if(on){if(p)p.hidden=true;if(arenaMinimized&&!arenaHash){arenaMinimized=false;return}arenaMinimized=false;return arenaSet0(on)}if(arenaMin){arenaMin=false;arenaMinimized=true;if(p){p.hidden=false;p.querySelector('span').textContent=arenaActive?'Duel in progress':'Duel Arena'}return}arenaMinimized=false;if(p)p.hidden=true;return arenaSet0(on)}
window.addEventListener('message',e=>{const d=e.data||{};const p=$('duelPill');if(!p||p.hidden)return;if(d.kx==='duel'){p.querySelector('span').textContent=d.active?'Duel in progress':'Duel Arena'}if(d.kx==='chat'){p.classList.add('ping');setTimeout(()=>p.classList.remove('ping'),3000)}});
mediaLoad().then(()=>{try{skinsToArena()}catch(e){}});

