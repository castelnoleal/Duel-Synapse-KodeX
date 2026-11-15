/* KodeX 10.1 (v68)
 * - The Arena is told where KodeX's own buttons (help, minimise, close) sit over it, so it keeps names and Life
 *   Points clear of them.
 * - kxDiagnose(): a self-check of the screen that is open (also run by the KodeX Master Editor). It lists buttons
 *   whose label is cut or squashed, controls that overlap, things that run off the screen, broken pictures, repeated
 *   ids, and tap targets that are too small.
 * Created by Castel Noleal, creator of MEIOCG. A project of Meta Insider OCG since 2023.
 */

/* ---------- the Arena keeps clear of KodeX's buttons ---------- */
function kxChromeToArena() {
  const frame = $('arenaFrame');
  const bar = document.querySelector('#Larena .arbar');
  if (!frame || !bar || !frame.contentWindow) return null;
  const f = frame.getBoundingClientRect();
  // the floating buttons only: the logo and title are hidden while the Arena is open
  const buttons = [...bar.querySelectorAll('button, .ibtn')].filter(b => b.offsetParent);
  if (!buttons.length || !f.width) return null;
  const left = Math.min(...buttons.map(b => b.getBoundingClientRect().left));
  const bottom = Math.max(...buttons.map(b => b.getBoundingClientRect().bottom));
  const w = Math.max(0, Math.round(f.right - left));
  const h = Math.max(0, Math.round(bottom - f.top));
  try {
    frame.contentWindow.postMessage({ kx: 'chrome', w, h }, '*');
  } catch (e) {}
  return { w, h };
}
window.addEventListener('message', e => {
  const frame = $('arenaFrame');
  if (frame && e.source === frame.contentWindow && (e.data || {}).kx === 'ready') setTimeout(kxChromeToArena, 60);
});
window.addEventListener('resize', () => {
  clearTimeout(kxChromeToArena.t);
  kxChromeToArena.t = setTimeout(kxChromeToArena, 150);
});
{
  const open = openArena;
  openArena = function () {
    const r = open.apply(this, arguments);
    setTimeout(kxChromeToArena, 250);
    return r;
  };
}

/* ---------- the self-check ---------- */
/**
 * Looks over what is on screen now and returns a list of problems: { kind, what, detail, el }.
 * kinds: cut (a label does not fit), squashed (a button far taller than wide or taller than its text needs),
 * overlap (two controls on top of each other), offscreen (runs past the edge), tiny (hard to tap),
 * image (a picture that failed to load), id (the same id twice).
 */
function kxDiagnose(root) {
  const doc = (root && root.ownerDocument) || document;
  const win = doc.defaultView || window;
  const W = win.innerWidth;
  const H = win.innerHeight;
  const scope = root || doc.body;
  const out = [];
  const label = el => {
    const t = (el.getAttribute('aria-label') || el.textContent || el.id || el.className || el.tagName).toString();
    return t.replace(/\s+/g, ' ').trim().slice(0, 60);
  };
  const shown = el => {
    if (!el.getClientRects().length) return false;
    const s = win.getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
  };
  // the element that is really on top at a point (anything inside a closed layer does not count)
  const onTop = (el, r) => {
    const x = Math.min(W - 1, Math.max(0, r.left + r.width / 2));
    const y = Math.min(H - 1, Math.max(0, r.top + r.height / 2));
    const hit = doc.elementFromPoint(x, y);
    return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
  };
  const controls = [...scope.querySelectorAll('button, .btn, .ibtn, a.btn, [role=button], select, input:not([type=hidden])')]
    .filter(shown)
    .filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < H && onTop(el, r);
    });
  for (const el of controls) {
    const r = el.getBoundingClientRect();
    const s = win.getComputedStyle(el);
    const text = (el.textContent || '').trim();
    if (text && el.tagName !== 'SELECT' && el.tagName !== 'INPUT') {
      if (el.scrollWidth > el.clientWidth + 2 && s.overflowX !== 'auto' && s.textOverflow !== 'ellipsis')
        out.push({ kind: 'cut', what: label(el), detail: `needs ${el.scrollWidth}px, has ${el.clientWidth}px`, el });
      // a piece of the label's text that puts one word on each line (icons do not count)
      let worst = 0;
      const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const words = n.nodeValue.trim().split(/\s+/).filter(Boolean).length;
        if (words < 2) continue;
        const range = doc.createRange();
        range.selectNodeContents(n);
        const tops = new Set();
        for (const q of range.getClientRects()) if (q.width > 1) tops.add(Math.round(q.top / 4));
        if (tops.size >= 3 && tops.size >= words) worst = Math.max(worst, tops.size);
      }
      if (worst && r.width < 160)
        out.push({ kind: 'squashed', what: label(el), detail: `${Math.round(r.width)}×${Math.round(r.height)}, one word per line (${worst} lines)`, el });
    }
    if (r.height > r.width * 2.2 && r.width < 60 && text.length > 1)
      out.push({ kind: 'squashed', what: label(el), detail: `${Math.round(r.width)}×${Math.round(r.height)}`, el });
    if (r.right > W + 2 || r.left < -2)
      out.push({ kind: 'offscreen', what: label(el), detail: `x ${Math.round(r.left)}…${Math.round(r.right)} of ${W}`, el });
    if ((r.width < 28 || r.height < 28) && el.tagName !== 'INPUT')
      out.push({ kind: 'tiny', what: label(el), detail: `${Math.round(r.width)}×${Math.round(r.height)}`, el });
  }
  const pinned = el => {
    for (let e = el; e && e !== doc.body; e = e.parentElement) {
      const p = win.getComputedStyle(e).position;
      if (p === 'fixed' || p === 'sticky') return true;
    }
    return false;
  };
  const canScrollClear = el => {
    for (let e = el.parentElement; e; e = e.parentElement) {
      const t = e === doc.body ? doc.scrollingElement : e;
      const oy = e === doc.body ? 'auto' : win.getComputedStyle(e).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && t.scrollHeight > t.clientHeight + 4)
        return t.scrollTop + t.clientHeight < t.scrollHeight - 4;
      if (e === doc.body) break;
    }
    return false;
  };
  // controls on top of each other (one partly hidden by the other)
  for (let i = 0; i < controls.length; i++) {
    const a = controls[i].getBoundingClientRect();
    for (let j = i + 1; j < controls.length; j++) {
      const A = controls[i];
      const B = controls[j];
      if (A.contains(B) || B.contains(A)) continue;
      // fixed bars and buttons float over a list on purpose: fine while the list can still scroll clear of them
      if ((pinned(A) && canScrollClear(B)) || (pinned(B) && canScrollClear(A))) continue;
      const b = B.getBoundingClientRect();
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 6 && h > 6 && w * h > 0.15 * Math.min(a.width * a.height, b.width * b.height))
        out.push({ kind: 'overlap', what: `${label(A)} / ${label(B)}`, detail: `${Math.round(w)}×${Math.round(h)} px shared`, el: A });
    }
  }
  // the page itself is wider than the screen
  if (doc.documentElement.scrollWidth > W + 2)
    out.push({ kind: 'offscreen', what: 'page', detail: `page is ${doc.documentElement.scrollWidth}px wide on a ${W}px screen`, el: doc.body });
  // pictures that did not load
  for (const img of scope.querySelectorAll('img')) {
    if (shown(img) && img.complete && img.naturalWidth === 0 && img.getAttribute('src') && !img.dataset.u)
      out.push({ kind: 'image', what: img.alt || img.getAttribute('src').slice(0, 50), detail: 'did not load', el: img });
  }
  // the same id twice
  const seen = new Map();
  for (const el of doc.querySelectorAll('[id]')) {
    if (seen.has(el.id)) out.push({ kind: 'id', what: '#' + el.id, detail: 'used more than once', el });
    else seen.set(el.id, el);
  }
  return out;
}
window.kxDiagnose = kxDiagnose;
