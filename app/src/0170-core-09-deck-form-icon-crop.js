/* ---------- deck form + icon crop ---------- */
function cropIcon(file,done){
  const img=new Image(),url=URL.createObjectURL(file);
  img.onerror=()=>{URL.revokeObjectURL(url);toast('Image could not be opened')};
  img.onload=()=>{
    const V=280,m=openModal(`<h3>Adjust icon</h3><div class="crop"><canvas id="cv" width="${V}" height="${V}"></canvas></div><input id="cz" class="zoom" type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom"><div class="dact"><button class="btn" data-close>Cancel</button><button class="btn p" id="cok">Use icon</button></div>`),
      cv=m.querySelector('#cv'),cx=cv.getContext('2d'),w=img.naturalWidth,h=img.naturalHeight,s0=Math.max(V/w,V/h);
    let z=1,ox=(V-w*s0)/2,oy=(V-h*s0)/2,p=null;
    const draw=()=>{const dw=w*s0*z,dh=h*s0*z;ox=Math.min(0,Math.max(V-dw,ox));oy=Math.min(0,Math.max(V-dh,oy));cx.fillStyle='#000';cx.fillRect(0,0,V,V);cx.drawImage(img,ox,oy,dw,dh)};
    draw();
    m.querySelector('#cz').oninput=e=>{const nz=+e.target.value,a=(V/2-ox)/(s0*z),b=(V/2-oy)/(s0*z);z=nz;ox=V/2-a*s0*z;oy=V/2-b*s0*z;draw()};
    cv.onpointerdown=e=>{p={x:e.clientX,y:e.clientY,ox,oy};cv.setPointerCapture(e.pointerId)};
    cv.onpointermove=e=>{if(!p)return;const k=V/cv.getBoundingClientRect().width;ox=p.ox+(e.clientX-p.x)*k;oy=p.oy+(e.clientY-p.y)*k;draw()};
    cv.onpointerup=cv.onpointercancel=()=>{p=null};
    m.querySelector('#cok').onclick=()=>{const o=document.createElement('canvas');o.width=o.height=192;const k=192/V;o.getContext('2d').drawImage(img,ox*k,oy*k,w*s0*z*k,h*s0*z*k);const u=o.toDataURL('image/jpeg',.88);URL.revokeObjectURL(url);closeModal();setTimeout(()=>done(u),90)};
  };
  img.src=url;
}
function deckForm(d,after){
  let icon=d?d.icon||'':'';
  const m=openModal(`<h3>${d?'Edit deck':'New deck'}</h3><div class="dk-form"><button type="button" class="dk-pick" id="dfIcon" aria-label="Choose icon"></button><input id="dfName" class="fld" maxlength="60" placeholder="Deck name" value="${esc(d?d.name:'')}"></div><input id="dfFile" type="file" accept="image/*" hidden><div class="dact">${d&&d.icon?'<button class="btn" id="dfClr">Remove icon</button>':''}<button class="btn" data-close>Cancel</button><button class="btn p" id="dfOk">${d?'Save':'Create'}</button></div>`);
  const paint=()=>{m.querySelector('#dfIcon').innerHTML=icon?`<img src="${icon}" alt="">`:ic('cam',26)};paint();
  m.querySelector('#dfIcon').onclick=()=>m.querySelector('#dfFile').click();
  m.querySelector('#dfFile').onchange=e=>{const f=e.target.files[0];e.target.value='';if(f)cropIcon(f,u=>{icon=u;paint()})};
  const clr=m.querySelector('#dfClr');if(clr)clr.onclick=()=>{icon='';paint();clr.remove()};
  m.querySelector('#dfOk').onclick=()=>{const n=m.querySelector('#dfName').value.trim();if(!n){toast('Enter a deck name');return}closeModal();setTimeout(()=>after(n,icon),90)};
  setTimeout(()=>{const f=m.querySelector('#dfName');if(f)f.focus()},120);
}

