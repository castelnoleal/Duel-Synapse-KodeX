
/* ---------- KodeX 9.0 (loaded last: these replace earlier versions) ---------- */
/* ===== showdowns: one set of styles for the winning blow and for Ace cards ===== */
const SHOW_DESC={menacing:'Rumbling ゴゴゴ letters around your card',rush:'A barrage of blows and RUSH! RUSH!',timestop:'Everything freezes in grey around your card',freeze:'Sepia freeze frame with TO BE CONTINUED',domain:'A void swallows the screen, a sigil turns behind your card',allout:'Red and black comic panels, cut-out title',impact:'Black-and-white impact frames on every hit',destiny:'One card flies from the deck in gold and turns over',finalblow:'Slow zoom, flash, then K.O.!',powerup:'A golden aura bursts, the ground shakes',beam:'Energy gathers, then a beam crosses the screen',spotlight:'A spotlight and a turning reveal',radiant:'Golden rays from behind your card',random:'A different one each time'};
const showName=k=>k==='random'?'Random':((FINALE_T.find(x=>x[0]===k)||['',k])[1]);
const finaleMs=()=>{const v=Number(S.g('finale_ms',3300));return Number.isFinite(v)?Math.min(5000,Math.max(3000,Math.round(v/100)*100)):3300};
function sigShow(){const o=S.g('sig_show',{}),out={};if(o&&typeof o==='object')for(const k of sigCards())if(o[k]==='random'||FINALE_T.some(x=>x[0]===o[k]))out[k]=o[k];return out}
function showTiles(kind,sel){const all=[...FINALE_T,['random','Random']];return `<div class="st-grid show-row" role="radiogroup" aria-label="${kind==='finale'?'Winning blow':'Ace showdown'}">${all.map(([k,l])=>{const lock=!PREMIUM&&kind==='finale'&&k!=='menacing';return `<button type="button" class="st-tile sh-${k}${sel===k?' on':''}${lock?' prem':''}" role="radio" aria-checked="${sel===k}" data-show="${kind}" data-showk="${k}" title="${esc(SHOW_DESC[k]||'')}"><i class="st-ic">${SHOW_ICON[k]||''}</i><span>${l}</span>${lock?'<em class="st-lock" aria-label="KodeX Premium">★</em>':''}</button>`}).join('')}</div>`}
function previewShow(kind,k){const l=showName(k),ms=kind==='finale'?finaleMs():0;openModal(`<div class="dk-hd"><h3>${esc(l)} · ${kind==='finale'?'winning blow':'Ace card'}</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div><iframe class="pv-wrap" title="Preview" src="${ARENA_URL}preview.html#${kind}:${k}${ms?':'+ms:''}"></iframe><p class="note">${kind==='finale'?`Plays for ${(ms/1000).toFixed(1)} seconds before the blow that wins the duel: an attack, or a Spell, Trap or effect that deals the last damage. Everyone in the duel sees it.`:'Your Ace cards (any card type) are shown on the big screen before their effect resolves.'}${k==='random'?' Random picks a different showdown each time; both players see the same one.':''}${PREMIUM?'':kind==='finale'?' Free edition: Menacing. The others come with KodeX Premium.':' Ace cards come with KodeX Premium.'}</p>`,'','pv')}

/* ===== the Arena gets card passcodes (cards are saved by Konami ID in KodeX) ===== */
let KP=null,KPn=0;
function pcode(id){id=String(id);if(!KP||KPn!==cards.length){KP=new Map();KPn=cards.length;for(const c of cards)if(c.kid)KP.set(String(c.kid),String(c.id))}return KP.get(id)||id}
const pcKeys=o=>{const out={};for(const [k,v] of Object.entries(o||{}))out[pcode(k)]=v;return out};
function skinsToArena(){const f=$('arenaFrame');if(!PREMIUM||!f||!f.contentWindow)return;const voices={};for(const id of sigCards()){const v=MEDIA.voices[id];if(v&&v.snd)voices[pcode(id)]=v.snd}
 try{f.contentWindow.postMessage({kx:'skin',premium:PREMIUM,sleeve:skinImg('sleeve'),xsleeve:skinImg('xsleeve'),field:fieldSkin(),signature:sigCards().map(pcode).map(Number),finisher:finStyle(),sigFx:pcKeys(sigFx()),entrance:entStyle(),attack:atkStyle(),entFx:pcKeys(perCardFx('sig_ent',ENT_T)),atkFx:pcKeys(perCardFx('sig_atk',ATK_T)),finale:finaleStyle(),aceStyle:aceStyle(),aces:aceCards().map(pcode).map(Number),finaleMs:finaleMs(),showFx:pcKeys(sigShow()),emotes:MEDIA.emotes.map(x=>({name:x.name,src:x.src,snd:x.snd||''})),sounds:MEDIA.sounds.map(x=>({name:x.name,snd:x.snd})),voices},'*')}catch(e){}audioToArena()}

/* ===== Premium Studio: everything Premium in one organized place ===== */
const STUDIO_TABS=[['look','Look'],['moves','Moves'],['shows','Showdowns'],['cards','Cards'],['emotes','Emotes'],['sound','Sound']];
let studioTab=S.g('studio_tab','look');
const sCard=(title,desc,body,extra='')=>`<section class="st-card"${extra}><div class="st-hd"><h4>${title}</h4>${desc?`<p>${desc}</p>`:''}</div>${body}</section>`;
function cardOf(id){return M.get(String(id))||cards.find(v=>String(v.kid)===String(id))||null}
function cardThumb(c){if(!c)return '';const u=c.sm||c.img||(c.id?'https://images.ygoprodeck.com/images/cards_small/'+c.id+'.jpg':'');return u?`<img data-u="${esc(u)}" alt="" loading="lazy">`:''}
function sigRows(){const a=sigCards(),aces=new Set(aceCards().map(String)),sh=sigShow(),fx=S.g('sig_fx',{})||{},en=S.g('sig_ent',{})||{},at=S.g('sig_atk',{})||{};
 if(!a.length)return '<div class="st-empty"><b>No signature cards yet</b><span>Search above to add your favourite cards. Bosses (3000+ ATK, Level 8+, Link 4+) always get an entrance.</span></div>';
 return a.map(id=>{const c=cardOf(id)||{},chips=[aces.has(id)?'<em class="ch ace">★ Ace</em>':'',sh[id]?`<em class="ch">${esc(showName(sh[id]))}</em>`:'',fx[id]?`<em class="ch">${esc((FIN_T.find(x=>x[0]===fx[id])||['',''])[1])}</em>`:'',en[id]?`<em class="ch">${esc((ENT_T.find(x=>x[0]===en[id])||['',''])[1])}</em>`:'',at[id]?`<em class="ch">${esc((ATK_T.find(x=>x[0]===at[id])||['',''])[1])}</em>`:'',MEDIA.voices[id]?'<em class="ch">🎙 Voice</em>':''].filter(Boolean).join('');
  return `<button type="button" class="st-sig" data-sigopen="${esc(id)}"><span class="st-th">${cardThumb(c)}</span><span class="st-sigt"><b>${esc(c.name||id)}</b><small>${esc(String(c.type||'').replace(/ Card$/,''))}</small><span class="st-chips">${chips||'<em class="ch dim">Default moves</em>'}</span></span><span class="st-go" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></span></button>`}).join('')}
function openSkins(){
 const sel=skinSel(),all=[...skinPacks(),...skinsOwn()],chk='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
 if(!STUDIO_TABS.some(t=>t[0]===studioTab))studioTab='look';
 const look=SKIN_T.map(([t,l])=>sCard(l,t==='field'?'Your half of the duel field. Your opponent sees it too.':t==='sleeve'?'The back of your Main Deck cards.':'The back of your face-down Extra Deck cards.',`<div class="sk-row sk-${t}" role="listbox" aria-label="${l}"><button class="sk-t sk-none${!sel[t]?' on':''}" data-skin="" data-skt="${t}" role="option" aria-selected="${!sel[t]}"><span>Default</span>${!sel[t]?`<em>${chk}</em>`:''}</button>${all.filter(x=>x.type===t).map(x=>`<button class="sk-t${sel[t]===x.id?' on':''}" data-skin="${esc(x.id)}" data-skt="${t}" role="option" aria-selected="${sel[t]===x.id}" style="background-image:url('${safeImg(x.img)}')" aria-label="${esc(x.name||'Skin')}">${sel[t]===x.id?`<em>${chk}</em>`:''}${x.pre?'':`<i data-skdel="${esc(x.id)}" role="button" aria-label="Delete">×</i>`}</button>`).join('')}<label class="sk-t sk-add" aria-label="Add from gallery"><span>+</span><input type="file" accept="image/*" data-skadd="${t}" hidden></label></div>${t==='field'&&sel.field?'<button class="btn st-wide" data-fieldedit>Adjust zoom, position and darkness</button>':''}`)).join('')
  +sCard('KodeX effects','',`<label class="st-switch"><span><strong>MEIOCG animations</strong><small>Moving background, floating MEIOCG cards and animated lists in KodeX</small></span><input type="checkbox" data-kxfx ${S.g('kx_fx',true)?'checked':''}><i aria-hidden="true"></i></label>`);
 const moves=sCard('Finishing move','How your opponent\'s field breaks when you win.',`${finTiles(finStyle())}<button type="button" class="btn st-pv" data-finpv>▶ Preview ${FIN_T.find(x=>x[0]===finStyle())[1]}</button>`)
  +sCard('Entrance','How your monsters arrive on the field. Everyone in the duel sees it.',`${mvTiles('ent',entStyle())}<button type="button" class="btn st-pv" data-mvpv="ent">▶ Preview ${ENT_T.find(x=>x[0]===entStyle())[1]}</button>`)
  +sCard('Attack','How your monsters attack. The target is always marked.',`${mvTiles('atk',atkStyle())}<button type="button" class="btn st-pv" data-mvpv="atk">▶ Preview ${ATK_T.find(x=>x[0]===atkStyle())[1]}</button>`);
 const ms=finaleMs();
 const shows=sCard('Winning blow','Plays before the blow that wins the duel: an attack, or a Spell, Trap or effect that deals the last damage. Cards with their own showdown (in Cards) use theirs.',`${showTiles('finale',finaleStyle())}<div class="st-slider"><label for="stMs"><strong>Length</strong><output id="stMsV">${(ms/1000).toFixed(1)} s</output></label><input id="stMs" type="range" min="3000" max="5000" step="100" value="${ms}" data-finms aria-label="Length of the winning blow"></div><button type="button" class="btn st-pv" data-showpv="finale">▶ Preview ${esc(showName(finaleStyle()))}</button>`)
  +sCard('Ace showdown','Your Ace cards (any card type: monsters, Spells, Traps) fill the screen before their effect resolves. Mark Ace cards in Cards.',`${showTiles('ace',aceStyle())}<button type="button" class="btn st-pv" data-showpv="ace">▶ Preview ${esc(showName(aceStyle()))}</button>`);
 const cardsP=sCard('Signature cards','Your cards with the full show. Tap a card to choose its showdown, finishing move, entrance, attack and voice, or make it an Ace card.',`<div class="st-search"><input data-sigq placeholder="Add a card by name" aria-label="Add a signature card" autocomplete="off"><div data-sigres class="st-res"></div></div><div class="st-sigs" data-siglist>${sigRows()}</div><p class="note">${sigCards().length}/60 cards · ${aceCards().length}/12 Ace cards</p>`);
 const emotes=emotesSection()+soundsSection();
 const sound=sCard('Music &amp; sounds','MP3, M4A, OGG or WAV. Music up to 8 MB, sounds up to 1 MB. Played in the Arena on this device.',`<div class="snd-list">${SND_T.map(([k,l])=>`<div class="snd-row" data-snd="${k}"><span><strong>${l}</strong><small data-sndname>Default</small></span><label class="btn">Choose<input type="file" accept="audio/*" data-sndadd="${k}" hidden></label><button class="btn" data-snddel="${k}" hidden>Reset</button></div>`).join('')}</div>`);
 const panes={look,moves,shows,cards:cardsP,emotes,sound};
 tool('Premium Studio',`<div class="studio"><div class="st-hero"><img src="${(document.querySelector('header .logo img')||{}).src||''}" alt="" onerror="this.remove()"><div><b>KodeX Premium</b><span>Make every duel yours. Your look, moves and showdowns are shown to your opponent too.</span></div></div><nav class="st-tabs" role="tablist" aria-label="Premium Studio">${STUDIO_TABS.map(([k,l])=>`<button type="button" role="tab" data-stab="${k}" aria-selected="${k===studioTab}">${l}</button>`).join('')}</nav>${STUDIO_TABS.map(([k])=>`<div class="st-pane" data-spane="${k}"${k===studioTab?'':' hidden'}>${panes[k]}</div>`).join('')}</div>`);
 const tb=$('tb');
 tb.querySelectorAll('[data-stab]').forEach(b=>b.onclick=()=>{studioTab=b.dataset.stab;S.s('studio_tab',studioTab);tb.querySelectorAll('[data-stab]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));tb.querySelectorAll('[data-spane]').forEach(p=>p.hidden=p.dataset.spane!==studioTab);b.scrollIntoView({inline:'center',block:'nearest'});tb.scrollTop=0});
 tb.querySelectorAll('[data-skt]').forEach(b=>b.onclick=e=>{const del=e.target.closest('[data-skdel]');if(del){e.stopPropagation();skinsSave(skinsOwn().filter(x=>x.id!==del.dataset.skdel));const s=skinSel();for(const k in s)if(s[k]===del.dataset.skdel)delete s[k];S.s('skin_sel',s);skinsToArena();openSkins();return}const s=skinSel(),was=s[b.dataset.skt];if(b.dataset.skin)s[b.dataset.skt]=b.dataset.skin;else delete s[b.dataset.skt];S.s('skin_sel',s);skinsToArena();openSkins();if(b.dataset.skt==='field'&&b.dataset.skin&&was!==b.dataset.skin)openFieldEditor()});
 const fe=tb.querySelector('[data-fieldedit]');if(fe)fe.onclick=openFieldEditor;
 sndPanel(tb);movesPanel(tb);
 tb.querySelectorAll('[data-fin]').forEach(b=>b.onclick=()=>{S.s('fin_style',b.dataset.fin);tb.querySelectorAll('[data-fin]').forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-checked',String(x===b))});const pv=tb.querySelector('[data-finpv]');if(pv)pv.textContent='▶ Preview '+b.textContent.trim();skinsToArena()});
 {const pv=tb.querySelector('[data-finpv]');if(pv)pv.onclick=()=>previewFin(finStyle())}
 tb.querySelectorAll('[data-mv]').forEach(b=>{const o=b.onclick;b.onclick=e=>{o&&o(e);const pv=tb.querySelector(`[data-mvpv="${b.dataset.mv}"]`);if(pv)pv.textContent='▶ Preview '+b.textContent.trim()}});
 tb.querySelectorAll('[data-show]').forEach(b=>b.onclick=()=>{const kind=b.dataset.show;if(!PREMIUM&&b.classList.contains('prem')){openPremiumInfo();return}S.s(kind==='finale'?'finale_style':'ace_style',b.dataset.showk);tb.querySelectorAll(`[data-show="${kind}"]`).forEach(x=>{x.classList.toggle('on',x===b);x.setAttribute('aria-checked',String(x===b))});const pv=tb.querySelector(`[data-showpv="${kind}"]`);if(pv)pv.textContent='▶ Preview '+showName(b.dataset.showk);skinsToArena()});
 tb.querySelectorAll('[data-showpv]').forEach(b=>b.onclick=()=>previewShow(b.dataset.showpv,b.dataset.showpv==='finale'?finaleStyle():aceStyle()));
 const r=tb.querySelector('[data-finms]');if(r){r.oninput=()=>{$('stMsV').textContent=(r.value/1000).toFixed(1)+' s'};r.onchange=()=>{S.s('finale_ms',+r.value);skinsToArena()}}
 const fxi=tb.querySelector('[data-kxfx]');if(fxi)fxi.onchange=()=>{S.s('kx_fx',fxi.checked);kxFx()};
 tb.querySelectorAll('[data-skadd]').forEach(inp=>inp.onchange=async()=>{const f=inp.files&&inp.files[0];if(!f)return;try{const t=inp.dataset.skadd,img=await shrinkImage(f,t==='field'?1000:420),id='u'+Date.now().toString(36);if(skinsSave([...skinsOwn(),{id,type:t,name:f.name.slice(0,40),img}])){const s=skinSel();s[t]=id;S.s('skin_sel',s);skinsToArena();openSkins();if(t==='field')openFieldEditor()}}catch(e){toast('That picture could not be used')}});
 studioCards(tb);
}
function studioCards(tb){const qi=tb.querySelector('[data-sigq]'),res=tb.querySelector('[data-sigres]'),lst=tb.querySelector('[data-siglist]');if(!qi)return;
 const code=c=>String(/^\d{3,10}$/.test(String(c.kid||''))?c.kid:c.id);
 const draw=()=>{lst.innerHTML=sigRows();lst.querySelectorAll('[data-sigopen]').forEach(b=>b.onclick=()=>openSigEditor(b.dataset.sigopen,draw));const n=lst.nextElementSibling;if(n)n.textContent=`${sigCards().length}/60 cards · ${aceCards().length}/12 Ace cards`};
 qi.oninput=()=>{const t=nt(qi.value);if(t.length<2){res.innerHTML='';return}const hits=[];for(const c of cards){if(nt(c.name).includes(t)){hits.push(c);if(hits.length>=8)break}}const have=new Set(sigCards());
  res.innerHTML=hits.map(c=>`<button type="button" class="st-hit" data-sigadd="${esc(code(c))}"${have.has(code(c))?' disabled':''}><span class="st-th">${cardThumb(c)}</span><span><b>${esc(c.name)}</b><small>${esc(String(c.type||'').replace(/ Card$/,''))}</small></span><em>${have.has(code(c))?'Added':'+ Add'}</em></button>`).join('');
  res.querySelectorAll('[data-sigadd]').forEach(b=>b.onclick=()=>{const a=sigCards();if(!a.includes(b.dataset.sigadd)){if(a.length>=60){toast('Up to 60 signature cards');return}a.push(b.dataset.sigadd);S.s('sig_cards',a);skinsToArena()}qi.value='';res.innerHTML='';draw();openSigEditor(b.dataset.sigadd,draw)})};
 lst.querySelectorAll('[data-sigopen]').forEach(b=>b.onclick=()=>openSigEditor(b.dataset.sigopen,draw));
}
/** One signature card: its showdown, finishing move, entrance, attack, voice, Ace card. */
function openSigEditor(id,onDone){
 const c=cardOf(id)||{},mon=/Monster/i.test(c.type||''),get=k=>(S.g(k,{})||{})[id]||'',isAce=aceCards().map(String).includes(String(id));
 const opt=(T,cur,def)=>`<option value="">${def}</option>`+T.map(([k,l])=>`<option value="${k}"${cur===k?' selected':''}>${l}</option>`).join('');
 const row=(key,label,help,sel,pv)=>`<div class="se-row"><label class="se-l" for="se_${key}"><strong>${label}</strong><small>${help}</small></label><div class="se-c"><div class="se-sel">${sel}</div><button type="button" class="se-pv" data-sepv="${pv}" aria-label="Preview ${label}">▶</button></div></div>`;
 const m=openModal(`<div class="dk-hd"><h3>Card settings</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
 <div class="se-head"><span class="st-th big">${cardThumb(c)}</span><div><b>${esc(c.name||id)}</b><small>${esc(c.type||'')}</small></div></div>
 <label class="st-switch se-ace"><span><strong>★ Ace card</strong><small>Fills the screen before it resolves. Up to 12.</small></span><input type="checkbox" data-se="ace" ${isAce?'checked':''}><i aria-hidden="true"></i></label>
 ${row('show','Showdown','Before its winning blow, and as an Ace card',`<select id="se_show" data-se="show">${opt([...FINALE_T,['random','Random']],get('sig_show'),'My default ('+esc(showName(finaleStyle()))+')')}</select>`,'show')}
 ${row('fx','Finishing move','When it lands the winning blow',`<select id="se_fx" data-se="fx">${opt(FIN_T,get('sig_fx'),'My default ('+esc((FIN_T.find(x=>x[0]===finStyle())||['',''])[1])+')')}</select>`,'fx')}
 ${mon?row('ent','Entrance','When it is summoned',`<select id="se_ent" data-se="ent">${opt(ENT_T,get('sig_ent'),'My default ('+esc((ENT_T.find(x=>x[0]===entStyle())||['',''])[1])+')')}</select>`,'ent')+row('atk','Attack','When it attacks',`<select id="se_atk" data-se="atk">${opt(ATK_T,get('sig_atk'),'My default ('+esc((ATK_T.find(x=>x[0]===atkStyle())||['',''])[1])+')')}</select>`,'atk'):'<p class="note">Spells and Traps use the showdown, finishing move and voice; entrances and attacks are for monsters.</p>'}
 <div class="se-row se-voice"><div class="se-l"><strong>Voice</strong><small data-sevs>${MEDIA.voices[id]?'Your sound plays when this card is activated or summoned':'No sound yet: the usual sound plays'}</small></div><div class="se-c se-vb"><button type="button" class="btn" data-sev="set">${MEDIA.voices[id]?'Change':'🎙 Add sound'}</button><button type="button" class="btn" data-sev="play"${MEDIA.voices[id]?'':' hidden'}>▶ Play</button><button type="button" class="btn" data-sev="del"${MEDIA.voices[id]?'':' hidden'}>Remove</button></div></div>
 <div class="se-foot"><button type="button" class="btn st-danger" data-sedel>Remove card</button><button type="button" class="btn p" data-close>Done</button></div>`,'se','se');
 const save=(key,v)=>{const o=Object.assign({},S.g(key,{}));if(v)o[id]=v;else delete o[id];S.s(key,o);skinsToArena()};
 m.querySelector('[data-se="ace"]').onchange=e=>{const s=new Set(S.g('ace_cards',[]).map(String));if(e.target.checked){if(aceCards().length>=12){e.target.checked=false;toast('Up to 12 Ace cards');return}s.add(String(id))}else s.delete(String(id));S.s('ace_cards',[...s]);skinsToArena()};
 for(const [k,key] of [['show','sig_show'],['fx','sig_fx'],['ent','sig_ent'],['atk','sig_atk']]){const sl=m.querySelector(`[data-se="${k}"]`);if(sl)sl.onchange=()=>save(key,sl.value)}
 m.querySelectorAll('[data-sepv]').forEach(b=>b.onclick=()=>{const k=b.dataset.sepv,v=(m.querySelector(`[data-se="${k}"]`)||{}).value;if(k==='show')previewShow(m.querySelector('[data-se="ace"]').checked?'ace':'finale',v||finaleStyle());else if(k==='fx')previewFin(v||finStyle());else previewMove(k,v||(k==='ent'?entStyle():atkStyle()))});
 const vs=m.querySelector('[data-sevs]'),vb=k=>m.querySelector(`[data-sev="${k}"]`),vdraw=()=>{const on=!!MEDIA.voices[id];vs.textContent=on?'Your sound plays when this card is activated or summoned':'No sound yet: the usual sound plays';vb('set').textContent=on?'Change':'🎙 Add sound';vb('play').hidden=!on;vb('del').hidden=!on};
 vb('set').onclick=()=>soundFor(async snd=>{if(!snd)return;MEDIA.voices[id]={snd};await mediaSave();skinsToArena();vdraw();toast('Card voice saved')},false);
 vb('play').onclick=()=>{const v=MEDIA.voices[id];if(v)playData(v.snd)};
 vb('del').onclick=async()=>{delete MEDIA.voices[id];await mediaSave();skinsToArena();vdraw()};
 m.querySelector('[data-sedel]').onclick=()=>{S.s('sig_cards',sigCards().filter(x=>x!==String(id)));const s=new Set(S.g('ace_cards',[]).map(String));s.delete(String(id));S.s('ace_cards',[...s]);skinsToArena();history.back()};
 const obs=new MutationObserver(()=>{if(!m.isConnected){obs.disconnect();onDone&&onDone()}});obs.observe(document.body,{childList:true});
}

/* ===== Settings: the Premium entry opens the Studio ===== */
{const b=$('bPrem'),sp=b&&b.querySelector('span');if(PREMIUM&&sp)sp.textContent='Premium Studio'}
// (the back-navigation fix is in the main script: minimizing no longer asks "Leave the duel?")

/* ===== offline card database: pictures and rulings on this device, in folders you can fill yourself ===== */
const KXF=window.CastelFiles||null,PIC_DIR='KodeX/pics',RUL_DIR='KodeX/rulings';
const ODB={ids:new Set(),webCount:0,job:'',busy:false};
const picId=u=>{const m=/\/(?:images\/cards(?:_small)?|img(?:\/full)?)\/(\d{3,10})\.jpg(?:$|\?)/.exec(u||'');return m?m[1]:''};
function odbScan(){if(KXF){try{KXF.ensure(PIC_DIR+','+RUL_DIR);if(!KXF.exists('KodeX/README.txt'))KXF.writeText('KodeX/README.txt','KodeX offline database\n\npics/     card pictures, named by passcode: 89631139.jpg (the same names desktop duel clients use).\n          Paste pictures here, or download them all in KodeX: Settings > Offline database.\nrulings/  rulings, named by Konami ID: 4007.json. Downloaded by KodeX, or pasted here.\n\nKodeX uses whatever is in these folders, no internet needed.\n');const a=JSON.parse(KXF.list(PIC_DIR));ODB.ids=new Set(a.map(n=>(/^(\d{3,10})\.(jpe?g|png|webp)$/i.exec(n)||[])[1]).filter(Boolean))}catch(e){}picsToArena()}}
async function odbWebCount(){try{ODB.webCount=(await kvCur('p:',false)).length}catch(e){ODB.webCount=0}}
function picsToArena(){const f=$('arenaFrame');if(!KXF||!f||!f.contentWindow)return;try{f.contentWindow.postMessage({kx:'pics',base:KXF.url(PIC_DIR)+'/',ids:[...ODB.ids].map(Number)},'*')}catch(e){}}
/** A picture saved on the phone, for a card picture address. */
const PICM=new Map();
async function localPicUrl(u){const id=picId(u);if(!id)return null;if(KXF)return ODB.ids.has(id)?KXF.url(PIC_DIR+'/'+id+'.jpg'):null;if(!ODB.webCount)return null;if(PICM.has(id))return PICM.get(id);try{const b=await kv('get','p:'+id);if(b instanceof Blob){const o=URL.createObjectURL(b);PICM.set(id,o);return o}}catch(e){}return null}
// pictures on screen come from the phone first (the deck image keeps using its own copies, which it can embed)
function kxHydrate(im){if(im.dataset.h||!im.dataset.u)return;im.dataset.h='1';const u=im.dataset.u;localPicUrl(u).then(l=>l||icGet(u)).then(v=>{im.src=v||u},()=>{im.src=u})}
async function kxImgErr(im){const u=im.dataset.u||im.src;if(!im.dataset.lpTried){im.dataset.lpTried='1';const l=await localPicUrl(u);if(l&&im.src!==l){im.style.visibility='';im.src=l;return}}return kxImgErr0(im)}
/** Rulings: the copy in the rulings folder counts as saved. Downloads are copied there too. */
async function getRul(id,force){
 let c=await kv('get','r:'+id);
 if(!c&&KXF){try{const t=KXF.readText(RUL_DIR+'/'+id+'.json');if(t){const d=JSON.parse(t);if(d&&Array.isArray(d.records)){c={t:Date.now(),data:d};kv('put','r:'+id,c)}}}catch(e){}}
 if(c&&c.data&&!force&&Date.now()-c.t<TTL)return c;
 try{const d=await fj(RUL+encodeURIComponent(id)+'.json',15000);if(!d||!Array.isArray(d.records))throw Error('bad');const r={t:Date.now(),data:d};await kv('put','r:'+id,r);if(KXF)try{KXF.writeText(RUL_DIR+'/'+id+'.json',JSON.stringify(d))}catch(e){}return r}
 catch(e){if(c&&c.data)return Object.assign({stale:1},c);throw e}
}
const fmtMB=b=>b>=1e9?(b/1e9).toFixed(2)+' GB':Math.max(0,Math.round(b/1e6))+' MB';
function odbUi(){
 const sec=document.querySelector('[data-odb]');if(!sec)return;
 const st=$('picSt'),pg=$('picPg'),dl=$('picDl'),total=cards.length;
 const have=KXF?ODB.ids.size:ODB.webCount;
 if(!ODB.busy){st.textContent=have?`${total?have.toLocaleString()+' of '+total.toLocaleString():have.toLocaleString()} picture${(total||have)===1?'':'s'} saved on this device${KXF?' · '+fmtMB(JSON.parse(KXF.usage(PIC_DIR)).bytes):''}`:'No pictures saved yet: they load from the internet';pg.style.width=total?Math.min(100,have/total*100)+'%':'0';dl.textContent=have&&total&&have<total?'Download the rest':'Download all pictures'}
 const w=$('odbWhere');if(w)w.innerHTML=KXF?`Folder: <b>${esc(JSON.parse(KXF.info()).root||'')}/KodeX</b>. Pictures go in <b>pics</b> (named by passcode, like <b>89631139.jpg</b>, the same as desktop duel clients) and rulings in <b>rulings</b>. Paste files there and they're used straight away.`:'Saved in this browser. In the KodeX app they go in a folder on your phone that you can also fill yourself.';
 const fb=$('odbFolder');if(fb)fb.hidden=!KXF;
 $('picQ').closest('.odb-q').hidden=!KXF;
}
function odbInit(){
 const old=$('bDl');if(!old||document.querySelector('[data-odb]'))return;
 const grp=old.closest('.grp'),sec=grp.previousElementSibling;
 if(sec&&sec.classList.contains('sec'))sec.textContent='Offline database';
 grp.classList.add('odb');grp.dataset.odb='1';grp.removeAttribute('style');
 grp.innerHTML=`<div class="odb-blk"><div class="odb-hd"><span class="odb-ic">${ic('image',20)}</span><div><strong>Card pictures</strong><small id="picSt">Checking…</small></div></div><div class="prog"><i id="picPg"></i></div>
  <label class="odb-q"><span>Picture size</span><select id="picQ"><option value="full">Full size · ~1.5 GB</option><option value="small">Small · ~250 MB</option></select></label>
  <div class="odb-acts"><button id="picDl" class="btn p">Download all pictures</button><button id="picImp" class="btn">Import</button><button id="picClr" class="btn">Clear</button></div></div>
 <div class="odb-blk"><div class="odb-hd"><span class="odb-ic">${ic('list',20)}</span><div><strong>Rulings</strong><small id="dlst">Not downloaded yet.</small></div></div><div class="prog"><i id="pg"></i></div>
  <div class="odb-acts"><button id="bDl" class="btn p">Download all rulings</button><button id="rulImp" class="btn">Import</button></div></div>
 <div class="odb-blk odb-folder" id="odbFolder" hidden><p class="note" id="odbWhere"></p><div class="odb-acts"><button id="odbPick" class="btn">Choose a folder</button><button id="odbScan" class="btn">Rescan</button></div></div>
 <p class="note odb-web" id="odbWhere2"></p><input type="file" id="odbFile" hidden multiple>`;
 const nb=$('bDl');nb.onclick=old.onclick;   // the rulings download keeps working as before
 $('picQ').value=S.g('pic_q','full');$('picQ').onchange=()=>S.s('pic_q',$('picQ').value);
 $('picDl').onclick=picDownload;$('picClr').onclick=picClear;$('picImp').onclick=()=>odbImport('pics');$('rulImp').onclick=()=>odbImport('rulings');
 if(KXF){$('odbPick').onclick=()=>{const opts=JSON.parse(KXF.info()).kind==='folder';odbChoose(opts)};$('odbScan').onclick=()=>{odbScan();odbUi();toast('Folder scanned')}}
 if(!KXF)$('odbWhere2').textContent='';
 rulCount();odbUi();
}
async function rulCount(){try{const n=(await kvCur('r:',false)).length,f=KXF?JSON.parse(KXF.list(RUL_DIR)).length:0;if(!dl&&(n||f))$('dlst').textContent=`${Math.max(n,f).toLocaleString()} cards' rulings saved on this device`}catch(e){}}
function odbChoose(inFolder){const m=openModal(`<div class="dk-hd"><h3>Where to keep the database</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div><p class="note">Pick a folder such as <b>Internal storage/KodeX</b> to keep pictures and rulings where any file manager can reach them. KodeX makes <b>pics</b> and <b>rulings</b> folders inside it.</p><button class="btn p" data-o="pick">Choose a folder</button>${inFolder?'<button class="btn" data-o="app">Use the app folder again</button>':''}`,'','odb');
 m.querySelector('[data-o="pick"]').onclick=()=>{closeModal();window.__kxFolder=(ok,label)=>{if(ok){odbScan();odbUi();toast('Using '+label)}else if(label&&label!=='cancelled')toast(label)};KXF.chooseFolder('__kxFolder')};
 const a=m.querySelector('[data-o="app"]');if(a)a.onclick=()=>{KXF.useAppFolder();closeModal();odbScan();odbUi();toast('Using the app folder')}}
function picDownload(){
 if(ODB.busy){if(KXF&&ODB.job)KXF.cancel(ODB.job);ODB.busy=false;$('picDl').textContent='Download all pictures';odbUi();return}
 if(!navigator.onLine){toast('Connect to the internet to download');return}
 const ids=[...new Set(cards.map(c=>String(c.id)).filter(x=>/^\d{3,10}$/.test(x)))];
 if(!ids.length){toast('The card database is still loading');return}
 const full=!!KXF&&$('picQ').value!=='small',base=svcBase();
 ODB.busy=true;$('picDl').textContent='Stop';
 if(KXF){
  const todo=ids.filter(id=>!ODB.ids.has(id)).map(id=>({u:`${base}/img/${full?'full/':''}${id}.jpg`,p:`${PIC_DIR}/${id}.jpg`}));
  if(!todo.length){ODB.busy=false;toast('All pictures are already saved');odbUi();return}
  ODB.job='p'+Date.now().toString(36);const startHave=ODB.ids.size;
  window.__castelFiles=(job,done,total,failed,fin)=>{if(job!==ODB.job)return;$('picSt').textContent=fin?'':`Downloading… ${(startHave+done).toLocaleString()} / ${ids.length.toLocaleString()}${failed?' · '+failed+' failed':''}`;$('picPg').style.width=Math.min(100,(startHave+done)/ids.length*100)+'%';if(fin){ODB.busy=false;odbScan();odbUi();toast(failed?`Pictures saved · ${failed} failed, download again to retry`:'Pictures saved on this device');$('picDl').textContent='Download all pictures'}};
  try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
  KXF.download(ODB.job,JSON.stringify(todo),12);return}
 // browser: small pictures, kept in this browser's storage
 (async()=>{try{await navigator.storage.persist()}catch(e){}let have=new Set((await kvCur('p:',false)).map(k=>k.slice(2))),n=0,bad=0,i=0;const todo=ids.filter(id=>!have.has(id)),T=todo.length,start=have.size;
  const w=async()=>{while(ODB.busy){const id=todo[i++];if(id===undefined)return;try{const r=await fetch(`${base}/img/${id}.jpg`,{mode:'cors'});if(!r.ok)throw 0;const b=await r.blob();if(!/^image\//.test(b.type)||!b.size)throw 0;await kv('put','p:'+id,b)}catch(e){bad++}n++;if(n%10===0||n===T){$('picSt').textContent=`Downloading… ${(start+n).toLocaleString()} / ${ids.length.toLocaleString()}${bad?' · '+bad+' failed':''}`;$('picPg').style.width=Math.min(100,(start+n)/ids.length*100)+'%'}await new Promise(r=>setTimeout(r,60))}};
  await Promise.all([w(),w(),w(),w()]);const was=ODB.busy;ODB.busy=false;await odbWebCount();odbUi();$('picDl').textContent='Download all pictures';if(was)toast(bad?`Pictures saved · ${bad} failed, download again to retry`:'Pictures saved in this browser')})();
}
async function picClear(){const m=openModal(`<div class="dk-hd"><h3>Clear saved pictures?</h3></div><p class="note">Card pictures will load from the internet again. Rulings are kept.</p><div class="sacts" style="display:flex;gap:8px;justify-content:flex-end"><button class="btn" data-close>Cancel</button><button class="btn p" data-ok>Clear</button></div>`,'','odb');
 m.querySelector('[data-ok]').onclick=async()=>{closeModal();if(KXF){KXF.remove(PIC_DIR);odbScan()}else{for(const k of await kvCur('p:',false))await kvDel(k);await odbWebCount()}icMem.clear();odbUi();toast('Pictures cleared')}}
function odbImport(kind){
 if(KXF){const dest=kind==='pics'?PIC_DIR:RUL_DIR;const m=openModal(`<div class="dk-hd"><h3>Import ${kind==='pics'?'pictures':'rulings'}</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div><p class="note">${kind==='pics'?'Pictures named by passcode (<b>89631139.jpg</b>), like a desktop duel client\'s <b>pics</b> folder.':'Rulings named by Konami ID (<b>4007.json</b>), like KodeX\'s <b>rulings</b> folder.'}</p><button class="btn p" data-o="folder">From a folder</button><button class="btn" data-o="zip">From a ZIP file</button>`,'','odb');
  window.__kxImport=(ok,n)=>{if(ok){odbScan();odbUi();rulCount();toast(`${Number(n).toLocaleString()} files imported`)}else if(n&&n!=='cancelled')toast(n)};
  m.querySelector('[data-o="folder"]').onclick=()=>{closeModal();KXF.importFolder(dest,'__kxImport')};
  m.querySelector('[data-o="zip"]').onclick=()=>{closeModal();KXF.importZip(dest,'__kxImport')};return}
 const f=$('odbFile');f.accept=kind==='pics'?'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp':'application/json,.json';f.value='';
 f.onchange=async()=>{let n=0,bad=0;for(const file of f.files){const m=/^(\d{3,10})\.(jpe?g|png|webp|json)$/i.exec(file.name);if(!m){bad++;continue}try{if(kind==='pics'){if(!/^image\//.test(file.type)&&!/jpe?g|png|webp/i.test(m[2])){bad++;continue}await kv('put','p:'+m[1],file.slice(0,file.size,file.type||'image/jpeg'));n++}else{const d=JSON.parse(await file.text());if(!d||!Array.isArray(d.records)){bad++;continue}await kv('put','r:'+m[1],{t:Date.now(),data:d});n++}}catch(e){bad++}}
  await odbWebCount();odbUi();rulCount();toast(`${n.toLocaleString()} imported${bad?` · ${bad} skipped (name them by ${kind==='pics'?'passcode, like 89631139.jpg':'Konami ID, like 4007.json'})`:''}`)};
 f.click()}
(async()=>{await odbWebCount();odbScan();odbInit();const go=()=>{odbUi()};if(!cards.length){let t=0;const iv=setInterval(()=>{if(cards.length||++t>60){clearInterval(iv);go()}},1000)}})();
$('arenaFrame').addEventListener('load',()=>setTimeout(picsToArena,300));
window.addEventListener('message',e=>{const d=e.data||{};if(d.kx==='ready')picsToArena()});

/* ---------- minimize the duel, then load the late v56 bits ---------- */
mediaLoad().then(()=>{try{skinsToArena()}catch(e){}});

