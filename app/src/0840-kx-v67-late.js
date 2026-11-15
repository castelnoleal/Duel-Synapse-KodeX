/* KodeX 10.0 (v67): the combo sheet. Each play is a tile (what it used, the card, what it led to), tiles flow in a
   grid, and the sheet grows as tall as the combo needs. Cards keep the zone, position and source a replay gave them.
   Created by Castel Noleal, creator of MEIOCG. A project of Meta Insider OCG since 2023. */
for(const a of [['mat','Use as material'],['att','Attach as Xyz material'],['ex','To the Extra Deck'],['deck','Return to the Deck'],['put','Place on the field']])if(!CB_ACT.some(x=>x[0]===a[0]))CB_ACT.push(a);
Object.assign(CB_SHORT,{mat:'Material',att:'Attach',ex:'To Extra',deck:'To Deck',put:'Place'});
const CB_RESULT=new Set(['add','gy','ban','mat','att','ex','deck','put']);
const CB_GROUP={add:'ADD TO HAND',gy:'SEND TO GY',ban:'BANISH',mat:'USING',att:'USING',ex:'TO EXTRA DECK',deck:'RETURN TO DECK',put:'PLACE',ss:'SPECIAL SUMMON',ns:'NORMAL SUMMON',set:'SET',act:'ACTIVATE',scale:'PENDULUM SCALE',eff:'EFFECT',auto:'THEN'};
const cbPlaceOf=x=>{const o={};for(const [k,max,min] of [['z',7,0],['p',3,1],['f',7,1],['s',7,0]]){const v=x&&x[k]!=null?Number(x[k]):NaN;if(Number.isInteger(v)&&v>=min&&v<=max)o[k]=v}return o};
/* ---------- the combo code, version 2: more steps, the new moves, and each card's placement ---------- */
const CBQ2={cell:8,cal:6,maxRows:90,foot:74,acts:['auto','act','ns','ss','add','set','scale','eff','gy','ban','mat','att','ex','deck','put']};
function cbqPack(list,withExtra,withPlace){
 const bits=[],put=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push(Math.floor(v/2**i)%2)},num=id=>{const n=Number(pcode(String(id)));return Number.isInteger(n)&&n>0&&n<2**34?n:0};
 const dict=[],ref=id=>{const n=num(id);if(!n)return -1;let i=dict.indexOf(n);if(i<0){if(dict.length>=127)return -1;dict.push(n);i=dict.length-1}return i};
 const cs=list.slice(0,7).map(c=>{const d=c.deckId?deckById(c.deckId):null;
  return{t:[...new TextEncoder().encode(cbTitle(c))].slice(0,40),size:d?Math.max(c.hand.length,copies(d,'main').length):40,
   hand:c.hand.map(ref).filter(i=>i>=0).slice(0,12),extra:withExtra&&d?copies(d,'extra').map(x=>ref(pcOf(x))).filter(i=>i>=0).slice(0,15):[],
   lines:c.lines.slice(0,60).map(l=>l.slice(0,12).map(n=>n.cards.map(x=>[ref(x.c),Math.max(0,CBQ2.acts.indexOf(x.a)),withPlace?cbPlaceOf(x):{}]).filter(x=>x[0]>=0).slice(0,6)).filter(n=>n.length)).filter(l=>l.length)}});
 put(2,4);put(dict.length,7);for(const n of dict)put(n,34);put(cs.length,3);
 for(const c of cs){put(c.t.length,6);for(const b of c.t)put(b,8);put(Math.min(60,c.size),6);put(c.hand.length,4);for(const i of c.hand)put(i,7);put(c.extra.length,4);for(const i of c.extra)put(i,7);
  put(c.lines.length,6);for(const l of c.lines){put(l.length,4);for(const n of l){put(n.length,3);for(const [i,a,pl] of n){put(i,7);put(a,4);
   const has=pl.z!=null||pl.p!=null||pl.f!=null;put(has?1:0,1);if(has){put(pl.z!=null?pl.z+1:0,4);put(pl.p||0,2);put(pl.f||0,3);put(pl.s!=null?pl.s+1:0,4)}}}}}
 while(bits.length%8)bits.push(0);
 const body=new Uint8Array(bits.length/8);for(let i=0;i<body.length;i++){let v=0;for(let k=0;k<8;k++)v=v*2+bits[i*8+k];body[i]=v}
 const out=new Uint8Array(body.length+8);out[0]=0x4D;out[1]=0x43;out[2]=body.length>>8;out[3]=body.length&255;out.set(body,4);
 const crc=cbqCrc(out.subarray(0,body.length+4));out.set([crc>>>24,crc>>>16&255,crc>>>8&255,crc&255],body.length+4);return out}
function cbqUnpack(bytes){
 if(bytes.length<9||bytes[0]!==0x4D||bytes[1]!==0x43)return null;const len=bytes[2]<<8|bytes[3];if(bytes.length<len+8)return null;
 const crc=cbqCrc(bytes.subarray(0,len+4)),got=(bytes[len+4]<<24|bytes[len+5]<<16|bytes[len+6]<<8|bytes[len+7])>>>0;if(crc!==got)return null;
 let p=32;const end=(len+4)*8,get=n=>{let v=0;for(let i=0;i<n;i++){if(p>=end)throw new Error('short');v=v*2+(bytes[p>>3]>>(7-(p&7))&1);p++}return v};
 try{const ver=get(4);if(ver!==1&&ver!==2)return null;const dict=[];for(let n=get(7);n>0;n--)dict.push(get(34));const at=i=>dict[i]||0,out=[];
  for(let n=get(3);n>0;n--){const tb=[];for(let k=get(6);k>0;k--)tb.push(get(8));const c={title:new TextDecoder().decode(new Uint8Array(tb)),deckSize:get(6),hand:[],extra:[],lines:[]};
   for(let k=get(4);k>0;k--)c.hand.push(at(get(7)));for(let k=get(4);k>0;k--)c.extra.push(at(get(7)));
   for(let l=get(ver===1?5:6);l>0;l--){const line=[];for(let k=get(4);k>0;k--){const cards=[];for(let j=get(3);j>0;j--){const id=at(get(7)),x={c:id,a:CBQ2.acts[get(4)]||'auto'};
      if(ver===2&&get(1)){const z=get(4),pp=get(2),f=get(3),s=get(4);if(z)x.z=z-1;if(pp)x.p=pp;if(f)x.f=f;if(s)x.s=s-1}
      if(id)cards.push(x)}if(cards.length)line.push({cards,note:''})}if(line.length)c.lines.push(line)}
   c.hand=c.hand.filter(Boolean);c.extra=c.extra.filter(Boolean);if(c.hand.length||c.lines.length)out.push(c)}
  return out.length?out:null}catch(e){return null}}
/** The strip for a combo sheet: { h (space it needs above the footer), draw(H) → svg }. Null when it cannot carry the combos. */
function cbqBand(list,W,H,pad,P){
 const cols=Math.floor((W-pad*2)/CBQ2.cell),per=cols-CBQ2.cal;let bytes=null,rows=0;
 for(const [n,ex,pl] of [[list.length,true,true],[list.length,false,true],[list.length,false,false],[1,false,true],[1,false,false]]){const b=cbqPack(list.slice(0,n),ex,pl),r=Math.ceil(b.length*8/per);if(r<=CBQ2.maxRows){bytes=b;rows=r;break}}
 if(!bytes)return null;
 const c=CBQ2.cell,bit=i=>i<bytes.length*8?bytes[i>>3]>>(7-(i&7))&1:(i*7+3)%5<2?1:0;
 const draw=Hh=>{const y1=Hh-CBQ2.foot;let d='';
  for(let r=0;r<rows;r++){const y=y1-c*(r+1);let run=-1;
   for(let i=0;i<=cols;i++){const on=i<cols&&(i<CBQ2.cal?i%2===0:bit(r*per+i-CBQ2.cal));if(on&&run<0)run=i;if(!on&&run>=0){d+=`M${pad+run*c} ${y}h${(i-run)*c}v${c}h${-(i-run)*c}z`;run=-1}}}
  const top=y1-rows*c;
  return `<g><rect x="${pad-10}" y="${top-10}" width="${cols*c+20}" height="${rows*c+20}" rx="8" fill="${P.bg}"/><path d="${d}" fill="${P.ink}"/><text x="${pad-10}" y="${top-18}" font-family="'Chakra Petch',Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="3" fill="${P.mute}">COMBO CODE · OPEN THIS IMAGE IN KODEX TO LOAD THE COMBO AND ITS REPLAY</text></g>`};
 return{h:rows*c+46,rows,draw,svg:draw(H)}}
/** Reads the strip back from a picture of a combo sheet of any height (also after resizing). Returns the combos or null. */
function cbqRead(img){
 const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;if(!w||!h||h<w*.4||h>w*12)return null;
 const N=DI_SIZE,full=Math.round(h*N/w),R=Math.min(full,CBQ2.maxRows*CBQ2.cell+140),cv=document.createElement('canvas');cv.width=N;cv.height=R;
 const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,R-full,N,full);
 let px;try{px=g.getImageData(0,0,N,R).data}catch(e){return null}
 const pad=56,c=CBQ2.cell,cols=Math.floor((N-pad*2)/c),per=cols-CBQ2.cal,y1=R-CBQ2.foot;
 const lum=(x,y)=>{let s=0;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const X=Math.max(0,Math.min(N-1,Math.round(x)+a)),Y=Math.max(0,Math.min(R-1,Math.round(y)+b)),i=(Y*N+X)*4;s+=px[i]*.3+px[i+1]*.59+px[i+2]*.11}return s/9};
 const row=(r,dx,dy,sc)=>{const y=R-(R-(y1-c*(r+.5)))*sc+dy,X=i=>(pad+c*(i+.5)-N/2)*sc+N/2+dx;if(y<1)return null;let on=0,off=0;
  for(let i=0;i<CBQ2.cal;i++){const v=lum(X(i),y);if(i%2===0)on+=v;else off+=v}on/=3;off/=3;if(Math.abs(on-off)<36)return null;
  const th=(on+off)/2,pos=on>off,out=[];for(let i=CBQ2.cal;i<cols;i++){const v=lum(X(i),y);out.push((v>th)===pos?1:0)}return out};
 const toBytes=bits=>{const b=new Uint8Array(bits.length>>3);for(let i=0;i<b.length;i++){let v=0;for(let k=0;k<8;k++)v=v*2+bits[i*8+k];b[i]=v}return b};
 for(const sc of [1,.997,1.003,.994,1.006])for(let dy=0;Math.abs(dy)<=8;dy=dy>0?-dy:-dy+2)for(let dx=0;Math.abs(dx)<=8;dx=dx>0?-dx:-dx+2){
  const r0=row(0,dx,dy,sc);if(!r0)continue;const hd=toBytes(r0.slice(0,32));if(hd[0]!==0x4D||hd[1]!==0x43)continue;
  const need=Math.ceil(((hd[2]<<8|hd[3])+8)*8/per);if(need<1||need>CBQ2.maxRows)continue;
  let bits=r0,okRows=true;for(let r=1;r<need;r++){const x=row(r,dx,dy,sc);if(!x){okRows=false;break}bits=bits.concat(x)}if(!okRows)continue;
  const got=cbqUnpack(toBytes(bits));if(got)return got}
 return null}
function cbAdopt(raw,from){const c=cbNew({title:String(raw.title||'').slice(0,60),hand:(raw.hand||[]).map(cbqId).slice(0,12),
  lines:(raw.lines||[]).slice(0,60).map(l=>l.slice(0,12).map(n=>({cards:(n.cards||[]).slice(0,6).map(x=>({c:cbqId(x.c),a:CBQ2.acts.includes(x.a)?x.a:'auto',...cbPlaceOf(x)})),note:String(n.note||'').slice(0,80)})).filter(n=>n.cards.length)).filter(l=>l.length)});
 if(from)c.from=from;if(!cbHas(c))return null;cbStore(c);return c}
/* ---------- what is on the field after the combo (for the sheet's "Final board") ---------- */
function cbWalk(c){const hand=c.hand.map(String),field=[],gone=[];let normal=false;
 const txt=id=>{const k=cbCard(id);return String((k&&k.type)||'')},isMon=id=>/monster/i.test(txt(id)),isX=id=>/link|xyz|synchro|fusion/i.test(txt(id)),stays=id=>isMon(id)||/pendulum/i.test(txt(id))||/continuous|field|equip/i.test(String((cbCard(id)||{}).race||''));
 const drop=(a,id)=>{const i=a.indexOf(String(id));if(i>=0)a.splice(i,1);return i>=0};
 // "Auto" is decided the way the Arena decides it: by where the card is and what it is
 const lines=c.lines.map(l=>l.map(n=>({note:n.note||'',cards:n.cards.map(x=>{const id=String(x.c);let a=x.a;
  if(a==='auto')a=field.includes(id)?'eff':gone.includes(id)?'eff':hand.includes(id)?(isMon(id)?(normal?'ss':'ns'):'act'):isX(id)?'ss':'add';
  if(a==='ns')normal=true;
  if(a==='ns'||a==='ss'||a==='set'||a==='scale'||a==='put'){if(x.f===1||x.f==null)drop(hand,id);drop(gone,id);field.push(id)}
  else if(a==='act'){if(!field.includes(id)){drop(hand,id);if(stays(id))field.push(id);else gone.push(id)}}
  else if(a==='add'){if(x.f===6||(x.f==null&&field.includes(id)))drop(field,id);drop(gone,id);hand.push(id)}
  else if(CB_RESULT.has(a)){if(x.f===6)drop(field,id);else if(x.f===1)drop(hand,id);else if(x.f==null){if(!drop(field,id))drop(hand,id)}if(a!=='deck'&&a!=='att')gone.push(id)}
  return Object.assign({},x,{a})})})));
 return{lines,field,hand}}
const cbFinalBoard=c=>{const w=cbWalk(c);return{field:w.field,hand:w.hand}};
/* ---------- the combo sheet ---------- */
function buildComboSvg(list,meta,bg){
 const W=DI_SIZE,P=DI_PAL[meta.design]||DI_PAL.night,clean=meta.design==='clean',X=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
 const F="'Chakra Petch','Plus Jakarta Sans',Arial,sans-serif",B="'Plus Jakarta Sans','Chakra Petch',Arial,sans-serif",pad=56,pf=meta.profile?diProfile():null;
 const acc=clean?P.accent:P.gold,title=String(meta.title||'Combos'),right=pf?430:0,ts=Math.max(40,Math.min(76,Math.floor((W-pad*2-right)/(title.length*.62))));
 const band=cbqBand(list,W,1600,pad,P),o=[];let y=206+ts;
 const fit=(t,max,fs)=>{t=String(t||'');const n=Math.max(3,Math.floor(max/(fs*.56)));return t.length>n?t.slice(0,n-1)+'…':t};
 const wrap=(t,max,fs,lines)=>{const n=Math.max(4,Math.floor(max/(fs*.54))),out=[];let cur='';for(const w of String(t||'').split(/\s+/)){if(!w)continue;const tr=cur?cur+' '+w:w;if(tr.length<=n||!cur)cur=tr;else{out.push(cur);cur=w}if(out.length>=lines)break}if(cur&&out.length<lines)out.push(cur);
  if(out.length===lines&&String(t).split(/\s+/).join(' ').length>out.join(' ').length)out[lines-1]=fit(out[lines-1]+'…',max,fs);return out.map(l=>fit(l,max,fs))};
 let clipN=0;const card=(id,x,y0,cw)=>{const ch=Math.round(cw*86/59),c=cbCard(id)||{name:cbName(id)},url=deckCardImageUrl(c),k='cc'+(++clipN),rx=Math.max(3,cw*.05);
  o.push(`<rect x="${x}" y="${y0+2}" width="${cw}" height="${ch}" rx="${rx}" fill="#000" opacity="${clean?.16:.5}"/>`);
  if(url){let a=url;try{a=new URL(url,document.baseURI).href}catch(e){}o.push(`<clipPath id="${k}"><rect x="${x}" y="${y0}" width="${cw}" height="${ch}" rx="${rx}"/></clipPath><rect x="${x}" y="${y0}" width="${cw}" height="${ch}" rx="${rx}" fill="${P.slot}"/><image href="${X(a)}" xlink:href="${X(a)}" x="${x}" y="${y0}" width="${cw}" height="${ch}" preserveAspectRatio="none" clip-path="url(#${k})"/>`)}
  else o.push(`<rect x="${x}" y="${y0}" width="${cw}" height="${ch}" rx="${rx}" fill="${P.slot}" stroke="${P.line}"/>`);return ch};
 const section=(t,y0)=>{o.push(`<text x="${pad}" y="${y0+24}" font-family="${F}" font-size="24" font-weight="800" letter-spacing="3" fill="${acc}">${X(t)}</text><rect x="${pad+t.length*18+20}" y="${y0+14}" width="${Math.max(0,W-pad*2-t.length*18-20)}" height="2" fill="${P.line}"/>`);return y0+44};
 const panel=(x,y0,w,h,on)=>o.push(`<rect x="${x}" y="${y0}" width="${w}" height="${h}" rx="14" fill="${P.head}" fill-opacity="${clean?.75:.8}" stroke="${on?acc:P.line}" stroke-width="${on?2:1}"/>`);
 const kindOf=id=>{const k=cbCard(id),t=String((k&&(k.type||''))||'');return /link/i.test(t)?'Link':/xyz/i.test(t)?'Xyz':/synchro/i.test(t)?'Synchro':/fusion/i.test(t)?'Fusion':/ritual/i.test(t)&&/monster/i.test(t)?'Ritual':''};
 const LABEL={ns:'Normal Summon',ss:'Special Summon',act:'Activate',eff:'Activate Effect',set:'Set',scale:'Pendulum Scale',auto:'Play'},DOT={ns:'#38c9a6',ss:P.gold,act:P.accent,eff:'#ff8a5c',set:'#8fa0c8',scale:'#b98bff',auto:P.sub};
 list.forEach((c,ci)=>{
  if(list.length>1){o.push(`<rect x="${pad}" y="${y}" width="${W-pad*2}" height="46" rx="10" fill="${P.head}"/><rect x="${pad}" y="${y}" width="6" height="46" rx="3" fill="url(#da)"/><text x="${pad+20}" y="${y+31}" font-family="${F}" font-size="24" font-weight="800" fill="${P.ink}">${X((ci+1)+' · '+cbTitle(c))}</text>`);y+=64}
  // starting hand
  y=section('STARTING HAND',y);
  {const cw=118,ch=Math.round(cw*86/59),gap=16,per=Math.floor((W-pad*2-32)/(cw+gap)),rows=Math.max(1,Math.ceil(c.hand.length/per)),h=rows*(ch+34)+24;panel(pad,y,W-pad*2,h);
   if(!c.hand.length)o.push(`<text x="${pad+20}" y="${y+h/2+8}" font-family="${B}" font-size="22" fill="${P.mute}">Any hand</text>`);
   c.hand.forEach((id,i)=>{const x=pad+16+(i%per)*(cw+gap),yy=y+14+Math.floor(i/per)*(ch+34);card(id,x,yy,cw);o.push(`<text x="${x+cw/2}" y="${yy+ch+20}" font-family="${B}" font-size="14" font-weight="700" fill="${P.ink}" text-anchor="middle">${X(fit(cbName(id),cw+10,14))}</text>`)});y+=h+26}
  // steps: every play is a tile; what a line used comes first ("USING"), what it led to follows under the card
  const tiles=[],walk=cbWalk(c);
  walk.lines.forEach((l,li)=>{let cur=null,lead=[];
   l.forEach(n=>{const isRes=x=>CB_RESULT.has(x.a)||(x.a==='ss'&&!!cur&&(x.f!=null||n.cards.some(k=>CB_RESULT.has(k.a)))),play=n.cards.filter(x=>!isRes(x)),res=n.cards.filter(isRes);
    if(play.length){cur={cards:play,groups:lead,note:n.note||'',line:li,first:!tiles.some(t=>t.line===li)};lead=[];tiles.push(cur)}
    const tgt=cur?cur.groups:lead;for(const x of res){const lb=CB_GROUP[x.a]||'THEN';let g=tgt[tgt.length-1];if(!g||g.t!==lb||g.ids.length>=8){g={t:lb,ids:[]};tgt.push(g)}g.ids.push(x.c)}
    if(!play.length&&n.note&&cur&&!cur.note)cur.note=n.note});
   if(lead.length){tiles.push({cards:[],groups:lead,note:'',line:li,first:!tiles.some(t=>t.line===li)})}});
  if(tiles.length){y=section(`COMBO STEPS · ${tiles.length}`,y);
   const cols=5,gap=16,tw=(W-pad*2-gap*(cols-1))/cols,mw=60,mh=Math.round(mw*86/59),mper=Math.floor((tw-24+8)/(mw+8));
   const hOf=t=>{const n=t.cards.length,cw=n<=1?150:n===2?112:74,ch=Math.round(cw*86/59),rows=Math.ceil(Math.max(1,n)/3);let h=74+(n?rows*(ch+8+(n>1?18:0))+ (n===1?wrap(cbName(t.cards[0].c),tw-24,16,2).length*20:0)+8:0);
    for(const g of t.groups)h+=24+Math.ceil(g.ids.length/mper)*(mh+8);if(t.note)h+=wrap(t.note,tw-24,14,3).length*18+8;return h+14};
   for(let r=0;r<tiles.length;r+=cols){const row=tiles.slice(r,r+cols),rh=Math.max(...row.map(hOf));
    row.forEach((t,i)=>{const x=pad+i*(tw+gap),n=t.cards.length,main=t.cards[0],a=main?main.a:'',k=main?kindOf(main.c):'';let yy=y;
     panel(x,yy,tw,rh,false);
     if(!t.first&&i)o.push(`<text x="${x-gap/2}" y="${yy+rh/2}" font-family="${F}" font-size="20" font-weight="800" fill="${acc}" text-anchor="middle">›</text>`);
     o.push(`<text x="${x+tw/2}" y="${yy+30}" font-family="${F}" font-size="19" font-weight="800" fill="${P.ink}" text-anchor="middle">STEP ${r+i+1}</text>`);
     const lab=!main?'Then':a==='ss'&&k&&t.groups.some(g=>g.t==='USING')?k+' Summon':(LABEL[a]||'Play'),lw=lab.length*9.4+26;
     o.push(`<circle cx="${x+tw/2-lw/2+6}" cy="${yy+52}" r="6" fill="${DOT[a]||P.sub}"/><text x="${x+tw/2-lw/2+22}" y="${yy+58}" font-family="${F}" font-size="17" font-weight="700" fill="${DOT[a]||P.sub}">${X(lab)}</text>`);yy+=74;
     if(n){const cw=n<=1?150:n===2?112:74,ch=Math.round(cw*86/59),per=Math.min(3,n),tot=per*cw+(per-1)*8;
      t.cards.forEach((cd,j)=>{const cx=x+(tw-tot)/2+(j%3)*(cw+8),cy=yy+Math.floor(j/3)*(ch+8+(n>1?18:0));card(cd.c,cx,cy,cw);if(n>1)o.push(`<text x="${cx+cw/2}" y="${cy+ch+14}" font-family="${B}" font-size="12" font-weight="700" fill="${P.ink}" text-anchor="middle">${X(fit(cbName(cd.c),cw+6,12))}</text>`)});yy+=Math.ceil(n/3)*(ch+8+(n>1?18:0));
      if(n===1){for(const ln of wrap(cbName(main.c),tw-24,16,2)){o.push(`<text x="${x+tw/2}" y="${yy+14}" font-family="${B}" font-size="16" font-weight="700" fill="${P.ink}" text-anchor="middle">${X(ln)}</text>`);yy+=20}}yy+=8}
     for(const g of t.groups){o.push(`<text x="${x+tw/2}" y="${yy+16}" font-family="${F}" font-size="13" font-weight="800" letter-spacing="1.5" fill="${g.t==='USING'?P.sub:acc}" text-anchor="middle">${X(g.t)}</text>`);yy+=24;
      g.ids.forEach((id,j)=>{const inRow=Math.min(mper,g.ids.length-Math.floor(j/mper)*mper),tot=inRow*mw+(inRow-1)*8;card(id,x+(tw-tot)/2+(j%mper)*(mw+8),yy+Math.floor(j/mper)*(mh+8),mw)});yy+=Math.ceil(g.ids.length/mper)*(mh+8)}
     if(t.note)for(const ln of wrap(t.note,tw-24,14,3)){o.push(`<text x="${x+tw/2}" y="${yy+14}" font-family="${B}" font-size="14" font-style="italic" fill="${P.mute}" text-anchor="middle">${X(ln)}</text>`);yy+=18}});
    y+=rh+gap}y+=12}
  // final board
  const fb=walk;
  if(fb.field.length){y=section('FINAL BOARD',y);const cw=118,ch=Math.round(cw*86/59),gap=16,per=Math.floor((W-pad*2-32)/(cw+gap)),rows=Math.ceil(fb.field.length/per),h=rows*(ch+34)+24+(fb.hand.length?30:0);panel(pad,y,W-pad*2,h);
   fb.field.forEach((id,i)=>{const x=pad+16+(i%per)*(cw+gap),yy=y+14+Math.floor(i/per)*(ch+34);card(id,x,yy,cw);o.push(`<text x="${x+cw/2}" y="${yy+ch+20}" font-family="${B}" font-size="14" font-weight="700" fill="${P.ink}" text-anchor="middle">${X(fit(cbName(id),cw+10,14))}</text>`)});
   if(fb.hand.length)o.push(`<text x="${pad+18}" y="${y+h-14}" font-family="${B}" font-size="17" fill="${P.sub}">${X(fit('In hand: '+fb.hand.map(cbName).join(', '),W-pad*2-36,17))}</text>`);y+=h+26}
  y+=10});
 const H=Math.max(900,Math.ceil(y+(band?band.h:0)+92));
 const head=[`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
 `<defs><linearGradient id="dg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.bg2}"/><stop offset=".6" stop-color="${P.bg}"/><stop offset="1" stop-color="${P.bg}"/></linearGradient><linearGradient id="da" x1="0" x2="1"><stop offset="0" stop-color="${P.accent}"/><stop offset=".6" stop-color="${P.accent2}"/><stop offset="1" stop-color="${P.gold}"/></linearGradient>`+
 (pf?`<linearGradient id="dfr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${(DI_FRAME[pf.frame]||DI_FRAME.none)[0]}"/><stop offset="1" stop-color="${(DI_FRAME[pf.frame]||DI_FRAME.none)[1]}"/></linearGradient><clipPath id="dav"><circle cx="0" cy="0" r="44"/></clipPath>`:'')+
 `<linearGradient id="dsh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.bg}" stop-opacity="${clean?.9:.6}"/><stop offset="${Math.min(.5,700/H).toFixed(3)}" stop-color="${P.bg}" stop-opacity="${clean?.95:.94}"/><stop offset="1" stop-color="${P.bg}" stop-opacity="1"/></linearGradient></defs>`,
 `<rect width="${W}" height="${H}" fill="${clean?P.bg:'url(#dg)'}"/>`];
 // the picture sits behind the heading only, so the steps stay easy to read
 if(bg)head.push(`<image href="${X(bg)}" xlink:href="${X(bg)}" width="${W}" height="${Math.min(H,1600)}" preserveAspectRatio="xMidYMin slice"/><rect width="${W}" height="${H}" fill="url(#dsh)"/>`);
 if(clean)head.push(`<rect x="0" y="0" width="${W}" height="10" fill="url(#da)"/>`);else head.push(`<rect x="16" y="16" width="${W-32}" height="${H-32}" rx="28" fill="none" stroke="url(#da)" stroke-width="3"/>`);
 head.push(`<g font-family="${F}" fill="${P.ink}"><text x="${pad}" y="70" font-size="20" font-weight="700" letter-spacing="5" fill="${P.gold}">DUEL SYNAPSE · KODEX · COMBO</text>`,
  `<text x="${pad}" y="${80+ts}" font-size="${ts}" font-weight="800">${X(title.slice(0,60))}</text>`,
  `<text x="${pad}" y="${120+ts}" font-family="${B}" font-size="24" font-weight="700" fill="${P.sub}">${X([meta.sub,meta.player].filter(Boolean).join('  ·  '))}</text>`,
  `<text x="${pad}" y="${156+ts}" font-family="${B}" font-size="22" fill="${P.mute}">${X([meta.note,diDateText(meta.date)].filter(Boolean).join('  ·  '))}</text></g>`);
 if(pf){const ax=W-pad-44,ay=96;head.push(`<g transform="translate(${ax},${ay})"><circle r="52" fill="url(#dfr)"/><circle r="46" fill="${P.bg}"/><image href="${X(pf.src)}" xlink:href="${X(pf.src)}" x="-44" y="-44" width="88" height="88" clip-path="url(#dav)" preserveAspectRatio="xMidYMid slice"/></g>`,
  `<g font-family="${F}" text-anchor="end"><text x="${ax-66}" y="${ay-12}" font-size="28" font-weight="800" fill="${P.ink}">${X(pf.name)}</text><text x="${ax-66}" y="${ay+18}" font-family="${B}" font-size="19" fill="${P.sub}">${X(pf.title||((KXPF.tierName(pf.tier)||'')+' duelist'))}</text><text x="${ax-66}" y="${ay+44}" font-size="16" font-weight="700" letter-spacing="2" fill="${P.gold}">MEIOCG${pf.rank?' PLAYERS #'+pf.rank:' PROFILE'}${pf.premium?' · PREMIUM':''}</text></g>`)}
 const foot=[band?band.draw(H):'',`<g font-family="${F}"><text x="${pad}" y="${H-44}" font-size="18" fill="${P.mute}">Made with Duel Synapse: KodeX · a project of Meta Insider OCG</text><text x="${W-pad}" y="${H-44}" font-size="18" fill="${P.gold}" text-anchor="end" font-weight="700">kodex.meiocg.org</text></g></svg>`];
 return head.join('')+o.join('')+foot.join('')}
/* the preview scrolls for a tall sheet; saving a tall sheet draws it at full size instead of capturing the screen */
{const ci=cbImage;cbImage=function(){const r=ci.apply(this,arguments);const box=document.querySelector('.mdl[data-k=pm] .di-svg');
  if(box){box.classList.add('tall');const sm=box.parentNode.querySelector('small');if(sm)sm.textContent='The sheet grows with the combo · zoom in after saving'}return r}}
{const dv=deckViewer;deckViewer=function(svg,name,deck){const m=dv.apply(this,arguments);if(deck||!/DUEL SYNAPSE · KODEX · COMBO/.test(svg))return m;
  const md=document.querySelector('.mdl.viewer')||document.querySelector('.mdl[data-k=viewer]')||document.querySelector('.vw-body')?.closest('.mdl');if(!md)return m;
  md.addEventListener('click',e=>{const b=e.target.closest('button[data-vsave]');if(!b||b.dataset.vsave==='jpg')return;e.stopImmediatePropagation();e.preventDefault();
   const H=+((svg.match(/<svg[^>]* height="(\d+)"/)||[])[1]||1600);b.disabled=true;toast('Preparing image…');
   svgToPng(svg,H>5200?1:1.5,'image/png').then(async p=>{await saveFile(p,name+'.png','image/png')}).catch(()=>toast('Could not make the image')).finally(()=>{b.disabled=false})},true);return m}}
/* the Combo Generator button in the Arena's lobby: leave the Arena and open Combos */
window.addEventListener('message',e=>{const d=e.data||{},f=$('arenaFrame');if(!f||e.source!==f.contentWindow||d.kx!=='combos')return;
 if(!kxInApp()){kxComboAd();return}
 if(L.includes('arena')){arenaBye=true;history.back();setTimeout(()=>kxCombos(),420)}else kxCombos()});
