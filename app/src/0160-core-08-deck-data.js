/* ---------- deck data ---------- */
function normalizeDeck(d){const raw=Array.isArray(d.cards)?d.cards:[],tot=new Map(),out=[];for(const c of raw){const id=String(c.id),sec=['main','extra','side'].includes(c.section)?c.section:'main',used=tot.get(id)||0;let q=Math.max(1,Math.min(3,parseInt(c.qty)||1));q=Math.min(q,3-used);if(q<=0)continue;tot.set(id,used+q);const ex=out.find(x=>x.id===id&&x.section===sec);if(ex)ex.qty+=q;else out.push({id,name:c.name||'Unknown card',kid:c.kid||null,section:sec,qty:q})}d.cards=out;d.icon=d.icon||'';return d}
const deckStore=()=>S.g('decks',[]).map(normalizeDeck);
const CAP={main:60,extra:15,side:15};
const deckTotal=d=>d.cards.reduce((n,c)=>n+(c.qty||1),0);
const copiesOf=(d,c)=>d.cards.filter(x=>String(x.id)===String(c.id)).reduce((n,x)=>n+x.qty,0);
const copies=(d,k)=>d.cards.filter(c=>c.section===k).flatMap(c=>Array.from({length:c.qty||1},()=>c));
function allowedSec(c,sec){const live=resolveDeckCard(c);if(!live)return true;return sec==='side'||(extraType(live)?sec==='extra':sec==='main')}
function addCopy(d,c,sec){if(copiesOf(d,c)>=3)return 'Maximum 3 copies';if(!allowedSec(c,sec))return 'Not allowed in '+SEC[sec];if(cnt(d,sec)>=CAP[sec])return SEC[sec]+' deck is full';const e=d.cards.find(x=>String(x.id)===String(c.id)&&x.section===sec);if(e)e.qty++;else d.cards.push({id:String(c.id),name:c.name,kid:c.kid||null,section:sec,qty:1});return 'ok'}
function dropCopy(d,id,sec){const e=d.cards.find(x=>String(x.id)===String(id)&&x.section===sec);if(!e)return false;if(--e.qty<=0)d.cards=d.cards.filter(x=>x!==e);return true}
function moveCopy(deckId,id,from,to){const a=deckStore(),d=a.find(x=>String(x.id)===String(deckId));if(!d||!from||from===to)return;const e=d.cards.find(x=>String(x.id)===String(id)&&x.section===from);if(!e)return;const c={id:e.id,name:e.name,kid:e.kid};if(!allowedSec(c,to)){toast('Not allowed in '+SEC[to]);return}if(cnt(d,to)>=CAP[to]){toast(SEC[to]+' deck is full');return}dropCopy(d,id,from);addCopy(d,c,to);saveDecks(a);showDeck(d.id)}
const saveDecks=a=>S.s('decks',a);
const deckById=id=>deckStore().find(d=>String(d.id)===String(id));
const cardInDeck=(d,c)=>d.cards.some(x=>String(x.id)===String(c.id));
const _oldNorm=d=>{d.cards=Array.isArray(d.cards)?d.cards.map(c=>({id:String(c.id),name:c.name||'Unknown card',kid:c.kid||null,section:['main','extra','side'].includes(c.section)?c.section:'main'})):[];return d};
function createDeck(name,icon){name=String(name||'').trim();if(!name)return null;const a=deckStore(),d={id:'d'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:name.slice(0,60),cards:[],created:Date.now(),icon:icon||''};a.push(d);saveDecks(a);return d}
const cnt=(d,k)=>d.cards.filter(c=>c.section===k).reduce((n,c)=>n+(c.qty||1),0);
const deckIcon=(d,s=48)=>d.icon?`<img class="dk-ic" style="width:${s}px;height:${s}px" src="${esc(d.icon)}" alt="">`:`<span class="dk-ic ph" style="width:${s}px;height:${s}px;font-size:${Math.round(s*.42)}px">${esc((d.name||'?').trim().charAt(0).toUpperCase())}</span>`;
