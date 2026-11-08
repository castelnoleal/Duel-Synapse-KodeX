/* ---------- favorites, membership, add-to-deck options ---------- */
const isFav=c=>fav().some(x=>String(x.id)===String(c.id));
function toggleFav(c){const a=fav(),i=a.findIndex(x=>String(x.id)===String(c.id));if(i>=0)a.splice(i,1);else a.unshift({id:c.id,name:c.name});S.s('fav',a.slice(0,500));return i<0}
const favHTML=on=>`${ic('star',18)}${on?'Favorited':'Add to favorites'}`;
function setFavBtn(b,on){b.innerHTML=favHTML(on);b.classList.toggle('fav-on',on);b.setAttribute('aria-pressed',on)}
const extraType=c=>/\b(fusion|synchro|xyz|link)\b/i.test(c.type||'');
const secsFor=c=>extraType(c)?['extra','side']:['main','side'];
const SEC={main:'Main',extra:'Extra',side:'Side'};
const membership=c=>deckStore().map(d=>{const xs=d.cards.filter(v=>String(v.id)===String(c.id));return xs.length?`${d.name} · ${xs.map(x=>SEC[x.section]+(x.qty>1?' ×'+x.qty:'')).join(', ')}`:null}).filter(Boolean);
function refreshMemb(){document.querySelectorAll('.memb').forEach(el=>{const c=M.get(String(el.dataset.membid));if(!c)return;const a=membership(c);el.innerHTML=a.length?`<span class="mb-l">In decks</span>${a.map(x=>`<em>${esc(x)}</em>`).join('')}`:''})}
function refreshDecksOpen(){if(L.includes('tool')&&$('tt').textContent==='Decks'){window.activeDeckId?showDeck(window.activeDeckId):openDeckPanel()}}
function addCardToDeck(c){
  if(!deckStore().length){deckForm(null,(n,i)=>{const d=createDeck(n,i);if(d)addPicker(c,d.id)});return}
  addPicker(c);
}
function addPicker(c,pre){
  const secs=secsFor(c),first=deckStore().find(d=>copiesOf(d,c)<3)||deckStore()[0];
  let dk=pre||first.id,sc=secs[0];
  const m=openModal('','big','pk');
  const draw=()=>{
    const ds=deckStore(),d=ds.find(x=>x.id===dk)||ds[0],n=d?copiesOf(d,c):0,full=d&&cnt(d,sc)>=CAP[sc],blocked=n>=3||full;
    m.firstChild.innerHTML=`<div class="dk-hd"><h3>Add to deck</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div><p class="pk-card">${esc(c.name)}</p><div class="pk-l">Deck</div><div class="dk-pickl">${ds.map(x=>{const k=copiesOf(x,c);return `<button class="dk-open${x.id===dk?' sel':''}" data-pkdeck="${esc(x.id)}">${deckIcon(x,40)}<span class="dk-t"><b>${esc(x.name)}</b><small>${deckTotal(x)} cards${k?' · ×'+k+' of this card':''}</small></span></button>`}).join('')}</div><div class="pk-l">Section</div><div class="seg-w">${secs.map(k=>`<button class="seg${k===sc?' on':''}" data-pksec="${k}">${SEC[k]}</button>`).join('')}</div><div class="dact"><button class="btn" data-pknew>${ic('plus',18)}New deck</button><button class="btn p" data-pkgo${blocked?' disabled':''}>${n>=3?'Maximum 3 copies':full?SEC[sc]+' deck is full':'Add to '+SEC[sc]}</button></div>`;
  };
  draw();
  m.addEventListener('click',ev=>{
    const b=ev.target.closest('button');if(!b)return;
    if(b.dataset.pkdeck){dk=b.dataset.pkdeck;draw()}
    else if(b.dataset.pksec){sc=b.dataset.pksec;draw()}
    else if(b.hasAttribute('data-pknew')){deckForm(null,(n,i)=>{const d=createDeck(n,i);if(d){dk=d.id;draw()}})}
    else if(b.hasAttribute('data-pkgo')){const a=deckStore(),d=a.find(x=>x.id===dk);if(!d)return;const r=addCopy(d,c,sc);if(r!=='ok'){toast(r);return}saveDecks(a);closeModal();toast(`Added · ${d.name} · ${SEC[sc]}`);setTimeout(()=>{refreshMemb();refreshDecksOpen()},140)}
  });
}
function quickView(id){
  const dcd=deckById(window.activeDeckId),dc=dcd&&dcd.cards.find(x=>String(x.id)===String(id)),c=(dc&&resolveDeckCard(dc))||M.get(String(id))||cards.find(x=>String(x.kid)===String(id));
  if(!c){openModal(`<div class="dk-hd"><h3>${esc(dc?dc.name:'Card')}</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div><p class="note">Details unavailable${dc?' · Passcode '+esc(dc.id):''}</p>`);return}
  const img=deckCardImageUrl(c),sec=dc?dc.section:'';
  const m=openModal(`<div class="dk-hd"><h3>${esc(c.name)}</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div><div class="qv-scroll"><div class="qv">${img?`<img src="${esc(img)}" alt="">`:''}<div class="qvt"><p class="meta">${esc(c.type||'')}${c.atk!=null?' · ATK '+esc(c.atk)+(c.def!=null?' / DEF '+esc(c.def):''):''}</p><p>${esc(c.desc||'Details unavailable')}</p><small>Passcode ${esc(c.id)}</small></div></div><div class="qv-act"><button class="btn fav" data-qvfav></button><button class="btn" data-qvadd>${ic('plus',18)}Add to deck</button><button class="btn" data-qvrul>${ic('list',18)}Rulings</button></div><div class="memb" data-membid="${esc(c.id)}"></div>${dcd?`<div class="pk-l">Copies in deck</div><div class="qv-steps" id="qvsteps"></div>`:''}<div class="qv-rul" id="qvrul" hidden></div></div>`,'big','qv');
  const fb=m.querySelector('[data-qvfav]');setFavBtn(fb,isFav(c));refreshMemb();
  const steps=()=>{const box=m.querySelector('#qvsteps');if(!box)return;const d=deckById(window.activeDeckId);if(!d)return;const ks=[...new Set([...secsFor(c),...d.cards.filter(x=>String(x.id)===String(c.id)).map(x=>x.section)])],tot=copiesOf(d,c);box.innerHTML=ks.map(k=>{const e=d.cards.find(x=>String(x.id)===String(c.id)&&x.section===k),q=e?e.qty:0;return `<div class="stp"><span>${SEC[k]}</span><button class="ibtn" data-qvstep="${k}:-1" aria-label="Remove one from ${SEC[k]}"${q?'':' disabled'}>−</button><b>${q}</b><button class="ibtn" data-qvstep="${k}:1" aria-label="Add one to ${SEC[k]}"${tot>=3||cnt(d,k)>=CAP[k]?' disabled':''}>+</button></div>`}).join('')+`<small class="stp-t">${tot} of 3 copies</small>`};steps();
  m.addEventListener('click',ev=>{
    const b=ev.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-qvfav')){const on=toggleFav(c);setFavBtn(b,on);toast(on?'Added to favorites':'Removed from favorites');refreshDecksOpen&&!window.activeDeckId&&refreshDecksOpen()}
    else if(b.dataset.qvstep){const [k,dl]=b.dataset.qvstep.split(':'),a=deckStore(),d=a.find(x=>String(x.id)===String(window.activeDeckId));if(!d)return;if(+dl>0){const r=addCopy(d,c,k);if(r!=='ok'){toast(r);return}}else dropCopy(d,c.id,k);saveDecks(a);showDeck(d.id);steps();refreshCardList();refreshMemb()}
    else if(b.hasAttribute('data-qvadd'))addCardToDeck(c);
    else if(b.hasAttribute('data-qvrul')){
      const box=m.querySelector('#qvrul'),dlg=m.firstChild;
      if(box.hidden){box.hidden=false;dlg.classList.add('xl');b.classList.add('on');box.innerHTML='<p class="note">Loading rulings…</p>';cur=c;rulings(c,'qvrul').then(()=>{if(box.isConnected)box.scrollIntoView({block:'start',behavior:'smooth'})})}
      else{box.hidden=true;dlg.classList.remove('xl');b.classList.remove('on')}
    }
  });
}

function exportMenu(id){openModal(`<div class="dk-hd"><h3>Export</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div><div class="dk-opts"><button class="opt" data-poster="${esc(id)}">${ic('image')}<b>Deck image</b></button><button class="opt" data-pdfdeck="${esc(id)}">${ic('file')}<b>PDF deck list</b></button><button class="opt" data-exportydk="${esc(id)}">${ic('down')}<b>.ydk file</b></button><button class="opt" data-copyydk="${esc(id)}">${ic('list')}<b>Copy .ydk</b></button><button class="opt" data-copyydke="${esc(id)}">${ic('list')}<b>Copy deck link (ydke://)</b></button><button class="opt" data-copytext="${esc(id)}">${ic('file')}<b>Copy text list</b></button><a class="opt" href="https://www.yugioh-card.com/en/downloads/forms/KDE_DeckList.pdf" target="_blank" rel="noopener">${ic('file')}<b>Konami form</b></a></div>`)}

