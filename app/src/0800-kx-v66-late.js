/* KodeX 9.9 (v66): the Synapse Arena is open to everyone, in the app and in a browser. Combos are part of the app:
   in a browser every way into Combos shows how the feature works and where to get the app.
   Created by Castel Noleal, creator of MEIOCG. A project of Meta Insider OCG since 2023. */
function kxComboAd() {
  return openModal(
    `<div class="cad"><h3>Combos are in the app</h3><p>Map out a combo, play it as a replay and share it as an image, in <b>Duel Synapse: KodeX</b> for Android.</p>
 <div class="cad-scene" aria-hidden="true"><div class="cad-row cad-hand"><i></i><i></i><i></i><i></i><i></i><span>Starting hand</span></div><div class="cad-row cad-line"><i></i><b>→</b><i></i><b>→</b><i></i><b>+</b><i></i><span>Each play and what it leads to</span></div><div class="cad-row cad-out"><em>▶ Replay</em><em>▣ Image</em><em>● Video</em><span>Play it, save it, share it</span></div></div>
 <ul class="cad-list"><li><b>Build</b> a line from any starting hand; KodeX reads each card and offers what it can do</li><li><b>Play it</b> in the Synapse Arena as a replay, with a title card, or record it as a video</li><li><b>Turn a replay into a combo</b>, one turn at a time</li><li><b>Save a combo image</b> that carries the combo, and load one back with its replay</li></ul>
 <a class="btn p" href="${esc(KX_STORE)}" target="_blank" rel="noopener" data-store>Get it on Google Play</a><p>Duels in the Synapse Arena stay free here in your browser.</p><div class="dact"><button class="btn" data-close>Not now</button></div></div>`,
    '',
    'comboad'
  );
}
/* every way into Combos: the Test tab tile, the Combo button on a card, opening/playing/sending one */
for (const fn of ['kxCombos', 'cbEdit', 'cbFromCard', 'cbPlay', 'cbPractice', 'cbImage', 'cbSend', 'cbImportImage']) {
  const f = window[fn];
  if (typeof f !== 'function') continue;
  window[fn] = function () {
    if (!kxInApp()) {
      kxComboAd();
      return;
    }
    return f.apply(this, arguments);
  };
}
{
  const th = kxTestHub;
  kxTestHub = function () {
    th.apply(this, arguments);
    if (kxInApp()) return;
    const em = $('tb').querySelector('[data-th=combo] em');
    if (em) em.textContent = 'In the app';
  };
  $('nTest').onclick = () => kxTestHub();
}
/* the Arena is told whether it runs inside the app (no zoom there, Combos there); it asks for this advert otherwise */
window.addEventListener('message', e => {
  const d = e.data || {},
    f = $('arenaFrame');
  if (!f || e.source !== f.contentWindow) return;
  if (d.kx === 'ready') {
    try {
      f.contentWindow.postMessage({ kx: 'host', app: kxInApp() }, '*');
    } catch (_) {}
  }
  if (d.kx === 'comboAd') kxComboAd();
});
{
  const f = $('arenaFrame');
  if (f && f.dataset.ready) {
    try {
      f.contentWindow.postMessage({ kx: 'host', app: kxInApp() }, '*');
    } catch (_) {}
  }
}
