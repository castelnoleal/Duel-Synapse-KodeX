/* KodeX 10.2 (v69): finishing emote, combo sheet formats, deck statistics, banlists, help search, uploaded banners,
   NRS profile. Created by Castel Noleal, creator of MEIOCG. A project of Meta Insider OCG since 2023. */

/* ---------- Premium: the finishing emote, shown over the field before the winning showdown ---------- */
function finEmoteRow() {
  const cur = S.g('fin_emote', ''),
    list = MEDIA.emotes || [];
  return `<div class="fe-box"><b>Finishing emote</b><p class="note">One of your emotes fills the field just before the winning showdown, then the showdown plays. Everyone in the duel sees it.</p><div class="fe-row" role="radiogroup" aria-label="Finishing emote"><button type="button" role="radio" data-finem="" class="fe-t${cur ? '' : ' on'}" aria-checked="${!cur}"><span>None</span></button>${list
    .map(
      x =>
        `<button type="button" role="radio" data-finem="${esc(x.id)}" class="fe-t${cur === x.id ? ' on' : ''}" aria-checked="${cur === x.id}"><img src="${x.src}" alt=""><span>${esc(x.name)}</span></button>`
    )
    .join(
      ''
    )}</div>${list.length ? '' : '<p class="note">Add an emote under Emotes first (an animated GIF up to 6 MB works best).</p>'}</div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-finem]');
  if (!b) return;
  S.s('fin_emote', b.dataset.finem);
  b.parentNode.querySelectorAll('[data-finem]').forEach(x => {
    x.classList.toggle('on', x === b);
    x.setAttribute('aria-checked', String(x === b));
  });
  skinsToArena();
  toast(b.dataset.finem ? 'Finishing emote set' : 'No finishing emote');
});

/* ---------- Deck statistics: exact odds, interactive charts, weak spots and suggestions (works offline) ---------- */
let dsAtkPool = null,
  dsNames = null;
/** The numbers for one deck (see duel/deckstats.js). */
function deckStatsOf(d) {
  normalizeDeck(d);
  if (!dsAtkPool || dsAtkPool.n !== cards.length) {
    const a = [];
    for (const c of cards) if (/monster/i.test(c.type || '') && c.atk != null && +c.atk >= 0) a.push(+c.atk);
    dsAtkPool = a.sort((x, y) => x - y);
    dsAtkPool.n = cards.length;
    dsNames = new Set(cards.map(c => c.name));
  }
  const conv = c => DeckStats.fromKodex(Object.assign({}, c, resolveDeckCard(c) || {}));
  return DeckStats.analyze(copies(d, 'main').map(conv), copies(d, 'extra').map(conv), {
    atkPool: dsAtkPool,
    known: n => dsNames.has(n)
  });
}
const DS_COL = {
  starter: '#f0b429',
  extender: '#8d99ff',
  handtrap: '#e0566b',
  interrupt: '#ff8a5c',
  breaker: '#38c9a6',
  draw: '#5ec8ff',
  brick: '#8790ab',
  other: '#4c5674'
};
const dsPc = v => (v == null ? '–' : (v * 100).toFixed(1) + '%');
/* small SVG charts; every bar or point carries data-tip, shown in the panel's info line when tapped or hovered */
function dsColumns(vals, labels, tips, col = '#8d99ff', h = 150) {
  const w = Math.max(240, vals.length * 46),
    max = Math.max(1e-9, ...vals);
  return `<svg viewBox="0 0 ${w} ${h}" class="ds-ch" role="img">${vals
    .map((v, i) => {
      const bw = (w - 20) / vals.length - 10,
        x = 10 + (i * (w - 20)) / vals.length + 5,
        bh = (v / max) * (h - 44);
      return `<g class="ds-hit" data-tip="${esc(tips[i])}" tabindex="0"><rect x="${x - 5}" y="0" width="${bw + 10}" height="${h}" fill="transparent"/><rect x="${x}" y="${h - 22 - bh}" width="${bw}" height="${Math.max(1, bh)}" rx="5" fill="${col}"/><text x="${x + bw / 2}" y="${h - 26 - bh}" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">${typeof v === 'number' && v <= 1 && labels.length < 12 && tips[i].includes('%') ? Math.round(v * 100) + '%' : v}</text><text x="${x + bw / 2}" y="${h - 6}" text-anchor="middle" font-size="11" fill="#9aa4bd">${esc(labels[i])}</text></g>`;
    })
    .join('')}</svg>`;
}
function dsLines(series, labels, h = 170) {
  const leg = `<div class="ds-leg">${series.map(s => `<span><i style="background:${s.c}"></i>${esc(s.name)}</span>`).join('')}</div>`;
  const w = 320,
    n = labels.length,
    X = i => 34 + (i * (w - 48)) / Math.max(1, n - 1),
    Y = v => h - 24 - v * (h - 44);
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map(
      g =>
        `<path d="M34 ${Y(g)}H${w - 14}" stroke="#ffffff" stroke-opacity=".1"/><text x="28" y="${Y(g) + 4}" text-anchor="end" font-size="10" fill="#9aa4bd">${g * 100}%</text>`
    )
    .join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="ds-ch" role="img">${grid}${labels.map((l, i) => `<text x="${X(i)}" y="${h - 6}" text-anchor="middle" font-size="10" fill="#9aa4bd">${esc(l)}</text>`).join('')}${series
    .map(
      s =>
        `<path d="${s.v.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join('')}" fill="none" stroke="${s.c}" stroke-width="2.6" stroke-linejoin="round"/>${s.v.map((v, i) => `<circle class="ds-hit" data-tip="${esc(s.name + ' · ' + labels[i] + ': ' + dsPc(v))}" tabindex="0" cx="${X(i)}" cy="${Y(v)}" r="5" fill="${s.c}"/>`).join('')}`
    )
    .join('')}</svg>${leg}`;
}
function dsDonut(parts, label) {
  const tot = parts.reduce((a, p) => a + p[1], 0) || 1,
    r = 42,
    L = 2 * Math.PI * r;
  let off = 0;
  return `<svg viewBox="0 0 120 120" class="ds-donut" role="img"><circle cx="60" cy="60" r="${r}" fill="none" stroke="#ffffff14" stroke-width="16"/>${parts
    .filter(p => p[1])
    .map(p => {
      const l = (p[1] / tot) * L,
        s = `<circle class="ds-hit" data-tip="${esc(`${p[0]}: ${p[1]} (${Math.round((p[1] / tot) * 100)}%)`)}" tabindex="0" cx="60" cy="60" r="${r}" fill="none" stroke="${p[2]}" stroke-width="16" stroke-dasharray="${l} ${L - l}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"/>`;
      off += l;
      return s;
    })
    .join(
      ''
    )}<text x="60" y="58" text-anchor="middle" font-size="20" font-weight="800" fill="currentColor">${tot}</text><text x="60" y="74" text-anchor="middle" font-size="9" fill="#9aa4bd">${esc(label)}</text></svg>`;
}
function dsHBars(rows, max) {
  max = max || Math.max(1, ...rows.map(r => r[1]));
  return `<div class="ds-hb">${rows.map(([l, v, c, tip, key]) => `<button type="button" class="ds-hr ds-hit"${key ? ` data-role="${esc(key)}"` : ''} data-tip="${esc(tip || l + ': ' + v)}"><span>${esc(l)}</span><i><b style="width:${Math.max(2, (v / max) * 100)}%;background:${c || '#8d99ff'}"></b></i><em>${v}</em></button>`).join('')}</div>`;
}
function openDeckStats(id) {
  const d = deckById(id);
  if (!d) return;
  if (!copies(d, 'main').length) {
    toast('Add cards to the Main Deck first');
    return;
  }
  const A = deckStatsOf(d);
  let hand = 5,
    tab = 'over',
    starters = A.roles.starter,
    size = A.N,
    pick = (A.perCard.find(c => c.role === 'starter') || A.perCard[0] || {}).id;
  const m = openModal(
    `<div class="dk-hd"><h3>Deck statistics</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
<div class="ds"><div class="ds-top"><b>${esc(d.name)}</b><small>${A.N} Main · ${A.extraN} Extra · exact odds, works offline</small></div>
<div class="ds-tabs" role="tablist">${[
      ['over', 'Overview'],
      ['hands', 'Opening hands'],
      ['make', 'Make-up'],
      ['weak', 'Weak spots']
    ]
      .map(([k, l]) => `<button role="tab" data-dt="${k}">${l}</button>`)
      .join('')}</div>
<div class="ds-body"></div><p class="ds-tip" aria-live="polite">Tap a bar or a point to see its number.</p>
<div class="dact"><button class="btn" data-dsimg>${ic('image', 18)}Save as image</button><button class="btn" data-dsold>Arena results &amp; key cards</button></div></div>`,
    'big ds-dlg',
    'dstats'
  );
  const body = m.querySelector('.ds-body'),
    tip = m.querySelector('.ds-tip');
  const go = () => (hand === 5 ? A.first : A.second);
  const seg = () =>
    `<div class="ds-seg" role="radiogroup" aria-label="Opening hand"><button data-hand="5" class="${hand === 5 ? 'on' : ''}">Going first · 5 cards</button><button data-hand="6" class="${hand === 6 ? 'on' : ''}">Going second · 6 cards</button></div>`;
  const draw = () => {
    m.querySelectorAll('[data-dt]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.dt === tab)));
    const g = go();
    if (tab === 'over')
      body.innerHTML = `<div class="ds-rt">${A.rating
        .map(
          r =>
            `<button type="button" class="ds-r ds-hit" data-tip="${esc(r.why)}"><span>${esc(r.label)}</span><i><b style="width:${r.v}%"></b></i><em>${r.v}%</em><small>${esc(r.word)}</small></button>`
        )
        .join('')}</div>
<p class="note">Each rating is a real chance: 84% consistency means 84 opening hands in 100 hold a starter. Tap one to see how it is worked out.</p>
${seg()}<div class="ds-kp">${[
        ['Open a starter', g.starter],
        ['Strong opening', g.strong],
        ['Starter + hand trap', g.fullCombo],
        ['A hand trap or interrupt', g.interact],
        ['A board breaker', g.breaker],
        ['Brick (no starter, no extender)', g.brick, 1]
      ]
        .map(([l, v, bad]) => `<div class="ds-k${bad ? ' bad' : ''}"><b>${dsPc(v)}</b><small>${l}</small></div>`)
        .join(
          ''
        )}<div class="ds-k"><b>${g.mean.toFixed(2)}</b><small>starters per hand (±${g.sd.toFixed(2)})</small></div></div>`;
    else if (tab === 'hands') {
      const pcard = A.perCard.find(c => String(c.id) === String(pick)) || A.perCard[0];
      const turns = ['T1', 'T2', 'T3', 'T4', 'T5'];
      body.innerHTML = `${seg()}<h6>How many starters you open (${A.roles.starter} in ${A.N} cards)</h6>${dsColumns(
        g.starters.map(v => +v.toFixed(4)),
        g.starters.map((_, i) => String(i)),
        g.starters.map((v, i) => `Exactly ${i} starter${i === 1 ? '' : 's'} in ${hand} cards: ${dsPc(v)}`),
        '#f0b429'
      )}
<h6>What if…</h6><div class="ds-wi"><label>Starters <input type="range" min="0" max="${Math.min(30, A.N)}" value="${starters}" data-wi="s"><b>${starters}</b></label><label>Deck size <input type="range" min="${Math.min(40, A.N)}" max="60" value="${size}" data-wi="n"><b>${size}</b></label><div class="ds-k big"><b>${dsPc(A.whatIf(starters, size, hand))}</b><small>open at least 1 starter in ${hand} cards</small></div></div>
${dsLines(
  [
    {
      name: 'This deck',
      c: '#f0b429',
      v: [40, 45, 50, 55, 60].map(n => A.whatIf(Math.round((starters * n) / size), n, hand))
    },
    {
      name: '+3 starters',
      c: '#8d99ff',
      v: [40, 45, 50, 55, 60].map(n => A.whatIf(Math.round(((starters + 3) * n) / size), n, hand))
    }
  ],
  ['40', '45', '50', '55', '60']
)}<small class="note">The same share of starters at each deck size.</small>
<h6>Seeing one card by turn</h6><select data-pick>${A.perCard.map(c => `<option value="${esc(c.id)}"${String(c.id) === String(pcard.id) ? ' selected' : ''}>${esc(c.name)} ×${c.n}</option>`).join('')}</select>
${dsLines(
  [1, 2, 3].map(k => ({
    name: `${k} cop${k === 1 ? 'y' : 'ies'}`,
    c: ['#5ec8ff', '#8d99ff', '#f0b429'][k - 1],
    v: A.seeBy(k, 5, hand === 5)
  })),
  turns
)}<small class="note">${esc(pcard.name)}: you play ${pcard.n}. Going ${hand === 5 ? 'first' : 'second'} you see one by your first turn ${dsPc(hand === 5 ? pcard.first : pcard.second)} of the time.</small>`;
    } else if (tab === 'make') {
      const lv = Object.entries(A.levels).sort((a, b) => a[0] - b[0]),
        bins = [0, 0, 0, 0, 0, 0],
        bl = ['0–999', '1000+', '1500+', '2000+', '2500+', '3000+'];
      for (const a of A.atks) bins[a >= 3000 ? 5 : a >= 2500 ? 4 : a >= 2000 ? 3 : a >= 1500 ? 2 : a >= 1000 ? 1 : 0]++;
      body.innerHTML = `<h6>What each card does (tap one to see the cards)</h6>${dsHBars(
        A.ROLE_ORDER.filter(r => A.roles[r]).map(r => [
          A.ROLE_NAME[r],
          A.roles[r],
          DS_COL[r],
          `${A.ROLE_NAME[r]}: ${A.roles[r]} of ${A.N} (${Math.round((A.roles[r] / A.N) * 100)}%)`,
          r
        ])
      )}<div class="ds-rl" hidden></div>
<div class="ds-2"><div><h6>Card types</h6>${dsDonut(
        [
          ['Monsters', A.kinds.monster, '#f0b429'],
          ['Spells', A.kinds.spell, '#38c9a6'],
          ['Traps', A.kinds.trap, '#e0566b']
        ],
        'Main Deck'
      )}</div><div><h6>Extra Deck</h6>${dsDonut(
        Object.entries(A.exMake).map(([k, v], i) => [k, v, ['#8d99ff', '#ffffff', '#f0b429', '#5ec8ff'][i % 4]]),
        'Extra Deck'
      )}</div></div>
${
  lv.length
    ? `<h6>Levels (Main Deck monsters)</h6>${dsColumns(
        lv.map(x => x[1]),
        lv.map(x => 'Lv' + x[0]),
        lv.map(x => `Level ${x[0]}: ${x[1]} card${x[1] === 1 ? '' : 's'}`),
        '#8d99ff'
      )}`
    : ''
}
${
  A.atks.length
    ? `<h6>ATK (median ${A.atkMed}, average ${Math.round(A.atkMean)})</h6>${dsColumns(
        bins,
        bl,
        bins.map((v, i) => `${bl[i]} ATK: ${v} monster${v === 1 ? '' : 's'}`),
        '#e0566b'
      )}`
    : ''
}
${A.attrs.length ? `<h6>Attributes</h6>${dsHBars(A.attrs.map(([k, v]) => [k, v, '#5ec8ff']))}` : ''}${A.races.length ? `<h6>Types</h6>${dsHBars(A.races.slice(0, 8).map(([k, v]) => [k, v, '#38c9a6']))}` : ''}`;
    } else
      body.innerHTML = `<h6>Weak spots</h6>${A.weak.length ? A.weak.map(w => `<div class="ds-w"><b>${esc(w.t)}</b><p>${esc(w.d)}</p></div>`).join('') : '<p class="note">No clear weak spot from the card text.</p>'}
<h6>Needs improvement</h6>${A.improve.length ? A.improve.map(w => `<div class="ds-w imp"><b>${esc(w.t)}</b><p>${esc(w.d)}</p></div>`).join('') : '<p class="note">Nothing to fix from the numbers.</p>'}
<h6>Suggestions</h6>${
        A.suggest.length
          ? `<div class="ds-sg">${A.suggest
              .map(s => {
                const c = cards.find(x => x.name === s.t);
                return `<button type="button" class="ds-s"${c ? ` data-quickview="${esc(c.id)}"` : ''}>${c ? `<img src="${esc(c.sm || c.img || '')}" alt="" loading="lazy">` : ''}<span><b>${esc(s.t)}</b><small>${esc(s.d)}</small></span></button>`;
              })
              .join('')}</div>`
          : '<p class="note">No suggestions: the deck already covers the basics.</p>'
      }
<p class="note">Read from the card text with exact odds; your own testing in the Duel Arena is the final word.</p>`;
  };
  m.addEventListener('click', e => {
    const t = e.target.closest('[data-dt],[data-hand],[data-role],[data-quickview],.ds-hit,[data-dsimg],[data-dsold]');
    if (!t) return;
    if (t.dataset.dt) {
      tab = t.dataset.dt;
      draw();
    } else if (t.dataset.hand) {
      hand = +t.dataset.hand;
      draw();
    } else if (t.dataset.quickview) quickView(t.dataset.quickview);
    else if (t.hasAttribute('data-dsimg')) deckStatsImage(d, A);
    else if (t.hasAttribute('data-dsold')) {
      closeModal();
      setTimeout(() => openAnalyzer(id), 120);
    }
    if (t.dataset.role) {
      const box = m.querySelector('.ds-rl'),
        list = A.cards.filter(c => c.role === t.dataset.role);
      box.hidden = false;
      box.innerHTML = `<b>${esc(A.ROLE_NAME[t.dataset.role])}</b>${list.map(c => `<button type="button" class="ds-c" data-quickview="${esc(c.id)}">${esc(c.name)} <em>×${c.n}</em></button>`).join('')}`;
    }
    if (t.dataset.tip) tip.textContent = t.dataset.tip;
  });
  m.addEventListener('mouseover', e => {
    const t = e.target.closest('.ds-hit');
    if (t && t.dataset.tip) tip.textContent = t.dataset.tip;
  });
  m.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.wi) {
      if (t.dataset.wi === 's') starters = +t.value;
      else size = +t.value;
      draw();
      const again = m.querySelector(`[data-wi="${t.dataset.wi}"]`);
      if (again) again.focus();
    }
    if (t.matches('[data-pick]')) {
      pick = t.value;
      draw();
    }
  });
  draw();
  return m;
}
/** The statistics as a picture, in the deck image designs. */
function deckStatsImage(d, A) {
  const pm = S.g('stats_img', {}) || {};
  const m = openModal(
    `<div class="dk-hd"><h3>Statistics image</h3><button class="ibtn" data-close aria-label="Close">${ic('x')}</button></div>
<div class="di-des" role="radiogroup" aria-label="Design">${DI_DESIGNS.map(([k, l, t]) => `<button type="button" role="radio" data-dsg="${k}" title="${esc(t)}" class="${(pm.design || 'night') === k ? 'on' : ''}"><i class="di-sw di-${k}"></i>${l}</button>`).join('')}</div>
<div class="dact"><button class="btn p" data-go>${ic('image', 18)}Make image</button></div>`,
    '',
    'dsimg'
  );
  let design = DI_DESIGNS.some(x => x[0] === pm.design) ? pm.design : 'night';
  m.querySelectorAll('[data-dsg]').forEach(
    b =>
      (b.onclick = () => {
        design = b.dataset.dsg;
        m.querySelectorAll('[data-dsg]').forEach(x => x.classList.toggle('on', x === b));
      })
  );
  m.querySelector('[data-go]').onclick = () => {
    S.s('stats_img', { design });
    closeModal();
    setTimeout(() => deckViewer(buildStatsSvg(d, A, design), (d.name || 'deck') + ' stats', null), 120);
  };
}
function buildStatsSvg(d, A, design) {
  const W = 1600,
    P = DI_PAL[design] || DI_PAL.night,
    clean = design === 'clean',
    F = "'Chakra Petch','Plus Jakarta Sans',Arial,sans-serif",
    B = "'Plus Jakarta Sans','Chakra Petch',Arial,sans-serif",
    pad = 64,
    o = [],
    X = v =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
  let y = 190;
  const sec = t => {
    o.push(
      `<text x="${pad}" y="${y}" font-family="${F}" font-size="26" font-weight="800" letter-spacing="3" fill="${P.gold}">${X(t)}</text>`
    );
    y += 26;
  };
  sec('RATINGS · REAL CHANCES');
  A.rating.forEach((r, i) => {
    const x = pad + (i % 2) * ((W - pad * 2) / 2 + 10),
      yy = y + Math.floor(i / 2) * 92,
      w = (W - pad * 2) / 2 - 20;
    o.push(
      `<text x="${x}" y="${yy + 30}" font-family="${F}" font-size="24" font-weight="700" fill="${P.ink}">${X(r.label)}</text><text x="${x + w}" y="${yy + 30}" font-family="${F}" font-size="26" font-weight="800" fill="${P.ink}" text-anchor="end">${r.v}%</text><rect x="${x}" y="${yy + 44}" width="${w}" height="14" rx="7" fill="${P.slot}"/><rect x="${x}" y="${yy + 44}" width="${(w * r.v) / 100}" height="14" rx="7" fill="${P.accent}"/><text x="${x}" y="${yy + 82}" font-family="${B}" font-size="17" fill="${P.sub}">${X(r.word)}</text>`
    );
  });
  y += Math.ceil(A.rating.length / 2) * 92 + 40;
  sec('OPENING HANDS');
  const kp = [
    ['Starter going first', A.first.starter],
    ['Starter going second', A.second.starter],
    ['Strong opening', A.first.strong],
    ['Hand trap going second', A.second.interact],
    ['Board breaker going second', A.second.breaker],
    ['Brick going first', A.first.brick]
  ];
  kp.forEach(([l, v], i) => {
    const cw = (W - pad * 2 - 50) / 6,
      x = pad + i * (cw + 10);
    o.push(
      `<rect x="${x}" y="${y}" width="${cw}" height="128" rx="16" fill="${P.head}"/><text x="${x + cw / 2}" y="${y + 62}" font-family="${F}" font-size="40" font-weight="800" fill="${i === 5 ? '#e0566b' : P.ink}" text-anchor="middle">${(v * 100).toFixed(1)}%</text><text x="${x + cw / 2}" y="${y + 100}" font-family="${B}" font-size="16" fill="${P.sub}" text-anchor="middle">${X(l)}</text>`
    );
  });
  y += 170;
  // starters distribution
  const dist = A.first.starters,
    mx = Math.max(...dist),
    cw = (W - pad * 2) / dist.length;
  sec(`STARTERS IN 5 CARDS (${A.roles.starter} IN ${A.N})`);
  dist.forEach((v, i) => {
    const bh = (v / mx) * 200;
    o.push(
      `<rect x="${pad + i * cw + 20}" y="${y + 230 - bh}" width="${cw - 40}" height="${Math.max(2, bh)}" rx="10" fill="${P.gold}"/><text x="${pad + i * cw + cw / 2}" y="${y + 222 - bh}" font-family="${F}" font-size="22" font-weight="800" fill="${P.ink}" text-anchor="middle">${(v * 100).toFixed(1)}%</text><text x="${pad + i * cw + cw / 2}" y="${y + 262}" font-family="${B}" font-size="18" fill="${P.sub}" text-anchor="middle">${i} starter${i === 1 ? '' : 's'}</text>`
    );
  });
  y += 300;
  sec('WHAT THE DECK IS MADE OF');
  const roles = A.ROLE_ORDER.filter(r => A.roles[r]);
  let x0 = pad;
  roles.forEach(r => {
    const w = ((W - pad * 2) * A.roles[r]) / A.N;
    o.push(`<rect x="${x0}" y="${y}" width="${Math.max(0, w - 4)}" height="44" rx="8" fill="${DS_COL[r]}"/>`);
    x0 += w;
  });
  y += 70;
  roles.forEach((r, i) => {
    const x = pad + (i % 4) * ((W - pad * 2) / 4);
    o.push(
      `<circle cx="${x + 10}" cy="${y + Math.floor(i / 4) * 34 - 6}" r="9" fill="${DS_COL[r]}"/><text x="${x + 28}" y="${y + Math.floor(i / 4) * 34}" font-family="${B}" font-size="19" fill="${P.ink}">${X(A.ROLE_NAME[r])} · ${A.roles[r]}</text>`
    );
  });
  y += Math.ceil(roles.length / 4) * 34 + 30;
  const list = (title, items, col) => {
    if (!items.length) return;
    sec(title);
    for (const w of items.slice(0, 5)) {
      o.push(
        `<rect x="${pad}" y="${y}" width="8" height="54" rx="4" fill="${col}"/><text x="${pad + 24}" y="${y + 22}" font-family="${F}" font-size="22" font-weight="700" fill="${P.ink}">${X(w.t.slice(0, 80))}</text><text x="${pad + 24}" y="${y + 48}" font-family="${B}" font-size="17" fill="${P.sub}">${X(w.d.slice(0, 130))}</text>`
      );
      y += 72;
    }
    y += 18;
  };
  list('WEAK SPOTS', A.weak, '#e0566b');
  list('NEEDS IMPROVEMENT', A.improve, P.gold);
  list('SUGGESTIONS', A.suggest, '#38c9a6');
  const H = y + 90;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.bg2}"/><stop offset="1" stop-color="${P.bg}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="${clean ? P.bg : 'url(#sg)'}"/>${clean ? '' : `<rect x="16" y="16" width="${W - 32}" height="${H - 32}" rx="28" fill="none" stroke="${P.gold}" stroke-opacity=".5" stroke-width="3"/>`}<text x="${pad}" y="74" font-family="${F}" font-size="20" font-weight="700" letter-spacing="5" fill="${P.gold}">DUEL SYNAPSE · KODEX · DECK STATISTICS</text><text x="${pad}" y="128" font-family="${F}" font-size="52" font-weight="800" fill="${P.ink}">${X(String(d.name || 'Deck').slice(0, 44))}</text><text x="${W - pad}" y="128" font-family="${B}" font-size="22" fill="${P.sub}" text-anchor="end">${A.N} Main · ${A.extraN} Extra</text>${o.join('')}<text x="${pad}" y="${H - 40}" font-family="${F}" font-size="18" fill="${P.mute}">Exact odds from the deck list · Duel Synapse: KodeX · a project of Meta Insider OCG</text><text x="${W - pad}" y="${H - 40}" font-family="${F}" font-size="18" font-weight="700" fill="${P.gold}" text-anchor="end">kodex.meiocg.org</text></svg>`;
}

/* ---------- Premium: your own profile banner (GIFs move), kept on this device ---------- */
function kxpBanner() {
  try {
    return localStorage.getItem('kx_pf_bimg') || '';
  } catch (e) {
    return '';
  }
}
/** A banner picture: a GIF under 460 KB stays animated; anything else becomes a 960×320 picture. */
function kxpBannerPicture(f) {
  return new Promise((ok, no) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(f.type)) {
      no(new Error('Choose a PNG, JPG, WebP or GIF'));
      return;
    }
    const rd = new FileReader();
    rd.onerror = () => no(new Error('Could not read the file'));
    rd.onload = () => {
      const u = String(rd.result);
      if (f.type === 'image/gif') {
        if (u.length < 460000) ok(u);
        else no(new Error('Animated banners can be up to about 340 KB'));
        return;
      }
      const im = new Image();
      im.onload = () => {
        const W = 960,
          H = 320,
          c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const k = Math.max(W / im.width, H / im.height),
          w = im.width * k,
          h = im.height * k;
        c.getContext('2d').drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
        let out = c.toDataURL('image/webp', 0.84);
        if (!/^data:image\/webp/.test(out)) out = c.toDataURL('image/jpeg', 0.84);
        out.length < 460000 ? ok(out) : no(new Error('That picture is too large'));
      };
      im.onerror = () => no(new Error('That picture could not be opened'));
      im.src = u;
    };
    rd.readAsDataURL(f);
  });
}

/* ---------- MEIOCG National Ranking System: link your profile to your NRS entry ---------- */
// The published NRS sheets (national first). Change or add seasons here; Config in the Master Editor lists them too.
const NRS_SHEETS = [
  [
    'National',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTWP6n9cZL4TRceHGh3Ejqx9pN1WTUyjN8AwEAQKWOIOviWUbBcE5ga1STQ9y1ZOJuK40YiDnXf8RCC/pub?output=csv'
  ],
  [
    'Central Luzon',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQcU26vtDDkjCqHij3wunLE_QLydCR5w8o4CGaTHuvz1F8Y_VWCQ7Qs0XqXW9NS9yr5FGn90-6iPLtw/pub?gid=186001220&single=true&output=csv'
  ],
  [
    'ODA Albay',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRWot6A9qXZ1iHF79sMwO1jS6NNRWDgZS9JeEtV22l62QOohGW8GUA1TcOYM7gdujXRVOgNiuX5l_lf/pub?gid=186001220&single=true&output=csv'
  ],
  [
    'Cebu',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTIHIO1qBI6QDdO6oo5ZUy2S8xMN0gjn9FupxwcAf2J8eMXRV3Sk7KQNN7GHNTS-As5d3JljfmvhB-L/pub?gid=186001220&single=true&output=csv'
  ],
  [
    'Iloilo',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSrjWKDeUrh6I-sWMXX4gXOJvIM5QtwhC7SHvpIqOdZMxNYn3C46_OJwn2OMng9eI4JUeEkYdsGi9sP/pub?gid=186001220&single=true&output=csv'
  ],
  [
    'Bulacan',
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRvjq0zx7GpMs3fRrmZExVDEHIuVSWqWRt04bg3WaGsH-3-vpgRCpRQXKiT4THHyDB5m5K7uw_Q1irK/pub?gid=186001220&single=true&output=csv'
  ]
];
const NRS_SEASON = 'Season 1';
function nrsCsv(t) {
  const rows = [];
  let row = [],
    cur = '',
    q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      row.push(cur);
      cur = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else cur += ch;
  }
  if (cur || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}
/** "Noleal, Castel" → "Castel Noleal" */
const nrsName = s => {
  const t = String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
  const m = /^([^,]+),\s*(.+)$/.exec(t);
  return m ? `${m[2]} ${m[1]}` : t;
};
/** One leaderboard sheet → [{ name, rank, pts, region }] (the header row is found by its column names). */
function nrsParse(csv, region) {
  const R = nrsCsv(csv),
    hi = R.findIndex(r => r.some(c => /name|player/i.test(c)) && r.some(c => /points|pts|total/i.test(c)));
  if (hi < 0) return [];
  const H = R[hi].map(c => c.trim().toLowerCase()),
    ni = H.findIndex(c => /name|player/.test(c)),
    pi = H.findIndex(c => /^(total )?(points|pts)$|total/.test(c)),
    ri = H.findIndex(c => /^(#|rank|place|pos)/.test(c));
  const out = [];
  for (const r of R.slice(hi + 1)) {
    const name = nrsName(r[ni]);
    if (!name || name.length < 2 || /^(name|player)$/i.test(name)) continue;
    const pts = Math.round(parseFloat(String(r[pi] || '').replace(/[^\d.]/g, '')) || 0);
    out.push({ name, pts, rank: ri >= 0 ? parseInt(r[ri], 10) || 0 : 0, region });
  }
  out.sort((a, b) => b.pts - a.pts);
  out.forEach((x, i) => {
    if (!x.rank) x.rank = i + 1;
  });
  return out;
}
/** Every NRS player (cached on this device; refreshed when online, at most every 6 hours). */
async function nrsLoad(force) {
  const kept = await kv('get', 'nrs');
  if (!force && kept && kept.rows && Date.now() - kept.t < 6 * 36e5) return kept.rows;
  if (!navigator.onLine) return (kept && kept.rows) || [];
  const rows = [];
  await Promise.all(
    NRS_SHEETS.map(async ([region, url]) => {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (r.ok) rows.push(...nrsParse(await r.text(), region));
      } catch (e) {}
    })
  );
  if (rows.length) {
    kv('put', 'nrs', { t: Date.now(), rows });
    return rows;
  }
  return (kept && kept.rows) || [];
}
/** The NRS part of Edit profile: find yourself, link, and choose to show your real name or your nickname. */
function kxpNrsBox(box, st, changed) {
  if (!box) return;
  const key = JSON.stringify([st.nrs, st.nick]);
  if (box.dataset.k === key) return; // only redrawn when the link changes (typing elsewhere keeps it as it is)
  box.dataset.k = key;
  if (st.nrs) {
    box.innerHTML = `<div class="pfe-nrs-on"><span><b>NRS #${st.nrs.rank}</b> · ${esc(st.nrs.region || 'National')} · ${st.nrs.pts} pts<br><small>${esc(st.nrs.real)} · ${esc(st.nrs.season || NRS_SEASON)}</small></span><button type="button" class="btn sm" data-nrsoff>Unlink</button></div>
<label class="pfe-tg"><input type="checkbox" data-nick${st.nick ? ' checked' : ''}><span><b>Use my nickname</b><small>On: your profile shows the name you typed above, and your real name stays hidden. Off: your profile shows your name from NRS.</small></span></label>`;
    box.querySelector('[data-nrsoff]').onclick = () => {
      st.nrs = null;
      changed();
    };
    box.querySelector('[data-nick]').onchange = e => {
      st.nick = e.target.checked;
      changed();
    };
    return;
  }
  box.innerHTML = `<small class="note">Registered in the NRS? Link your entry to show your rank and region on your profile.</small><div class="row2"><input class="fld" data-nrsq placeholder="Your name as in the NRS" autocomplete="off"><button type="button" class="btn sm" data-nrsgo>Find</button></div><div class="pfe-nrs-list" data-nrsl></div>`;
  const inp = box.querySelector('[data-nrsq]'),
    list = box.querySelector('[data-nrsl]');
  const find = async () => {
    const s = inp.value.trim().toLowerCase();
    if (s.length < 2) {
      list.innerHTML = '<small class="note">Type at least 2 letters.</small>';
      return;
    }
    list.innerHTML = '<small class="note">Looking in the NRS…</small>';
    const rows = await nrsLoad();
    if (!rows.length) {
      list.innerHTML = `<small class="note">${navigator.onLine ? "Couldn't reach the NRS right now. Try again later." : 'Connect once to look yourself up; KodeX keeps the list for offline use.'}</small>`;
      return;
    }
    const w = s.split(/\s+/),
      hits = rows.filter(r => w.every(x => r.name.toLowerCase().includes(x))).slice(0, 12);
    list.innerHTML = hits.length
      ? hits
          .map(
            (r, i) =>
              `<button type="button" data-nrsi="${i}"><b>#${r.rank}</b><span>${esc(r.name)}<br><small>${esc(r.region)}</small></span><small>${r.pts} pts</small></button>`
          )
          .join('')
      : '<small class="note">No one by that name. Check the spelling, or contact MEIOCG to register.</small>';
    list.querySelectorAll('[data-nrsi]').forEach(
      b =>
        (b.onclick = () => {
          const r = hits[+b.dataset.nrsi];
          st.nrs = { rank: r.rank, pts: r.pts, region: r.region, season: NRS_SEASON, real: r.name };
          changed();
        })
    );
  };
  box.querySelector('[data-nrsgo]').onclick = find;
  inp.onkeydown = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      find();
    }
  };
}
