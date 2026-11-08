/* ---------- exports ---------- */
function buildDeckPdf(d,player,cardId,event){
 const sections=[['MAIN DECK',copies(d,'main')],['EXTRA DECK',copies(d,'extra')],['SIDE DECK',copies(d,'side')]]; 
 const clean=v=>String(v??'').normalize('NFKD').replace(/[^\x20-\x7E]/g,'').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)'); 
 const lines=['KONAMI TOURNAMENT DECK LIST - KODEX EXPORT',`Deck: ${d.name}`,`Duelist: ${player||'________________________'}`,`CARD GAME ID: ${cardId||'________________'}`,`Event: ${event||'________________________'}`,`Date: ${new Date().toLocaleDateString()}`,`Total: ${deckTotal(d)} cards`,'']; 
 for(const [label,arr] of sections){lines.push(`${label} (${arr.length} cards)`);const counts=new Map();arr.forEach(c=>counts.set(c.name,(counts.get(c.name)||0)+1));if(!counts.size)lines.push('  -');for(const [name,qty] of counts)lines.push(`${qty} x  ${name}`);lines.push('')} 
 lines.push('KodeX-generated list; transfer to the official Konami form if the event requires that exact form.'); 
 const pages=[];for(let i=0;i<lines.length;i+=48)pages.push(lines.slice(i,i+48)); 
 const objs=[],add=o=>(objs.push(o),objs.length),catalogId=add(''),pagesId=add(''),fontId=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),pageIds=[],streamIds=[]; 
 for(const page of pages){let content='BT\n/F1 10 Tf\n48 790 Td\n14 TL\n';page.forEach((line,j)=>{if(j)content+='T*\n';content+=`(${clean(line).slice(0,115)}) Tj\n`});content+='ET';const streamId=add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);streamIds.push(streamId);pageIds.push(add(''))} 
 objs[catalogId-1]=`<< /Type /Catalog /Pages ${pagesId} 0 R >>`;objs[pagesId-1]=`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pageIds.length} >>`; 
 pageIds.forEach((id,i)=>objs[id-1]=`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamIds[i]} 0 R >>`); 
 let pdf='%PDF-1.4\n%KODEX\n',offsets=[0];for(let i=0;i<objs.length;i++){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`}const xref=pdf.length;pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';pdf+=`trailer\n<< /Size ${objs.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`; 
 
 return new Blob([pdf],{type:'application/pdf'});
}
const isWV=()=>/; wv\)/.test(navigator.userAgent);
const blobB64=b=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=rej;r.readAsDataURL(b)});
async function saveFile(blob,name,mime){
  const f=new File([blob],name,{type:mime});
  try{const B=window.KodexBridge||window.AndroidBridge;if(B&&typeof B.saveBase64==='function'){B.saveBase64(name,mime,await blobB64(blob));toast('Saved '+name);return}}catch(e){}
  const anchor=href=>{const a=document.createElement('a');a.href=href;a.download=name;a.rel='noopener';a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>a.remove(),1500)};
  if(!isWV()){const url=URL.createObjectURL(blob);anchor(url);setTimeout(()=>URL.revokeObjectURL(url),60000);toast('Saving '+name);return}
  try{const du=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(blob)});anchor(du);toast('Saving '+name);return}catch(e){}
  try{if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});return}}catch(e){if(e&&e.name==='AbortError')return}
  saveFallback(blob,name,mime)
}
function saveFallback(blob,name,mime){
  const img=/^image\//.test(mime),txt=/^text\//.test(mime)||/ydk/.test(name);
  const url=img?URL.createObjectURL(blob):'';
  const m=openModal(`<h3>${esc(name)}</h3>${img?`<img class="sv-img" src="${url}" alt="">`:''}<div class="dact"><button class="btn" data-close>Close</button>${img||txt?`<button class="btn p" id="svCp">${img?'Copy image':'Copy text'}</button>`:''}</div>${img||txt?'':'<small class="sv-n">File saving is not enabled in this app build.</small>'}`);
  const cp=m.querySelector('#svCp');if(cp)cp.onclick=async()=>{try{if(img)await navigator.clipboard.write([new ClipboardItem({[blob.type]:blob})]);else await navigator.clipboard.writeText(await blob.text());toast('Copied')}catch(e){toast('Copy not available')}}
}
async function svgToPng(svg,scale,mime){
  window.__pngMiss=0;mime=mime||'image/png';
  const doc=new DOMParser().parseFromString(svg,'image/svg+xml'),imgs=[...doc.querySelectorAll('image')];
  const cache={};
  await Promise.all(imgs.map(async n=>{const u=n.getAttribute('href')||n.getAttribute('xlink:href');if(!u||u.startsWith('data:'))return;try{if(!cache[u])cache[u]=icLoad(u);const d=await cache[u];n.setAttribute('href',d);n.removeAttribute('xlink:href')}catch(e){window.__pngMiss++;const x=+n.getAttribute('x'),y=+n.getAttribute('y'),w=+n.getAttribute('width'),h=+n.getAttribute('height'),t=(n.querySelector('title')?.textContent||'').trim(),ns='http://www.w3.org/2000/svg',g=doc.createElementNS(ns,'g'),r=doc.createElementNS(ns,'rect');r.setAttribute('x',x);r.setAttribute('y',y);r.setAttribute('width',w);r.setAttribute('height',h);r.setAttribute('fill','#18213a');r.setAttribute('stroke','#3a4a73');g.appendChild(r);let ln=[],cur='';for(const wd of t.split(/\s+/)){const q=cur?cur+' '+wd:wd;if(q.length>11&&cur){ln.push(cur);cur=wd}else cur=q}if(cur)ln.push(cur);ln.slice(0,7).forEach((l,i)=>{const tx=doc.createElementNS(ns,'text');tx.setAttribute('x',x+4);tx.setAttribute('y',y+16+i*13);tx.setAttribute('font-size','10.5');tx.setAttribute('font-family','Arial,sans-serif');tx.setAttribute('fill','#dbe4ff');tx.textContent=l.slice(0,13);g.appendChild(tx)});n.replaceWith(g)}}));
  const out=new XMLSerializer().serializeToString(doc.documentElement),W=+doc.documentElement.getAttribute('width')||1200,H=+doc.documentElement.getAttribute('height')||800;
  const im=new Image();await new Promise((ok,no)=>{im.onload=ok;im.onerror=no;im.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(out)});
  const c=document.createElement('canvas');c.width=W*scale;c.height=H*scale;const x=c.getContext('2d');x.scale(scale,scale);x.drawImage(im,0,0,W,H);
  return await new Promise((ok,no)=>c.toBlob(b=>b?ok(b):no(new Error('png')),mime,mime==='image/jpeg'?.93:undefined))
}
