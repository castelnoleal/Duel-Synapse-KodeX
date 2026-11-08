/* ---------- deck events ---------- */
$('bDecks').onclick=openDeckPanel;
let _dkSup=()=>suppressDeckClick;
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(_dkSup()&&b.hasAttribute('data-dragcard')){e.preventDefault();e.stopPropagation();return}
  const D=b.dataset,top=()=>(L[L.length-1]||'').startsWith('m:');
  if(D.quickview!==undefined){quickView(D.quickview);return}
  if(D.cltab){cardListModal(D.cltab);return}
  if(D.cardlist!==undefined){cardListModal('main');return}
  if(b.hasAttribute('data-arena')){openArena('');return}
  if(D.analyze){openAnalyzer(D.analyze);return}   if(D.playtest){if(topIsModal())closeModal();const d=deckById(D.playtest);if(d)setTimeout(()=>openPlaytest(d),topIsModal()?90:0);return}
  if(D.exportmenu){exportMenu(D.exportmenu);return}
  if(D.favview){quickView(D.favview);return}
  if(D.favadd){const c=M.get(String(D.favadd));if(c)addCardToDeck(c);return}
  if(D.dknew!==undefined){deckForm(null,(n,i)=>{createDeck(n,i);openDeckPanel()});return}
  if(D.viewdeck){showDeck(D.viewdeck);return}
  if(D.dkpaste!==undefined){pasteDeckModal();return}
  if(D.legal){legalityModal(D.legal);return}
  if(D.matchlog){matchLogModal(D.matchlog);return}
  if(D.copyydke){const d=deckById(D.copyydke);if(d){const t=ydkeEncode(d);if(topIsModal())closeModal();setTimeout(()=>copyText(t,'Copied deck link'),120)}return}
  if(D.copytext){const d=deckById(D.copytext);if(d){const t=textListOf(d);if(topIsModal())closeModal();setTimeout(()=>copyText(t,'Copied text list'),120)}return}
  if(D.copyydk){window.__ydkCopy=true;exportYdk(D.copyydk);setTimeout(()=>{if(topIsModal())closeModal()},250);return}
  if(D.exportydk){exportYdk(D.exportydk);setTimeout(()=>{if(topIsModal())closeModal()},250);return}
  if(D.pdfdeck){const id=D.pdfdeck;if(topIsModal())closeModal();setTimeout(()=>pdfForm(id),90);return}
  if(D.poster){exportDeckPoster(D.poster);return}
  if(D.editdeck){const a=deckById(D.editdeck);if(a)deckForm(a,(n,i)=>{const all=deckStore(),x=all.find(v=>v.id===a.id);if(x){x.name=n.slice(0,60);x.icon=i;saveDecks(all)}window.activeDeckId&&String(window.activeDeckId)===String(a.id)?showDeck(a.id):openDeckPanel()});return}
  if(D.deletedeck){const a=deckById(D.deletedeck);if(a)confirmBox(`Delete “${a.name}”?`,'Delete',()=>{saveDecks(deckStore().filter(x=>x.id!==a.id));openDeckPanel()});return}
  if(D.removefromdeck){const a=deckStore(),d=a.find(x=>x.id===D.removefromdeck);if(d){dropCopy(d,D.cardid,D.sec||'main');saveDecks(a);showDeck(d.id);refreshCardList()}return}
  if(b.id==='deckBack'){if(L[L.length-1]==='dv')history.back();else openDeckPanel();return}
});
$('tb').addEventListener('dragstart',e=>{const b=e.target.closest('[data-dragcard]');if(!b)return;b.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',JSON.stringify({cardId:b.dataset.dragcard,from:b.dataset.fromsec,deckId:window.activeDeckId}))});
$('tb').addEventListener('dragend',e=>{const b=e.target.closest('[data-dragcard]');if(b)b.classList.remove('dragging');document.querySelectorAll('.deck-section.drag-target').forEach(x=>x.classList.remove('drag-target'))});
$('tb').addEventListener('dragover',e=>{const sec=e.target.closest('[data-dropsection]');if(!sec)return;e.preventDefault();e.dataTransfer.dropEffect='move';sec.classList.add('drag-target')});
$('tb').addEventListener('dragleave',e=>{const sec=e.target.closest('[data-dropsection]');if(sec&&!sec.contains(e.relatedTarget))sec.classList.remove('drag-target')});
$('tb').addEventListener('drop',e=>{const sec=e.target.closest('[data-dropsection]');if(!sec)return;e.preventDefault();sec.classList.remove('drag-target');try{const p=JSON.parse(e.dataTransfer.getData('text/plain'));if(String(p.deckId)===String(sec.dataset.dropdeck))moveCopy(p.deckId,p.cardId,p.from,sec.dataset.dropsection)}catch(err){}});
let touchDeckDrag=null,suppressDeckClick=false;
function clearTouchDrag(){if(touchDeckDrag&&touchDeckDrag.timer)clearTimeout(touchDeckDrag.timer);document.querySelectorAll('.deck-section.drag-target').forEach(x=>x.classList.remove('drag-target'));document.querySelectorAll('.deck-card-thumb.dragging,.drag-ready').forEach(x=>x.classList.remove('dragging','drag-ready'));touchDeckDrag=null}
$('tb').addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;const b=e.target.closest('[data-dragcard]');if(!b)return;clearTouchDrag();const st={el:b,id:b.dataset.dragcard,from:b.dataset.fromsec,deckId:window.activeDeckId,x:e.clientX,y:e.clientY,armed:false,dragging:false,timer:null};touchDeckDrag=st;st.timer=setTimeout(()=>{if(touchDeckDrag===st){st.armed=true;b.classList.add('drag-ready')}},600)},{passive:true});
$('tb').addEventListener('pointermove',e=>{const st=touchDeckDrag;if(!st)return;const dist=Math.hypot(e.clientX-st.x,e.clientY-st.y);if(!st.armed&&!st.dragging){if(dist>10){clearTimeout(st.timer);touchDeckDrag=null}return}if(st.armed&&dist>8){st.dragging=true;st.el.classList.add('dragging');const u=document.elementFromPoint(e.clientX,e.clientY),tgt=u&&u.closest('[data-dropsection]');document.querySelectorAll('.deck-section').forEach(x=>x.classList.toggle('drag-target',x===tgt));e.preventDefault()}},{passive:false});
$('tb').addEventListener('pointerup',e=>{const st=touchDeckDrag;if(!st)return;if(st.timer)clearTimeout(st.timer);if(st.dragging){suppressDeckClick=true;setTimeout(()=>{suppressDeckClick=false},450);const el=document.elementFromPoint(e.clientX,e.clientY),sec=el&&el.closest('[data-dropsection]');clearTouchDrag();if(sec&&String(sec.dataset.dropdeck)===String(st.deckId))moveCopy(st.deckId,st.id,st.from,sec.dataset.dropsection);return}clearTouchDrag()},{passive:true});
$('tb').addEventListener('pointercancel',clearTouchDrag);
document.addEventListener('change',e=>{
  if(e.target.id==='ydkImport'&&e.target.files&&e.target.files[0])importYdk(e.target.files[0]).catch(err=>toast('Import failed: '+err.message));
  if(e.target.id==='posterBg'&&e.target.files&&e.target.files[0])loadPosterBackground(e.target.files[0]).catch(err=>toast('Could not load background'));
});

$('bHis').onclick=()=>{const a=S.g('hist',[]);tool('Search History',a.length?`<button class="btn" id="hc" style="margin:10px 0">Clear history</button>`+a.map(x=>`<button class="lnk" style="background:none;border:0;border-top:1px solid var(--line);width:100%;text-align:left" data-s="${esc(x)}">⌕ ${esc(x)}</button>`).join(''):'<p class="note">No searches recorded yet.</p>');const h=$('hc');if(h)h.onclick=()=>{S.s('hist',[]);history.back()}};
$('tb').addEventListener('click',e=>{const o=e.target.closest('[data-open]'),s=e.target.closest('[data-s]');if(o)openCard(o.dataset.open);if(s){q.value=s.dataset.s;hideAll();settle();run()}});
$('bAbout').onclick=()=>tool('Legal & Privacy',`<div class="about"><h4>License</h4><p>Duel Synapse: KodeX and the Duel Arena are a project of Meta Insider OCG (MEIOCG), since 2023.</p><p>© 2023–2026 Meta Insider OCG. All rights reserved. KodeX, the Duel Arena and their features, code, design, artwork, animations, sounds, name and logos are protected by copyright. They may not be copied, modified, redistributed, republished, decompiled, disassembled or otherwise reverse engineered without written permission. Ask first: <a href="mailto:metainsiderocg@gmail.com?subject=KodeX%20permission%20request">metainsiderocg@gmail.com</a>. Full terms: <a href="https://kodex.meiocg.org/license" target="_blank" rel="noopener">kodex.meiocg.org/license</a>.</p><p>The Duel Arena includes open-source components (the ygopro-core rules engine and Project Ignis card scripts). They are not MEIOCG materials: they stay under their own licences (GNU AGPL-3.0) and anyone may use them as those licences allow. Details: Arena › Licences &amp; notices.</p><h4>Disclaimer</h4><p>Duel Synapse: KodeX is an independent project founded by Meta Insider OCG. It is not affiliated with, sponsored by, endorsed by, or approved by ©Studio Dice, SHUEISHA, TV Tokyo, or Konami. Some images, card artwork and card information are the property of ©Studio Dice/SHUEISHA, TV Tokyo, and Konami.</p><h4>Rulings</h4><p>Provided by Konami OCG Japan, publicly mirrored and translated by YGOrganization, and delivered through the Duel Synapse/MEIOCG server.</p><h4>Privacy</h4><p>KodeX has no accounts and no analytics. Settings, favorites, decks, history and downloaded data stay on your device. Card and ruling requests go to kodex.meiocg.org. Translation is optional: only when you tap “Translate to English”, that ruling’s text is sent to translate.meiocg.org (or api.mymemory.translated.net if it is unavailable) and is not linked to you. Sponsored banners, when shown, may open external links. In online duels, your name, deck list, chat and chosen sleeves and field are relayed to the players in your room and are not kept afterwards. Full policy: <a href="https://kodex.meiocg.org/privacy-policy" target="_blank" rel="noopener">kodex.meiocg.org/privacy-policy</a>.</p><h4>Fair use</h4><p>Third-party material is used for identification, reference, commentary, research and community information. If you are a rights holder with a concern, contact metainsiderocg@gmail.com.</p><p class="ver">KodeX ${document.querySelector('meta[name=kodex-build]').content.replace('KODEX-','')}</p></div>`);

