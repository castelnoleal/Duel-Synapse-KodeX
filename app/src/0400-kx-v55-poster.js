
/* ---------- deck image in the MEIOCG style: placement, event, player and the date ---------- */
const PLACES=[['','No placement'],['champ','Champion'],['top2','Top 2 · Finalist'],['top4','Top 4'],['top8','Top 8'],['top16','Top 16'],['top32','Top 32'],['top64','Top 64'],['play','Participant']];
const PLACE_COL={champ:['#f0b429','#ffe9a8'],top2:['#cfd6ea','#ffffff'],top4:['#e09a5a','#ffd2a8'],top8:['#8d99ff','#d6dbff'],top16:['#7a4fd6','#c8b3ff'],top32:['#38c9a6','#b5f2e2'],top64:['#67a8ff','#cfe4ff'],play:['#9aa4bd','#e6eaf5']};
function posterOptions(id){
 const p=S.g('poster_meta',{});const m=openModal(`<div class="dk-hd"><h3>Deck image</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div><div class="pm-f"><label><span>Placement</span><select data-pm="place">${PLACES.map(([k,l])=>`<option value="${k}"${(p.place||'')===k?' selected':''}>${l}</option>`).join('')}</select></label><label><span>Event</span><input data-pm="event" maxlength="48" placeholder="e.g. Regional Qualifier" value="${esc(p.event||'')}"></label><label><span>Player</span><input data-pm="player" maxlength="32" placeholder="Your name" value="${esc(p.player||'')}"></label><label class="pm-c"><input type="checkbox" data-pm="types"${p.types===false?'':' checked'}><span>Show card-type counts</span></label><p class="note">The date the image is made is printed on it.</p><button class="btn p" data-pmgo>${ic('image',18)}Make image</button></div>`,'','pm');
 m.querySelector('[data-pmgo]').onclick=()=>{const o={};m.querySelectorAll('[data-pm]').forEach(x=>o[x.dataset.pm]=x.type==='checkbox'?x.checked:x.value.trim());S.s('poster_meta',o);closeModal();setTimeout(()=>exportDeckPoster(id,o),120)};
}
function buildDeckPosterSvg(d,W,H,bg,meta){
 meta=meta||{};const X=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
 const F="'Chakra Petch','Plus Jakarta Sans',Arial,sans-serif",sections=[['MAIN DECK',copies(d,'main')],['EXTRA DECK',copies(d,'extra')],['SIDE DECK',copies(d,'side')]].filter(([l,a],i)=>i<2||a.length);
 const cols=13,pad=40,gap=8,cw=Math.floor((W-pad*2-gap*(cols-1))/cols),ch=Math.round(cw*86/59),head=48,top=250;
 const kind=c=>{const t=String((resolveDeckCard(c)||{}).type||'').toLowerCase();return /spell/.test(t)?'S':/trap/.test(t)?'T':'M'};
 const date=new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
 const pc=PLACE_COL[meta.place],pl=(PLACES.find(x=>x[0]===meta.place)||['',''])[1];
 const o=[`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
 `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#121a4a"/><stop offset=".55" stop-color="#0c0f1f"/><stop offset="1" stop-color="#1c1236"/></linearGradient>`+
 `<radialGradient id="b1" cx=".85" cy=".05" r=".55"><stop offset="0" stop-color="#3347f0" stop-opacity=".55"/><stop offset="1" stop-color="#3347f0" stop-opacity="0"/></radialGradient>`+
 `<radialGradient id="b2" cx=".05" cy=".9" r=".5"><stop offset="0" stop-color="#7a4fd6" stop-opacity=".45"/><stop offset="1" stop-color="#7a4fd6" stop-opacity="0"/></radialGradient>`+
 `<linearGradient id="gd" x1="0" x2="1"><stop offset="0" stop-color="#3347f0"/><stop offset=".55" stop-color="#7a4fd6"/><stop offset="1" stop-color="#f0b429"/></linearGradient>`+
 (pc?`<linearGradient id="pl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pc[1]}"/><stop offset="1" stop-color="${pc[0]}"/></linearGradient>`:'')+
 `<pattern id="gr" width="58" height="84" patternUnits="userSpaceOnUse"><path d="M58 0H0V84" fill="none" stroke="#ffffff" stroke-opacity=".045"/></pattern><clipPath id="cc"><rect width="${cw}" height="${ch}" rx="5"/></clipPath></defs>`,
 `<rect width="100%" height="100%" fill="url(#bg)"/>`];
 if(bg)o.push(`<image href="${X(bg)}" xlink:href="${X(bg)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" opacity=".35"/>`);
 o.push(`<rect width="100%" height="100%" fill="url(#b1)"/><rect width="100%" height="100%" fill="url(#b2)"/><rect width="100%" height="100%" fill="url(#gr)"/>`,
 `<rect x="14" y="14" width="${W-28}" height="${H-28}" rx="26" fill="none" stroke="url(#gd)" stroke-width="3"/>`,
 `<g font-family="${F}" fill="#fff"><text x="${pad}" y="66" font-size="18" font-weight="700" letter-spacing="5" fill="#f0b429">DUEL SYNAPSE · KODEX</text>`,
 `<text x="${pad}" y="122" font-size="48" font-weight="800">${X(String(d.name||'Deck').slice(0,30))}</text>`,
 `<text x="${pad}" y="160" font-size="19" fill="#c9d0f2">${[meta.player?X(meta.player):'',meta.event?X(meta.event):''].filter(Boolean).join('  ·  ')||X(deckTotal(d)+' cards')}</text>`,
 `<text x="${pad}" y="192" font-size="15" fill="#9aa4bd" letter-spacing="1">${X(date)}${meta.player||meta.event?'  ·  '+deckTotal(d)+' cards':''}</text></g>`,
 `<rect x="${pad}" y="208" width="${W-pad*2}" height="3" rx="1.5" fill="url(#gd)" opacity=".8"/>`);
 if(pc){const bx=W-pad-250;o.push(`<g transform="translate(${bx},40)"><rect width="250" height="150" rx="22" fill="#0c0f1f" fill-opacity=".72" stroke="url(#pl)" stroke-width="3"/>`+
  (meta.place==='champ'?`<path transform="translate(97,16) scale(1.15)" d="M8 0h32v8h8v8c0 9-6 15-14 16-2 5-6 8-10 9v7h10v6H14v-6h10v-7c-4-1-8-4-10-9C6 31 0 25 0 16V8h8zM6 13v3c0 5 3 9 8 10-2-4-2-8-2-13zm36 0h-6c0 5 0 9-2 13 5-1 8-5 8-10z" fill="url(#pl)"/>`:`<circle cx="125" cy="48" r="30" fill="none" stroke="url(#pl)" stroke-width="4"/><text x="125" y="58" font-family="${F}" font-size="${meta.place==='play'?22:26}" font-weight="800" fill="url(#pl)" text-anchor="middle">${meta.place==='play'?'★':X(pl.replace(/\D+/g,''))}</text>`)+
  `<text x="125" y="124" font-family="${F}" font-size="${pl.length>12?20:26}" font-weight="800" fill="url(#pl)" text-anchor="middle" letter-spacing="2">${X(pl.split(' · ')[0].toUpperCase())}</text></g>`)}
 let y=top;
 for(const [label,arr] of sections){
  const n={M:0,S:0,T:0};arr.forEach(c=>n[kind(c)]++);
  const sub=meta.types===false||label!=='MAIN DECK'&&label!=='SIDE DECK'?'':`${n.M} Monster${n.M===1?'':'s'}  ·  ${n.S} Spell${n.S===1?'':'s'}  ·  ${n.T} Trap${n.T===1?'':'s'}`;
  o.push(`<rect x="${pad}" y="${y}" width="${W-pad*2}" height="${head}" rx="14" fill="#151a3a" fill-opacity=".85" stroke="#2f3a86"/><rect x="${pad}" y="${y}" width="6" height="${head}" rx="3" fill="url(#gd)"/>`,
  `<g font-family="${F}"><text x="${pad+22}" y="${y+31}" font-size="20" font-weight="800" fill="#fff" letter-spacing="2">${label}</text><text x="${pad+22+label.length*14.5+14}" y="${y+31}" font-size="20" font-weight="800" fill="#f0b429">${arr.length}</text><text x="${W-pad-18}" y="${y+30}" font-size="15" fill="#c9d0f2" text-anchor="end">${sub}</text></g>`);
  y+=head+12;
  arr.forEach((c,i)=>{const x=pad+(i%cols)*(cw+gap),cy=y+Math.floor(i/cols)*(ch+gap),url=deckCardImageUrl(c);
   o.push(`<rect x="${x-1}" y="${cy+3}" width="${cw+2}" height="${ch}" rx="6" fill="#000" opacity=".45"/>`);
   if(url){let a=url;try{a=new URL(url,document.baseURI).href}catch{}o.push(`<g transform="translate(${x},${cy})" clip-path="url(#cc)"><rect width="${cw}" height="${ch}" fill="#1b2147"/><image href="${X(a)}" xlink:href="${X(a)}" width="${cw}" height="${ch}" preserveAspectRatio="none"><title>${X(c.name)}</title></image></g><rect x="${x}" y="${cy}" width="${cw}" height="${ch}" rx="5" fill="none" stroke="#ffffff" stroke-opacity=".18"/>`)}
   else{const w=String(c.name||'Card').split(/\s+/);let ls=[],l='';for(const t of w){const q=l?l+' '+t:t;if(q.length>12){if(l)ls.push(l);l=t}else l=q}if(l)ls.push(l);o.push(`<rect x="${x}" y="${cy}" width="${cw}" height="${ch}" rx="5" fill="#26306a"/><text x="${x+5}" y="${cy+16}" fill="#fff" font-family="${F}" font-size="9">${ls.slice(0,7).map((t,j)=>`<tspan x="${x+5}" dy="${j?12:0}">${X(t)}</tspan>`).join('')}</text>`)}});
  y+=Math.max(1,Math.ceil(arr.length/cols))*(ch+gap)+22;
 }
 o.push(`<g font-family="${F}"><text x="${pad}" y="${H-34}" font-size="15" fill="#9aa4bd">Made with Duel Synapse: KodeX · a project of Meta Insider OCG</text><text x="${W-pad}" y="${H-34}" font-size="15" fill="#f0b429" text-anchor="end" font-weight="700">kodex.meiocg.org</text></g></svg>`);
 return o.join('');
}
function posterHeight(d,W){const cols=13,pad=40,gap=8,cw=Math.floor((W-pad*2-gap*(cols-1))/cols),ch=Math.round(cw*86/59),sec=[copies(d,'main'),copies(d,'extra'),copies(d,'side')].filter((a,i)=>i<2||a.length);return 250+sec.reduce((h,a)=>h+48+12+Math.max(1,Math.ceil(a.length/cols))*(ch+gap)+22,0)+60}
function exportDeckPoster(deckId,meta){
 const d=deckById(deckId);if(!d)return;
 if(!meta){if(topIsModal())closeModal();setTimeout(()=>posterOptions(deckId),90);return}
 const W=1200,H=posterHeight(d,W),name=(d.name.replace(/[^\w -]/g,'').trim()||'deck')+(meta.place?'-'+meta.place:'');let svg=buildDeckPosterSvg(d,W,H,posterBackground,meta);
 (async()=>{const urls=[...new Set([...svg.matchAll(/<image href="(https:[^"]+)"/g)].map(m=>m[1].replace(/&amp;/g,'&')))];const got=await Promise.all(urls.map(u=>icGet(u).then(v=>[u,v],()=>[u,null])));for(const [u,v] of got){const e=u.replace(/&/g,'&amp;');svg=svg.split(`href="${e}"`).join(`href="${v||artSrc(u).replace(/&/g,'&amp;')}"`)}setTimeout(()=>deckViewer(svg,name,null),60);icWarm(urls)})();
}


