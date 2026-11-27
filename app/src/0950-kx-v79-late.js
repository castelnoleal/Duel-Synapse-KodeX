/* ===================================================================================================================
   KodeX 10.4 · module: premium-codes, share-links
   Blueprint: app/BLUEPRINT.md. KodeX is created by Castel Noleal, creator of MEIOCG (Meta Insider OCG).
   - Premium by code: a signed key (made by MEIOCG with scripts/kodex_keys.mjs) or a promo code unlocks Premium in the
     free app, for Premium bought another way than Google Play. Keys are checked with the public key in
     app/premium-codes.json (window.KX_CODES); nothing goes online. The code is checked again on every start.
   - Share a ruling: a link to that Q&A on kodex.meiocg.org (it opens the card there and highlights the Q&A).
   - Share a combo: a link that plays it in the Arena in any browser, or its picture.
   =================================================================================================================== */
const KX_B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ',
  KX_EPOCH = Date.UTC(2024, 0, 1),
  KX_DAY = 864e5;
const kxCodes = () => window.KX_CODES || { pub: '', promos: [], revoked: [] };
function kxUnb32(s) {
  let bits = 0,
    v = 0;
  const out = [];
  for (const ch of s) {
    const i = KX_B32.indexOf(ch);
    if (i < 0) return null;
    v = (v << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((v >>> (bits - 8)) & 255);
      bits -= 8;
    }
    v &= (1 << bits) - 1;
  }
  return Uint8Array.from(out);
}
const kxNormPromo = s =>
  String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
async function kxSha256(text) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
/** Reads a code: a key ("KX1-…", checked against MEIOCG's public key) or a promo code. Resolves to
 *  { ok, kind, end, id, why } — end is when Premium stops (0: no end). */
async function kxCodeRead(input, redeeming) {
  const s = String(input || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');
  const C = kxCodes();
  if (s.startsWith('KX1') && s.length > 100) {
    const b = kxUnb32(s.slice(3).replace(/O/g, '0').replace(/[IL]/g, '1'));
    if (!b || b.length < 74 || b[0] !== 1 || b[1] !== 1)
      return { ok: false, why: 'That key is not complete. Copy it again, all of it.' };
    let good = false;
    try {
      const der = Uint8Array.from(atob(C.pub), x => x.charCodeAt(0));
      const key = await crypto.subtle.importKey('spki', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      good = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b.subarray(10, 74), b.subarray(0, 10));
    } catch (e) {
      return { ok: false, why: 'Keys cannot be checked on this device.' };
    }
    if (!good) return { ok: false, why: 'That key is not valid.' };
    const id = [...b.subarray(2, 6)].map(x => x.toString(16).padStart(2, '0')).join(''),
      issued = (b[6] << 8) | b[7],
      days = (b[8] << 8) | b[9];
    if ((C.revoked || []).includes(id)) return { ok: false, why: 'That key no longer works.' };
    const end = days ? KX_EPOCH + (issued + days) * KX_DAY : 0;
    if (end && Date.now() >= end) return { ok: false, why: 'That key has ended.' };
    return { ok: true, kind: 'key', end, id, code: 'KX1' + s.slice(3) };
  }
  const n = kxNormPromo(input);
  if (n.length < 6) return { ok: false, why: 'Type the whole code.' };
  const h = await kxSha256('kodex-promo|' + n),
    p = (C.promos || []).find(x => x.h === h);
  if (!p) return { ok: false, why: 'That code is not valid.' };
  if (redeeming && p.until && Date.now() > Date.parse(p.until + 'T23:59:59'))
    return { ok: false, why: 'That code has ended.' };
  return { ok: true, kind: 'promo', h, days: +p.days || 0, code: 'P:' + h };
}
/** Every start: the code that unlocked Premium is checked again; one that no longer checks out is removed. */
async function kxKeyCheck() {
  if (!KX_KEY.active) return;
  let ok = false;
  try {
    if (KX_KEY.kind === 'promo') {
      const h = KX_KEY.code.replace(/^P:/, '');
      ok = (kxCodes().promos || []).some(x => x.h === h);
    } else ok = (await kxCodeRead(KX_KEY.code)).ok;
  } catch (e) {
    ok = false;
  }
  if (ok) return;
  try {
    localStorage.removeItem('kx_key');
  } catch (e) {}
  toast('That Premium code no longer works · back to the free edition');
  setTimeout(() => location.reload(), 1600);
}
setTimeout(kxKeyCheck, 60);
function kxRedeem() {
  if (kxIsEdPremium()) return;
  const m = openModal(
    `<div class="dk-hd"><h3>Redeem a Premium code</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
 <p class="note">Type or paste the code or key you got from MEIOCG. It unlocks every KodeX Premium feature on this device, with no ads.</p>
 <textarea class="kx-code" rows="3" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="KX1-… or your promo code" aria-label="Premium code or key"></textarea>
 <p class="note kx-code-msg" role="status"></p>
 <div class="dact"><button class="btn" data-close>Cancel</button><button class="btn p" data-redeem-go>Redeem</button></div>`,
    '',
    'redeem'
  );
  const t = m.querySelector('.kx-code'),
    msg = m.querySelector('.kx-code-msg'),
    go = m.querySelector('[data-redeem-go]');
  setTimeout(() => t.focus(), 80);
  go.onclick = async () => {
    go.disabled = true;
    msg.textContent = 'Checking…';
    const r = await kxCodeRead(t.value, true);
    go.disabled = false;
    if (!r.ok) {
      msg.textContent = r.why;
      return;
    }
    const end = r.kind === 'promo' ? (r.days ? Date.now() + r.days * KX_DAY : 0) : r.end;
    try {
      localStorage.setItem('kx_key', JSON.stringify({ code: r.code, kind: r.kind, end, at: Date.now(), v: 1 }));
    } catch (e) {
      msg.textContent = 'Could not save it (storage is full or blocked).';
      return;
    }
    closeModal();
    toast(
      'KodeX Premium unlocked' + (end ? ' until ' + new Date(end).toLocaleDateString() : '') + ' · restarting…',
      3000
    );
    setTimeout(() => location.reload(), 900);
  };
}
function kxCodeInfo() {
  const end = KX_KEY.end ? new Date(KX_KEY.end).toLocaleDateString() : '';
  const m = openModal(
    `<div class="dk-hd"><h3>Premium by code</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
 <p class="note">KodeX Premium is unlocked on this device by a ${KX_KEY.kind === 'promo' ? 'promo code' : 'Premium key'}${end ? `, until <b>${esc(end)}</b>` : ', with no end'}.</p>
 <div class="dact"><button class="btn" data-kxkey-off>Remove the code</button><button class="btn p" data-close>OK</button></div>`
  );
  m.querySelector('[data-kxkey-off]').onclick = () => {
    try {
      localStorage.removeItem('kx_key');
    } catch (e) {}
    closeModal();
    toast('Code removed · restarting…');
    setTimeout(() => location.reload(), 800);
  };
}
/* Settings: "Redeem a code" (free edition), or what the code gives while it runs */
(function () {
  if (kxIsEdPremium()) return;
  const bp = $('bPrem');
  if (!bp || $('bRedeem')) return;
  const b = bp.cloneNode(true);
  b.id = 'bRedeem';
  b.querySelector('span').textContent = KX_KEY.active
    ? 'Premium by code' + (KX_KEY.end ? ' · until ' + new Date(KX_KEY.end).toLocaleDateString() : '')
    : 'Have a Premium code or key? Redeem it';
  b.onclick = () => (KX_KEY.active ? kxCodeInfo() : kxRedeem());
  bp.parentNode.insertBefore(b, bp.nextSibling);
})();
{
  const b = window.bindPremiumCard;
  if (typeof b === 'function')
    window.bindPremiumCard = function (root) {
      b.apply(this, arguments);
      const cta = root.querySelector('.pz-cta');
      if (cta && !KX_KEY.active && !cta.querySelector('[data-redeem]')) {
        const r = document.createElement('button');
        r.type = 'button';
        r.className = 'btn pz-redeem';
        r.dataset.redeem = '';
        r.textContent = 'Redeem a code';
        cta.appendChild(r);
      }
      root.querySelectorAll('[data-redeem]').forEach(x => (x.onclick = kxRedeem));
    };
  const bp = $('bPrem'),
    box = bp && bp.previousElementSibling;
  if (!PREMIUM && box && !box.id && box.tagName === 'DIV' && box.querySelector('.pz-cta')) window.bindPremiumCard(box);
}

/* ---------- sharing a link (a ruling, a combo) ---------- */
/** Opens the phone's share sheet with a link (Messenger, Facebook, Discord, X…); else copies it. */
async function kxShareLink(title, text, url) {
  const A = window.CastelApp;
  if (A && typeof A.share === 'function') {
    try {
      A.share(title, text, url);
      return true;
    } catch (e) {}
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
    }
  }
  copyText(text + '\n' + url, 'Link copied · paste it anywhere');
  return true;
}
const KX_WEB = 'https://kodex.meiocg.org/';
/** The link to one ruling (Q&A) of a card on kodex.meiocg.org: it opens the card there with that Q&A open and
 *  highlighted. */
const kxRulingUrl = (cardId, qa) =>
  KX_WEB + '#card=' + encodeURIComponent(cardId) + (qa ? '&qa=' + encodeURIComponent(qa) : '');
function kxRulingShareButtons(box, c) {
  if (!box || !c) return;
  box.querySelectorAll('details.qa').forEach(d => {
    if (d.querySelector('.qa-share')) return;
    const meta = d.querySelector('summary .meta'),
      m = /#\s*([\w-]+)/.exec(meta ? meta.textContent : ''),
      qa = m ? m[1] : '';
    const title = (d.querySelector('summary').firstChild || {}).textContent || 'Ruling';
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn sm qa-share';
    b.innerHTML = ic('share', 15) + 'Share this ruling';
    b.onclick = e => {
      e.preventDefault();
      kxShareLink(
        c.name + ' · ruling',
        `${c.name} — Q&A${qa ? ' #' + qa : ''}: ${String(title).trim().slice(0, 160)}`,
        kxRulingUrl(c.id, qa)
      );
    };
    const qb = d.querySelector('.qb') || d;
    qb.appendChild(b);
  });
}
{
  const r0 = rulings;
  rulings = async function (c, targetId = 'rul') {
    const out = await r0.apply(this, arguments);
    try {
      kxRulingShareButtons($(targetId), c);
    } catch (e) {}
    return out;
  };
}
/** A combo as a link: it plays in the Arena in any browser (kodex.meiocg.org/duel/#combo=…). */
async function cbLink(c) {
  const p = await cbPayload(c);
  if (p.intro) delete p.intro.bg;
  delete p.credits;
  delete p.fx;
  delete p.opening;
  p.v = 1;
  const txt = JSON.stringify(p),
    b64 = buf => {
      let s = '';
      const u = new Uint8Array(buf);
      for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
      return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    };
  let s;
  try {
    const z = await new Response(
      new Blob([txt]).stream().pipeThrough(new CompressionStream('deflate-raw'))
    ).arrayBuffer();
    s = 'z' + b64(z);
  } catch (e) {
    s = 'j' + b64(new TextEncoder().encode(txt));
  }
  return KX_WEB + 'duel/#combo=' + s;
}
async function cbShare(c) {
  if (!c || !cbHas(c)) {
    toast('This combo is empty');
    return;
  }
  const m = openModal(
    `<div class="dk-hd"><h3>Share this combo</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
 <p class="note">${esc(cbTitle(c))}</p>
 <div class="cb-share"><button class="btn p" data-cbsh="link">${ic('share', 16)}Share a link<small>It plays the combo step by step, in any browser</small></button>
 <button class="btn" data-cbsh="img">${ic('image', 16)}Share a picture<small>The combo sheet, then Share</small></button></div>`,
    '',
    'cbshare'
  );
  m.querySelector('[data-cbsh=link]').onclick = async () => {
    const url = await cbLink(c);
    closeModal();
    kxShareLink(cbTitle(c), `${cbTitle(c)} · a combo made with Duel Synapse: KodeX`, url);
  };
  m.querySelector('[data-cbsh=img]').onclick = () => {
    closeModal();
    setTimeout(() => cbImage([c.id]), 200);
  };
}
{
  const kc = kxCombos;
  kxCombos = function () {
    const out = kc.apply(this, arguments);
    document.querySelectorAll('#tb .cb-item').forEach(it => {
      const row = it.querySelector('.cb-row');
      if (!row || row.querySelector('[data-cbshare]')) return;
      const b = document.createElement('button');
      b.className = 'btn sm';
      b.dataset.cbshare = '';
      b.innerHTML = ic('share', 15) + 'Share';
      b.onclick = () => cbShare(cbGet(it.dataset.cbid));
      const img = row.querySelector('[data-cbimg]');
      row.insertBefore(b, img ? img.nextSibling : row.firstChild);
    });
    return out;
  };
}
