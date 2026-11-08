/* ---------- offline rulings download ---------- */
let dl=false;
$('bDl').onclick=async()=>{
  if(dl){dl=false;return}
  if(!navigator.onLine){$('dlst').textContent='Connect to the internet to download.';return}
  const ids=[...new Set(cards.map(c=>c.kid).filter(Boolean).map(String))];
  if(!ids.length){$('dlst').textContent='Card database not loaded yet.';return}
  dl=true;$('bDl').textContent='Stop download';let n=0,bad=0,i=0;
  const w=async()=>{while(dl){const id=ids[i++];if(id===undefined)return;try{const c=await kv('get','r:'+id);if(!c||!c.data)await getRul(id,true)}catch(e){if(/404/.test(e.message))await kv('put','r:'+id,{t:Date.now(),data:{records:[]}});else bad++}n++;if(n%10===0||n===ids.length){$('pg').style.width=(n/ids.length*100)+'%';$('dlst').textContent=`Downloading… ${n.toLocaleString()} / ${ids.length.toLocaleString()}${bad?' • '+bad+' failed':''}`}}};
  await Promise.all([w(),w(),w(),w()]);
  $('dlst').textContent=n>=ids.length?`Done • rulings saved on this device${bad?' • '+bad+' failed, run again to retry':''}`:`Stopped at ${n.toLocaleString()} / ${ids.length.toLocaleString()}. Tap download to resume.`;
  dl=false;$('bDl').textContent='Download all rulings';
};

