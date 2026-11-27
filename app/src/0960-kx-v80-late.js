/* ===================================================================================================================
   KodeX 10.4.1 · module: combo-two-turns
   A combo can show two turns: yours, then your opponent's, so plays in their turn (your negates and interruptions,
   their hand traps and summons) are on the table too. Created by Castel Noleal, creator of MEIOCG.
   - c.turns: 1 or 2; c.t2: the first line that happens in the opponent's turn (a bar in the editor moves it).
   - A card in a step can be "played by your opponent" (x.b; one of their cards, from their side).
   - The Arena plays the turn change ("Turn 2 · Your opponent's turn"); the combo sheet starts a new heading there.
   =================================================================================================================== */
function cbTurnsUi(c, box) {
  const lines = box.querySelector('.cb-lines');
  if (!lines) return;
  if (c.turns === 2) c.t2 = Math.max(0, Math.min(c.t2 == null ? c.lines.length : c.t2, c.lines.length));
  const save = () => {
    cbStore(c);
    if (typeof cbRefreshList === 'function') cbRefreshList();
  };
  // Turns: one or two, right above the steps
  let bar = box.querySelector('.cb-turns');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'cb-turns';
    lines.parentNode.insertBefore(bar, lines);
  }
  bar.innerHTML = `<span class="cb-tl">Turns</span><div class="cb-seg" role="radiogroup" aria-label="Turns shown">
  <button type="button" role="radio" data-turns="1" aria-checked="${c.turns !== 2}">Your turn</button>
  <button type="button" role="radio" data-turns="2" aria-checked="${c.turns === 2}">+ Opponent's turn</button></div>
  <small>${c.turns === 2 ? 'Lines under the red bar happen in your opponent’s turn. Move the bar with its arrows; tap a card to mark it as played by your opponent.' : 'Add your opponent’s turn to show plays in it: your negates and interruptions, their summons and hand traps.'}</small>`;
  bar.querySelectorAll('[data-turns]').forEach(
    b =>
      (b.onclick = () => {
        const two = b.dataset.turns === '2';
        if (two === (c.turns === 2)) return;
        if (two) {
          c.turns = 2;
          c.t2 = c.lines.length; // the bar starts after the last line: new lines go to their turn
        } else {
          delete c.turns;
          delete c.t2;
        }
        save();
        cbTurnsUi(c, box);
        if (two) toast('Opponent’s turn on: new lines go under the red bar');
      })
  );
  // the bar between the two turns, and which lines are in the opponent's turn
  box.querySelectorAll('.cb-t2bar').forEach(x => x.remove());
  const rows = [...lines.querySelectorAll(':scope > .cb-line')];
  rows.forEach((r, i) => r.classList.toggle('t2', c.turns === 2 && i >= c.t2));
  // cards the opponent plays say so on their chip
  box.querySelectorAll('.cb-chip[data-chip]').forEach(ch => {
    const [l, n, i] = ch.dataset.chip.split(',').map(Number),
      x = c.lines[l] && c.lines[l][n] && c.lines[l][n].cards[i];
    ch.classList.toggle('by-opp', !!(x && x.b));
    const em = ch.querySelector('em');
    if (x && x.b && em && !/plays/.test(em.textContent)) em.textContent = em.textContent.replace('Opp.', 'Opp. plays');
  });
  if (c.turns !== 2) return;
  const t = document.createElement('div');
  t.className = 'cb-t2bar';
  t.setAttribute('role', 'separator');
  t.innerHTML = `<span><b>Turn 2</b> · Your opponent’s turn</span><button type="button" class="ibtn" data-t2="-1" aria-label="Move the opponent's turn up a line" ${c.t2 <= 0 ? 'disabled' : ''}>▲</button><button type="button" class="ibtn" data-t2="1" aria-label="Move the opponent's turn down a line" ${c.t2 >= c.lines.length ? 'disabled' : ''}>▼</button>`;
  lines.insertBefore(t, rows[c.t2] || lines.querySelector('[data-add=line]') || null);
  t.querySelectorAll('[data-t2]').forEach(
    b =>
      (b.onclick = () => {
        c.t2 = Math.max(0, Math.min(c.lines.length, c.t2 + Number(b.dataset.t2)));
        save();
        cbTurnsUi(c, box);
      })
  );
}
{
  const ce = cbEdit;
  cbEdit = function (c) {
    const m = ce.apply(this, arguments),
      box = m && m.querySelector('.cb-ed');
    if (!box) return m;
    // a line deleted above the bar moves the bar up with it
    box.addEventListener(
      'click',
      e => {
        const d = e.target.closest('[data-ldel]');
        if (d && c.turns === 2 && Number(d.dataset.ldel) < c.t2) c.t2--;
      },
      true
    );
    cbTurnsUi(c, box);
    // the editor draws itself again after each change: the turn bar comes back with it
    new MutationObserver(() => {
      if (!box.querySelector('.cb-turns') || (c.turns === 2 && !box.querySelector('.cb-t2bar'))) cbTurnsUi(c, box);
    }).observe(box, { childList: true });
    return m;
  };
}
{
  const cc = cbChip;
  cbChip = function (c, l, n, i) {
    const out = cc.apply(this, arguments),
      m = document.querySelector('.mdl[data-k=cbc]'),
      x = c.lines[l] && c.lines[l][n] && c.lines[l][n].cards[i];
    const sel = m && m.querySelector('[data-o]');
    if (!sel || !x) return out;
    const op = document.createElement('option');
    op.value = '2';
    op.textContent = 'Played by your opponent (their card: a hand trap, a play in their turn)';
    sel.appendChild(op);
    if (x.b) sel.value = '2';
    // after the usual Done (which keeps "their side"), keep whether they play it
    m.querySelector('[data-ok]').addEventListener(
      'click',
      () => {
        if (sel.value === '2') x.b = 1;
        else delete x.b;
      },
      true
    );
    return out;
  };
}
