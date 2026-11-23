/* KodeX 10.3.7 (v76)
 * - Duelist Studio (was Premium Studio) opens in the free edition too: everything is shown, the Premium parts are
 *   marked and locked, and the free parts (quick reactions, combo video credits) work. Settings has its own entry.
 * - Quick reactions (the Arena's emotes, sounds and phrases, up to 6, 2 by default) can be chosen in the Studio.
 * - The Premium page in Settings now shows Combos: what they can do, and what Premium adds.
 * - Free edition: up to 3 decks. Premium: no limit.
 * - Combos › Settings: what every combo video says at its end (MEIOCG always; Premium: your name, deck, handle, a line
 *   of your own and the colours) and, for Premium, a dramatic effect on every summon and activation.
 * Created by Castel Noleal, creator of MEIOCG. A project of Meta Insider OCG since 2023.
 */

IC.settings =
  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>';

/* ---------- free edition: 3 decks ---------- */
const KX_FREE_DECKS = 3;
function kxDeckLimitHit() {
  if (PREMIUM || deckStore().length < KX_FREE_DECKS) return false;
  const m = openModal(
    `<div class="dk-hd"><h3>${KX_FREE_DECKS} decks in the free edition</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div><p class="note">The free edition keeps up to ${KX_FREE_DECKS} decks. Delete one to make room, or keep as many as you like with <strong>KodeX Premium</strong>.</p><div class="dact"><button class="btn" data-close>OK</button><button class="btn p" data-gp>See KodeX Premium</button></div>`,
    '',
    'decklim'
  );
  m.querySelector('[data-gp]').onclick = () => {
    history.back();
    setTimeout(openPremiumInfo, 250);
  };
  return true;
}
{
  const cd = createDeck;
  createDeck = function () {
    if (kxDeckLimitHit()) return null;
    return cd.apply(this, arguments);
  };
  const df = deckForm;
  // asked before the name is typed, not after
  deckForm = function (d) {
    if (!d && kxDeckLimitHit()) return;
    return df.apply(this, arguments);
  };
}

/* ---------- quick reactions, shared with the Arena ---------- */
const KX_QUICK_DEFAULT = ['gg', 'nice'];
const KX_EMOTES = [
  ['hi', '👋', 'Hi'],
  ['gg', '🤝', 'Good game'],
  ['nice', '👍', 'Nice'],
  ['wow', '😮', 'Wow'],
  ['think', '🤔', 'Hmm…'],
  ['oops', '😅', 'Oops'],
  ['fire', '🔥', "Let's go"],
  ['gl', '🍀', 'Good luck']
];
const KX_SOUNDS = [
  ['boom', '💥', 'Boom', 0],
  ['airhorn', '📯', 'Air horn', 0],
  ['sadtrom', '🎺', 'Sad trombone', 0],
  ['rimshot', '🥁', 'Ba-dum-tss', 0],
  ['dramatic', '😱', 'Dun dun dunnn', 0],
  ['crickets', '🦗', 'Crickets', 1],
  ['bonk', '🔨', 'Bonk', 1],
  ['honk', '🦢', 'Honk', 1],
  ['applause', '👏', 'Applause', 1],
  ['scratch', '💿', 'Record scratch', 1],
  ['riser', '📈', 'Tension', 1],
  ['levelup', '⭐', 'Level up', 1],
  ['buzzer', '❌', 'Wrong!', 1],
  ['tada', '🎉', 'Ta-da', 1]
];
function kxArenaPref() {
  try {
    const v = JSON.parse(localStorage.getItem('duel:pref') || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch (e) {
    return {};
  }
}
function kxQuickList() {
  const a = kxArenaPref().quick;
  return (Array.isArray(a) ? a : KX_QUICK_DEFAULT).filter(x => typeof x === 'string' && x.length < 64).slice(0, 6);
}
function kxQuickSave(list, bar) {
  const p = kxArenaPref();
  p.quick = list.slice(0, 6);
  if (typeof bar === 'boolean') p.quickBar = bar;
  try {
    localStorage.setItem('duel:pref', JSON.stringify(p));
  } catch (e) {}
  try {
    const f = $('arenaFrame');
    if (f && f.contentWindow)
      f.contentWindow.postMessage({ kx: 'quick', list: p.quick, bar: p.quickBar === true }, '*');
  } catch (e) {}
}
function kxQuickLook(id) {
  if (id.startsWith('t:')) return { t: id.slice(2), n: id.slice(2), txt: 1 };
  if (id.startsWith('s:')) {
    const x = KX_SOUNDS.find(y => y[0] === id.slice(2));
    return x ? { t: x[1], n: x[2] } : null;
  }
  const b = KX_EMOTES.find(x => x[0] === id);
  if (b) return { t: b[1], n: b[2] };
  const own =
    (typeof MEDIA === 'object' && [...(MEDIA.emotes || []), ...(MEDIA.sounds || [])].find(x => x.id === id)) || null;
  return own ? { img: own.src || '', t: own.src ? '' : '🔊', n: own.name || 'Your emote' } : null;
}
function kxQuickTile(id, on, picked) {
  const q = kxQuickLook(id);
  if (!q) return '';
  return `<button type="button" class="qk-t${q.txt ? ' txt' : ''}${on ? ' on' : ''}${picked ? ' picked' : ''}" data-qk="${esc(id)}" title="${esc(q.n)}" aria-pressed="${on}" aria-label="${esc((picked ? 'Take out ' : on ? 'Chosen: ' : 'Add ') + q.n)}">${q.img ? `<img src="${esc(q.img)}" alt="">` : `<span>${esc(q.t)}</span>`}</button>`;
}
function kxQuickCard() {
  const a = kxQuickList(),
    p = kxArenaPref();
  const own =
    PREMIUM && typeof MEDIA === 'object' ? [...(MEDIA.emotes || []), ...(MEDIA.sounds || [])].map(x => x.id) : [];
  const group = (t, ids) =>
    ids.length
      ? `<div class="qk-h">${t}</div><div class="qk-g">${ids.map(id => kxQuickTile(id, a.includes(id), false)).join('')}</div>`
      : '';
  return `<section class="st-card qk-card" data-free="1"><div class="st-hd"><h4>Quick reactions</h4><p>Up to 6 emotes, sounds or phrases, first in the Arena's emote picker and, if you like, as buttons beside the emote button.</p></div>
 <div class="qk-now" data-qknow>${a.length ? a.map(id => kxQuickTile(id, true, true)).join('') : '<span class="qk-none">None chosen</span>'}</div>
 <form class="qk-add" data-qkadd><input class="fld" maxlength="40" placeholder="Add a phrase (sent as chat)" aria-label="Quick phrase"><button class="btn" type="submit">Add</button></form>
 ${group(
   'Emotes',
   KX_EMOTES.map(x => x[0])
 )}${group(
   'Sounds',
   KX_SOUNDS.filter(x => PREMIUM || !x[3]).map(x => 's:' + x[0])
 )}${group('Your emotes and sounds', own)}
 <label class="st-switch"><span><strong>Quick reaction buttons</strong><small>Shown beside the emote button in a duel</small></span><input type="checkbox" data-qkbar ${p.quickBar === true ? 'checked' : ''}><i aria-hidden="true"></i></label>
 <button type="button" class="btn st-wide" data-qkreset>Back to the default (Good game, Nice)</button></section>`;
}
function kxQuickBind(root) {
  const card = root.querySelector('.qk-card');
  if (!card) return;
  const redraw = () => {
    const n = document.createElement('div');
    n.innerHTML = kxQuickCard();
    card.replaceWith(n.firstElementChild);
    kxQuickBind(root);
  };
  card.addEventListener('click', e => {
    const b = e.target.closest('[data-qk]');
    if (b) {
      const id = b.dataset.qk,
        a = kxQuickList(),
        i = a.indexOf(id);
      if (i >= 0) a.splice(i, 1);
      else if (a.length >= 6) {
        toast('Up to 6 quick reactions');
        return;
      } else a.push(id);
      kxQuickSave(a);
      redraw();
      return;
    }
    if (e.target.closest('[data-qkreset]')) {
      kxQuickSave(KX_QUICK_DEFAULT);
      redraw();
    }
  });
  card.querySelector('[data-qkadd]').addEventListener('submit', e => {
    e.preventDefault();
    const i = e.currentTarget.querySelector('input'),
      t = i.value.trim().slice(0, 40),
      a = kxQuickList();
    if (!t || a.includes('t:' + t)) return;
    if (a.length >= 6) {
      toast('Up to 6 quick reactions');
      return;
    }
    kxQuickSave([...a, 't:' + t]);
    redraw();
  });
  card.querySelector('[data-qkbar]').addEventListener('change', e => kxQuickSave(kxQuickList(), e.target.checked));
}

/* ---------- combo settings: the video's end credits and the Premium dramatic effects ---------- */
const CB_FX = [
  ['', 'None', 'Only the usual moves'],
  ['shockwave', 'Shockwave', 'A white flash and rings of force that shake the table'],
  ['lightning', 'Lightning', 'The table goes dark and bolts strike the card'],
  ['inferno', 'Inferno', 'Flames roar up from below with a rain of embers'],
  ['cosmic', 'Cosmic', 'Warp-speed starlight streams out of the card'],
  ['glitch', 'Glitch', 'The picture tears into colour-split slices'],
  ['eclipse', 'Eclipse', 'A black sun rises behind the card, then bursts'],
  ['random', 'Random', 'A different one every time']
];
const CB_OPENINGS = [
  ['', 'Classic', 'The picture clears, the title lands and the key card slides in'],
  ['thunder', 'Thunderstrike', 'Darkness, then bolts strike down and the key card crashes in with a shockwave'],
  ['inferno', 'Inferno Rise', 'The screen catches fire and the key card rises out of the flames'],
  ['warp', 'Cosmic Warp', 'Warp-speed starlight; the key card flies out of the void'],
  ['shatter', 'Shatter', 'The screen cracks and explodes into shards to reveal the combo'],
  ['eclipse', 'Eclipse Summon', 'A summoning circle turns under a black sun and the key card rises from it'],
  ['cutin', 'Anime Cut-in', 'Speed lines, impact frames and a slanted cut-in of the key card'],
  ['random', 'Random', 'A different opening every time']
];
const CB_THEMES = [
  ['gold', 'Gold', '#f0b429'],
  ['neon', 'Neon', '#2ef2ff'],
  ['crimson', 'Crimson', '#ff4d6a'],
  ['ice', 'Ice', '#9fd3ff'],
  ['royal', 'Royal', '#b38bff']
];
function cbSet() {
  const v = S.g('cb_set', {}) || {};
  return {
    by: String(v.by || '').slice(0, 32),
    deck: String(v.deck || '').slice(0, 60),
    handle: String(v.handle || '').slice(0, 40),
    line: String(v.line || '').slice(0, 90),
    theme: CB_THEMES.some(t => t[0] === v.theme) ? v.theme : 'gold',
    secs: Math.max(3, Math.min(8, Number(v.secs) || 4.5)),
    fx: CB_FX.some(t => t[0] === v.fx) ? v.fx : '',
    opening: CB_OPENINGS.some(t => t[0] === v.opening) ? v.opening : ''
  };
}
function cbSettings() {
  const s = cbSet(),
    pf = typeof kxpRaw === 'function' ? kxpRaw().name || '' : '',
    lock = PREMIUM ? '' : ' disabled',
    pro = PREMIUM ? '' : `<em class="cbs-pro">${ic('star', 12)} Premium</em>`;
  const m = openModal(
    `<div class="dk-hd"><h3>Combo settings</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div><div class="qv-scroll cbs">
 <section class="cbs-sec"><h4>End credits</h4><p class="note">Every combo video ends with its credits${PREMIUM ? '' : ': the combo, who made it, its deck, and MEIOCG'}.${PREMIUM ? ' Set what they say and how they look. MEIOCG · Duel Synapse: KodeX is always shown at the bottom.' : ''}</p>
  <label class="cbs-l">Combo by ${pro}<input class="fld" data-cbs="by" maxlength="32" placeholder="${esc(pf || 'Your duelist name')}" value="${esc(s.by)}"${lock}></label>
  <label class="cbs-l">Deck ${pro}<input class="fld" data-cbs="deck" maxlength="60" placeholder="The combo's deck" value="${esc(s.deck)}"${lock}></label>
  <label class="cbs-l">Handle or channel ${pro}<input class="fld" data-cbs="handle" maxlength="40" placeholder="@yourname" value="${esc(s.handle)}"${lock}></label>
  <label class="cbs-l">Your line ${pro}<input class="fld" data-cbs="line" maxlength="90" placeholder="Like and follow for more combos!" value="${esc(s.line)}"${lock}></label>
  <div class="cbs-l">Colours ${pro}<div class="cbs-th" role="radiogroup" aria-label="Credit colours">${CB_THEMES.map(([k, l, c]) => `<button type="button" role="radio" class="cbs-tc${s.theme === k ? ' on' : ''}" data-cbth="${k}" aria-checked="${s.theme === k}" style="--c:${c}"${lock}><i></i>${l}</button>`).join('')}</div></div>
  <label class="cbs-l">Length <output data-cbsecs>${s.secs.toFixed(1)} s</output><input type="range" min="3" max="8" step="0.5" value="${s.secs}" data-cbs="secs"${lock}></label>
  <div class="cbs-pv" data-cbspv aria-label="Preview of the end credits"></div></section>
 <section class="cbs-sec"><h4>Opening ${pro}</h4><p class="note">How every combo video starts: the dramatic title sequence that features the combo, its key card and its title before the first step (also when it plays on screen). Tap one to see it.</p>
  <div class="cbs-fx">${CB_OPENINGS.map(([k, l, d]) => `<button type="button" class="cbs-f${s.opening === k ? ' on' : ''}" data-cbop="${k}" aria-pressed="${s.opening === k}"><b>${l}${k ? '' : ' <small class="cbs-free">Free</small>'}</b><small>${d}</small></button>`).join('')}</div></section>
 <section class="cbs-sec"><h4>Effects during the combo ${pro}</h4><p class="note">Played on every summon and activation, on screen and in the video, and the combo ends with a <b>COMBO COMPLETE</b> slam. Tap one to see it.</p>
  <div class="cbs-fx">${CB_FX.map(([k, l, d]) => `<button type="button" class="cbs-f${s.fx === k ? ' on' : ''}" data-cbfx="${k}" aria-pressed="${s.fx === k}"><b>${l}</b><small>${d}</small></button>`).join('')}</div></section>
 ${PREMIUM ? '' : `<div class="cbs-up"><span>Your own credits and the dramatic effects come with <b>KodeX Premium</b>. Free combo videos end with the standard MEIOCG credits.</span><button class="btn p" data-gp>See KodeX Premium</button></div>`}
 </div><div class="dact"><button class="btn p" data-close>Done</button></div>`,
    'big',
    'cbset'
  );
  const save = () => {
    if (!PREMIUM) return;
    const v = cbSet();
    m.querySelectorAll('[data-cbs]').forEach(
      i => (v[i.dataset.cbs] = i.dataset.cbs === 'secs' ? Number(i.value) : i.value.trim())
    );
    S.s('cb_set', v);
  };
  const pv = () => {
    const v = cbSet(),
      th = (CB_THEMES.find(t => t[0] === (PREMIUM ? v.theme : 'gold')) || CB_THEMES[0])[2];
    m.querySelector('[data-cbspv]').innerHTML =
      `<div class="cbs-pvi" style="--c:${th}"><b>YOUR COMBO TITLE</b><small>COMBO BY</small><strong>${esc((PREMIUM && v.by) || pf || 'Duelist')}</strong><small>DECK</small><strong>${esc((PREMIUM && v.deck) || 'The combo’s deck')}</strong>${PREMIUM && v.handle ? `<em>${esc(v.handle)}</em>` : ''}${PREMIUM && v.line ? `<i>${esc(v.line)}</i>` : ''}<hr><span>MADE WITH DUEL SYNAPSE: KODEX</span><span class="g">MEIOCG · META INSIDER OCG · meiocg.org</span></div>`;
  };
  pv();
  m.querySelectorAll('[data-cbs]').forEach(i =>
    i.addEventListener('input', () => {
      if (i.dataset.cbs === 'secs') m.querySelector('[data-cbsecs]').textContent = Number(i.value).toFixed(1) + ' s';
      save();
      pv();
    })
  );
  m.querySelectorAll('[data-cbth]').forEach(
    b =>
      (b.onclick = () => {
        if (!PREMIUM) return;
        const v = cbSet();
        v.theme = b.dataset.cbth;
        S.s('cb_set', v);
        m.querySelectorAll('[data-cbth]').forEach(x => {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-checked', String(x === b));
        });
        pv();
      })
  );
  m.querySelectorAll('[data-cbfx]').forEach(
    b =>
      (b.onclick = () => {
        const k = b.dataset.cbfx;
        if (k) cbFxPreview(k);
        if (!PREMIUM) return;
        const v = cbSet();
        v.fx = k;
        S.s('cb_set', v);
        m.querySelectorAll('[data-cbfx]').forEach(x => {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-pressed', String(x === b));
        });
      })
  );
  m.querySelectorAll('[data-cbop]').forEach(
    b =>
      (b.onclick = () => {
        const k = b.dataset.cbop;
        if (k) cbOpeningPreview(k);
        if (!PREMIUM) return;
        const v = cbSet();
        v.opening = k;
        S.s('cb_set', v);
        m.querySelectorAll('[data-cbop]').forEach(x => {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-pressed', String(x === b));
        });
      })
  );
  const gp = m.querySelector('[data-gp]');
  if (gp)
    gp.onclick = () => {
      history.back();
      setTimeout(openPremiumInfo, 250);
    };
}
/** The Arena's drawing code for the effects and openings: built into KodeX (window.KXFX), else loaded from the Arena. */
async function kxFxMod() {
  if (window.KXFX) return window.KXFX;
  const f = $('arenaFrame'),
    src = (f && f.getAttribute('src')) || 'duel/index.html',
    base = new URL(src.split('#')[0], location.href);
  return import(new URL('cbfx.js', base).href);
}
/** A preview of a dramatic effect, drawn over KodeX. */
async function cbFxPreview(style) {
  try {
    const mod = await kxFxMod();
    await mod.playFx(style, { x: innerWidth / 2, y: innerHeight * 0.45 });
    await mod.playFx(style, null, { finale: true, title: 'Preview' });
  } catch (e) {
    toast('The preview could not start here');
  }
}
/** A preview of an opening: a combo of yours with a key card (or a sample) and its picture. */
async function cbOpeningPreview(style) {
  try {
    const mod = await kxFxMod();
    const list = typeof cbStore === 'function' ? Object.values(S.g('combos', {}) || {}) : [];
    const c = list.find(x => x && x.intro && x.intro.key) || list[0] || null;
    const key =
      c && c.intro && (c.intro.key || c.intro.art)
        ? cbCard(c.intro.key || c.intro.art)
        : cards.find(x => /monster/i.test(x.type || ''));
    const pic = src =>
      new Promise(ok => {
        if (!src) return ok(null);
        const im = new Image();
        im.crossOrigin = /^data:|^blob:/.test(src) ? null : 'anonymous';
        const t = setTimeout(() => ok(null), 2500);
        im.onload = () => {
          clearTimeout(t);
          ok(im);
        };
        im.onerror = () => {
          clearTimeout(t);
          ok(null);
        };
        im.src = src;
      });
    const imgOf = x => (x ? x.img || x.sm || '' : '');
    const [card, logo, bg] = await Promise.all([
      pic(imgOf(key)),
      pic(document.querySelector('link[rel~="icon"]')?.href || ''),
      pic((c && c.intro && c.intro.bg) || imgOf(key))
    ]);
    const by = typeof kxpRaw === 'function' ? kxpRaw().name || '' : '';
    await mod.playOpening(style, {
      title: (c && c.title) || 'Your Combo',
      sub: [(c && cbDeck(c) && cbDeck(c).name) || '', by ? 'by ' + by : ''].filter(Boolean).join(' · '),
      bg,
      bgCard: !(c && c.intro && c.intro.bg),
      card,
      logo
    });
  } catch (e) {
    toast('The preview could not start here');
  }
}
{
  // every combo sent to the Arena carries the credits and, for Premium, the dramatic effect
  const cp = cbPayload;
  cbPayload = async function (c) {
    const p = await cp.apply(this, arguments),
      s = cbSet();
    p.credits = {
      by: (PREMIUM && s.by) || p.by || '',
      deck: (PREMIUM && s.deck) || p.deck || '',
      handle: PREMIUM ? s.handle : '',
      line: PREMIUM ? s.line : '',
      theme: PREMIUM ? s.theme : 'gold',
      ms: Math.round(s.secs * 1000),
      custom: !!PREMIUM
    };
    p.fx = PREMIUM ? s.fx : '';
    p.opening = PREMIUM ? s.opening : '';
    return p;
  };
  // Combos: a Settings button beside New combo
  const kc = kxCombos;
  kxCombos = function () {
    kc.apply(this, arguments);
    const top = $('tb').querySelector('.cb-top');
    if (!top || top.querySelector('[data-cbset]')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn cb-setb';
    b.dataset.cbset = '1';
    b.innerHTML = ic('settings', 18) + 'Settings';
    b.onclick = cbSettings;
    (top.querySelector('.cb-two') || top).append(b);
  };
}

/* ---------- Duelist Studio for everyone ---------- */
{
  const os = openSkins;
  openSkins = function () {
    os.apply(this, arguments);
    const tb = $('tb'),
      st = tb.querySelector('.studio');
    if (!st) return;
    $('tt').textContent = 'Duelist Studio';
    const hb = st.querySelector('.st-hero b'),
      hs = st.querySelector('.st-hero span');
    if (hb) hb.textContent = PREMIUM ? 'Duelist Studio' : 'Duelist Studio · Free edition';
    if (hs && !PREMIUM)
      hs.textContent =
        'Everything you can make your own. Parts marked Premium come with KodeX Premium; the rest works now. Free duels already have the Rise and Lunge moves and the Menacing showdown.';
    // the free parts: quick reactions (Emotes) and combo videos (Showdowns)
    const ep = st.querySelector('[data-spane="emotes"]');
    if (ep && !ep.querySelector('.qk-card')) {
      ep.insertAdjacentHTML('afterbegin', kxQuickCard());
      kxQuickBind(ep);
    }
    const sp = st.querySelector('[data-spane="shows"]');
    if (sp && !sp.querySelector('.cbv-card')) {
      sp.insertAdjacentHTML(
        'beforeend',
        `<section class="st-card cbv-card" data-free="1"><div class="st-hd"><h4>Combo videos</h4><p>Every combo video ends with credits. ${PREMIUM ? 'Choose what they say, their colours, and a dramatic effect for every summon and activation.' : 'Premium: your own credits and dramatic effects.'}</p></div><button type="button" class="btn st-wide" data-cbsetopen>${ic('settings', 16)}Combo settings</button></section>`
      );
      sp.querySelector('[data-cbsetopen]').onclick = cbSettings;
    }
    if (PREMIUM) return;
    st.classList.add('st-free');
    st.querySelectorAll('.st-card:not([data-free]), .sk-sec').forEach(c => {
      c.classList.add('st-lock');
      const hd = c.querySelector('.st-hd, .sk-hd');
      if (hd && !hd.querySelector('.st-lockb'))
        hd.insertAdjacentHTML(
          'beforeend',
          `<button type="button" class="st-lockb" data-stprem>${ic('star', 12)} Premium</button>`
        );
      c.querySelectorAll('input, select, textarea').forEach(i => (i.disabled = true));
    });
    st.querySelectorAll('[data-stprem]').forEach(
      b =>
        (b.onclick = () => {
          history.back();
          setTimeout(openPremiumInfo, 250);
        })
    );
    // the tabs say what is free in them
    st.querySelectorAll('[data-stab]').forEach(t => {
      if (!['emotes', 'shows'].includes(t.dataset.stab)) t.classList.add('st-tpro');
    });
  };
  // Settings: the Studio has its own entry (above the Premium page in the free edition)
  const bp = $('bPrem');
  if (bp) {
    if (PREMIUM) {
      const sp = bp.querySelector('span');
      if (sp) sp.textContent = 'Duelist Studio';
    } else if (!$('bStudio')) {
      const b = bp.cloneNode(true);
      b.id = 'bStudio';
      b.querySelector('span').textContent = 'Duelist Studio · see what is free and what is Premium';
      b.onclick = () => openSkins();
      const box = bp.previousElementSibling && !bp.previousElementSibling.id ? bp.previousElementSibling : bp;
      box.parentNode.insertBefore(b, box);
    }
  }
}

/* ---------- the Premium page: Combos ---------- */
function kxComboPitch() {
  const rows = [
    ['Build lines from any hand', 'Possible plays are read from the card text, from the combo’s deck', 1],
    ['Play it in the Arena', 'As a replay you can step, slow down and rewind', 1],
    ['Practise it for real', 'A playtest with that starting hand', 1],
    ['Combo sheets', 'Long, square and page images with the final board', 1],
    ['From your replays', 'Any turn of a duel becomes a combo, zones and all', 1],
    ['Combo videos', 'Title card, every step, and end credits', 0],
    ['Your own credits', 'Your name, deck, handle, a line of your own, five colour sets', 0],
    ['Dramatic effects', 'Shockwave, Lightning, Inferno, Cosmic, Glitch, Eclipse and a COMBO COMPLETE finale', 0]
  ];
  return `<section class="pz-cb"><h4>${ic('star', 14)} Combos</h4><p class="pz-p">Plan, play, practise and share your best lines.</p><ul>${rows.map(([t, d, f]) => `<li><span><b>${t}</b><small>${d}</small></span><em class="${f ? 'f' : 'p'}">${f ? 'Free' : 'Premium'}</em></li>`).join('')}</ul><button type="button" class="btn" data-cbfxpv>${ic('play', 14)} Preview a dramatic effect</button></section>`;
}
{
  const v60 = premiumCardV60;
  premiumCardV60 = function () {
    let h = v60.apply(this, arguments);
    // the comparison gets the deck limit and combo videos; the Combos section comes after the tiles
    h = h.replace(
      /(<div class="pz-cmp">[\s\S]*?)(<\/div>\s*<details)/,
      (all, a, b) =>
        a +
        `<div class="pz-row"><span>Decks</span><i>${KX_FREE_DECKS}</i><i class="y">Unlimited</i></div><div class="pz-row"><span>Combo videos</span><i>–</i><i class="y">Own credits, effects</i></div>` +
        b
    );
    return h.replace('<div class="pz-cmp">', kxComboPitch() + '<div class="pz-cmp">');
  };
  const bind = window.bindPremiumCard || bindPremiumCard;
  window.bindPremiumCard = function (root) {
    bind.apply(this, arguments);
    root.querySelectorAll('[data-cbfxpv]').forEach(b => (b.onclick = () => cbFxPreview('random')));
  };
  // the pitch box in Settings was drawn before this module loaded: draw it again
  const bp = $('bPrem'),
    box = bp && bp.previousElementSibling;
  if (!PREMIUM && box && !box.id && box.tagName === 'DIV') {
    box.innerHTML = premiumCard();
    window.bindPremiumCard(box);
  }
  const op = openPremiumInfo;
  openPremiumInfo = function () {
    op.apply(this, arguments);
    const tb = $('tb');
    if (tb) tb.querySelectorAll('[data-cbfxpv]').forEach(b => (b.onclick = () => cbFxPreview('random')));
  };
}
window.cbSettings = cbSettings;
