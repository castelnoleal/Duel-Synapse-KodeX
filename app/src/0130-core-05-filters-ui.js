/* ---------- filters UI ---------- */
function visF(){const t=[...document.querySelectorAll('#fBody [data-g=types] [aria-pressed=true]')].map(x=>x.dataset.v);document.querySelectorAll('#fBody [data-for]').forEach(e=>e.hidden=!t.includes(e.dataset.for));$('fHint').hidden=t.length>0}
function buildFilters(){
  const gs=FG.map(g=>`<div${g[3]?` data-for="${g[3]}"`:''}><div class="sec">${g[1]}</div><div class="chips" data-g="${g[0]}">${g[2].map(v=>`<button class="chip" aria-pressed="${F[g[0]].includes(v)}" data-v="${esc(v)}">${esc(v)}</button>`).join('')}</div></div>`);
  $('fBody').innerHTML=gs[0]+'<p id="fHint" class="note">Select Monster, Spell or Trap to see more filters.</p>'+gs.slice(1).join('')+`<div data-for="Monster"><div class="sec">Monster Stats</div><div class="rg">${RG.map(r=>`<div><label for="f_${r[0]}0">${r[1]} min</label><input id="f_${r[0]}0" type="number" inputmode="numeric" min="0" value="${esc(F[r[0]][0])}"></div><div><label for="f_${r[0]}1">${r[1]} max</label><input id="f_${r[0]}1" type="number" inputmode="numeric" min="0" value="${esc(F[r[0]][1])}"></div>`).join('')}</div></div>`;
  visF();
}
$('fBody').addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;b.setAttribute('aria-pressed',b.getAttribute('aria-pressed')!=='true');if(b.parentNode.dataset.g==='types')visF()});
$('bFil').onclick=()=>{buildFilters();push('fil')};$('nTest').onclick=()=>openArena('');
$('fOk').onclick=()=>{const f=fresh();document.querySelectorAll('#fBody .chips').forEach(g=>{if(!g.closest('[hidden]'))f[g.dataset.g]=[...g.querySelectorAll('[aria-pressed=true]')].map(x=>x.dataset.v)});RG.forEach(r=>{const a=$('f_'+r[0]+'0');if(!a.closest('[hidden]'))f[r[0]]=[a.value.trim(),$('f_'+r[0]+'1').value.trim()]});F=f;S.s('filters',F);history.back();run()};
$('fRst').onclick=()=>{F=fresh();S.s('filters',F);buildFilters();run()};

