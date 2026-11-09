
/* KodeX 9.4 (v61): square deck images with three designs and an editable preset, and saving Arena video clips.
   Created by Castel Noleal, creator of MEIOCG. See app/BLUEPRINT.md. */

/* ---------- Arena video clips (KodeX Premium): the Arena records, KodeX saves the file ---------- */
addEventListener('message',e=>{const f=$('arenaFrame');if(!f||e.source!==f.contentWindow)return;const d=e.data||{};
 if(d.kx!=='saveVideo')return;
 if(!PREMIUM){toast('Video clips are part of KodeX Premium');return}
 const buf=d.buf;if(!(buf instanceof ArrayBuffer)||buf.byteLength<1000||buf.byteLength>4e8){toast('That clip could not be saved');return}
 const mime=/^video\/(mp4|webm)/.test(String(d.mime))?String(d.mime).split(';')[0]:'video/webm',ext=mime==='video/mp4'?'mp4':'webm';
 let nm=String(d.name||'KodeX_clip').replace(/[\\/:*?"<>|]/g,'_').replace(/\.(mp4|webm)$/i,'').slice(0,80)+'.'+ext;
 toast('Saving the clip…');saveFile(new Blob([buf],{type:mime}),nm,mime).catch(()=>toast('That clip could not be saved'));
});

/* ---------- Deck image: square, dated, with the MEIOCG profile and an editable preset ---------- */
const DI_SIZE=1600;
const DI_DESIGNS=[
 ['clean','Clean','White sheet, like a deck list from the deck maker'],
 ['night','MEIOCG Night','Dark blue MEIOCG look'],
 ['gold','Champion Gold','Black and gold, made for tournament results'],
];
const DI_PAL={
 clean:{bg:'#ffffff',bg2:'#f3f5fb',ink:'#11152b',sub:'#4c5674',mute:'#8790ab',line:'#dfe3ef',head:'#eef1f9',accent:'#3347f0',accent2:'#7a4fd6',gold:'#c48a00',slot:'#e6e9f3',grid:false},
 night:{bg:'#0c0f1f',bg2:'#121a4a',ink:'#ffffff',sub:'#c9d0f2',mute:'#8d97bb',line:'#2f3a86',head:'#151a3a',accent:'#3347f0',accent2:'#7a4fd6',gold:'#f0b429',slot:'#1b2147',grid:true},
 gold:{bg:'#0b0906',bg2:'#241a08',ink:'#fff6dc',sub:'#e8d29a',mute:'#a8956a',line:'#5a4612',head:'#1a1408',accent:'#b8860b',accent2:'#ffe08a',gold:'#ffd45a',slot:'#221b0c',grid:false},
};
const DI_FRAME={rookie:['#8a96b4','#4c5878'],bronze:['#e0a070','#8a4b20'],silver:['#f4f7fb','#8d97a8'],gold:['#ffe08a','#a8740b'],platinum:['#f2fffd','#5fd3c4'],diamond:['#8be1ff','#b46bff'],master:['#ffb347','#e0102a'],premium:['#f0b429','#7a4fd6'],none:['#9aa4bd','#5c6684']};
function diToday(){const t=new Date();return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0')}
function diDateText(v){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v||'');const dt=m?new Date(+m[1],+m[2]-1,+m[3]):new Date();return dt.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}
/** The player's MEIOCG profile when they have set one up (a name, or listed on MEIOCG Players). */
function diProfile(){try{const r=kxpRaw();if(!r.name&&!r.listed)return null;const p=kxProfile();return{name:p.name,title:p.title,frame:p.frame,tier:p.tier,premium:p.premium,
 src:KXPF.iconSrc(p,KXP_LOGO()),rank:r.listed?+S.g('pf_rank',0):0}}catch(e){return null}}
/** The preset: what the last image used, with the deck's own name, today's date and the profile name filled in. */
function diPreset(d){const p=S.g('poster_meta',{})||{},pf=diProfile(),mon=new Date().toLocaleDateString(undefined,{month:'short',year:'numeric'});
 return{design:DI_DESIGNS.some(x=>x[0]===p.design)?p.design:'clean',title:String(d.name||'Deck').slice(0,40),reg:p.reg||('OCG · Forbidden & Limited · '+mon),
  player:p.player||(pf?pf.name:''),event:p.event||'',place:p.place||'',note:'',date:diToday(),profile:p.profile!==false,types:p.types!==false}}
/** Card width that fits every section in the square: Main across the full width, Extra and Side side by side. */
function diLayout(d,W,top,bottom){const pad=56,gap=8,secH=54,main=copies(d,'main'),ex=copies(d,'extra'),side=copies(d,'side'),split=ex.length&&side.length;
 const avail=bottom-top;let best=null;
 const fw=W-pad*2;
 for(const cols of [10,11,12,13,14,15,16,18,20,22,24]){const cw=Math.floor((fw-gap*(cols-1))/cols),ch=Math.round(cw*86/59),full=cols,half=Math.floor(((fw-36)/2+gap)/(cw+gap));if(half<1)continue;
  const rM=Math.max(1,Math.ceil(main.length/full)),rE=ex.length?Math.ceil(ex.length/(split?half:full)):0,rS=side.length?Math.ceil(side.length/(split?half:full)):0;
  const lower=split?secH+Math.max(rE,rS)*(ch+gap):(ex.length?secH+rE*(ch+gap)+14:0)+(side.length?secH+rS*(ch+gap)+14:0);
  const h=secH+rM*(ch+gap)+18+lower;if(h<=avail){best={cw,ch,gap,pad,secH,full,half,split,main,ex,side};break}}
 if(!best){const cw=34,ch=Math.round(cw*86/59);best={cw,ch,gap:6,pad,secH,full:Math.floor((W-pad*2)/(cw+6)),half:Math.floor(((W-pad*2-36)/2)/(cw+6)),split,main,ex,side}}
 return best}
function buildSquareDeckSvg(d,meta,bg){
 meta=meta||diPreset(d);const W=DI_SIZE,H=DI_SIZE,P=DI_PAL[meta.design]||DI_PAL.clean,X=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
 const F="'Chakra Petch','Plus Jakarta Sans',Arial,sans-serif",B="'Plus Jakarta Sans','Chakra Petch',Arial,sans-serif";
 const kind=c=>{const t=String((resolveDeckCard(c)||{}).type||'').toLowerCase();return /spell/.test(t)?'S':/trap/.test(t)?'T':'M'};
 const pf=meta.profile?diProfile():null,pc=PLACE_COL[meta.place],pl=(PLACES.find(x=>x[0]===meta.place)||['',''])[1];
 const pad=56,right=pf||pc?430:0,tw=W-pad*2-right,title=String(meta.title||d.name||'Deck'),ts=Math.max(40,Math.min(76,Math.floor(tw/(title.length*.62))));
 const top0=(meta.note?268:238)+ts,L=diLayout(d,W,top0,H-92),{cw,ch,gap}=L;
 const o=[`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
 `<defs><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.bg2}"/><stop offset=".6" stop-color="${P.bg}"/><stop offset="1" stop-color="${P.bg}"/></linearGradient>`+
 `<linearGradient id="da" x1="0" x2="1"><stop offset="0" stop-color="${P.accent}"/><stop offset=".6" stop-color="${P.accent2}"/><stop offset="1" stop-color="${P.gold}"/></linearGradient>`+
 (pf?`<linearGradient id="dfr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${(DI_FRAME[pf.frame]||DI_FRAME.none)[0]}"/><stop offset="1" stop-color="${(DI_FRAME[pf.frame]||DI_FRAME.none)[1]}"/></linearGradient><clipPath id="dav"><circle cx="0" cy="0" r="44"/></clipPath>`:'')+
 (pc?`<linearGradient id="dpl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pc[1]}"/><stop offset="1" stop-color="${pc[0]}"/></linearGradient>`:'')+
 `<pattern id="dgr" width="58" height="84" patternUnits="userSpaceOnUse"><path d="M58 0H0V84" fill="none" stroke="#ffffff" stroke-opacity=".045"/></pattern><clipPath id="dcc"><rect width="${cw}" height="${ch}" rx="${Math.max(3,cw*.05)}"/></clipPath></defs>`,
 `<rect width="${W}" height="${H}" fill="${meta.design==='clean'?P.bg:'url(#dg)'}"/>`];
 if(bg&&meta.design!=='clean')o.push(`<image href="${X(bg)}" xlink:href="${X(bg)}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" opacity=".22"/>`);
 if(P.grid)o.push(`<rect width="${W}" height="${H}" fill="url(#dgr)"/>`);
 if(meta.design==='clean')o.push(`<rect x="0" y="0" width="${W}" height="10" fill="url(#da)"/>`);
 else o.push(`<rect x="16" y="16" width="${W-32}" height="${H-32}" rx="28" fill="none" stroke="url(#da)" stroke-width="3"/>`);
 // header: title, regulation, player · event, date; the counts; the profile on the right
 o.push(`<g font-family="${F}" fill="${P.ink}">`,
  `<text x="${pad}" y="70" font-size="20" font-weight="700" letter-spacing="5" fill="${P.gold}">DUEL SYNAPSE · KODEX</text>`,
  `<text x="${pad}" y="${80+ts}" font-size="${ts}" font-weight="800">${X(title.slice(0,40))}</text>`,
  meta.reg?`<text x="${pad}" y="${120+ts}" font-family="${B}" font-size="24" font-weight="700" fill="${P.sub}">${X(meta.reg)}</text>`:'',
  `<text x="${pad}" y="${156+ts}" font-family="${B}" font-size="22" fill="${P.mute}">${X([meta.player,meta.event].filter(Boolean).join('  ·  '))}${meta.player||meta.event?'  ·  ':''}${X(diDateText(meta.date))}</text>`,
  meta.note?`<text x="${pad}" y="${190+ts}" font-family="${B}" font-size="20" font-style="italic" fill="${P.mute}">${X(meta.note.slice(0,110))}</text>`:'','</g>');
 // the counts, as chips under the header
 const cy0=(meta.note?208:178)+ts;let cx=pad;
 for(const [lab,arr] of [['Main',L.main],['Extra',L.ex],['Side',L.side]]){if(lab==='Side'&&!arr.length)continue;const w=lab.length*13+String(arr.length).length*15+46;
  o.push(`<rect x="${cx}" y="${cy0}" width="${w}" height="40" rx="20" fill="${P.head}" stroke="${P.line}"/><text x="${cx+18}" y="${cy0+27}" font-family="${F}" font-size="20" font-weight="700" fill="${P.sub}">${lab} <tspan fill="${P.accent===P.gold?P.gold:meta.design==='clean'?P.accent:P.gold}" font-weight="800">${arr.length}</tspan></text>`);cx+=w+10}
 if(pf){const ax=W-pad-44,ay=96;
  o.push(`<g transform="translate(${ax},${ay})"><circle r="52" fill="url(#dfr)"/><circle r="46" fill="${P.bg}"/><image href="${X(pf.src)}" xlink:href="${X(pf.src)}" x="-44" y="-44" width="88" height="88" clip-path="url(#dav)" preserveAspectRatio="xMidYMid slice"/></g>`,
  `<g font-family="${F}" text-anchor="end"><text x="${ax-66}" y="${ay-12}" font-size="28" font-weight="800" fill="${P.ink}">${X(pf.name)}</text>`,
  `<text x="${ax-66}" y="${ay+18}" font-family="${B}" font-size="19" fill="${P.sub}">${X(pf.title||((KXPF.tierName(pf.tier)||'')+' duelist'))}</text>`,
  `<text x="${ax-66}" y="${ay+44}" font-size="16" font-weight="700" letter-spacing="2" fill="${P.gold}">MEIOCG${pf.rank?' PLAYERS #'+pf.rank:' PROFILE'}${pf.premium?' · PREMIUM':''}</text></g>`)}
 if(pc){const bx=W-pad-200,by=pf?168:60;o.push(`<g transform="translate(${bx},${by})"><rect width="200" height="64" rx="32" fill="${P.head}" stroke="url(#dpl)" stroke-width="3"/><text x="100" y="41" font-family="${F}" font-size="${pl.length>12?18:24}" font-weight="800" fill="url(#dpl)" text-anchor="middle" letter-spacing="2">${X(pl.split(' · ')[0].toUpperCase())}</text></g>`)}
 // sections
 const sec=(label,arr,x,y,w,cols)=>{const n={M:0,S:0,T:0};arr.forEach(c=>n[kind(c)]++);
  const sub=meta.types&&arr.length&&label!=='Extra Deck'?`${n.M} Monster${n.M===1?'':'s'} · ${n.S} Spell${n.S===1?'':'s'} · ${n.T} Trap${n.T===1?'':'s'}`:'';
  o.push(`<rect x="${x}" y="${y}" width="${w}" height="${L.secH-12}" rx="10" fill="${P.head}"/><rect x="${x}" y="${y}" width="6" height="${L.secH-12}" rx="3" fill="url(#da)"/>`,
   `<g font-family="${F}"><text x="${x+20}" y="${y+29}" font-size="21" font-weight="800" fill="${P.ink}" letter-spacing="1">${label}  <tspan fill="${meta.design==='clean'?P.accent:P.gold}">${arr.length}</tspan></text>`+
   (sub&&w>620?`<text x="${x+w-16}" y="${y+28}" font-family="${B}" font-size="17" fill="${P.mute}" text-anchor="end">${sub}</text>`:'')+`</g>`);
  const y0=y+L.secH;arr.forEach((c,i)=>{const xx=x+(i%cols)*(cw+gap),yy=y0+Math.floor(i/cols)*(ch+gap),url=deckCardImageUrl(c);
   o.push(`<rect x="${xx}" y="${yy+2}" width="${cw}" height="${ch}" rx="5" fill="#000" opacity="${meta.design==='clean'?.14:.45}"/>`);
   if(url){let a=url;try{a=new URL(url,document.baseURI).href}catch(e){}o.push(`<g transform="translate(${xx},${yy})" clip-path="url(#dcc)"><rect width="${cw}" height="${ch}" fill="${P.slot}"/><image href="${X(a)}" xlink:href="${X(a)}" width="${cw}" height="${ch}" preserveAspectRatio="none"><title>${X(c.name||'')}</title></image></g>`)}
   else{o.push(`<rect x="${xx}" y="${yy}" width="${cw}" height="${ch}" rx="5" fill="${P.slot}" stroke="${P.line}"/><text x="${xx+cw/2}" y="${yy+ch/2}" font-family="${B}" font-size="${Math.max(9,cw/8)}" fill="${P.sub}" text-anchor="middle">${X(String(c.name||'Card').slice(0,14))}</text>`)}});
  return y0+Math.max(1,Math.ceil(arr.length/cols))*(ch+gap)};
 let y=top0;const fullW=W-pad*2;
 y=sec('Main Deck',L.main,pad,y,fullW,L.full)+18;
 if(L.split){const hw=(fullW-36)/2;sec('Extra Deck',L.ex,pad,y,hw,L.half);sec('Side Deck',L.side,pad+hw+36,y,hw,L.half)}
 else{if(L.ex.length)y=sec('Extra Deck',L.ex,pad,y,fullW,L.full)+14;if(L.side.length)sec('Side Deck',L.side,pad,y,fullW,L.full)}
 o.push(`<g font-family="${F}"><text x="${pad}" y="${H-44}" font-size="18" fill="${P.mute}">Made with Duel Synapse: KodeX · a project of Meta Insider OCG</text><text x="${W-pad}" y="${H-44}" font-size="18" fill="${P.gold}" text-anchor="end" font-weight="700">kodex.meiocg.org</text></g></svg>`);
 return o.join('')}
/** The options: design, the preset (all editable) and a live preview. */
function posterOptions(id){
 const d=deckById(id);if(!d)return;const p=diPreset(d),pf=diProfile();
 const inp=(k,l,ph,max,type)=>`<label><span>${l}</span><input data-pm="${k}" ${type?`type="${type}"`:`maxlength="${max||48}"`} placeholder="${esc(ph||'')}" value="${esc(p[k]||'')}"></label>`;
 const m=openModal(`<div class="dk-hd"><h3>Deck image</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
 <div class="di-wrap"><div class="di-prev" aria-label="Preview"><div class="di-svg"></div><small>Square · ${DI_SIZE}×${DI_SIZE} · saved larger</small></div>
 <div class="pm-f di-f"><div class="di-des" role="radiogroup" aria-label="Design">${DI_DESIGNS.map(([k,l,t])=>`<button type="button" role="radio" data-dsg="${k}" title="${esc(t)}" class="${p.design===k?'on':''}"><i class="di-sw di-${k}"></i>${l}</button>`).join('')}</div>
 ${inp('title','Title','Deck name',40)}${inp('reg','Regulation','e.g. OCG · Forbidden & Limited',60)}
 <div class="di-2">${inp('player','Player','Your name',32)}${inp('date','Date','','', 'date')}</div>
 <div class="di-2">${inp('event','Event','e.g. Regional Qualifier',48)}<label><span>Placement</span><select data-pm="place">${PLACES.map(([k,l])=>`<option value="${k}"${(p.place||'')===k?' selected':''}>${l}</option>`).join('')}</select></label></div>
 ${inp('note','Note','Optional line under the title',110)}
 <label class="pm-c"><input type="checkbox" data-pm="profile"${p.profile?' checked':''}${pf?'':' disabled'}><span>${pf?'Show my MEIOCG profile ('+esc(pf.name)+')':'MEIOCG profile: set one up in Settings to show it here'}</span></label>
 <label class="pm-c"><input type="checkbox" data-pm="types"${p.types?' checked':''}><span>Show card-type counts</span></label>
 <button class="btn p" data-pmgo>${ic('image',18)}Make image</button></div></div>`,'big','pm');
 let design=p.design;const read=()=>{const o={design};m.querySelectorAll('[data-pm]').forEach(x=>o[x.dataset.pm]=x.type==='checkbox'?x.checked&&!x.disabled:x.value.trim());if(!o.date)o.date=diToday();return o};
 const box=m.querySelector('.di-svg');let tm=0;const draw=()=>{clearTimeout(tm);tm=setTimeout(()=>{box.innerHTML=buildSquareDeckSvg(d,read(),posterBackground)},120)};
 m.querySelectorAll('[data-dsg]').forEach(b=>b.onclick=()=>{design=b.dataset.dsg;m.querySelectorAll('[data-dsg]').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-checked',x===b)});draw()});
 m.querySelectorAll('[data-pm]').forEach(x=>x.addEventListener(x.tagName==='SELECT'||x.type==='checkbox'||x.type==='date'?'change':'input',draw));
 m.querySelector('[data-pmgo]').onclick=()=>{const o=read();S.s('poster_meta',{design:o.design,reg:o.reg,player:o.player,event:o.event,place:o.place,profile:o.profile,types:o.types});closeModal();setTimeout(()=>exportDeckPoster(id,o),120)};
 draw()}
function exportDeckPoster(deckId,meta){
 const d=deckById(deckId);if(!d)return;
 if(!meta){if(topIsModal())closeModal();setTimeout(()=>posterOptions(deckId),90);return}
 if(!meta.design)meta={...diPreset(d),...meta};
 const name=(String(meta.title||d.name).replace(/[^\w -]/g,'').trim()||'deck')+'-'+(meta.date||diToday());let svg=buildSquareDeckSvg(d,meta,posterBackground);
 (async()=>{const urls=[...new Set([...svg.matchAll(/<image href="(https:[^"]+)"/g)].map(m=>m[1].replace(/&amp;/g,'&')))];const got=await Promise.all(urls.map(u=>icGet(u).then(v=>[u,v],()=>[u,null])));
  for(const [u,v] of got){const e=u.replace(/&/g,'&amp;');svg=svg.split(`href="${e}"`).join(`href="${v||artSrc(u).replace(/&/g,'&amp;')}"`)}setTimeout(()=>deckViewer(svg,name,null),60);icWarm(urls)})();
}
