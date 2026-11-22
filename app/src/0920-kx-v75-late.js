/* KodeX 10.3.6 (v75)
 * - Combos: "Possible plays" only lists cards a card's effect can really reach. The card text is read for what it
 *   adds, sends, summons, sets, tributes or banishes ("1 Fairy monster from your Deck or Extra Deck", "1 Level 4 or
 *   lower "Solfachord" Pendulum Monster"...), and an Extra Deck monster is offered only when the card fits its
 *   materials. With a deck chosen for the combo only that deck's cards are used; without one, any card that fits.
 * - Sharing: pictures and clips KodeX makes (combo sheets, deck images, deck lists, video clips) can be shared to
 *   other apps and social media from the save prompt (kxShareFile).
 * Created by Castel Noleal, creator of MEIOCG. A project of Meta Insider OCG since 2023.
 */

/* ---------- what a card's text asks for ---------- */
const CBQ_ATTR = ['LIGHT', 'DARK', 'WATER', 'FIRE', 'EARTH', 'WIND', 'DIVINE'];
const CBQ_RACE = [
  'Aqua',
  'Beast-Warrior',
  'Beast',
  'Cyberse',
  'Dinosaur',
  'Divine-Beast',
  'Dragon',
  'Fairy',
  'Fiend',
  'Fish',
  'Illusion',
  'Insect',
  'Machine',
  'Plant',
  'Psychic',
  'Pyro',
  'Reptile',
  'Rock',
  'Sea Serpent',
  'Spellcaster',
  'Thunder',
  'Warrior',
  'Winged Beast',
  'Wyrm',
  'Zombie'
];
const CBQ_SUB = [
  'Pendulum',
  'Tuner',
  'Normal',
  'Effect',
  'Ritual',
  'Fusion',
  'Synchro',
  'Xyz',
  'Link',
  'Flip',
  'Gemini',
  'Spirit',
  'Union',
  'Toon'
];
const CBQ_ST = ['Continuous', 'Quick-Play', 'Field', 'Equip', 'Counter'];
const cbqRx = (() => {
  const w = a => a.map(x => x.replace(/[-]/g, '\\-')).join('|');
  const mod = `(?:non-(?:${w(CBQ_SUB)}|Tuner)|face-up|face-down|Level \\d+(?: or (?:lower|higher|more|less))?|Rank \\d+(?: or (?:lower|higher))?|Link-\\d+|${w(CBQ_ATTR)}|${w(CBQ_RACE)}|${w(CBQ_SUB)}|${w(CBQ_ST)}|"[^"]{2,60}")`;
  return new RegExp(
    `\\b(?:\\d+\\+?|up to \\d+|any number of|a|an)\\s+((?:${mod}(?:,? (?:and|or|and/or) | |, )?)+)?\\s*(monsters?|Spell\\/Trap|Spells?|Traps?|cards?|Monster Cards?)\\b([^.;:]{0,60})`,
    'gi'
  );
})();
/** One requirement: { names: [quoted words], attr, race, sub: [], notSub: [], st, lvl:[op, n], kind, deck, extra, except } */
function cbqParse(np, kind, tail) {
  const q = {
    names: [],
    sub: [],
    notSub: [],
    kind: /spell\/trap/i.test(kind)
      ? 'st'
      : /spell/i.test(kind)
        ? 'spell'
        : /trap/i.test(kind)
          ? 'trap'
          : /monster/i.test(kind)
            ? 'monster'
            : 'card'
  };
  const s = np || '';
  for (const m of s.matchAll(/"([^"]{2,60})"/g)) q.names.push(m[1]);
  const t = s.replace(/"[^"]*"/g, ' ');
  for (const a of CBQ_ATTR) if (new RegExp('\\b' + a + '\\b').test(t)) (q.attr = q.attr || []).push(a);
  for (const r of CBQ_RACE)
    if (new RegExp('(^|[^-\\w])' + r.replace('-', '\\-') + '(?![-\\w])').test(t)) (q.race = q.race || []).push(r);
  for (const b of CBQ_SUB) {
    if (new RegExp('non-' + b + '\\b', 'i').test(t)) q.notSub.push(b);
    else if (new RegExp('(^|[^-\\w])' + b + '\\b').test(t)) q.sub.push(b);
  }
  for (const b of CBQ_ST) if (new RegExp('\\b' + b + '\\b').test(t)) q.st = b;
  const lv = t.match(/\b(Level|Rank) (\d+)(?: or (lower|higher|more|less))?/i);
  if (lv) q.lvl = [lv[3] ? (/lower|less/i.test(lv[3]) ? '<=' : '>=') : '=', +lv[2], lv[1].toLowerCase()];
  const tl = tail || '';
  if (/Extra Deck/i.test(tl)) q.extra = 1;
  if (/\bDeck\b(?! Zone)/i.test(tl.replace(/Extra Deck/gi, ''))) q.deck = 1;
  const ex = tl.match(/except "([^"]+)"/i);
  if (ex) q.except = ex[1];
  if (/\bface-up\b/i.test(t) && q.extra) q.faceUp = 1;
  return q;
}
const cbqCache = new Map();
/** Every requirement written in a card's text (and, for an Extra Deck monster, the ones in its material line). */
function cbqOf(c) {
  const k = String(c.id);
  if (cbqCache.has(k)) return cbqCache.get(k);
  const d = String(c.desc || '');
  const lines = d.split(/\r?\n/);
  const isX = cbIsExtra(c) && lines.length > 1;
  const mat = isX ? lines[0] : '';
  const body = isX ? lines.slice(1).join('\n') : d;
  const reqs = [];
  for (const m of body.matchAll(cbqRx)) {
    if (!m[1] && /^cards?$/i.test(m[2])) continue; // "1 card" alone says nothing about which
    const q = cbqParse(m[1], m[2], m[3]);
    // "2 monsters", "1 card": anything fits, so it says nothing about which card comes next
    if (!q.names.length && !q.attr && !q.race && !q.sub.length && !q.notSub.length && !q.st && !q.lvl) continue;
    reqs.push(q);
  }
  const mats = [];
  if (mat) {
    for (const part of mat.split(/\s*\+\s*|, including |, with /i)) {
      const m = part.match(/^\s*(?:\d+\+?|\d+ or more)?\s*(.*?)\s*(monsters?|cards?)?\s*$/i);
      if (!m) continue;
      const q = cbqParse(m[1] || '', m[2] || 'monster', '');
      // a name written alone ("Dark Magician" + ...) is a material by name
      if (!q.names.length && /^"[^"]+"$/.test(part.trim())) q.names.push(part.trim().slice(1, -1));
      mats.push(q);
    }
  }
  const own = String(c.name).toLowerCase();
  const out = {
    reqs,
    mats,
    named: [...body.matchAll(/"([^"]{2,60})"/g)].map(m => m[1]).filter(n => n.toLowerCase() !== own)
  };
  cbqCache.set(k, out);
  return out;
}
const cbqIsMon = x => /monster/i.test(x.type || '');
const cbqHasSub = (x, b) => {
  const t = String(x.type || '');
  if (b === 'Effect') return cbqIsMon(x) && !/Normal/i.test(t) && !/Token/i.test(t);
  if (b === 'Normal') return /Normal/i.test(t) && !/Normal Tuner|Tuner Normal/i.test(t) ? true : /Normal/i.test(t);
  return new RegExp('\\b' + b + '\\b', 'i').test(t);
};
const cbqInName = (x, n) => {
  const nl = n.toLowerCase();
  return (
    String(x.name).toLowerCase() === nl ||
    String(x.name).toLowerCase().includes(nl) ||
    String(x.arch || '').toLowerCase() === nl
  );
};
/** Does card x fit requirement q? */
function cbqFits(x, q) {
  if (!x) return false;
  if (q.except && String(x.name).toLowerCase() === q.except.toLowerCase()) return false;
  const mon = cbqIsMon(x),
    t = String(x.type || '');
  if (q.kind === 'monster' && !mon) return false;
  if (q.kind === 'spell' && !/Spell/i.test(t)) return false;
  if (q.kind === 'trap' && !/Trap/i.test(t)) return false;
  if (q.kind === 'st' && mon) return false;
  if (q.names.length && !q.names.some(n => cbqInName(x, n))) return false;
  if (q.attr && !(mon && q.attr.includes(String(x.attr).toUpperCase()))) return false;
  if (q.race && !(mon && q.race.some(r => String(x.race).toLowerCase() === r.toLowerCase()))) return false;
  if (q.sub.length && !q.sub.every(b => cbqHasSub(x, b))) return false;
  if (q.notSub.some(b => cbqHasSub(x, b))) return false;
  if (q.st && !(new RegExp(q.st, 'i').test(x.race || '') && !mon)) return false;
  if (q.lvl) {
    const v = q.lvl[2] === 'rank' ? (x.rk ?? (/xyz/i.test(t) ? x.lv : null)) : /xyz|link/i.test(t) ? null : x.lv;
    if (v == null) return false;
    if (q.lvl[0] === '=' && v !== q.lvl[1]) return false;
    if (q.lvl[0] === '<=' && v > q.lvl[1]) return false;
    if (q.lvl[0] === '>=' && v < q.lvl[1]) return false;
  }
  // "from your Extra Deck" alone: only Extra Deck monsters (or face-up Pendulums); "from your Deck" alone: Main Deck
  if (q.extra && !q.deck && mon && !cbIsExtra(x) && !(q.faceUp && /Pendulum/i.test(t))) return false;
  if (q.deck && !q.extra && cbIsExtra(x)) return false;
  return true;
}
/** How strongly card x follows from source card s (0 = not a play). */
function cbqLink(s, x) {
  if (!s || !x || String(s.id) === String(x.id)) return 0;
  const a = cbqOf(s),
    b = cbqOf(x);
  let v = 0;
  // s's effect reaches x (strongest when it names x or its archetype)
  for (const q of a.reqs)
    if (cbqFits(x, q)) {
      v = Math.max(v, q.names.length ? 8 : 6);
    }
  // s names x outright ("Card Name")
  if (a.named.some(n => n.toLowerCase() === String(x.name).toLowerCase())) v = Math.max(v, 7);
  // x is an Extra Deck monster s can be material for
  if (cbIsExtra(x) && b.mats.length && cbqIsMon(s) && !cbIsExtra(s)) {
    const fit = q => cbqFits(s, Object.assign({}, q, { kind: q.kind === 'card' ? 'monster' : q.kind }));
    const generic = q =>
      !q.names.length && !q.race && !q.attr && !q.lvl && !q.sub.filter(z => z !== 'Effect' && z !== 'Tuner').length;
    if (b.mats.some(q => q.names.length && fit(q))) v = Math.max(v, 7);
    else if (b.mats.some(fit)) {
      // a material named by card name that this card is not: it can only be half of the summon
      const needsName = b.mats.some(q => q.names.length && !fit(q));
      v = Math.max(v, needsName ? 1 : b.mats.some(q => !generic(q) && fit(q)) ? 4 : 2);
    }
  }
  // x's effect reaches s (x can use s: tributes it, searches with it...)
  if (b.reqs.some(q => cbqFits(s, q))) v = Math.max(v, b.reqs.some(q => q.names.length && cbqFits(s, q)) ? 5 : 3);
  if (b.named.some(n => n.toLowerCase() === String(s.name).toLowerCase())) v = Math.max(v, 5);
  if (v && x.arch && s.arch && x.arch === s.arch) v += 1;
  return v;
}
/** What could come next after these cards: only cards their effects can reach (or that can use them), from the
 *  combo's deck when it has one, otherwise from every card. */
const cbqMemo = new Map();
cbSuggest = function (c, fromIds, max = 12) {
  const key = [c.deckId || '', fromIds.join(','), max, (cbDeck(c) || { list: [] }).list.length].join('|');
  if (cbqMemo.has(key)) return cbqMemo.get(key).slice();
  const r = cbSuggest0(c, fromIds, max);
  if (cbqMemo.size > 200) cbqMemo.clear();
  cbqMemo.set(key, r);
  return r.slice();
};
function cbSuggest0(c, fromIds, max) {
  const src = fromIds.map(cbCard).filter(Boolean);
  if (!src.length) return [];
  const dk = cbDeck(c);
  const pool = dk ? dk.list.map(e => e.card) : cards;
  const srcIds = new Set(src.map(s => String(s.id)));
  const seen = new Set();
  const out = [];
  for (const x of pool) {
    const id = String(x.id);
    if (srcIds.has(id) || seen.has(x.name)) continue;
    let v = 0;
    for (const s of src) v = Math.max(v, cbqLink(s, x));
    if (v >= 2) {
      seen.add(x.name);
      out.push([v, x]);
    }
  }
  // without a deck: the strongest links first, the same archetype before the rest, newer cards before older
  return out
    .sort(
      (a, b) =>
        b[0] - a[0] ||
        (dk ? 0 : String(b[1].date || '').localeCompare(String(a[1].date || ''))) ||
        String(a[1].name).localeCompare(b[1].name)
    )
    .slice(0, max)
    .map(v => String(v[1].id));
}
window.cbqLink = cbqLink;

/* ---------- sharing what KodeX makes ---------- */
IC.share =
  '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.8l7.4-4.3M8.3 13.2l7.4 4.3"/>';
// After a picture, PDF or video clip is saved, a "Share" button stays on screen for a few seconds: it opens the phone's
// share sheet (Facebook, Messenger, Instagram, X, Discord…) with that file. In the app this needs the app's file
// sharing (CastelApp.shareBase64File); in a browser it uses the Web Share API where the browser has it.
const kxShareable = mime => /^(image|video)\//.test(mime || '') || mime === 'application/pdf';
function kxCanShareFiles(f) {
  const A = window.CastelApp;
  if (A) return typeof A.shareBase64File === 'function';
  try {
    return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [f] }));
  } catch (e) {
    return false;
  }
}
/** Opens the share sheet with this file. Resolves to true when the sheet opened. */
async function kxShareFile(blob, name, mime, text) {
  const A = window.CastelApp;
  const say = text || 'Made with Duel Synapse: KodeX · kodex.meiocg.org';
  if (A && typeof A.shareBase64File === 'function') {
    if (blob.size > 58e6) {
      toast('That file is too large to share from here');
      return false;
    }
    A.shareBase64File('data:' + mime + ';base64,' + (await blobB64(blob)), name, say);
    return true;
  }
  const f = new File([blob], name, { type: mime });
  if (kxCanShareFiles(f)) {
    try {
      await navigator.share({ files: [f], title: name, text: say });
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
    }
  }
  toast(
    A ? 'Update the KodeX app to share files straight to other apps' : 'Sharing files is not available in this browser'
  );
  return false;
}
function kxOfferShare(blob, name, mime) {
  if (!kxShareable(mime)) return;
  if (!window.CastelApp && !kxCanShareFiles(new File([blob], name, { type: mime }))) return;
  let bar = $('kxShareBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'kxShareBar';
    bar.setAttribute('role', 'status');
    document.body.appendChild(bar);
  }
  bar.innerHTML = `<span>${esc(name)}</span><button class="btn p" type="button">${ic('share', 18)}Share</button><button class="ibtn" type="button" aria-label="Close">${ic('x', 16)}</button>`;
  const [go, x] = bar.querySelectorAll('button');
  const hide = () => bar.classList.remove('on');
  go.onclick = () => {
    hide();
    kxShareFile(blob, name, mime);
  };
  x.onclick = hide;
  bar.classList.add('on');
  clearTimeout(kxOfferShare.t);
  kxOfferShare.t = setTimeout(hide, 9000);
}
{
  const save = saveFile;
  saveFile = async function (blob, name, mime) {
    const r = await save.apply(this, arguments);
    try {
      kxOfferShare(blob, name, mime || blob.type);
    } catch (e) {}
    return r;
  };
  if (typeof kxSaveVideo === 'function') {
    const vid = kxSaveVideo;
    kxSaveVideo = async function (blob, name, mime) {
      const r = await vid.apply(this, arguments);
      try {
        kxOfferShare(blob, name, mime || blob.type);
      } catch (e) {}
      return r;
    };
  }
}
window.kxShareFile = kxShareFile;
