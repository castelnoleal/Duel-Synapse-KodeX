/* ---------- start ---------- */
addEventListener('online',()=>{if(!cards.length)boot();else set(`${src} • ${cards.length.toLocaleString()} cards`)});
addEventListener('offline',()=>set('Offline • saved data is available',true));
if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
syncAd();addEventListener('resize',syncAd);addEventListener('load',syncAd);try{new ResizeObserver(syncAd).observe($('topAdSafeArea'))}catch(e){}
applySat();applySab();applyUI();wpApply();boot();
