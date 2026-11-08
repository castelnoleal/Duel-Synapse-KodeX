/* ---------- settings ---------- */
const TH={
  Midnight:{accent:'#67a8ff',bg:'#080a10',glow:'#17213a',panel:'#111522',panel2:'#171b2a',line:'#272d40',text:'#eef2ff',muted:'#9aa4bd'},
  Ocean:{accent:'#20d6c7',bg:'#061014',glow:'#10313b',panel:'#0d1d24',panel2:'#142a33',line:'#25434c',text:'#e7fbff',muted:'#91b8c2'},
  Emerald:{accent:'#4ade80',bg:'#07110c',glow:'#143522',panel:'#101e16',panel2:'#192b20',line:'#2b4935',text:'#edfff2',muted:'#9bb8a4'},
  Violet:{accent:'#a78bfa',bg:'#0c0914',glow:'#292044',panel:'#171326',panel2:'#211b32',line:'#39304f',text:'#f5f0ff',muted:'#b3a7cc'},
  Crimson:{accent:'#ff5c7c',bg:'#13080d',glow:'#3a1724',panel:'#21121a',panel2:'#301923',line:'#4b2935',text:'#fff0f3',muted:'#c9a0ab'},
  Amber:{accent:'#fbbf24',bg:'#120e06',glow:'#38290e',panel:'#201a0e',panel2:'#302716',line:'#4b3d22',text:'#fff8e8',muted:'#c5b58e'}
};
function applyUI(){
  const s=Math.max(80,Math.min(125,Number(S.g('ts',100))||100));
  document.documentElement.style.fontSize=(16*s/100)+'px';$('ts').value=s;$('tsv').textContent=s+'%';
  const name=S.g('theme','Midnight'),theme=TH[name]||TH.Midnight,root=document.documentElement.style,intensity=Math.max(0,Math.min(100,Number(S.g('ti',60))));$('ti').value=intensity;$('tiVal').textContent=intensity+'%';
  for(const k of ['bg','panel','panel2','line','text','muted','accent'])root.setProperty('--'+k,theme[k]);
  const hex=theme.glow.replace('#',''),gr=parseInt(hex.slice(0,2),16),gg=parseInt(hex.slice(2,4),16),gb=parseInt(hex.slice(4,6),16),ga=(intensity/100*.72).toFixed(3);document.body.style.background=`radial-gradient(circle at top,rgba(${gr},${gg},${gb},${ga}) 0,${theme.bg} 58%) ${theme.bg}`;
  root.setProperty('--theme-glow',theme.glow);{const h=theme.accent,r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);root.setProperty('--soft',`rgba(${r},${g},${b},${(.03+intensity/100*.20).toFixed(3)})`);root.setProperty('--soft2',`rgba(${r},${g},${b},${(.02+intensity/100*.13).toFixed(3)})`);document.querySelector('meta[name=theme-color]').setAttribute('content',theme.bg)}
  document.querySelectorAll('.sw').forEach(b=>b.setAttribute('aria-checked',S.g(b.dataset.t,true)));
  $('themes').innerHTML=Object.entries(TH).map(([n,c])=>`<button aria-pressed="${name===n}" data-th="${n}"><i style="background:${c.accent}"></i>${n}</button>`).join('');
}
$('ts').oninput=e=>{S.s('ts',+e.target.value);applyUI()};
$('ti').oninput=e=>{S.s('ti',+e.target.value);applyUI()};
document.querySelectorAll('.sw').forEach(b=>b.onclick=()=>{S.s(b.dataset.t,!S.g(b.dataset.t,true));applyUI();if(!detail.hidden&&b.dataset.t==='cp'&&cur)openCard(cur.id);else run()});
$('themes').addEventListener('click',e=>{const b=e.target.closest('[data-th]');if(b){S.s('theme',b.dataset.th);applyUI()}});
$('bSet').onclick=()=>{push('set');savedCount()};
function tool(t,h){$('Ltool').classList.remove('full');$('tt').textContent=t;$('tb').innerHTML=h;L.includes('tool')?0:push('tool')}
