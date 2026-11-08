
/* ===================================================================================================================
   KodeX 9.3 · module: premium-pitch-and-trial
   Blueprint: app/BLUEPRINT.md. KodeX is created by Castel Noleal, creator of MEIOCG (Meta Insider OCG).
   - KodeX Premium pitch in Settings (free edition): an ad-style card with real card art, a 5-day trial and the CTA.
   - 5-day KodeX Premium trial: started once per install from the pitch; the free app then runs as Premium (no ads,
     every Premium feature) and turns back to free on its own when the 5 days are over (KX_TRIAL, set before PREMIUM).
   =================================================================================================================== */
const KODEX_BLUEPRINT=Object.freeze({app:'Duel Synapse: KodeX',creator:'Castel Noleal',role:'Creator of MEIOCG (Meta Insider OCG)',since:2023,
 contact:'metainsiderocg@gmail.com',doc:'app/BLUEPRINT.md'});
const KX_TRIAL_DAYS=5;
const kxIsEdPremium=()=>((document.querySelector('meta[name=kodex-edition]')||{}).content)==='premium';
function kxTrialLeft(){const h=Math.max(0,Math.floor(KX_TRIAL.left/36e5)),d=Math.floor(h/24);return d?`${d} day${d>1?'s':''} ${h%24} h`:`${h} h`}
function kxStartTrial(){if(kxIsEdPremium())return;if(KX_TRIAL.used){toast('Your free trial has already been used on this device');return}
 const m=openModal(`<div class="dk-hd"><h3>Start your 5-day Premium trial?</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
 <p class="note">Every KodeX Premium feature, with no ads, for ${KX_TRIAL_DAYS} days. It ends on its own after that; nothing is charged and no account is needed. One trial per device.</p>
 <div class="dact"><button class="btn" data-close>Not now</button><button class="btn p" id="ktGo">Start free trial</button></div>`,'','trial');
 m.querySelector('#ktGo').onclick=()=>{try{localStorage.setItem('kx_trial',JSON.stringify({start:Date.now(),v:1}))}catch(e){toast('Could not start the trial (storage is full or blocked)');return}
  try{kv('put','kx_trial_bk',{start:Date.now()})}catch(e){}closeModal();toast('KodeX Premium trial started · restarting…');setTimeout(()=>location.reload(),700)}}
function kxPitchArt(){const want=['Blue-Eyes White Dragon','Dark Magician','Ash Blossom & Joyous Spring','Accesscode Talker','Maxx "C"','Snake-Eye Ash','Dark Magician Girl','Red-Eyes Black Dragon'];
 const by=n=>cards.find(c=>c.name===n&&(c.img||c.sm));const out=[];for(const n of want){const c=by(n);if(c)out.push(c);if(out.length===3)break}
 for(const c of cards){if(out.length>=3)break;if((c.img||c.sm)&&/Monster/.test(c.type||'')&&!out.includes(c))out.push(c)}
 return out.map(c=>({src:c.img||c.sm,name:c.name}))}
function premiumCardV60(){const art=kxPitchArt(),used=KX_TRIAL.used&&!KX_TRIAL.active;
 const tiles=[['Ace showdowns','Your best cards take over the screen','show','destiny','ace'],['Finishing moves','Shatter, Meteor, Thunder and more','fin','thunder',''],['Grand entrances','Portal, Storm, Inferno, Nova','mv','portal','ent'],['Winning showdowns','Domain Expansion, Time Stop…','show','domain','finale'],['Your profile','Own picture, animated banner, Premium frame','',''],['No ads','The sponsor strip is gone','',''],['Unlimited card scanner','Free: 4 scans a day','',''],['Skins & sounds','Sleeves, fields, emotes, music','','']];
 return `<div class="pz">
 <div class="pz-hero">
  <div class="pz-fan" aria-hidden="true">${art.map((a,i)=>`<img class="f${i}" src="${esc(a.src)}" alt="" loading="lazy">`).join('')}</div>
  <span class="pz-tag">${ic('star',14)} KodeX Premium</span>
  <h3 class="pz-h">Duel like it's the finals.</h3>
  <p class="pz-p">Ace showdowns, finishing moves, your own profile, skins and sounds, and no ads.</p>
  <div class="pz-cta">${used?'':`<button class="btn pz-try" data-trial>Try Premium free · ${KX_TRIAL_DAYS} days</button>`}<button class="btn p pz-buy" data-getprem>Get KodeX Premium</button></div>
  <small class="pz-fine">${used?'Your free trial has ended. Premium keeps every feature on, for good.':'No account, nothing charged. The trial ends on its own after 5 days.'}</small>
 </div>
 <div class="pz-grid">${tiles.map(([t,d,k,v,kk])=>`<button type="button" class="pz-t"${k==='show'?` data-show="${v}" data-showk="${kk}"`:k==='fin'?` data-fin="${v}"`:k==='mv'?` data-mv="${v}" data-mvk="${kk}"`:''}><b>${t}</b><small>${d}</small>${k?`<em>${ic('play',12)} Preview</em>`:''}</button>`).join('')}</div>
 <div class="pz-cmp"><div class="pz-row h"><span></span><b>Free</b><b>Premium</b></div>${[['Ads','Yes','None'],['Card scans','4 a day','Unlimited'],['Winning showdowns','Menacing','13 + Random'],['Ace cards','–','✓'],['Profile','Presets','Own picture, animated']].map(r=>`<div class="pz-row"><span>${r[0]}</span><i>${r[1]}</i><i class="y">${r[2]}</i></div>`).join('')}</div>
 <details class="pz-more"><summary>Everything in Premium, with previews</summary>${typeof premiumCardV59==='function'?premiumCardV59():''}</details>
 <p class="scan-left">Free card scans left today: ${Math.max(0,4-scanUses().length)} of 4</p></div>`}
{const b=window.bindPremiumCard;if(typeof b==='function')window.bindPremiumCard=function(root){b.apply(this,arguments);root.querySelectorAll('[data-trial]').forEach(x=>x.onclick=kxStartTrial)}}
/* the pitch box in Settings was drawn before this module loaded: draw it again */
{const bp=$('bPrem'),box=bp&&bp.previousElementSibling;if(!PREMIUM&&box&&!box.id&&box.tagName==='DIV'){box.innerHTML=premiumCard();bindPremiumCard(box)}}
/* Settings: the trial banner while it runs; a notice when it ends */
(function(){if(kxIsEdPremium())return;
 if(KX_TRIAL.active){const sb=document.querySelector('#Lset .sb'),prem=sb&&[...sb.querySelectorAll('.sec')].find(x=>x.textContent.trim()==='Premium');
  if(prem){const d=document.createElement('div');d.className='pz-trial';d.innerHTML=`<b>${ic('star',16)} Premium trial</b><span>${kxTrialLeft()} left</span><button class="btn p" data-getprem>Keep Premium</button>`;prem.after(d);d.querySelector('[data-getprem]').onclick=()=>{try{window.open(PREMIUM_URL,'_blank','noopener')}catch(e){location.href=PREMIUM_URL}}}
  // the trial ends while the app is open: back to free at the next quiet moment
  setTimeout(()=>{toast('Your KodeX Premium trial has ended');setTimeout(()=>location.reload(),2500)},Math.min(KX_TRIAL.left,2147e6))}
 else if(KX_TRIAL.used&&!S.g('kx_trial_seen',false)){S.s('kx_trial_seen',true);setTimeout(()=>{const m=openModal(`<div class="dk-hd"><h3>Your Premium trial has ended</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div><p class="note">Thanks for trying KodeX Premium. Your decks, profile and settings are all still here; Premium features are off until you get KodeX Premium.</p><div class="dact"><button class="btn" data-close>Maybe later</button><button class="btn p" data-getprem>Get KodeX Premium</button></div>`,'','trialend');m.querySelector('[data-getprem]').onclick=()=>{try{window.open(PREMIUM_URL,'_blank','noopener')}catch(e){location.href=PREMIUM_URL}}},1500)}
 // a cleared localStorage keeps the trial used (IndexedDB copy)
 if(!KX_TRIAL.used)kv('get','kx_trial_bk').then(v=>{if(v&&v.start){try{localStorage.setItem('kx_trial',JSON.stringify({start:v.start,v:1}))}catch(e){}if(Date.now()-v.start<KX_TRIAL_DAYS*864e5)location.reload()}}).catch(()=>{})})();

/* MEIOCG Players: the ping also sends the banner, and keeps the public profile id for "View my public profile" */
{const f0=window.fetch;window.fetch=function(u,o){if(typeof u==='string'&&/\/api\/players\/ping$/.test(u)&&o&&typeof o.body==='string'){try{const b=JSON.parse(o.body);b.theme=kxProfile().theme;o={...o,body:JSON.stringify(b)}}catch(e){}
  return f0.call(this,u,o).then(r=>{try{r.clone().json().then(j=>{if(j&&j.pid){S.s('pf_pid',j.pid)}}).catch(()=>{})}catch(e){}return r})}return f0.apply(this,arguments)}}
{const v=window.kxpView;if(typeof v==='function')window.kxpView=function(){v.apply(this,arguments);const pid=S.g('pf_pid',''),m=[...document.querySelectorAll('.mdl')].pop();if(!m||!pid||!kxpRaw().listed)return;const a=m.querySelector('[data-pfplayers]');if(a){a.textContent='My public profile';a.onclick=()=>openLink('https://kodex.meiocg.org/players#'+pid,'MEIOCG Players')}}}

/* "More about KodeX Premium": the full list is open there */
{const o=window.openPremiumInfo;if(typeof o==='function')window.openPremiumInfo=function(){o.apply(this,arguments);document.querySelectorAll('#tb .pz-more').forEach(d=>d.open=true)}}

