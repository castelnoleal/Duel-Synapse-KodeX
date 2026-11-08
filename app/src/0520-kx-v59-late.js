
const KXPF=(()=>{
// Player profiles: icon, frame, title and banner, shown on the Life Point plates and in a profile card.
// Shared with the KodeX app (its build copies PROFILE_DATA from this file), so both draw profiles the same way.
// Free players: the MEIOCG icon or a preset, frames unlocked by how much they use KodeX, three plain banners.
// KodeX Premium: their own picture (GIFs move), the Premium frame, animated banners and an accent colour.

/* PROFILE_DATA_START */
const PROFILE_DATA = {
  icons: {
    star: ["#3347f0", "#7a4fd6", "M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"],
    flame: ["#e0563a", "#f0b429", "M12 2.5c1 4 5.5 6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.6 1.4-4.2 2.4-5.3.3 1.9 1.4 3 2.5 3-.9-2.9-.2-5.8.6-8.7z"],
    crown: ["#b8860b", "#ffe08a", "M3.5 8l4 3.5L12 5l4.5 6.5 4-3.5-1.8 10H5.3z M5.5 20h13"],
    blade: ["#2b7fff", "#9fe2ff", "M14.5 3.5h6v6L10 20l-2-2-2.5 2.5-2-2L6 16l-2-2z M13 8l3 3"],
    shield: ["#1f9d6b", "#8be1ff", "M12 2.8l7.5 3v6c0 4.7-3.2 8.2-7.5 9.4-4.3-1.2-7.5-4.7-7.5-9.4v-6z M8.5 12l2.4 2.4L15.6 9.7"],
    moon: ["#3b2a8a", "#b46bff", "M19.5 14.5A8 8 0 1 1 9.5 4.5a6.4 6.4 0 0 0 10 10z"],
    sun: ["#f08a29", "#ffe066", "M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"],
    bolt: ["#7a4fd6", "#8be1ff", "M13.5 2.5L5 13.5h6l-1 8 8.5-11h-6z"],
    eye: ["#0f6a8a", "#8be1ff", "M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"],
    gem: ["#a81a6a", "#ff8dc7", "M6.5 3.5h11l4 5.5L12 21 2.5 9z M2.5 9h19 M9 3.5L12 21l3-17.5"],
    wing: ["#3a8a9a", "#e0f7ff", "M21 4c-6 .5-11 3-14 8-1.5 2.5-2.5 5-3 8 2-2.5 4.5-3.5 7-3.5-1.5-1-2-2-2-3 3 .5 5.5-.5 7.5-2.5-1.5-.5-2.5-1-3-2 3-.5 5.5-2.5 7.5-5z"],
    spiral: ["#6a1aa8", "#ffb347", "M12 12m-1.5 0a1.5 1.5 0 1 0 3 0a3 3 0 1 0-6 0a4.5 4.5 0 1 0 9 0a6 6 0 1 0-12 0a7.5 7.5 0 1 0 15 0"],
  },
  // frames unlock with activity points (a day you use KodeX: 10, a duel: 4, a deck: 5, cards looked up: up to 300)
  tiers: [["rookie", "Rookie", 0], ["bronze", "Bronze", 120], ["silver", "Silver", 350], ["gold", "Gold", 800], ["platinum", "Platinum", 1600], ["diamond", "Diamond", 3200], ["master", "Master", 6000]],
  themes: [["default", "MEIOCG", false], ["ocean", "Ocean", false], ["dusk", "Dusk", false], ["aurora", "Aurora", true], ["nebula", "Nebula", true], ["inferno", "Inferno", true], ["royal", "Royal Gold", true], ["synapse", "Synapse Grid", true]],
};
/* PROFILE_DATA_END */

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const TIER_IDS = PROFILE_DATA.tiers.map((t) => t[0]);
const FRAME_IDS = ["none", ...TIER_IDS, "premium"];
const THEME_IDS = PROFILE_DATA.themes.map((t) => t[0]);
const tierName = (id) => (PROFILE_DATA.tiers.find((t) => t[0] === id) || ["", "Rookie"])[1];

/** A preset icon as an SVG data URL. */
function presetIcon(id) {
  const p = PROFILE_DATA.icons[id];
  if (!p) return "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p[0]}"/><stop offset="1" stop-color="${p[1]}"/></linearGradient></defs><rect width="48" height="48" fill="url(#g)"/><g transform="translate(12 12)" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${p[2]}"/></g></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
/** Cleans a profile that came from KodeX or from the other player. */
function cleanProfile(v, imgOk) {
  if (!v || typeof v !== "object") return null;
  const t = (x, n) => String(x == null ? "" : x).replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
  const premium = v.premium === true;
  let icon = t(v.icon, 12);
  const img = premium && icon === "custom" && typeof v.img === "string" && v.img.length < 400000 && (!imgOk || imgOk(v.img)) ? v.img : "";
  if (icon === "custom" && !img) icon = "meiocg";
  if (icon !== "custom" && icon !== "meiocg" && !PROFILE_DATA.icons[icon]) icon = "meiocg";
  let frame = FRAME_IDS.includes(v.frame) ? v.frame : "none";
  if (frame === "premium" && !premium) frame = "none";
  const theme = THEME_IDS.includes(v.theme) && (premium || !PROFILE_DATA.themes.find((x) => x[0] === v.theme)[2]) ? v.theme : "default";
  const n = (x) => Math.max(0, Math.min(1e7, Math.floor(Number(x) || 0)));
  return { name: t(v.name, 24) || "Duelist", title: t(v.title, 32), bio: t(v.bio, 140), icon, img, frame, theme, premium,
    tier: TIER_IDS.includes(v.tier) ? v.tier : "rookie", accent: premium && /^#[0-9a-f]{6}$/i.test(v.accent || "") ? v.accent : "",
    stats: { points: n(v.stats && v.stats.points), days: n(v.stats && v.stats.days), duels: n(v.stats && v.stats.duels), wins: n(v.stats && v.stats.wins) } };
}
/** The picture for a profile (MEIOCG logo, a preset or their own). */
function iconSrc(p, meiocgLogo) {
  if (!p) return meiocgLogo;
  if (p.icon === "custom" && p.img) return p.img;
  return presetIcon(p.icon) || meiocgLogo;
}
/** <span class="pf-av fr-…"><img></span> */
function avatarHTML(p, meiocgLogo, size = 0) {
  const fr = (p && p.frame) || "none";
  return `<span class="pf-av fr-${fr}"${size ? ` style="--pf:${size}px"` : ""}><img src="${esc(iconSrc(p, meiocgLogo))}" alt="" draggable="false"></span>`;
}
/** The profile card (opened by tapping a player's plate). */
function cardHTML(p, meiocgLogo, opts = {}) {
  if (!p) return "";
  const s = p.stats || {}, rate = s.duels ? Math.round((s.wins / s.duels) * 100) + "%" : "–";
  return `<div class="pf-card th-${esc(p.theme || "default")}"${p.accent ? ` style="--pf-acc:${esc(p.accent)}"` : ""}>
    <div class="pf-banner"><i></i></div>
    <div class="pf-head">${avatarHTML(p, meiocgLogo, 84)}<div class="pf-who"><b>${esc(p.name)}</b>${p.title ? `<span>${esc(p.title)}</span>` : ""}
      <div class="pf-tags"><em class="pf-tier t-${esc(p.tier)}">${esc(tierName(p.tier))}</em>${p.premium ? '<em class="pf-prem">PREMIUM</em>' : ""}${opts.ai ? '<em class="pf-ai">AI</em>' : ""}</div></div></div>
    ${p.bio ? `<p class="pf-bio">${esc(p.bio)}</p>` : ""}
    ${opts.ai ? "" : `<div class="pf-stats"><div><b>${s.days || 0}</b><span>Days on KodeX</span></div><div><b>${s.duels || 0}</b><span>Duels</span></div><div><b>${rate}</b><span>Win rate</span></div><div><b>${s.points || 0}</b><span>Points</span></div></div>`}
  </div>`;
}

return{PROFILE_DATA,TIER_IDS,FRAME_IDS,THEME_IDS,tierName,presetIcon,cleanProfile,iconSrc,avatarHTML,cardHTML}})();
/* KodeX 9.1: player profile (Settings, Arena plates, MEIOCG Players page), help bubble, legality on every card,
   the Arena gets the KodeX decks, profile and Forbidden & Limited list from the app itself. */
const KXP_LOGO=()=>{const l=document.querySelector('header .logo img');return l&&l.src||''};
const KXP_TIERS=KXPF.PROFILE_DATA.tiers;
function kxpAct(){const a=S.g('pf_act',{});return{days:+a.days||0,last:String(a.last||''),duels:+a.duels||0,wins:+a.wins||0,looks:+a.looks||0}}
function kxpPoints(a){a=a||kxpAct();return a.days*10+a.duels*4+deckStore().length*5+Math.min(300,a.looks)}
function kxpTier(p){let t=KXP_TIERS[0];for(const x of KXP_TIERS)if(p>=x[2])t=x;return t}
function kxpNext(p){return KXP_TIERS.find(x=>x[2]>p)||null}
function kxpFrames(p){const ok=new Set(['none']);for(const x of KXP_TIERS)if(p>=x[2])ok.add(x[0]);if(PREMIUM)ok.add('premium');return ok}
function kxpRaw(){const r=S.g('pf',{});return r&&typeof r==='object'&&!Array.isArray(r)?r:{}}
function kxpImg(){try{return localStorage.getItem('kx_pf_img')||''}catch(e){return ''}}
/** The player's profile as the Arena and the profile card draw it. */
function kxProfile(){const r=kxpRaw(),a=kxpAct(),pts=kxpPoints(a),t=kxpTier(pts),fr=kxpFrames(pts);
 const p=KXPF.cleanProfile({name:r.name||'Duelist',title:r.title||'',bio:r.bio||'',icon:r.icon||'meiocg',img:PREMIUM&&r.icon==='custom'?kxpImg():'',
  frame:r.frame==null?(PREMIUM?'premium':t[0]):(fr.has(r.frame)?r.frame:t[0]),theme:r.theme||'default',accent:r.accent||'',premium:PREMIUM,tier:t[0],
  stats:{points:pts,days:a.days,duels:a.duels,wins:a.wins}});return p}
function kxpSave(r){S.s('pf',r);kxpRefresh();kxpToArena();kxpPing(true)}
/* activity: a day you open KodeX, each duel (and win) in the Arena, each card you look up */
(function(){const a=kxpAct(),d=new Date(),day=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();if(a.last!==day){a.days++;a.last=day;S.s('pf_act',a)}})();
(function(){const o=window.openCard;if(typeof o!=='function')return;window.openCard=function(){try{const a=kxpAct();if(a.looks<300){a.looks++;S.s('pf_act',a)}}catch(e){}return o.apply(this,arguments)}})();
function kxpDuel(m){if(!m||!m.result)return;const a=kxpAct();a.duels++;if(m.result.win)a.wins++;S.s('pf_act',a);kxpRefresh();kxpToArena();kxpPing()}

/* ---------- Arena: profile, decks and the Forbidden & Limited list come from KodeX (nothing to fetch) ---------- */
function kxpPost(msg){const f=$('arenaFrame');if(!f||!f.contentWindow)return;try{f.contentWindow.postMessage(msg,'*')}catch(e){}}
function kxpToArena(){kxpPost({kx:'profile',p:kxProfile()})}
function kxpDecksToArena(){const out=[];for(const d of deckStore()){const sec=k=>{const a=[];for(const c of d.cards||[]){if(c.section!==k)continue;const n=Number(pcOf(c));if(n>0)for(let i=0;i<Math.max(1,c.qty||1);i++)a.push(n)}return a};const x={name:String(d.name||'Deck').slice(0,60),main:sec('main'),extra:sec('extra'),side:sec('side')};if(x.main.length)out.push(x)}kxpPost({kx:'decks',decks:out.slice(0,200)})}
function kxpBanToArena(){const map={};for(const c of cards)if(c.ban in BANMAX&&/^\d{3,10}$/.test(String(c.id)))map[c.id]=BANMAX[c.ban];kxpPost({kx:'banlist',map})}
addEventListener('message',e=>{const f=$('arenaFrame');if(!f||e.source!==f.contentWindow)return;const d=e.data||{};
 if(d.kx==='ready'){kxpToArena();kxpDecksToArena();kxpBanToArena()}
 if(d.kx==='stats')kxpDuel(d)});
{const ss=S.s;let tm=0;S.s=function(k){const r=ss.apply(this,arguments);if(k==='decks'){clearTimeout(tm);tm=setTimeout(()=>{try{kxpDecksToArena();kxpRefresh()}catch(e){}},400)}return r}}

/* ---------- MEIOCG Players page (opt-in) ---------- */
const KXP_API='https://kodex.meiocg.org/api/players/';
function kxpId(){let r=kxpRaw();if(!r.id||!r.key){const rnd=n=>{const a=new Uint8Array(n);crypto.getRandomValues(a);return [...a].map(x=>x.toString(36).padStart(2,'0')).join('').slice(0,n)};r={...r,id:rnd(24).replace(/[^a-z0-9]/g,'a'),key:rnd(40).replace(/[^A-Za-z0-9]/g,'k')};S.s('pf',r)}return r}
async function kxpPing(force){const r=kxpRaw();if(!r.listed||!navigator.onLine)return;const last=+S.g('pf_ping',0);if(!force&&Date.now()-last<5*60e3)return;if(force&&Date.now()-last<4*60e3+5e3)return;
 const k=kxpId(),p=kxProfile();S.s('pf_ping',Date.now());
 try{const res=await fetch(KXP_API+'ping',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:k.id,key:k.key,name:p.name,title:p.title,bio:p.bio,icon:p.icon,frame:p.frame,tier:p.tier,premium:p.premium,points:p.stats.points,days:p.stats.days,duels:p.stats.duels,wins:p.stats.wins,decks:deckStore().length})});const j=await res.json().catch(()=>({}));if(j&&j.rank){S.s('pf_rank',j.rank);kxpRefresh()}}catch(e){}}
async function kxpLeave(){const r=kxpRaw();if(!r.id||!r.key)return;try{await fetch(KXP_API+'leave',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:r.id,key:r.key})})}catch(e){}S.s('pf_rank',0);S.s('pf_ping',0)}
setTimeout(()=>kxpPing(),6000);

/* ---------- Settings: the profile card above Premium ---------- */
function kxpCardRow(){const p=kxProfile(),pts=p.stats.points,nx=kxpNext(pts),t=kxpTier(pts),pct=nx?Math.round((pts-t[2])/(nx[2]-t[2])*100):100,rank=+S.g('pf_rank',0);
 return `${KXPF.avatarHTML(p,KXP_LOGO(),56)}<span class="pfs-who"><b>${esc(p.name)}</b><small>${esc(KXPF.tierName(p.tier))} frame · ${pts} points${rank&&kxpRaw().listed?` · #${rank} on MEIOCG Players`:''}</small><span class="pfs-bar" aria-hidden="true"><i style="width:${pct}%"></i></span><small class="pfs-nx">${nx?`${nx[2]-pts} points to ${esc(nx[1])}`:'Every frame unlocked'}</small></span>${ic('back',18).replace('<svg','<svg style="transform:rotate(180deg)"')}`}
function kxpRefresh(){const b=$('bProfile');if(b)b.innerHTML=kxpCardRow();const h=$('bHelp');if(h)h.dataset.ok='1'}
(function(){const sb=document.querySelector('#Lset .sb'),prem=sb&&[...sb.querySelectorAll('.sec')].find(x=>x.textContent.trim()==='Premium');if(!sb)return;
 const sec=document.createElement('div');sec.className='sec';sec.textContent='Profile';const g=document.createElement('div');g.className='grp';
 g.innerHTML='<button class="pfs-card" id="bProfile" aria-label="Your profile"></button>';sb.insertBefore(sec,prem||sb.firstChild);sb.insertBefore(g,prem||sb.firstChild);
 $('bProfile').onclick=()=>kxpView();kxpRefresh()})();

function kxpView(){const p=kxProfile(),pts=p.stats.points,fr=kxpFrames(pts),r=kxpRaw();
 const m=openModal(`<div class="dk-hd"><h3>Your profile</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>${KXPF.cardHTML(p,KXP_LOGO())}
 <div class="pfv-sec">Icon frames <small>Unlock by using KodeX: a day here 10 points, a duel 4, a deck 5, cards you look up 1 each (up to 300).</small></div>
 <div class="pfv-frames">${['none',...KXP_TIERS.map(x=>x[0]),'premium'].map(f=>{const t=KXP_TIERS.find(x=>x[0]===f),ok=fr.has(f);return `<span class="pfv-fr${ok?'':' lock'}">${KXPF.avatarHTML({...p,frame:f},KXP_LOGO(),44)}<small>${f==='none'?'None':f==='premium'?'Premium':esc(t[1])}</small><em>${ok?'':f==='premium'?'Premium':t[2]+' pts'}</em></span>`}).join('')}</div>
 <div class="pfv-sec">MEIOCG Players</div><div class="pfv-list">${r.listed?`<b>You're listed${S.g('pf_rank',0)?` · #${S.g('pf_rank',0)}`:''}</b>`:'<b>Not listed</b>'}<small>${r.listed?'Your name, title, icon (presets only), frame and activity show on meiocg.org/players.':'Turn it on in Edit profile to appear on meiocg.org/players. Opt-in; no email or account.'}</small></div>
 <div class="dact"><button class="btn" data-pfplayers>Players page</button><button class="btn p" data-pfedit>${ic('edit',18)}Edit profile</button></div>`,'big pfv-dlg');
 m.querySelector('[data-pfedit]').onclick=()=>{closeModal();setTimeout(kxpEdit,180)};
 m.querySelector('[data-pfplayers]').onclick=()=>openLink('https://meiocg.org/players','MEIOCG Players')}

function kxpEdit(){const r={...kxpRaw()},pts=kxpPoints(),fr=kxpFrames(pts),D=KXPF.PROFILE_DATA,logo=KXP_LOGO();let img=kxpImg();
 const st={icon:r.icon||'meiocg',frame:r.frame==null?(PREMIUM?'premium':kxpTier(pts)[0]):(fr.has(r.frame)?r.frame:kxpTier(pts)[0]),theme:r.theme||'default',accent:r.accent||'#8d99ff'};
 if(st.icon==='custom'&&!(PREMIUM&&img))st.icon='meiocg';
 const icons=['meiocg',...Object.keys(D.icons)];
 const m=openModal(`<div class="dk-hd"><h3>Edit profile</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
 <div class="pfe-prev" id="pfePrev"></div>
 <label class="pfe-l">Name<input class="fld" id="pfeName" maxlength="24" value="${esc(r.name||'')}" placeholder="Duelist"></label>
 <label class="pfe-l">Title<input class="fld" id="pfeTitle" maxlength="32" value="${esc(r.title||'')}" placeholder="e.g. Ritual main · Manila"></label>
 <label class="pfe-l">About<textarea class="fld" id="pfeBio" maxlength="140" rows="2" placeholder="A line about you or your deck">${esc(r.bio||'')}</textarea></label>
 <div class="pfv-sec">Icon${PREMIUM?'':' <small>Free: the MEIOCG icon and presets. KodeX Premium: your own picture or GIF.</small>'}</div>
 <div class="pfe-grid" id="pfeIcons">${icons.map(i=>`<button type="button" class="pfe-ic" data-ic="${i}" aria-label="${i==='meiocg'?'MEIOCG':i}"><img src="${esc(i==='meiocg'?logo:KXPF.presetIcon(i))}" alt=""></button>`).join('')}<button type="button" class="pfe-ic pfe-up${PREMIUM?'':' lock'}" data-ic="custom" aria-label="Your picture">${PREMIUM&&img?`<img src="${esc(img)}" alt="">`:ic('up',22)}<em>${PREMIUM?'Upload':'Premium'}</em></button><input type="file" id="pfeFile" accept="image/png,image/jpeg,image/webp,image/gif" hidden></div>
 <div class="pfv-sec">Icon frame <small>${pts} points</small></div>
 <div class="pfe-grid fr" id="pfeFrames">${['none',...KXP_TIERS.map(x=>x[0]),'premium'].map(f=>{const t=KXP_TIERS.find(x=>x[0]===f);return `<button type="button" class="pfe-fr${fr.has(f)?'':' lock'}" data-fr="${f}"><span class="pfe-fx"></span><small>${f==='none'?'None':f==='premium'?'Premium':esc(t[1])}</small>${fr.has(f)?'':`<em>${f==='premium'?'Premium':t[2]+' pts'}</em>`}</button>`}).join('')}</div>
 <div class="pfv-sec">Banner${PREMIUM?'':' <small>Animated banners come with KodeX Premium.</small>'}</div>
 <div class="pfe-grid th" id="pfeThemes">${D.themes.map(([id,l,pr])=>`<button type="button" class="pfe-th th-${id}${pr&&!PREMIUM?' lock':''}" data-th="${id}"><span class="pf-card th-${id}"><span class="pf-banner"><i></i></span></span><small>${esc(l)}</small>${pr&&!PREMIUM?'<em>Premium</em>':''}</button>`).join('')}</div>
 ${PREMIUM?`<label class="pfe-l row1">Accent colour<input type="color" id="pfeAcc" value="${esc(st.accent)}"></label>`:''}
 <label class="pfe-tg"><input type="checkbox" id="pfeList"${r.listed?' checked':''}><span><b>Show me on MEIOCG Players</b><small>meiocg.org/players lists active KodeX players. Only your name, title, about, preset icon, frame and activity counts are shared. Turn off to be removed.</small></span></label>
 <div class="dact"><button class="btn" data-close>Cancel</button><button class="btn p" id="pfeOk">Save</button></div>`,'big pfe-dlg');
 const q=s=>m.querySelector(s);
 const draft=()=>KXPF.cleanProfile({name:q('#pfeName').value||'Duelist',title:q('#pfeTitle').value,bio:q('#pfeBio').value,icon:st.icon,img:st.icon==='custom'?img:'',frame:st.frame,theme:st.theme,accent:PREMIUM?st.accent:'',premium:PREMIUM,tier:kxpTier(pts)[0],stats:kxProfile().stats});
 const paint=()=>{const p=draft();q('#pfePrev').innerHTML=KXPF.cardHTML(p,logo);
  m.querySelectorAll('[data-ic]').forEach(b=>b.classList.toggle('on',b.dataset.ic===st.icon));
  m.querySelectorAll('[data-fr]').forEach(b=>{b.classList.toggle('on',b.dataset.fr===st.frame);b.querySelector('.pfe-fx').innerHTML=KXPF.avatarHTML({...p,frame:b.dataset.fr},logo,40)});
  m.querySelectorAll('[data-th]').forEach(b=>b.classList.toggle('on',b.dataset.th===st.theme))};
 m.addEventListener('input',paint);
 m.addEventListener('click',e=>{const b=e.target.closest('[data-ic],[data-fr],[data-th]');if(!b)return;
  if(b.dataset.ic){if(b.dataset.ic==='custom'){if(!PREMIUM){toast('Your own picture comes with KodeX Premium');return}q('#pfeFile').click();return}st.icon=b.dataset.ic}
  if(b.dataset.fr){if(!fr.has(b.dataset.fr)){const t=KXP_TIERS.find(x=>x[0]===b.dataset.fr);toast(t?`Unlocks at ${t[2]} points (you have ${pts})`:'The Premium frame comes with KodeX Premium');return}st.frame=b.dataset.fr}
  if(b.dataset.th){const t=D.themes.find(x=>x[0]===b.dataset.th);if(t[2]&&!PREMIUM){toast('Animated banners come with KodeX Premium');return}st.theme=b.dataset.th}
  paint()});
 q('#pfeFile').onchange=async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;try{img=await kxpPicture(f);st.icon='custom';const u=q('.pfe-up');u.innerHTML=`<img src="${esc(img)}" alt=""><em>Upload</em>`;paint()}catch(x){toast(x.message||'That picture could not be used')}};
 if(q('#pfeAcc'))q('#pfeAcc').oninput=e=>{st.accent=e.target.value;paint()};
 q('#pfeOk').onclick=()=>{const was=!!r.listed,listed=q('#pfeList').checked,name=q('#pfeName').value.trim();if(listed&&name.length<2){toast('Add a name (2 letters or more) to be listed');return}
  if(st.icon==='custom'){try{localStorage.setItem('kx_pf_img',img)}catch(x){toast('Not enough space for that picture');return}}
  kxpSave({...kxpRaw(),name:name.slice(0,24),title:q('#pfeTitle').value.trim().slice(0,32),bio:q('#pfeBio').value.trim().slice(0,140),icon:st.icon,frame:st.frame,theme:st.theme,accent:PREMIUM?st.accent:'',listed});
  if(listed&&!was){S.s('pf_ping',0);kxpPing()}if(!listed&&was)kxpLeave();
  closeModal();toast(listed&&!was?'Saved · you\'ll appear on MEIOCG Players shortly':'Profile saved')};
 paint()}
/** Premium picture: GIFs under 300 KB stay animated; anything else becomes a 256 px square. */
function kxpPicture(f){return new Promise((ok,no)=>{if(!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)){no(new Error('Choose a PNG, JPG, WebP or GIF'));return}
 const rd=new FileReader();rd.onerror=()=>no(new Error('Could not read the file'));rd.onload=()=>{const u=String(rd.result);if(f.type==='image/gif'&&u.length<400000){ok(u);return}
  const im=new Image();im.onload=()=>{const s=256,c=document.createElement('canvas');c.width=c.height=s;const x=c.getContext('2d'),k=Math.min(im.width,im.height);x.drawImage(im,(im.width-k)/2,(im.height-k)/2,k,k,0,0,s,s);let out=c.toDataURL('image/webp',.86);if(!/^data:image\/webp/.test(out))out=c.toDataURL('image/jpeg',.86);out.length<400000?ok(out):no(new Error('That picture is too large'))};im.onerror=()=>no(new Error('That picture could not be opened'));im.src=u};rd.readAsDataURL(f)})}

/* ---------- Legality on every card ---------- */
const kxLegal=c=>{const b=c&&c.ban;return b in BANMAX?`<em class="tg lgl l${BANMAX[b]}">${b==='Forbidden'?'Banned':esc(b)}</em>`:''};
function row(c){
  const im=S.g('sp',true)&&(c.sm||c.img)?`<img data-id="${esc(c.id)}" src="${esc(c.sm||c.img)}" alt="" loading="lazy" decoding="async">`:'';
  const ct=cat(c),l=c.lk?'Link '+c.lk:c.rk?'Rank '+c.rk:c.lv?'Level '+c.lv:'',st=[c.atk!=null&&c.atk!==''?'ATK '+c.atk:'',c.lk==null&&c.def!=null&&c.def!==''?'DEF '+c.def:''].filter(Boolean).join(' • ');
  return `<button class="card" data-id="${esc(c.id)}">${im}<span class="ci"><b class="cn">${esc(c.name)}${isFav(c)?` <span class="fm" aria-label="Favorite">${ic('star',13)}</span>`:''}</b><span class="tags">${kxLegal(c)}<em class="tg ${ct[0].toLowerCase()}">${esc(c.type||'Card')}</em>${c.attr?`<em class="tg">${esc(c.attr)}</em>`:''}</span><span class="meta">${[c.race,l].filter(Boolean).map(esc).join(' • ')}</span>${st?`<span class="meta">${esc(st)}</span>`:''}</span><span class="chev" aria-hidden="true">›</span></button>`;
}

/* ---------- Help bubble: find any feature, quick settings, the Forbidden & Limited list ---------- */
const KXH=[
 ['Search cards','find card name text effect',()=>{const q=$('q');if(q){q.focus();q.select()}}],
 ['Card filters','filter type attribute level atk def race archetype',()=>$('bFil').click()],
 ['Scan a card','camera scan photo',()=>{const b=$('bScan');if(b)b.click()}],
 ['Forbidden & Limited list','banlist banned limited semi-limited ocg legality',()=>kxBanlist()],
 ['Decks','deck manager builder my decks',()=>$('nDeck').click()],
 ['New deck','create deck add',()=>{$('nDeck').click();setTimeout(()=>{const b=document.querySelector('[data-dknew]');if(b)b.click()},250)}],
 ['Paste or import a deck','ydke ydk text list import paste link',()=>{$('nDeck').click();setTimeout(()=>{const b=document.querySelector('[data-dkpaste]');if(b)b.click()},250)}],
 ['Duel Arena','duel play arena ai online room test hand',()=>openArena('')],
 ['Your profile','profile icon frame name title avatar players',()=>kxpView()],
 ['Edit profile','profile edit icon frame banner name',()=>kxpEdit()],
 ['MEIOCG Players','players ranking leaderboard active',()=>openLink('https://meiocg.org/players','MEIOCG Players')],
 ['Settings','settings options preferences',()=>$('bSet').click()],
 ['KodeX Premium','premium ads remove upgrade',()=>{const b=$('bPrem');if(b)b.click();else $('bSet').click()}],
 ['Search history','history recent',()=>{const b=$('bHis');if(b)b.click()}],
 ['Advanced ruling search','rulings ruling faq q&a',()=>{const b=$('bAdv');if(b)b.click()}],
 ['System check','self check diagnostics problem fix',()=>{const b=$('bChk');if(b)b.click()}],
 ['Email MEIOCG','contact support email help',()=>{location.href='mailto:metainsiderocg@gmail.com?subject=KodeX%20Support'}],
];
function kxHelpIndex(){const out=KXH.map(([t,k,f])=>({t,k:(t+' '+k).toLowerCase(),f,g:'KodeX'}));const sb=document.querySelector('#Lset .sb');if(sb){let sec='Settings';for(const el of sb.querySelectorAll('.sec, .row strong, .lnk span, .grp > button span'))if(el.classList.contains('sec'))sec=el.textContent.trim();else{const t=el.textContent.trim();if(t&&t.length<60&&!out.some(o=>o.t===t))out.push({t,k:(t+' '+sec).toLowerCase(),g:'Settings · '+sec,f:()=>kxGoSetting(el)})}}return out}
function kxGoSetting(el){$('bSet').click();setTimeout(()=>{const r=el.closest('.row,.lnk,button')||el;r.scrollIntoView({block:'center'});r.classList.add('kx-flash');setTimeout(()=>r.classList.remove('kx-flash'),1800)},280)}
const kxInArena=()=>L.includes('arena')&&$('Larena').classList.contains('open');
function kxRun(f){closeModal();if(kxInArena()&&f!==kxBanlist&&f!==kxpView){setTimeout(()=>{arenaMin=true;history.back();setTimeout(f,350)},220)}else setTimeout(f,200)}
function kxHelp(){const arena=kxInArena(),idx=kxHelpIndex();
 const m=openModal(`<div class="dk-hd"><h3>Help &amp; quick settings</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
 <div class="kh-s">${ic('search',18)}<input id="khQ" type="search" placeholder="Find a feature or setting" autocomplete="off" aria-label="Find a feature or setting"></div>
 <div id="khR" class="kh-r" hidden></div>
 <div id="khT" class="kh-t">
  <button data-kh="ban">${ic('list',22)}<b>Banlist</b><small>OCG Forbidden &amp; Limited</small></button>
  <button data-kh="pf">${ic('star',22)}<b>Profile</b><small>Icon, frame, banner</small></button>
  ${arena?'':`<button data-kh="fil">${ic('search',22)}<b>Filters</b><small>Narrow the card list</small></button>`}
  <button data-kh="deck">${ic('deck',22)}<b>Decks</b><small>Build, import, analyze</small></button>
  ${arena?'':`<button data-kh="arena">${ic('play',22)}<b>Duel Arena</b><small>AI or online</small></button>`}
  <button data-kh="set">${ic('edit',22)}<b>Settings</b><small>Theme, display, offline</small></button>
 </div>
 <p class="kh-f">Can't find something? <a href="mailto:metainsiderocg@gmail.com?subject=KodeX%20Help">Email MEIOCG</a></p>`,'big kh-dlg');
 const R=m.querySelector('#khR'),T=m.querySelector('#khT'),inp=m.querySelector('#khQ');let hits=[];
 inp.oninput=()=>{const s=inp.value.trim().toLowerCase();if(!s){R.hidden=true;T.hidden=false;return}const w=s.split(/\s+/);hits=idx.filter(o=>w.every(x=>o.k.includes(x))).slice(0,14);R.hidden=false;T.hidden=true;R.innerHTML=hits.length?hits.map((o,i)=>`<button data-hit="${i}"><b>${esc(o.t)}</b><small>${esc(o.g)}</small></button>`).join(''):`<p class="kh-none">Nothing found for “${esc(inp.value)}”. Try another word.</p>`};
 m.addEventListener('click',e=>{const h=e.target.closest('[data-hit]');if(h){kxRun(hits[+h.dataset.hit].f);return}const t=e.target.closest('[data-kh]');if(!t)return;
  ({ban:()=>kxRun(kxBanlist),pf:()=>kxRun(kxpView),fil:()=>kxRun(()=>$('bFil').click()),deck:()=>kxRun(()=>$('nDeck').click()),arena:()=>kxRun(()=>openArena('')),set:()=>kxRun(()=>$('bSet').click())})[t.dataset.kh]()});
 setTimeout(()=>{if(!matchMedia('(pointer:coarse)').matches)inp.focus()},150)}
function kxBanlist(){const g={Forbidden:[],Limited:[],'Semi-Limited':[]};for(const c of cards)if(g[c.ban])g[c.ban].push(c);for(const k in g)g[k].sort((a,b)=>a.name.localeCompare(b.name));
 const arena=kxInArena(),tabs=[['Forbidden','Banned'],['Limited','Limited'],['Semi-Limited','Semi-Limited']];let cur='Forbidden';
 const m=openModal(`<div class="dk-hd"><h3>OCG Forbidden &amp; Limited</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
 <div class="kb-tabs" role="tablist">${tabs.map(([k,l])=>`<button role="tab" data-kb="${k}" class="l${BANMAX[k]}">${l}<i>${g[k].length}</i></button>`).join('')}</div>
 <div class="kh-s">${ic('search',18)}<input id="kbQ" type="search" placeholder="Search the list" autocomplete="off" aria-label="Search the list"></div>
 <div id="kbL" class="kb-l"></div><p class="kh-f">From KodeX's card database; it updates with each card data refresh.</p>`,'big kb-dlg');
 const list=m.querySelector('#kbL'),inp=m.querySelector('#kbQ');
 const draw=()=>{const s=inp.value.trim().toLowerCase();m.querySelectorAll('[data-kb]').forEach(b=>b.classList.toggle('on',b.dataset.kb===cur));const xs=(s?[...g.Forbidden,...g.Limited,...g['Semi-Limited']].filter(c=>c.name.toLowerCase().includes(s)):g[cur]);
  list.innerHTML=xs.length?xs.slice(0,400).map(c=>`<button class="kb-c" data-kbc="${esc(c.id)}"${arena?' disabled':''}>${c.sm||c.img?`<img src="${esc(c.sm||c.img)}" alt="" loading="lazy">`:''}<span><b>${esc(c.name)}</b><small>${esc(c.type||'')}</small></span>${kxLegal(c)}</button>`).join(''):'<p class="kh-none">No cards.</p>'};
 m.addEventListener('click',e=>{const t=e.target.closest('[data-kb]');if(t){cur=t.dataset.kb;inp.value='';draw();return}const c=e.target.closest('[data-kbc]');if(c&&!arena){closeModal();setTimeout(()=>openCard(c.dataset.kbc),200)}});
 inp.oninput=draw;draw()}
(function(){const f=$('bFil');if(!f)return;
 // the filters move into the search bar; the bubble becomes help
 const sb=document.querySelector('.searchbox');if(sb&&!$('bFil2')){const b=document.createElement('button');b.id='bFil2';b.className='scanbtn';b.setAttribute('aria-label','Filters');b.innerHTML='<svg class="i" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg><i id="fc2" hidden>0</i>';b.onclick=()=>f.click();sb.appendChild(b);
  const sync=()=>{const fc=$('fc'),c2=$('fc2');if(fc&&c2){c2.hidden=fc.hidden;c2.textContent=fc.textContent}};new MutationObserver(sync).observe($('fc'),{attributes:true,childList:true,characterData:true,subtree:true});sync()}
 f.classList.add('kx-fil-old');
 const h=document.createElement('button');h.id='bHelp';h.className='kx-help';h.setAttribute('aria-label','Help and quick settings');h.setAttribute('aria-haspopup','dialog');h.innerHTML='<svg class="i" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.2"/><path d="M9.4 9.3a2.7 2.7 0 0 1 5.2 1c0 1.9-2.6 2.4-2.6 4"/><circle cx="12" cy="17.4" r=".6" fill="currentColor"/></svg>';h.onclick=kxHelp;document.body.appendChild(h);
 const bar=document.querySelector('#Larena .arbar'),mn=$('arMin');if(bar){const a=document.createElement('button');a.className='ibtn ar-help';a.id='arHelp';a.setAttribute('aria-label','Help and quick settings');a.innerHTML=h.innerHTML.replace('width="24" height="24"','width="21" height="21"');a.onclick=kxHelp;bar.insertBefore(a,mn||bar.querySelector('[data-close]'))}
 const where=()=>{const t=L[L.length-1]||'';document.body.dataset.kxtop=t.startsWith('m:')?'modal':t};const o=window.navSync;if(typeof o==='function')window.navSync=function(){const r=o.apply(this,arguments);where();return r};where()})();
addEventListener('dragstart',()=>document.body.classList.add('kx-drag'),true);for(const t of ['dragend','drop'])addEventListener(t,()=>document.body.classList.remove('kx-drag'),true);

