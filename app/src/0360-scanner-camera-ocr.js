
(function(){
  "use strict";
  const TESSERACT="https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  const SCAN_DATA="https://kodex.meiocg.org/scan/cards.json";
  const ART_DATA="https://kodex.meiocg.org/scan/art.json";
  // The scanner's data also lives in the public repository: used when the site doesn't answer, and kept on the device.
  const RAW="https://raw.githubusercontent.com/castelnoleal/Duel-Synapse-KodeX/main/scan/";
  async function scanJson(url,alt){
    let cache=null,hit=null;try{cache=await caches.open("kx-scan");const c=await cache.match(url);if(c)hit=await c.json()}catch(e){}
    const net=async()=>{
      for(const u of [url,alt]){
        try{const r=await fetch(u,{cache:"no-cache"});if(!r.ok)continue;const copy=r.clone();const j=await r.json();if(j&&(Array.isArray(j)?j.length:Object.keys(j).length)){if(cache)try{await cache.put(url,copy)}catch(e){}return j}}catch(e){}
      }
      return null;
    };
    if(hit){net();return hit}   // saved copy now, refreshed in the background for next time
    const j=await net();if(j)return j;
    throw new Error("scan data unavailable");
  }
  const YGOPRO="https://db.ygoprodeck.com/api/v7/";
  const IMG=id=>`https://images.ygoprodeck.com/images/cards_small/${id}.jpg`;
  // Where each field sits on a card, as fractions of its width/height.
  const ZONES={name:{x:.04,y:.03,w:.82,h:.09},set:{x:.40,y:.695,w:.57,h:.06},pass:{x:.015,y:.925,w:.47,h:.065}};
  const h=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let index=null,indexFrom="",reader=null,artIndex=null,artLoading=null;
  /** Artwork fingerprints of every card (about 0.5 MB, cached by the app after the first download). */
  function getArt(){
    if(artIndex)return Promise.resolve(artIndex);
    if(!artLoading)artLoading=scanJson(ART_DATA,RAW+"art.json").then(j=>artIndex=KodexArt.buildArtIndex(j)).catch(()=>{artLoading=null;return null});
    return artLoading;
  }
  /** Looks a card up on YGOPRODeck when it isn't in the app's list yet (new or Japanese-only printings). */
  async function onlineLookup({passcode,setCode}){
    const tries=[];
    for(const m of String(passcode||"").replace(/[^0-9]+/g," ").matchAll(/\d{8}/g))tries.push(YGOPRO+"cardinfo.php?id="+Number(m[0]));
    for(const m of String(setCode||"").toUpperCase().matchAll(/([A-Z0-9]{2,5})-([A-Z]{0,2})(\d{3})/g))for(const reg of ["EN","",m[2]])tries.push(YGOPRO+"cardsetsinfo.php?setcode="+encodeURIComponent(m[1]+"-"+reg+m[3]));
    for(const u of [...new Set(tries)].slice(0,4)){
      try{const r=await fetch(u,{cache:"force-cache"});if(!r.ok)continue;const d=await r.json();const c=Array.isArray(d.data)?d.data[0]:d;
        if(c&&c.id&&c.name)return {id:Number(c.id),name:c.name}}catch(e){}
    }
    return null;
  }


  // ---- Online lookup: the photo is read by a vision model on the KodeX server, then the card is pulled by what it read ----
  const LENS="https://kodex.meiocg.org/api/lens";
  const lens={off:false,retry:0,why:""};
  const lensUsable=()=>!lens.off&&Date.now()>=lens.retry&&navigator.onLine!==false;
  /** Sends one picture to the server. Null when it can't be reached (the offline scanner takes over). */
  async function lensAsk(cv){
    if(!lensUsable())return null;
    try{
      const blob=await new Promise(r=>cv.toBlob(r,"image/jpeg",.82));if(!blob)return null;
      const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),15000);
      const r=await fetch(LENS,{method:"POST",headers:{"Content-Type":"image/jpeg"},body:blob,signal:ctl.signal});clearTimeout(t);
      if(r.status===503){lens.off=true;lens.why="not_configured";return null}
      if(r.status===429){lens.retry=Date.now()+20000;lens.why="busy";return null}
      if(!r.ok){lens.retry=Date.now()+15000;lens.why="error "+r.status;return null}
      const j=await r.json();return j&&typeof j==="object"?j:null;
    }catch(e){lens.retry=Date.now()+10000;lens.why="offline";return null}
  }
  /** The card database answers by name: exact name first, then the closest names. */
  async function onlineName(name){
    const out={exact:false,list:[]};
    for(const [q,exact] of [["name",true],["fname",false]]){
      try{
        const ctl=new AbortController(),t=setTimeout(()=>ctl.abort(),7000);
        const r=await fetch(YGOPRO+"cardinfo.php?"+q+"="+encodeURIComponent(name),{signal:ctl.signal,cache:"force-cache"});clearTimeout(t);
        if(!r.ok)continue;const d=await r.json();const rows=Array.isArray(d.data)?d.data:[];
        if(rows.length){out.exact=exact&&rows.length===1;out.list=rows.slice(0,8).map(c=>({id:Number(c.id),name:c.name,atk:c.atk,def:c.def}));return out}
      }catch(e){}
    }
    return out;
  }
  const fin=v=>v!=null&&v!==""&&Number.isFinite(Number(v));
  /** Does the card's ATK/DEF agree with what the picture says? 1 yes, -1 no, 0 can't tell. */
  function statOf(c,L){
    const own=(typeof M!=="undefined"&&(M.get(String(c.id))||(index.byId.get(c.id)&&M.get(String(index.byId.get(c.id).id)))))||c;
    let ok=0;
    if(fin(L.atk)&&fin(own.atk)){if(Number(own.atk)!==L.atk)return -1;ok=1}
    if(fin(L.def)&&fin(own.def)){if(Number(own.def)!==L.def)return -1;ok=1}
    return ok;
  }
  /**
   * What the server read -> a card. The model's name is never taken on trust: it has to be a real card name,
   * and the passcode, set code and ATK/DEF it read must not disagree with the card it points to.
   */
  async function lensResolve(L){
    if(!L||L.card===false)return {state:"none"};
    await getIndex();
    const name=L.name||"",card=c=>index.byId.get(c.id)||c;
    const r=KodexMatch.identify(index,{name,setCode:L.setCode||"",passcode:L.passcode||""});
    if(r.card&&r.sure){
      const s=statOf(r.card,L);
      if(r.via==="passcode"||r.via==="set"||s>=0)return {state:"sure",card:r.card,cands:r.candidates,weak:r.via==="name"&&s===0};
    }
    // A real card the app's list doesn't have yet (new or Japanese-only): ask the database for that exact name.
    if(name){
      const on=await onlineName(name);
      if(on.exact&&statOf(on.list[0],L)>=0){const c=card(on.list[0]);return {state:"sure",card:c,cands:[{card:c,score:1}],weak:statOf(on.list[0],L)===0}}
      const list=on.list.filter(c=>statOf(c,L)>=0).map(c=>({card:card(c),score:KodexMatch.nameSimilarity(KodexMatch.normName(name),KodexMatch.normName(c.name))})).filter(x=>x.score>=.5).sort((a,b)=>b.score-a.score);
      r.candidates=[...(r.candidates||[]),...list].filter((x,i,a)=>a.findIndex(y=>y.card.id===x.card.id)===i);
    }
    // Cards whose printed ATK and DEF match, ranked by how close their name is.
    let list=(r.candidates||[]).filter(x=>x.score>=.5&&statOf(x.card,L)>=0);
    const withStats=list.filter(x=>statOf(x.card,L)===1);
    if(withStats.length===1&&withStats[0].score>=.6)return {state:"sure",card:withStats[0].card,cands:list};
    return list.length?{state:"pick",list:list.slice(0,6)}:{state:"unread",L};
  }
  /** A downscaled copy of any picture, for sending. */
  function scaled(src,w,hh,max){const k=Math.min(1,max/Math.max(w,hh)),c=document.createElement("canvas");c.width=Math.round(w*k);c.height=Math.round(hh*k);c.getContext("2d").drawImage(src,0,0,c.width,c.height);return c}

  async function getIndex(){
    if(index)return index;
    try{index=KodexMatch.buildIndex(await scanJson(SCAN_DATA,RAW+"cards.json"));indexFrom="kodex";}
    catch(e){ // offline: use the cards the app already has (no set codes)
      if(typeof M==="undefined"||!M.size)throw new Error("Cards are still loading. Try again in a moment.");
      index=KodexMatch.buildIndex([...M.values()].map(c=>[Number(c.id),c.name,[],[]]));indexFrom="app";
    }
    return index;
  }
  function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement("script");s.src=src;s.async=true;s.onload=res;s.onerror=()=>rej(new Error("Card reading needs an internet connection the first time."));document.head.appendChild(s)})}
  async function getReader(){
    if(reader)return reader;
    if(window.KodexScanOCR)return reader=window.KodexScanOCR; // tests supply a stand-in
    if(!window.Tesseract)await loadScript(TESSERACT);
    reader=await Tesseract.createWorker("eng",1,{logger:()=>{}});
    return reader;
  }

  /** Crops a field, enlarges it and makes it dark text on light. Null when there's no printed text. */
  function zone(card,z,targetH){
    const sx=card.width*z.x,sy=card.height*z.y,sw=card.width*z.w,sh=card.height*z.h,k=Math.max(1,targetH/sh);
    const c=document.createElement("canvas");c.width=Math.round(sw*k);c.height=Math.round(sh*k);
    const x=c.getContext("2d",{willReadFrequently:true});x.imageSmoothingQuality="high";x.drawImage(card,sx,sy,sw,sh,0,0,c.width,c.height);
    const d=x.getImageData(0,0,c.width,c.height),p=d.data;let sum=0,mn=255,mx=0;
    for(let i=0;i<p.length;i+=4){const l=.299*p[i]+.587*p[i+1]+.114*p[i+2];p[i]=l;sum+=l;if(l<mn)mn=l;if(l>mx)mx=l}
    if(mx-mn<48)return null;
    const inv=sum/(p.length/4)<120,sp=Math.max(1,mx-mn);
    for(let i=0;i<p.length;i+=4){let l=(p[i]-mn)/sp*255;if(inv)l=255-l;p[i]=p[i+1]=p[i+2]=l}
    x.putImageData(d,0,0);return c;
  }
  async function readCard(card,{passOnly=false}={}){
    const w=await getReader(),out={};
    for(const [k,params,th] of [["pass",{tessedit_char_whitelist:"0123456789",tessedit_pageseg_mode:"7"},70],["name",{tessedit_char_whitelist:"",tessedit_pageseg_mode:"7"},90],["set",{tessedit_char_whitelist:"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-",tessedit_pageseg_mode:"7"},70]]){
      const img=zone(card,ZONES[k],th);if(!img){out[k]="";continue}
      await w.setParameters(params);const r=await w.recognize(img);
      out[k]=String((r&&r.data&&r.data.text)||"").replace(/\s+/g," ").trim();
      if(k==="pass"&&(passOnly||KodexMatch.findPasscodes(index,out.pass).length))break;
    }
    return {name:out.name||"",setCode:out.set||"",passcode:out.pass||""};
  }
  /** Other ways the card might sit in a photo: zoomed in and nudged around, as small copies. */
  function photoFramings(img){
    const out=[];
    for(const z of [.9,.8,.7,.6])for(const dx of [-.12,0,.12])for(const dy of [-.08,0,.08])out.push(photoCard(img,z,dx*(1-z)*4,dy*(1-z)*4,300));
    return out;
  }
  function photoCard(img,zoom=1,dx=0,dy=0,maxW=1100){
    const ratio=59/86;let w=img.naturalWidth,hh=img.naturalHeight,sx=0,sy=0;
    if(w/hh>ratio){const nw=hh*ratio;sx=(w-nw)/2;w=nw}else{const nh=w/ratio;sy=(hh-nh)/2;hh=nh}
    sx+=w*(1-zoom)/2+dx*w;sy+=hh*(1-zoom)/2+dy*hh;w*=zoom;hh*=zoom;
    const c=document.createElement("canvas");c.width=Math.round(Math.min(maxW,w));c.height=Math.round(c.width/ratio);
    c.getContext("2d").drawImage(img,sx,sy,w,hh,0,0,c.width,c.height);return c;
  }

  /** Opens the scanner as a full-screen pop-up (the back button closes it). */
  window.openScanner=async function(){
    const el=openModal(`<div class="scan" style="position:absolute;inset:0">
      <video id="scVideo" playsinline muted autoplay disablepictureinpicture poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></video><canvas id="scPrev" hidden></canvas><img id="scStill" alt="" hidden><button class="btn p sstart" id="scStart" hidden>Tap to start the camera</button>
      <div class="sguide" id="scGuide"><i></i><i></i><i></i><i></i></div>
      <p class="sload" id="scLoad">Starting camera…</p>
      <div class="stop"><button class="sib" data-close aria-label="Close scanner">${ic("back")}</button><b>Scan a card</b><button class="sib" id="scTorch" aria-label="Flashlight" aria-pressed="false" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2h10l-2 6v12a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V8z"/><path d="M12 12v3"/></svg></button></div>
      <p class="shint" id="scHint" aria-live="polite">Fit the whole card inside the frame<small>Hold it flat, in good light, without glare</small></p>
      <div class="sbar"><div class="sside"><label class="sib" for="scPhoto">Photo</label><input type="file" id="scPhoto" accept="image/*" hidden></div><button class="shut" id="scShut" aria-label="Scan now"><b></b></button><div class="sside"><button class="sib" id="scAuto" aria-pressed="true">Auto</button></div></div>
      <section class="ssheet" id="scSheet" aria-live="polite"><h3 id="scT"></h3><p class="ssub" id="scS"></p><div id="scB"></div><div class="sacts" id="scA"></div></section>
      <div class="smsg" id="scMsg"><div><h3 id="scMT"></h3><p id="scMB"></p><div class="sacts" id="scMA"></div></div></div>
    </div>`,"scan","scan");
    el.classList.add("scanm");
    const $s=id=>el.querySelector("#"+id);
    let stream=null,track=null,auto=true,busy=false,attempts=0,best=null,closed=false;
    /** Turns the camera off (the scanner stays open, e.g. while a photo is searched). */
    const camOff=()=>{if(stream)stream.getTracks().forEach(t=>t.stop());stream=track=null;capture=null};
    const stop=()=>{closed=true;camOff()};
    // Stop the camera as soon as the pop-up goes away (back button, close, or opening a card).
    new MutationObserver((m,o)=>{if(!document.body.contains(el)){stop();o.disconnect()}}).observe(document.body,{childList:true});
    const msg=(t,b,acts)=>{$s("scMT").textContent=t;$s("scMB").textContent=b;$s("scMA").innerHTML="";for(const [label,fn,pri] of acts){const x=document.createElement("button");x.className="btn"+(pri?" p":"");x.textContent=label;x.onclick=fn;$s("scMA").appendChild(x)}$s("scMsg").classList.add("on")};
    const sheet=(t,s,body,acts)=>{$s("scT").textContent=t;$s("scS").textContent=s;$s("scB").innerHTML=body;$s("scA").innerHTML="";for(const [label,fn,pri] of acts){const x=document.createElement("button");x.className="btn"+(pri?" p":"");x.textContent=label;x.onclick=fn;$s("scA").appendChild(x)}$s("scSheet").classList.add("on")};
    const again=()=>{$s("scSheet").classList.remove("on");attempts=0;best=null;lastTop=null;lastText=null;since=Date.now();lensPrev=null;unsure=0;lensCount=0;sentSig=null;
      if(!$s("scStill").hidden){$s("scStill").hidden=true;$s("scStill").removeAttribute("src");$s("scHint").innerHTML="Fit the whole card inside the frame<small>Hold it flat, in good light, without glare</small>"}
      if(!stream)startCamera();else if(auto)loop()};
    const openIt=card=>{stop();const own=M.get(String(card.id))||(index.byId.get(card.id)&&M.get(String(index.byId.get(card.id).id)));if(own)openCard(own.id);else{history.back();q.value=card.name;q.dispatchEvent(new Event("input",{bubbles:true}));toast(card.name+" isn't in KodeX yet. Showing a search instead.")}};

    function found(r){
      const c=r.card;try{navigator.vibrate&&navigator.vibrate(40)}catch(e){}
      sheet("Card found",{passcode:"Matched by passcode",set:"Matched by set code",name:"Matched by name",art:"Matched by artwork",online:"Found online by its code",lens:"Read online"}[r.via]||"",`<div class="shit"><img src="${h(IMG(c.id))}" alt="" onerror="this.style.visibility='hidden'"><div><b>${h(c.name)}</b><small>Passcode ${h(String(c.id).padStart(8,"0"))}</small>${r.candidates.length>1?'<br><button class="snot" id="scNot">Not this card?</button>':""}</div></div>`,[["Open card",()=>openIt(c),true],["Scan another",again],...(!$s("scStill").hidden?[["Another photo",()=>$s("scPhoto").click()]]:[])]);
      const n=$s("scNot");if(n)n.onclick=()=>choose({candidates:r.candidates.filter(x=>x.card!==c)});
    }
    function choose(r,fromPhoto){
      const list=(r.candidates||[]).slice(0,6);
      if(!list.length){if(fromPhoto)$s("scHint").innerHTML=artIndex?"No card recognised in that photo<small>Use a sharp, straight photo of the whole card</small>":"Card data couldn't be loaded<small>Check your connection and try again</small>";return}
      sheet("Which card is it?","The card wasn't clear enough to be sure. Pick it below, or scan again.",`<div class="scands">${list.map((x,i)=>`<button class="scand" data-i="${i}"><img src="${h(IMG(x.card.id))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span>${h(x.card.name)}<small>${Math.round(x.score*100)}% match</small></span></button>`).join("")}</div>`,[["Scan again",again]]);
      $s("scB").querySelectorAll(".scand").forEach(b=>b.onclick=()=>openIt(list[+b.dataset.i].card));
    }
    const sameCard=(a,b)=>{const x=index.byId.get(a),y=index.byId.get(b);return x&&y?x===y:a===b};
    /** Picture match: the card whose artwork is closest, if it's clearly that card. */
    function byArt(card){
      if(!artIndex)return {sure:false,list:[]};
      artFrames++;
      let m=KodexArt.nearest(artIndex,KodexArt.queriesFromCard(card,{quick:true}),10);
      if(!KodexArt.confident(m,sameCard)&&(artFrames%2===0||(m[0]&&m[0].d<=22)))m=KodexArt.nearest(artIndex,KodexArt.queriesFromCard(card),10);
      const list=[];
      for(const x of m){const c=index.byId.get(x.id);if(c&&!list.some(y=>y.card===c))list.push({card:c,score:Math.max(0,1-x.d/32),d:x.d})}
      const top=list[0],next=list[1],gap=top&&next?next.d-top.d:64;
      // Live camera: the same card on top in two frames in a row is enough.
      let agree=false;
      if(top&&top.d<=12&&gap>=2){agree=lastTop===top.card;lastTop=top.card}else lastTop=null;
      return {sure:(KodexArt.confident(m,sameCard)||agree)&&!!top,list};
    }
    let lastTop=null,artFrames=0,lastWide=null,lastBox=null;
    /** The visible camera picture as a canvas (the whole screen area, not just the frame). */
    async function grabVisible(maxW){
      const f=await frame();if(!f)return null;
      const v=$s("scVideo"),r=v.getBoundingClientRect(),k=Math.max(r.width/f.w,r.height/f.h),ox=(r.width-f.w*k)/2,oy=(r.height-f.h*k)/2;
      const sx=-ox/k,sy=-oy/k,sw=r.width/k,sh=r.height/k,c=document.createElement("canvas");
      c.width=Math.round(Math.min(maxW,sw));c.height=Math.round(c.width*sh/sw);
      c.getContext("2d").drawImage(f.src,sx,sy,sw,sh,0,0,c.width,c.height);if(f.src.close)f.src.close();
      const g=$s("scGuide").getBoundingClientRect(),q=c.width/r.width;
      return {c,g:{x:(g.left-r.left)*q,y:(g.top-r.top)*q,w:g.width*q,h:g.height*q}};
    }
    /** Finds the card even when it isn't lined up with the frame: tries it at several sizes and positions around the frame. */
    function wideArt(w){
      const {c,g}=w,gx=g.x+g.w/2,gy=g.y+g.h/2,qs=[],rects=[];
      for(const s of [.92,1,1.08])for(const ix of [-3,-2,-1,0,1,2,3])for(const iy of [-3,-2,-1,0,1,2,3]){
        const ch=g.h*s,cw=ch*59/86,rect={x:gx+ix*cw*.02-cw/2,y:gy+iy*ch*.02-ch/2,w:cw,h:ch};
        rects.push(rect);qs.push(...KodexArt.queriesFromCard(c,{quick:true,rect}));
      }
      const m=KodexArt.nearest(artIndex,qs,10),list=[];
      for(const x of m){const cd=index.byId.get(x.id);if(cd&&!list.some(y=>y.card===cd))list.push({card:cd,score:Math.max(0,1-x.d/32),d:x.d})}
      const top=list[0],next=list[1],gap=top&&next?next.d-top.d:64;
      const strict=!!top&&((top.d<=6&&gap>=3)||(top.d<=8&&gap>=4));
      let agree=false;
      if(top&&top.d<=10&&gap>=3){agree=lastWide===top.card;lastWide=top.card}else lastWide=null;
      if(top&&(strict||agree)){ // where the card is, for reading its text
        const i=artIndex.ids.indexOf(m[0].id);let bd=99,bk=null;
        if(i>=0)rects.forEach((rc,k)=>{for(const [qh,ql] of [qs[2*k],qs[2*k+1]]){const d=KodexArt.popcount((artIndex.hi[i]^qh)>>>0)+KodexArt.popcount((artIndex.lo[i]^ql)>>>0);if(d<bd){bd=d;bk=rc}}});
        lastBox=bk?{box:bk,cw:c.width}:null;
      }
      return {sure:strict||agree,list};
    }
    /** The card's own picture, cut out of a sharp camera frame using the position found by wideArt. */
    async function grabLocated(){
      if(!lastBox)return null;const v=await grabVisible(1400);if(!v)return null;
      const k=v.c.width/lastBox.cw,b=lastBox.box,out=document.createElement("canvas");
      out.width=Math.round(Math.min(1100,b.w*k));out.height=Math.round(out.width*86/59);
      out.getContext("2d").drawImage(v.c,b.x*k,b.y*k,b.w*k,b.h*k,0,0,out.width,out.height);return out;
    }
    let textBusy=false,since=Date.now(),lastText=null;
    /** Reads the card's text in the background (the reader runs in its own thread). */
    function readText(card,fromPhoto){
      if(textBusy||closed)return null;textBusy=true;
      const job=(async()=>{
        try{
          const t=await readCard(card,{passOnly:!fromPhoto&&!lastText});if(closed)return null;
          lastText=t;
          const r=KodexMatch.identify(index,t);
          if(r.sure)return r;
          const art=lastArt||{list:[]};
          const both=art.list.find(a=>a.d<=16&&r.candidates.some(c=>c.card===a.card&&c.score>=0.5));
          if(both)return {card:both.card,via:"art",candidates:[both,...art.list.filter(a=>a!==both)]};
          if(t.passcode||t.setCode){const on=await onlineLookup(t);if(on){const c=index.byId.get(on.id)||{id:on.id,name:on.name};return {card:c,via:"online",candidates:[{card:c,score:1}]}}}
          const cands=[...art.list.filter(a=>a.d<=14),...r.candidates].filter((x,i,a)=>a.findIndex(y=>y.card===x.card)===i);
          if(cands.length)best={candidates:cands};
          return {card:null,candidates:cands,text:t};
        }catch(e){return {card:null,candidates:[],error:e}}
        finally{textBusy=false}
      })();
      return job;
    }
    let lastArt=null;
    async function scanOnce(card,fromPhoto,alts){
      if(busy||!card||closed)return;busy=true;$s("scShut").classList.add("busy");$s("scGuide").classList.add("reading");
      try{
        attempts++;
        if(fromPhoto)await Promise.race([getArt(),new Promise(r=>setTimeout(r,8000))]);
        let art=null;
        // Live camera: look for the card in and around the frame (never trust one crop on its own).
        if(!fromPhoto&&artIndex){const w=await grabVisible(400);if(w)art=wideArt(w)}
        if(!art)art=byArt(card);
        // A photo is rarely framed exactly on the card: also try it zoomed in, and keep the closest match.
        if(fromPhoto&&!art.sure&&alts)for(const a of alts){const x=byArt(a),t0=x.list[0],t1=x.list[1];x.sure=x.sure&&!!t0&&t0.d<=5&&(!t1||t1.d-t0.d>=4);if(x.sure||(t0&&(!art.list[0]||t0.d<art.list[0].d)))art=x;if(x.sure)break}
        lastArt=art;
        if(art.sure)return found({card:art.list[0].card,via:"art",candidates:art.list});
        if(fromPhoto){
          // A photo: read its text now (bigger image), then decide.
          const r=await readText(card,true);if(closed)return;
          if(r&&r.card)return found(r);
          return choose(best||{candidates:(r&&r.candidates)||art.list.filter(a=>a.d<=10)},true);
        }
        const near=art.list.filter(a=>a.d<=9);if(near.length)best={candidates:near};
        // Live camera: start reading text after a moment without a picture match, without waiting for it.
        if(!textBusy&&(!artIndex||Date.now()-since>1500)){
          const big=(await grabLocated())||await grab(1100);
          const job=big&&readText(big,false);
          if(job)job.then(r=>{if(!r||closed||$s("scSheet").classList.contains("on"))return;if(r.card)found(r);else if(attempts>=24&&best)choose(best);else hint(lastArt||art,null,r.text)});
        }
        if(attempts>=40&&best)return choose(best);
        hint(art);
      }catch(e){if(!closed)msg("Card reader unavailable",e.message||String(e),[["Close",()=>history.back(),true]]);stop()}
      finally{busy=false;if(!closed){$s("scShut").classList.remove("busy");$s("scGuide").classList.remove("reading")}}
    }

    // ---- Online scanning: send a steady frame, get the card's name back, pull the card by it ----
    let prevSig=null,sentSig=null,sentAt=0,lensCount=0,lensPrev=null,unsure=0;
    const sig=cv=>{const s=document.createElement("canvas");s.width=s.height=24;const x=s.getContext("2d",{willReadFrequently:true});x.drawImage(cv,0,0,24,24);const d=x.getImageData(0,0,24,24).data,o=new Uint8Array(576);for(let i=0;i<576;i++)o[i]=(d[i*4]+d[i*4+1]+d[i*4+2])/3;return o};
    const moved=(a,b)=>{if(!a||!b)return 99;let s=0;for(let i=0;i<576;i++)s+=Math.abs(a[i]-b[i]);return s/576};
    /** The camera picture around the frame, with some room for a card that isn't lined up. */
    async function lensFrame(){
      const v=await grabVisible(1400);if(!v)return null;
      const {c,g}=v,mx=g.w*.18,my=g.h*.12,x=Math.max(0,g.x-mx),y=Math.max(0,g.y-my),w=Math.min(c.width-x,g.w+2*mx),hh=Math.min(c.height-y,g.h+2*my);
      const k=Math.min(1,1000/Math.max(w,hh)),o=document.createElement("canvas");o.width=Math.round(w*k);o.height=Math.round(hh*k);
      o.getContext("2d").drawImage(c,x,y,w,hh,0,0,o.width,o.height);return o;
    }
    const lensBusy=on=>{$s("scShut").classList.toggle("busy",on);$s("scGuide").classList.toggle("reading",on)};
    /** Reports the result of an online read. */
    function lensShow(R,L,fromPhoto){
      if(closed)return;
      if(R.state==="sure"){
        if(R.weak&&!fromPhoto&&lensPrev!==R.card){lensPrev=R.card;$s("scHint").innerHTML=`Hold steady…<small>Looks like ${h(R.card.name)}</small>`;return}
        return found({card:R.card,via:"lens",candidates:R.cands&&R.cands.length?R.cands:[{card:R.card,score:1}]});
      }
      lensPrev=null;
      if(R.state==="pick"){
        if(fromPhoto||++unsure>=3){unsure=0;return choose({candidates:R.list},true)}
        $s("scHint").innerHTML=`Hold steady…<small>Looks like ${h(R.list[0].card.name)}</small>`;return;
      }
      $s("scHint").innerHTML=R.state==="none"?(fromPhoto?"No card in that photo<small>Use a photo of the whole card</small>":"Fit the whole card inside the frame<small>Hold it flat, in good light, without glare</small>"):(fromPhoto?"Couldn't read that card<small>Use a sharper, closer photo</small>":"Move closer<small>The card's text needs to be readable</small>");
    }
    /** One online read of the live camera. False when the server can't be reached (the offline scanner takes over). */
    async function lensLive(force){
      if(!lensUsable())return false;
      if(busy||closed)return true;
      const cv=await lensFrame();if(!cv||closed)return true;
      const s=sig(cv),m=moved(prevSig,s);prevSig=s;
      if(!force){
        if(Date.now()-sentAt<700)return true;
        if(m>7&&Date.now()-sentAt<3000)return true;                       // still moving
        if(!lensPrev&&!unsure&&moved(sentSig,s)<2.5&&Date.now()-sentAt<6000)return true;      // nothing new to ask about (a half-sure read is checked again at once)
        if(lensCount>=14)return true;                                       // auto reads are capped; the shutter always works
      }
      busy=true;lensBusy(true);$s("scHint").innerHTML="Searching online…<small>Hold the card steady</small>";
      try{
        sentSig=s;sentAt=Date.now();lensCount++;
        const L=await lensAsk(cv);if(closed)return true;
        if(!L)return false;
        lensShow(await lensResolve(L),L,false);return true;
      }finally{busy=false;if(!closed)lensBusy(false)}
    }
    /** One online read of a gallery photo (the whole picture, not just the middle). */
    async function lensPhoto(img){
      if(!lensUsable())return false;
      busy=true;lensBusy(true);$s("scHint").innerHTML="Searching online…<small>Reading the card</small>";
      try{
        const L=await lensAsk(scaled(img,img.naturalWidth,img.naturalHeight,1280));if(closed)return true;
        if(!L)return false;
        lensShow(await lensResolve(L),L,true);return true;
      }finally{busy=false;if(!closed)lensBusy(false)}
    }
    function hint(art,r,t){
      const guess=(art.list[0]&&art.list[0].d<=8&&art.list[0].card)||(r&&r.card);
      $s("scHint").innerHTML=guess?`Hold steady…<small>Looks like ${h(guess.name)}</small>`:(t&&(t.name||t.passcode)?"Still reading…<small>Move closer so the card fills the frame</small>":"Fit the whole card inside the frame<small>Hold it flat, in good light, without glare</small>");
    }
    let capture=null,previewing=false;
    const videoOk=()=>{const v=$s("scVideo");return v.readyState>=2&&v.videoWidth>0&&!v.paused};
    /** A camera frame: from the video when it plays, otherwise grabbed straight from the camera. */
    async function frame(){
      const v=$s("scVideo");
      if(videoOk())return {src:v,w:v.videoWidth,h:v.videoHeight};
      if(capture){try{const b=await capture.grabFrame();return {src:b,w:b.width,h:b.height}}catch(e){}}
      return null;
    }
    // Some Android WebViews give the camera to the page but never start the <video>: show the frames on a canvas instead.
    async function preview(){
      if(previewing)return;previewing=true;const c=$s("scPrev"),x=c.getContext("2d");c.hidden=false;$s("scVideo").style.visibility="hidden";
      while(!closed&&stream&&!videoOk()){
        const f=await frame();
        if(f){const r=c.getBoundingClientRect();if(c.width!==Math.round(r.width)){c.width=Math.round(r.width);c.height=Math.round(r.height)}const k=Math.max(c.width/f.w,c.height/f.h);x.drawImage(f.src,(c.width-f.w*k)/2,(c.height-f.h*k)/2,f.w*k,f.h*k);if(f.src.close)f.src.close()}
        await new Promise(r=>setTimeout(r,120));
      }
      c.hidden=true;$s("scVideo").style.visibility="";previewing=false;
    }
    async function grab(maxW=480){
      const f=await frame();if(!f)return null;
      const v=$s("scVideo"),g=$s("scGuide").getBoundingClientRect(),r=v.getBoundingClientRect(),vw=f.w,vh=f.h;
      const k=Math.max(r.width/vw,r.height/vh),ox=(r.width-vw*k)/2,oy=(r.height-vh*k)/2;
      const sx=(g.left-r.left-ox)/k,sy=(g.top-r.top-oy)/k,sw=g.width/k,sh=g.height/k;
      const c=document.createElement("canvas");c.width=Math.round(Math.min(maxW,sw));c.height=Math.round(c.width*86/59);
      c.getContext("2d").drawImage(f.src,sx,sy,sw,sh,0,0,c.width,c.height);if(f.src.close)f.src.close();return c;
    }
    let looping=false;
    async function loop(){if(looping)return;looping=true;try{while(auto&&!closed&&stream&&!$s("scSheet").classList.contains("on")){if(document.visibilityState==="visible"){if(!(lensUsable()&&await lensLive()))await scanOnce(await grab())}await new Promise(r=>setTimeout(r,lensUsable()?280:artIndex?60:350))}}finally{looping=false}}
    $s("scShut").onclick=async()=>{if(!stream)return;if(!(lensUsable()&&await lensLive(true)))scanOnce(await grab())};
    $s("scStart").onclick=async()=>{try{await $s("scVideo").play()}catch(e){}$s("scStart").hidden=true;if(!videoOk())preview()};
    $s("scAuto").onclick=()=>{auto=!auto;$s("scAuto").setAttribute("aria-pressed",String(auto));if(auto)loop()};
    $s("scTorch").onclick=async()=>{const on=$s("scTorch").getAttribute("aria-pressed")!=="true";try{await track.applyConstraints({advanced:[{torch:on}]});$s("scTorch").setAttribute("aria-pressed",String(on))}catch(e){}};
    $s("scPhoto").onchange=e=>{const f=e.target.files&&e.target.files[0];e.target.value="";if(!f)return;
      camOff();$s("scPrev").hidden=true;$s("scStart").hidden=true;$s("scSheet").classList.remove("on");
      const still=$s("scStill"),url=URL.createObjectURL(f);still.src=url;still.hidden=false;$s("scGuide").style.visibility="hidden";
      $s("scHint").innerHTML="Searching this photo…<small>The camera is off</small>";
      const img=new Image();img.onload=async()=>{attempts=0;best=null;lastTop=null;if(!(await lensPhoto(img)))await scanOnce(photoCard(img),true,photoFramings(img));$s("scGuide").style.visibility=""};img.onerror=()=>{$s("scHint").innerHTML="That photo couldn't be opened<small>Try another photo</small>";$s("scGuide").style.visibility=""};img.src=url};

    getArt();
    try{await getIndex()}catch(e){msg("Scanner unavailable",e.message,[["Close",()=>history.back(),true]]);return}
    getArt().then(a=>{if(!a&&!closed)getReader().catch(()=>{})});
    async function startCamera(){
      $s("scLoad").hidden=false;$s("scLoad").textContent="Starting camera…";
      try{
        if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw Object.assign(new Error("no camera"),{name:"NotFoundError"});
        stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}}});
        if(closed){stop();return}
        const v=$s("scVideo");v.srcObject=stream;
        track=stream.getVideoTracks()[0];
        try{if("ImageCapture" in window)capture=new ImageCapture(track)}catch(e){}
        await Promise.race([v.play().catch(()=>{}),new Promise(r=>setTimeout(r,3000))]);
        for(let i=0;i<12&&!videoOk();i++)await new Promise(r=>setTimeout(r,250));
        if(!videoOk()){
          const f=capture?await frame():null;
          if(f){if(f.src.close)f.src.close();preview()}
          else if(track.readyState==="live")$s("scStart").hidden=false;
          else throw Object.assign(new Error("The camera stopped ("+track.readyState+")."),{name:"CameraStopped"});
        }
        try{const caps=track.getCapabilities?track.getCapabilities():{};if(caps.torch)$s("scTorch").hidden=false}catch(e){}
        try{await track.applyConstraints({advanced:[{focusMode:"continuous"}]})}catch(e){}
        $s("scLoad").hidden=true;since=Date.now();loop();
      }catch(e){
        $s("scLoad").hidden=true;
        const denied=e&&(e.name==="NotAllowedError"||e.name==="SecurityError");
        if(e&&e.name==="CameraStopped"){msg("The camera didn't start",e.message+" Close other apps using the camera and try again, or scan a photo.",[["Choose a photo",()=>{$s("scMsg").classList.remove("on");$s("scPhoto").click()},true],["Close",()=>history.back()]]);return}
        msg(denied?"Camera access is off":"No camera available",denied?"Allow camera access for KodeX in your phone's settings (Apps → KodeX → Permissions), or scan a photo instead.":"You can still scan a photo of a card.",[["Choose a photo",()=>{$s("scMsg").classList.remove("on");$s("scPhoto").click()},true],["Close",()=>history.back()]]);
      }
    }
    startCamera();
  };
  const btn=document.getElementById("bScan");if(btn)btn.onclick=()=>{if(window.scanGate&&!window.scanGate())return;openScanner()};
})();
