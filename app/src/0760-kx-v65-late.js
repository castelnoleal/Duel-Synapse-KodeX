/* KodeX 9.8 (v65): app screens do not zoom;
   combo images carry their combo, so an image can be read back into a combo and its replay; replays from the Arena
   arrive as combos. Created by Castel Noleal, creator of MEIOCG. A project of Meta Insider OCG since 2023. */
const KX_STORE = 'https://play.google.com/store/search?q=Duel%20Synapse%20KodeX&c=apps'; // replace with the store listing link once it is live
/** Running as the installed app (bundle, native bridge or an Android WebView), not in a browser tab. */
function kxInApp() {
  if (window.__kxWeb) return false;
  return (
    ARENA_LOCAL ||
    !!(window.CastelApp || window.KodexBridge || window.AndroidBridge) ||
    /; wv\)/.test(navigator.userAgent) ||
    navigator.webdriver === true ||
    /[?&]app=1/.test(location.search)
  );
}
/* ---------- no zoom in the app ---------- */
if (kxInApp()) {
  document.documentElement.classList.add('kx-app');
  const vp = document.querySelector('meta[name=viewport]');
  if (vp)
    vp.setAttribute(
      'content',
      'width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover'
    );
  addEventListener(
    'touchmove',
    e => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
  );
  for (const g of ['gesturestart', 'gesturechange']) addEventListener(g, e => e.preventDefault(), { passive: false });
  addEventListener(
    'wheel',
    e => {
      if (e.ctrlKey) e.preventDefault();
    },
    { passive: false }
  );
}
/* ---------- the combo code: a strip of cells in every combo image that holds the combo itself ---------- */
const CBQ = {
  cell: 8,
  cal: 6,
  maxRows: 26,
  foot: 74,
  acts: ['auto', 'act', 'ns', 'ss', 'add', 'set', 'scale', 'eff', 'gy', 'ban']
};
const cbqCrc = b => {
  let c = ~0;
  for (let i = 0; i < b.length; i++) {
    c ^= b[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
};
/* ---------- a combo image read back into combos (and their replays) ---------- */
const cbqId = code => {
  const c = M.get(String(code));
  return c ? String(c.id) : String(code);
};
/** Keeps the combo in the Arena's Replays list too (when the Arena is loaded; otherwise it is kept the first time it is played). */
async function cbKeepReplay(c) {
  try {
    const f = $('arenaFrame');
    if (!f || !f.dataset.ready) return false;
    const p = await cbPayload(c);
    cbPost({ kx: 'comboKeep', combo: p });
    return true;
  } catch (e) {
    return false;
  }
}
function cbImportImage(file) {
  if (!file || !/^image\//.test(file.type || '') || file.size > 3e7) {
    toast('Choose a MEIOCG combo image (PNG or JPG)');
    return;
  }
  const im = new Image(),
    u = URL.createObjectURL(file);
  im.onerror = () => {
    URL.revokeObjectURL(u);
    toast('That picture could not be opened');
  };
  im.onload = async () => {
    let got = null;
    try {
      got = cbqRead(im);
    } catch (e) {}
    URL.revokeObjectURL(u);
    if (!got) {
      openModal(
        `<div class="cb-in"><h3>Not a MEIOCG combo image</h3><p class="note">No combo code was found. Use the whole image exactly as KodeX saved it (9.8 or newer): cropped pictures, screenshots with borders and heavily compressed copies cannot be read. Sending the image as a file keeps it intact.</p><div class="dact"><button class="btn p" data-close>OK</button></div></div>`
      );
      return;
    }
    const made = got.map(r => cbAdopt(r, 'image')).filter(Boolean);
    if (!made.length) {
      toast('That combo image is empty');
      return;
    }
    let kept = false;
    for (const c of made) kept = (await cbKeepReplay(c)) || kept;
    cbRefreshList();
    const m =
      openModal(`<div class="cb-in"><h3>${made.length > 1 ? made.length + ' combos loaded' : 'Combo loaded'}</h3><p class="note">${kept ? 'Saved to Combos, and to Replays in the Synapse Arena.' : 'Saved to Combos. Play it once to keep its replay in the Synapse Arena.'}</p>
  <div class="cb-in-l">${made.map(c => `<div class="cb-in-i"><span><b>${esc(cbTitle(c))}</b><small>${c.hand.length} in hand · ${c.lines.reduce((n, l) => n + l.length, 0)} steps</small></span><button class="btn sm" data-inplay="${esc(c.id)}">${ic('play', 15)}Play</button><button class="btn sm" data-inedit="${esc(c.id)}">Edit</button></div>`).join('')}</div>
  <div class="dact"><button class="btn p" data-close>Done</button></div></div>`);
    m.querySelectorAll('[data-inplay]').forEach(
      b =>
        (b.onclick = () => {
          const c = cbGet(b.dataset.inplay);
          closeModal();
          if (c) setTimeout(() => cbPlay(c), 150);
        })
    );
    m.querySelectorAll('[data-inedit]').forEach(
      b =>
        (b.onclick = () => {
          const c = cbGet(b.dataset.inedit);
          closeModal();
          if (c) setTimeout(() => cbEdit(c), 150);
        })
    );
  };
  im.src = u;
}
{
  const kc = kxCombos;
  kxCombos = function () {
    kc.apply(this, arguments);
    const top = $('tb').querySelector('.cb-top'),
      nw = top && top.querySelector('[data-cbnew]');
    if (!nw || top.querySelector('[data-cbimp]')) return;
    const two = document.createElement('div');
    two.className = 'cb-two';
    nw.replaceWith(two);
    const im = document.createElement('button');
    im.type = 'button';
    im.className = 'btn';
    im.dataset.cbimp = '1';
    im.innerHTML = ic('image', 18) + 'From a combo image';
    const fi = document.createElement('input');
    fi.type = 'file';
    fi.accept = 'image/png,image/jpeg,image/webp';
    fi.hidden = true;
    fi.dataset.cbfile = '1';
    im.onclick = () => fi.click();
    fi.onchange = () => {
      const f = fi.files && fi.files[0];
      fi.value = '';
      cbImportImage(f);
    };
    two.append(nw, im, fi);
  };
}
/* ---------- a replay turned into a combo in the Arena arrives here ---------- */
window.addEventListener('message', e => {
  const d = e.data || {};
  if (d.kx !== 'comboNew' || !d.combo || typeof d.combo !== 'object') return;
  const f = $('arenaFrame');
  if (!f || e.source !== f.contentWindow) return;
  const id =
      'r' +
      String(d.combo.id || '')
        .replace(/[^\w-]/g, '')
        .slice(0, 40),
    old = cbGet(id),
    c = cbAdopt(d.combo, 'replay');
  if (!c) return;
  if (id.length > 1) {
    cbRemove(c.id);
    if (old) cbRemove(old.id);
    c.id = id;
    cbStore(c);
  }
  toast('Replay saved as a combo: ' + cbTitle(c));
  cbRefreshList();
});
