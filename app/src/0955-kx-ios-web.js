/* ===================================================================================================================
   KodeX 10.4 · module: ios-and-web-app
   KodeX on iPhone: the iOS app (ios/: KodeX's files served on the phone, window.CastelApp.platform === 'ios') and the
   web app (kodex.meiocg.org/app/, added to the Home Screen from Safari). Created by Castel Noleal, creator of MEIOCG.
   - Where no ad network fills the ad strip (iPhone, the web), the free edition shows MEIOCG's own banner there.
   - In Safari on an iPhone or iPad, a one-time tip shows how to add KodeX to the Home Screen.
   =================================================================================================================== */
const KX_IOS_APP = !!(window.CastelApp && window.CastelApp.platform === 'ios');
const KX_STANDALONE = (() => {
  try {
    return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  } catch (e) {
    return false;
  }
})();
const KX_IOS_DEVICE =
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
if (KX_IOS_APP || KX_STANDALONE) document.documentElement.classList.add('kx-ios-app');

/* ---------- MEIOCG's own banner where no ad network fills the strip ---------- */
(function () {
  const slot = $('topAdSlot');
  if (PREMIUM || !slot) return;
  const nativeAds = !!window.CastelApp && !KX_IOS_APP; // the Android app lays its ad over the strip
  if (nativeAds) return;
  const ads = [
    {
      t: 'KodeX Premium',
      s: 'No ads · Combos · Duelist Studio · take back moves',
      b: 'See Premium',
      go: () => (typeof openPremiumInfo === 'function' ? openPremiumInfo() : $('bPrem').click())
    },
    {
      t: 'Meta Insider OCG',
      s: 'OCG news, rulings and decks from the Philippines',
      b: 'meiocg.org',
      go: () =>
        KX_IOS_APP ? CastelApp.openUrl('https://meiocg.org/') : window.open('https://meiocg.org/', '_blank', 'noopener')
    },
    {
      t: 'Have a Premium code?',
      s: 'Redeem it in Settings to unlock KodeX Premium',
      b: 'Redeem',
      go: () => (typeof kxRedeem === 'function' ? kxRedeem() : null)
    }
  ];
  let i = 0;
  slot.classList.add('kx-house');
  const draw = () => {
    const a = ads[i % ads.length];
    slot.innerHTML = `<button type="button" class="kxh" aria-label="${esc(a.t)}: ${esc(a.s)}"><img src="${esc(
      document.querySelector('link[rel=icon]') ? document.querySelector('link[rel=icon]').href : ''
    )}" alt=""><span><b>${esc(a.t)}</b><small>${esc(a.s)}</small></span><i>${esc(a.b)}</i></button>`;
    slot.querySelector('.kxh').onclick = a.go;
  };
  draw();
  setInterval(() => {
    if (document.hidden) return;
    i++;
    draw();
  }, 20000);
})();

/* ---------- Safari on an iPhone: how to add KodeX to the Home Screen (once) ---------- */
(function () {
  if (!KX_IOS_DEVICE || KX_IOS_APP || KX_STANDALONE) return;
  if (!document.querySelector('meta[name=kodex-web-app]')) return;
  if (S.g('ios_tip', 0)) return;
  setTimeout(() => {
    const m = openModal(
      `<div class="dk-hd"><h3>KodeX on your iPhone</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
 <p class="note">Add KodeX to your Home Screen: it opens full screen like an app, keeps your decks and combos, and works offline.</p>
 <ol class="kx-ios-steps"><li>Tap <b>Share</b> <span class="kx-ios-share" aria-hidden="true"></span> in Safari's toolbar.</li><li>Choose <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>. Open KodeX from its icon.</li></ol>
 <div class="dact"><button class="btn p" data-close>Got it</button></div>`,
      '',
      'iostip'
    );
    S.s('ios_tip', 1);
    return m;
  }, 2500);
})();

/* ---------- the web app keeps working offline (its own service worker, for /app/) ---------- */
if (
  document.querySelector('meta[name=kodex-web-app]') &&
  'serviceWorker' in navigator &&
  location.protocol === 'https:'
) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {}));
}
