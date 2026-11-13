/* KodeX 9.6 (v63): smoother combos. Created by Castel Noleal, creator of MEIOCG. A project of Meta Insider OCG since 2023. */
/* A combo goes to the Arena the moment the Arena can take it, and a cover hides the Arena until its title card is up. */
function cbCover(on){const box=$('Larena');let c=box.querySelector('.cb-cover');clearTimeout(cbCover.t);
 if(on){if(!c){c=document.createElement('div');c.className='cb-cover';c.innerHTML='<i></i><b>Opening your combo</b>';box.appendChild(c)}c.classList.remove('out');cbCover.t=setTimeout(()=>cbCover(false),7000)}
 else if(c){c.classList.add('out');setTimeout(()=>{if(c.classList.contains('out'))c.remove()},280)}}
function cbSend(msg,hash){const f=$('arenaFrame'),open=L.includes('arena')&&f.dataset.ready;
 if(msg.kx==='combo')cbCover(true);
 if(open){cbPost(msg);return}
 cbPend=msg;if(hash!=null)hash();else openArena('');
 if(!L.includes('arena')){cbPend=null;cbCover(false);return}
 // already loaded in the background: it will not say "ready" again, so it gets the combo at once
 if(f.dataset.ready){cbPend=null;cbPost(msg)}
 else setTimeout(()=>{if(cbPend===msg&&f.dataset.ready){cbPend=null;cbPost(msg)}},900)}
window.addEventListener('message',e=>{const d=e.data||{};if(d.kx==='comboShown')cbCover(false)});
