/* ---------- machine translation (restored for Android WebView) ---------- */
function hasCJK(s){return /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(String(s||''))}
function translationSource(s){if(/[\u3040-\u30ff]/.test(s))return 'ja';if(/[\uac00-\ud7af]/.test(s))return 'ko';if(/[\u3400-\u9fff]/.test(s))return 'zh';return 'auto'}
function splitTranslation(s,max=300){const out=[];let rest=String(s||'');while(rest.length>max){let cut=rest.lastIndexOf(' ',max);if(cut<Math.floor(max*.55))cut=max;out.push(rest.slice(0,cut));rest=rest.slice(cut).trimStart()}if(rest)out.push(rest);return out}
function decodeTranslation(s){const t=document.createElement('textarea');t.innerHTML=String(s||'');return t.value}
async function translateOne(text,source){
 const chunks=splitTranslation(text,300),out=[];
 for(const chunk of chunks){
  let result='';
  try{
   const r=await fetch('https://translate.meiocg.org/translate',{method:'POST',mode:'cors',cache:'no-store',headers:{'Content-Type':'text/plain;charset=UTF-8','Accept':'application/json'},body:JSON.stringify({q:chunk,source:source||'auto',target:'en'})});
   if(!r.ok)throw Error('Translation proxy HTTP '+r.status);
   const j=await r.json();if(typeof j.translatedText!=='string'||!j.translatedText.trim())throw Error('Empty translation');result=decodeTranslation(j.translatedText);
  }catch(proxyError){
   const pair=(source||'auto')+'|en';
   const r=await fetch('https://api.mymemory.translated.net/get?mt=1&q='+encodeURIComponent(chunk)+'&langpair='+encodeURIComponent(pair),{mode:'cors',cache:'no-store'});
   if(!r.ok)throw Error('Translation service HTTP '+r.status);
   const j=await r.json();if(typeof j?.responseData?.translatedText!=='string'||!j.responseData.translatedText.trim())throw Error('Translation service returned no text');result=decodeTranslation(j.responseData.translatedText);
  }
  out.push(result);
 }
 return out.join('\n');
}
async function translateRulingToEnglish(x,button,slot){
 const key='translation:en:'+String(x.id||x.t||x.q).slice(0,180);
 button.disabled=true;button.textContent='Translating…';slot.innerHTML='<div class="note">Connecting to translation service…</div>';
 try{
  const cached=await kv('get',key);
  if(cached&&cached.q){renderTranslation(slot,cached.q,cached.a,true);button.textContent='English translation';return}
  const source=translationSource((x.q||'')+' '+(x.a||''));
  const q=x.q?await translateOne(x.q,source):'';const a=x.a?await translateOne(x.a,source):'';
  if(!q&&!a)throw Error('No translatable text was returned');
  await kv('put',key,{q:q||x.q,a:a||x.a,t:Date.now()});renderTranslation(slot,q||x.q,a||x.a,false);button.textContent='English translation';
 }catch(e){slot.innerHTML=`<div class="translation-error">Translation failed: ${esc(e.message||'Please check your connection and retry.')}</div>`;button.textContent='Retry translation'}
 finally{button.disabled=false}
}
function renderTranslation(slot,q,a,cached){slot.innerHTML=`<div class="translation-box"><div class="translation-label">English machine translation${cached?' • saved on this device':''}</div><div>${esc(q||'').replace(/\n/g,'<br>')}${a?`<div style="margin-top:8px"><b>A:</b> ${esc(a).replace(/\n/g,'<br>')}</div>`:''}</div></div>`}

