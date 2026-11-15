/* ===== KodeX Master Editor: Code, Diagnose, Config and the live view =====
 * The KodeX source modules (app/src) are inside this page (#kx-src). The page is put together from them the same way
 * scripts/build_kodex.py does it, shown in a device frame, and checked. Edits are kept on this device (IndexedDB).
 * Uses $, esc, kv, base, setBase, saveFile, go, status and loadZip from the main editor script.
 * Created by Castel Noleal, creator of MEIOCG. A project of Meta Insider OCG since 2023.
 */
(() => {
  const SRC = JSON.parse(document.getElementById('kx-src').textContent);
  const ORIG = Object.assign({}, SRC.files);
  const files = Object.assign({}, SRC.files);
  let man = JSON.parse(JSON.stringify(SRC.manifest));
  let eds = JSON.parse(JSON.stringify(SRC.editions));
  const BASE_ID = `${SRC.manifest.version}:${Object.keys(ORIG).length}:${Object.values(ORIG).reduce((n, t) => n + t.length, 0)}`;
  const nl = s => (s.match(/\n/g) || []).length;
  const isCss = f => /\.css$/.test(f);
  const isJs = f => /\.js$/.test(f);
  let cur = man.files[0].file;

  /* ---------- putting the page together (same as build_kodex.py) ---------- */
  function assemble(prem, marks) {
    const parts = [];
    const map = [];
    let line = 1;
    for (const f of man.files) {
      const text = files[f.file] == null ? '' : files[f.file];
      const open = f.open || '';
      const close = f.close || '';
      // in the live view each style module is marked, so a style edit can be swapped in without reloading
      const body = marks && isCss(f.file) ? `/*@kx:${f.file}*/${text}/*@kx-end:${f.file}*/` : text;
      const start = line + nl(open);
      map.push({ file: f.file, start, end: start + nl(body) });
      parts.push(open + body + close);
      line += nl(open + body + close);
    }
    let html = parts.join('');
    const deltas = [];
    if (prem) {
      for (const [o, n] of eds.premium) {
        const old = o.split('{build}').join(man.build);
        const now = n.split('{build}').join(man.build);
        const at = html.indexOf(old);
        if (at < 0 || html.indexOf(old, at + 1) >= 0)
          throw new Error(`Premium: "${old.slice(0, 50)}" must appear exactly once (Config › Free and Premium)`);
        deltas.push({ at: nl(html.slice(0, at)) + 1, d: nl(now) - nl(old) });
        html = html.slice(0, at) + now + html.slice(at + old.length);
      }
    }
    return { html, map, deltas };
  }
  /** A line of the put-together page → { file, line } of the module it came from. */
  function whereIs(doc, lineNo) {
    let L = lineNo;
    for (const d of doc.deltas) if (d.at < L) L -= d.d;
    for (const m of doc.map) if (L >= m.start && L <= m.end) return { file: m.file, line: L - m.start + 1 };
    return null;
  }

  /* ---------- keeping edits ---------- */
  const changed = () => Object.keys(files).filter(f => files[f] !== ORIG[f]);
  let saveT = 0;
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const out = {};
      for (const f of changed()) out[f] = files[f];
      kv('put', 'code', { base: BASE_ID, files: out, man, eds });
    }, 500);
  }

  /* ---------- line differences (Myers) ---------- */
  function diffLines(a, b) {
    // trims what is the same at both ends, then finds the fewest changes in the middle
    let s = 0;
    while (s < a.length && s < b.length && a[s] === b[s]) s++;
    let ea = a.length;
    let eb = b.length;
    while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
    const A = a.slice(s, ea);
    const B = b.slice(s, eb);
    const N = A.length;
    const Mx = B.length;
    const max = N + Mx;
    const hunks = [];
    if (!max) return hunks;
    if (max > 4000) return [{ a0: s, a1: ea, b0: s, b1: eb }];
    const v = new Map([[1, 0]]);
    const trace = [];
    let done = false;
    for (let d = 0; d <= max && !done; d++) {
      trace.push(new Map(v));
      for (let k = -d; k <= d; k += 2) {
        let x = k === -d || (k !== d && (v.get(k - 1) || 0) < (v.get(k + 1) || 0)) ? v.get(k + 1) || 0 : (v.get(k - 1) || 0) + 1;
        let y = x - k;
        while (x < N && y < Mx && A[x] === B[y]) { x++; y++; }
        v.set(k, x);
        if (x >= N && y >= Mx) { done = true; break; }
      }
    }
    // walk back to list the edits
    let x = N;
    let y = Mx;
    const ops = [];
    for (let d = trace.length - 1; d > 0; d--) {
      const vv = trace[d];
      const k = x - y;
      const pk = k === -d || (k !== d && (vv.get(k - 1) || 0) < (vv.get(k + 1) || 0)) ? k + 1 : k - 1;
      const px = vv.get(pk) || 0;
      const py = px - pk;
      while (x > px && y > py) { x--; y--; }
      if (x === px) ops.push({ t: 'add', b: py }); else ops.push({ t: 'del', a: px });
      x = px;
      y = py;
    }
    ops.reverse();
    // group neighbouring edits into hunks (old lines a0..a1, new lines b0..b1, 0-based, end exclusive)
    let h = null;
    let ax = 0;
    let bx = 0;
    for (const op of ops) {
      const ai = op.t === 'del' ? op.a : ax;
      const bi = op.t === 'add' ? op.b : bx;
      if (!h || ai > h.a1 + 1 || bi > h.b1 + 1) { h = { a0: ai, a1: ai, b0: bi, b1: bi }; hunks.push(h); }
      if (op.t === 'del') { h.a1 = op.a + 1; ax = op.a + 1; bx = Math.max(bx, h.b1); }
      else { h.b1 = op.b + 1; bx = op.b + 1; ax = Math.max(ax, h.a1); }
    }
    for (const q of hunks) { q.a0 += s; q.a1 += s; q.b0 += s; q.b1 += s; }
    return hunks;
  }

  /* ---------- the code editor ---------- */
  const ta = $('ceTa');
  const gut = $('ceGut');
  const LH = 19;
  let marks = new Set();
  let flags = new Set();
  function drawList() {
    const q = $('ceFilter').value.trim().toLowerCase();
    const box = $('ceList');
    box.innerHTML = '';
    const mod = new Set(changed());
    let hits = 0;
    for (const f of man.files.map(x => x.file)) {
      const t = files[f] || '';
      const inName = !q || f.toLowerCase().includes(q);
      const lines = [];
      if (q && q.length > 2 && !inName) {
        const all = t.split('\n');
        for (let i = 0; i < all.length && lines.length < 4; i++) if (all[i].toLowerCase().includes(q)) lines.push([i + 1, all[i].trim()]);
      }
      if (!inName && !lines.length) continue;
      const b = document.createElement('button');
      b.className = (f === cur ? 'on ' : '') + (mod.has(f) ? 'mod' : '');
      b.innerHTML = `<b>${esc(f)}</b><em>${nl(t) + 1}</em>`;
      b.onclick = () => openFile(f);
      box.appendChild(b);
      for (const [n, text] of lines) {
        const h = document.createElement('button');
        h.className = 'hit';
        h.textContent = `${n}: ${text.slice(0, 80)}`;
        h.onclick = () => openFile(f, n, q);
        box.appendChild(h);
        hits++;
      }
    }
    if (!box.children.length) box.innerHTML = '<p class="sub">Nothing found.</p>';
  }
  function outline() {
    const sel = $('ceOutline');
    sel.innerHTML = '<option value="">Jump to…</option>';
    const lines = (files[cur] || '').split('\n');
    const re = isJs(cur)
      ? /^(?:async )?function ([\w$]+)|^(?:const|let|var) ([\w$]+)\s*=|^\/\* -{3,} (.+?) -{3,}/
      : isCss(cur) ? /^\/\* (.{3,60}?)(?: \*\/|$)|^(@media[^{]{0,70})/ : /id="([\w-]+)"/;
    lines.forEach((l, i) => {
      const m = re.exec(l);
      if (!m) return;
      const o = document.createElement('option');
      o.value = i + 1;
      o.textContent = `${i + 1}  ${(m[1] || m[2] || m[3] || '').slice(0, 60)}`;
      sel.appendChild(o);
    });
  }
  function openFile(f, line, find) {
    cur = f;
    ta.value = files[f] || '';
    $('ceName').textContent = f;
    flags = new Set();
    refreshMarks();
    drawList();
    outline();
    if (find) $('ceFind').value = find;
    if (line) goLine(line);
    else { ta.scrollTop = 0; ta.setSelectionRange(0, 0); }
    caret();
  }
  function gutter() {
    const n = nl(ta.value) + 1;
    let h = '';
    for (let i = 1; i <= n; i++) h += `<span${flags.has(i) ? ' class="f"' : marks.has(i) ? ' class="c"' : ''}>${i}</span>`;
    gut.innerHTML = h;
    gut.scrollTop = ta.scrollTop;
  }
  function refreshMarks() {
    const a = (ORIG[cur] || '').split('\n');
    const b = ta.value.split('\n');
    marks = new Set();
    const hunks = files[cur] === ORIG[cur] ? [] : diffLines(a, b);
    for (const h of hunks) for (let i = h.b0; i < Math.max(h.b1, h.b0 + 1); i++) marks.add(i + 1);
    $('ceMod').hidden = !hunks.length;
    $('ceChg').textContent = hunks.length ? `${marks.size} line${marks.size === 1 ? '' : 's'} changed in ${hunks.length} place${hunks.length === 1 ? '' : 's'}` : '';
    gutter();
    drawChanges();
  }
  function drawChanges() {
    const box = $('chList');
    const all = changed();
    let n = 0;
    box.innerHTML = '';
    for (const f of all) {
      const a = (ORIG[f] || '').split('\n');
      const b = (files[f] || '').split('\n');
      for (const h of diffLines(a, b)) {
        n++;
        const el = document.createElement('button');
        el.className = 'ch-hunk';
        const old = a.slice(h.a0, h.a1).slice(0, 6).map(l => `<span class="o">- ${esc(l)}</span>`).join('\n');
        const now = b.slice(h.b0, h.b1).slice(0, 6).map(l => `<span class="n">+ ${esc(l)}</span>`).join('\n');
        el.innerHTML = `<b>${esc(f)} · line ${h.b0 + 1}${h.b1 - h.b0 > 1 ? '–' + h.b1 : ''}</b><pre>${old}${old && now ? '\n' : ''}${now}</pre>`;
        el.onclick = () => { go('code'); openFile(f, h.b0 + 1); };
        box.appendChild(el);
      }
    }
    if (!n) box.innerHTML = '<p class="sub">Nothing changed yet.</p>';
    $('chCount').textContent = n ? `${n} change${n === 1 ? '' : 's'} in ${all.length} module${all.length === 1 ? '' : 's'}` : '';
  }
  function caret() {
    const p = ta.selectionStart;
    const before = ta.value.slice(0, p);
    const ln = nl(before) + 1;
    const col = p - before.lastIndexOf('\n');
    $('cePos').textContent = `Ln ${ln}, Col ${col}`;
    $('ceCur').style.top = 8 + (ln - 1) * LH - ta.scrollTop + 'px';
  }
  function goLine(n) {
    const lines = ta.value.split('\n');
    n = Math.max(1, Math.min(lines.length, Number(n) || 1));
    let p = 0;
    for (let i = 0; i < n - 1; i++) p += lines[i].length + 1;
    ta.focus();
    ta.setSelectionRange(p, p + lines[n - 1].length);
    ta.scrollTop = Math.max(0, (n - 6) * LH);
    caret();
    gutter();
  }
  function find(dir) {
    const q = $('ceFind').value;
    if (!q) return;
    const t = ta.value.toLowerCase();
    const k = q.toLowerCase();
    let p = dir < 0 ? t.lastIndexOf(k, ta.selectionStart - 1) : t.indexOf(k, ta.selectionEnd);
    if (p < 0) p = dir < 0 ? t.lastIndexOf(k) : t.indexOf(k);
    if (p < 0) { status('stCode', `"${q}" is not in this module.`, 'err'); return; }
    ta.focus();
    ta.setSelectionRange(p, p + q.length);
    ta.scrollTop = Math.max(0, (nl(ta.value.slice(0, p)) - 6) * LH);
    caret();
    gutter();
  }
  let liveT = 0;
  function edited() {
    files[cur] = ta.value;
    persist();
    clearTimeout(refreshMarks.t);
    refreshMarks.t = setTimeout(() => { refreshMarks(); drawList(); }, 250);
    if (!$('lvLive').checked) return;
    clearTimeout(liveT);
    // a style change goes in at once; anything else rebuilds the app after a pause in typing
    if (isCss(cur) && hotCss(cur)) return;
    liveT = setTimeout(() => preview(), 1200);
  }
  ta.addEventListener('input', edited);
  ta.addEventListener('scroll', () => { gut.scrollTop = ta.scrollTop; caret(); });
  ta.addEventListener('click', caret);
  ta.addEventListener('keyup', caret);
  ta.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const s = ta.selectionStart;
      ta.setRangeText('  ', s, ta.selectionEnd, 'end');
      edited();
    }
  });
  addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || document.querySelector('[data-pane=code]').hidden) return;
    if (e.key === 'f') { e.preventDefault(); $('ceFind').focus(); $('ceFind').select(); }
    if (e.key === 'g') { e.preventDefault(); $('ceLine').focus(); }
    if (e.key === 's') { e.preventDefault(); persist(); status('stCode', 'Saved on this device.', 'ok'); }
  });
  $('ceFilter').addEventListener('input', drawList);
  $('ceOutline').onchange = e => { if (e.target.value) goLine(e.target.value); e.target.value = ''; };
  $('ceFind').addEventListener('keydown', e => { if (e.key === 'Enter') find(e.shiftKey ? -1 : 1); });
  $('ceFindNext').onclick = () => find(1);
  $('ceFindPrev').onclick = () => find(-1);
  $('ceLine').addEventListener('keydown', e => { if (e.key === 'Enter') goLine(e.target.value); });
  $('ceRepOne').onclick = () => {
    const q = $('ceFind').value;
    if (!q || ta.value.slice(ta.selectionStart, ta.selectionEnd).toLowerCase() !== q.toLowerCase()) return find(1);
    ta.setRangeText($('ceRep').value, ta.selectionStart, ta.selectionEnd, 'end');
    edited();
    find(1);
  };
  $('ceRepAll').onclick = () => {
    const q = $('ceFind').value;
    if (!q) return;
    const n = ta.value.split(q).length - 1;
    if (!n) return status('stCode', `"${q}" is not in this module.`, 'err');
    ta.value = ta.value.split(q).join($('ceRep').value);
    edited();
    status('stCode', `Replaced ${n} time${n === 1 ? '' : 's'}.`, 'ok');
  };
  $('ceRevert').onclick = () => {
    if (files[cur] === ORIG[cur] || !confirm(`Undo every edit to ${cur}?`)) return;
    ta.value = ORIG[cur];
    edited();
  };

  /* ---------- the live view ---------- */
  const frame = $('lvF');
  let doc = null;
  let url = '';
  let errs = [];
  let land = false;
  const devBox = $('lvDevBox');
  function size() {
    const v = $('lvDev').value;
    const st = $('lvStage').getBoundingClientRect();
    if (v === 'fill') return { w: Math.max(320, Math.floor(st.width)), h: Math.max(320, Math.floor(st.height)), fill: true };
    let [w, h] = v.split('x').map(Number);
    if (land) [w, h] = [h, w];
    return { w, h, fill: false };
  }
  function fit() {
    const s = size();
    const st = $('lvStage').getBoundingClientRect();
    frame.style.width = s.w + 'px';
    frame.style.height = s.h + 'px';
    devBox.classList.toggle('fill', s.fill);
    devBox.classList.toggle('land', land);
    const pad = s.fill ? 0 : 28;
    const k = Math.min(1, (st.width - 16) / (s.w + pad), (st.height - 16) / (s.h + pad));
    devBox.style.transform = `translate(-50%, -50%) scale(${k})`;
    $('lvSize').textContent = `${s.w}×${s.h}${k < 1 ? ` · shown at ${Math.round(k * 100)}%` : ''}`;
  }
  // the page reports its own errors (with the line they come from) before anything else runs
  const HOOK =
    '<script>window.__kxErr=[];addEventListener("error",function(e){if(e.target&&e.target!==window&&e.target.tagName)return;__kxErr.push({m:String(e.message||e.error),l:e.lineno,c:e.colno});try{parent.postMessage({kxed:"err"},"*")}catch(x){}},true);' +
    'addEventListener("unhandledrejection",function(e){__kxErr.push({m:"Unhandled: "+String(e.reason&&e.reason.message||e.reason)});try{parent.postMessage({kxed:"err"},"*")}catch(x){}});' +
    'var __ce=console.error;console.error=function(){__kxErr.push({m:[].slice.call(arguments).map(String).join(" ").slice(0,400)});try{parent.postMessage({kxed:"err"},"*")}catch(x){}return __ce.apply(console,arguments)};</script>';
  function preview() {
    let d;
    try { d = assemble($('lvEd').value === 'prem', true); }
    catch (e) { $('lvNote').textContent = e.message; $('lvNote').className = 'lv-note err'; return; }
    doc = d;
    errs = [];
    drawErrs();
    const html = d.html.replace(/<head[^>]*>/i, m => m + HOOK);
    // srcdoc keeps the app in this page's own origin (also when the editor is opened as a file), so it can be checked
    frame.removeAttribute('src');
    frame.srcdoc = html;
    url = 'srcdoc';
    $('lvNote').className = 'lv-note';
    $('lvNote').textContent = `Built from your code · ${(html.length / 1024).toFixed(0)} KB · ${changed().length} module${changed().length === 1 ? '' : 's'} edited`;
  }
  function win() { try { return frame.contentWindow && frame.contentWindow.document ? frame.contentWindow : null; } catch (e) { return null; } }
  /** Swaps a style module in the running app without reloading it. */
  function hotCss(f) {
    const w = win();
    if (!w) return false;
    const a = `/*@kx:${f}*/`;
    const b = `/*@kx-end:${f}*/`;
    for (const st of w.document.querySelectorAll('style')) {
      const t = st.textContent;
      const i = t.indexOf(a);
      const j = t.indexOf(b);
      if (i < 0 || j < i) continue;
      st.textContent = t.slice(0, i + a.length) + files[f] + t.slice(j);
      $('lvNote').textContent = `Style updated live · ${f}`;
      return true;
    }
    return false;
  }
  addEventListener('message', e => { if (e.source === frame.contentWindow && (e.data || {}).kxed === 'err') pullErrs(); });
  function pullErrs() {
    const w = win();
    if (!w || !w.__kxErr) return;
    errs = w.__kxErr.slice(-200);
    drawErrs();
  }
  function drawErrs() {
    const box = $('dgErr');
    if (!box) return;
    $('dgErrN').textContent = errs.length ? `(${errs.length})` : '';
    if (!errs.length) { box.innerHTML = '<p class="sub">No errors so far.</p>'; return; }
    box.innerHTML = '';
    const seen = new Set();
    for (const e of errs) {
      const at = e.l && doc ? whereIs(doc, e.l) : null;
      const key = e.m + (at ? at.file + at.line : '');
      if (seen.has(key)) continue;
      seen.add(key);
      box.appendChild(item('err', e.m, at ? `${at.file} · line ${at.line}` : 'in the running app', at ? () => { go('code'); openFile(at.file, at.line); flags.add(at.line); gutter(); } : null));
    }
  }
  function item(kind, title, sub, onClick) {
    const b = document.createElement('button');
    b.className = 'dg-item';
    b.innerHTML = `<i class="${kind}">${kind === 'err' ? 'error' : kind === 'warn' ? 'check' : 'note'}</i><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`;
    if (onClick) b.onclick = onClick;
    else b.disabled = true;
    return b;
  }
  $('lvDev').onchange = () => { fit(); kv('put', 'lv', { dev: $('lvDev').value, land, ed: $('lvEd').value }); };
  $('lvRot').onclick = () => { land = !land; fit(); kv('put', 'lv', { dev: $('lvDev').value, land, ed: $('lvEd').value }); };
  $('lvEd').onchange = () => { preview(); kv('put', 'lv', { dev: $('lvDev').value, land, ed: $('lvEd').value }); };
  $('lvReload').onclick = preview;
  addEventListener('resize', () => { clearTimeout(fit.t); fit.t = setTimeout(fit, 120); });
  // one live view, moved into whichever pane is open
  function dock(p) {
    const box = p === 'diag' ? $('lvDock2') : $('lvDock');
    if ($('lv').parentNode !== box) box.appendChild($('lv'));
    setTimeout(fit, 30);
    if (!url) preview();
  }
  document.querySelectorAll('.me-seg button').forEach(b => (b.onclick = () => {
    const pane = b.closest('.me-pane');
    pane.dataset.show = b.dataset.split;
    pane.querySelectorAll('.me-seg button').forEach(x => x.classList.toggle('on', x === b));
    if (b.dataset.split === 'live') setTimeout(fit, 30);
  }));

  /* ---------- Diagnose ---------- */
  const out = $('dgOut');
  function report(list, title) {
    out.innerHTML = '';
    const n = { err: 0, warn: 0, info: 0 };
    for (const x of list) { n[x.k]++; out.appendChild(item(x.k, x.t, x.s, x.go)); }
    if (!list.length) out.innerHTML = `<p class="sub">${esc(title)}: nothing found.</p>`;
    $('dgSum').innerHTML = `<span>${esc(title)}</span><span>${n.err} error${n.err === 1 ? '' : 's'}</span><span>${n.warn} to check</span><span>${n.info} note${n.info === 1 ? '' : 's'}</span>`;
  }
  const jump = (f, l) => () => { go('code'); openFile(f, l); };
  /** Parses each script module without running it and reports the line of any syntax error. */
  function syntax() {
    // every script module is parsed (never run) inside a hidden page; the page reports each error with its line
    return new Promise(done => {
      const head = '<!doctype html><script>window.__bad=[];window.onerror=function(m,s,l){__bad.push([m,l]);return true};</' + 'script>\n';
      let doc = head;
      let line = doc.split('\n').length; // line where the next text starts
      const at = [];
      for (const f of man.files.map(x => x.file).filter(isJs)) {
        const body = files[f].replace(/<\/script/gi, '<\\/script');
        const chunk = '<script>(async function(){\n' + body + '\n});</' + 'script>\n';
        at.push({ f, from: line + 1, n: body.split('\n').length });
        doc += chunk;
        line += chunk.split('\n').length - 1;
      }
      const ifr = document.createElement('iframe');
      ifr.style.display = 'none';
      ifr.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      let fin = false;
      const end = () => {
        if (fin) return;
        fin = true;
        let raw = [];
        try { raw = ifr.contentWindow.__bad || []; } catch (e) {}
        ifr.remove();
        done(raw.map(([m, l]) => {
          const hit = at.find(x => l >= x.from && l < x.from + x.n) || at.find(x => l >= x.from - 1 && l <= x.from + x.n);
          return hit ? { f: hit.f, l: Math.min(hit.n, Math.max(1, l - hit.from + 1)), m } : { f: '?', l: 1, m };
        }));
      };
      ifr.onload = () => setTimeout(end, 30);
      setTimeout(end, 4000);
      ifr.srcdoc = doc;
      document.body.appendChild(ifr);
    });
  }
  async function checkCode() {
    const list = [];
    for (const b of await syntax()) list.push({ k: 'err', t: b.m, s: `${b.f} · line ${b.l}`, go: jump(b.f, b.l) });
    // style modules: braces that do not close
    for (const f of man.files.map(x => x.file).filter(isCss)) {
      const t = files[f].replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g, m => m.replace(/[{}]/g, ' '));
      let depth = 0;
      let line = 1;
      let open = 0;
      for (const ch of t) {
        if (ch === '\n') line++;
        if (ch === '{') { depth++; if (depth === 1) open = line; }
        if (ch === '}') depth--;
        if (depth < 0) { list.push({ k: 'err', t: 'A } with no { before it', s: `${f} · line ${line}`, go: jump(f, line) }); depth = 0; }
      }
      if (depth > 0) list.push({ k: 'err', t: 'A { that is never closed', s: `${f} · from line ${open}`, go: jump(f, open) });
    }
    // Premium replacements
    try { assemble(true, false); } catch (e) { list.push({ k: 'err', t: e.message, s: 'Config › Free and Premium', go: () => go('cfg') }); }
    // the same function written twice: the later one wins, the earlier one only runs while the page loads
    const defs = new Map();
    for (const f of man.files.map(x => x.file).filter(isJs)) {
      files[f].split('\n').forEach((l, i) => {
        const m = /^(?:async )?function ([\w$]+)\s*\(/.exec(l);
        if (!m) return;
        if (!defs.has(m[1])) defs.set(m[1], []);
        defs.get(m[1]).push([f, i + 1]);
      });
    }
    for (const [n, at] of defs) {
      if (at.length < 2) continue;
      const [lf, ll] = at[at.length - 1];
      list.push({ k: 'info', t: `${n}() is written ${at.length} times; the one in ${lf} is the one used`, s: at.map(([f, l]) => `${f}:${l}`).join(', '), go: jump(lf, ll) });
    }
    // ids the code asks for that no markup has (some are made while the app runs)
    const markup = man.files.map(x => x.file).filter(f => !isJs(f) && !isCss(f)).map(f => files[f]).join('\n');
    const allJs = man.files.map(x => x.file).filter(isJs).map(f => files[f]).join('\n');
    const known = new Set([...(markup + allJs).matchAll(/id=["'\\]*([\w-]+)/g)].map(m => m[1]).concat([...allJs.matchAll(/\.id\s*=\s*['"]([\w-]+)/g)].map(m => m[1])));
    for (const f of man.files.map(x => x.file).filter(isJs)) {
      files[f].split('\n').forEach((l, i) => {
        for (const m of l.matchAll(/\$\('([\w-]+)'\)/g))
          if (!known.has(m[1])) list.push({ k: 'warn', t: `#${m[1]} is used but never created`, s: `${f} · line ${i + 1}`, go: jump(f, i + 1) });
      });
    }
    report(list, 'Code check');
    return list;
  }
  function highlight(el) {
    const w = win();
    if (!w || !el || !el.getBoundingClientRect) return;
    try { el.scrollIntoView({ block: 'center', inline: 'nearest' }); } catch (e) {}
    const r = el.getBoundingClientRect();
    let o = w.document.getElementById('__kxHi');
    if (!o) {
      o = w.document.createElement('div');
      o.id = '__kxHi';
      o.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;border:3px solid #ff3b5c;border-radius:8px;box-shadow:0 0 0 9999px #0006;transition:all .2s';
      w.document.body.appendChild(o);
    }
    Object.assign(o.style, { left: r.left - 4 + 'px', top: r.top - 4 + 'px', width: r.width + 8 + 'px', height: r.height + 8 + 'px', display: 'block' });
    clearTimeout(highlight.t);
    highlight.t = setTimeout(() => (o.style.display = 'none'), 2600);
  }
  const KIND = { cut: ['err', 'Label cut off'], squashed: ['warn', 'Squashed'], overlap: ['warn', 'On top of each other'], offscreen: ['err', 'Off the screen'], tiny: ['info', 'Small to tap'], image: ['warn', 'Picture missing'], id: ['info', 'Same id twice'] };
  function screenIssues(where) {
    const w = win();
    if (!w) return [{ k: 'err', t: 'The live view is not ready yet', s: '' }];
    if (typeof w.kxDiagnose !== 'function') return [{ k: 'warn', t: 'kxDiagnose() is not in this code', s: 'It is in 0880-kx-v68-late.js', go: jump('0880-kx-v68-late.js', 1) }];
    return w.kxDiagnose().map(x => ({ k: (KIND[x.kind] || ['info'])[0], t: `${(KIND[x.kind] || [0, x.kind])[1]}: ${x.what}`, s: `${where ? where + ' · ' : ''}${x.detail}`, go: () => { if (where) tourGo(where).then(() => highlight(x.el)); else highlight(x.el); } }));
  }
  // the screens the tour opens, in order; each step runs inside the app
  const TOUR = [
    ['Home', 'while(window.L&&L.length>1)history.back()'],
    ['Search', "while(window.L&&L.length>1)history.back();var q=document.getElementById('q');if(q){q.value='dragon';q.dispatchEvent(new Event('input',{bubbles:true}))}"],
    ['Test', 'kxTestHub()'],
    ['Combos', 'kxCombos()'],
    ['Decks', "while(window.L&&L.length>1)history.back();var b=document.querySelector('.nav button:nth-child(3)');b&&b.click()"],
    ['Settings', "while(window.L&&L.length>1)history.back();var s=document.getElementById('bSet');s&&s.click()"],
    ['Premium Studio', "while(window.L&&L.length>1)history.back();typeof openSkins==='function'&&openSkins()"]
  ];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function tourGo(name) {
    const w = win();
    const step = TOUR.find(t => t[0] === name);
    if (!w || !step) return;
    try { w.eval(step[1]); } catch (e) {}
    await sleep(650);
  }
  async function checkScreen() { report(screenIssues(''), 'This screen'); }
  async function tour() {
    const btn = $('dgTour');
    btn.disabled = true;
    const list = [];
    for (const [name] of TOUR) {
      $('dgSum').innerHTML = `<span>Checking ${esc(name)}…</span>`;
      await tourGo(name);
      try { if (win() && win().closeModal) win().closeModal(); } catch (e) {}
      await sleep(150);
      for (const x of screenIssues(name)) list.push(x);
    }
    await tourGo('Home');
    report(list, `Every screen at ${size().w}×${size().h}`);
    btn.disabled = false;
  }
  $('dgCode').onclick = checkCode;
  $('dgScreen').onclick = checkScreen;
  $('dgTour').onclick = tour;
  $('dgClear').onclick = () => { out.innerHTML = '<p class="sub">Run a check.</p>'; $('dgSum').innerHTML = ''; };

  /* ---------- Inspect: tap something in the live view to find the lines that make it ---------- */
  let inspecting = false;
  function onInspect(e) {
    if (!inspecting) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    const w = win();
    highlight(el);
    const cs = w.getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const tokens = [...(el.id ? ['#' + el.id] : []), ...[...el.classList].slice(0, 6).map(c => '.' + c)];
    for (let p = el.parentElement, i = 0; p && i < 2; p = p.parentElement, i++) if (p.id) tokens.push('#' + p.id);
    const found = [];
    for (const f of man.files.map(x => x.file)) {
      const lines = files[f].split('\n');
      lines.forEach((l, i) => {
        for (const t of tokens) {
          const name = t.slice(1);
          const re = isCss(f)
            ? new RegExp('\\' + t[0] + name.replace(/[-]/g, '\\-') + '(?![\\w-])')
            : new RegExp(`(?:id=["'\\\\]*|\\$\\(['"]|['"\` .])${name.replace(/[-]/g, '\\-')}(?![\\w-])`);
          if (re.test(l)) { found.push([f, i + 1, l.trim(), t]); break; }
        }
      });
    }
    $('dgInsCard').hidden = false;
    const box = $('dgIns');
    box.innerHTML = `<div class="dg-ins"><pre>&lt;${el.tagName.toLowerCase()}${el.id ? ` id="${esc(el.id)}"` : ''}${el.className && typeof el.className === 'string' ? ` class="${esc(el.className)}"` : ''}&gt;
${Math.round(r.width)}×${Math.round(r.height)} px · font ${cs.fontSize} · padding ${cs.padding} · display ${cs.display}${cs.position !== 'static' ? ' · ' + cs.position : ''}</pre></div>`;
    const list = document.createElement('div');
    list.className = 'dg-list';
    for (const [f, l, text, t] of found.slice(0, 60)) list.appendChild(item(isCss(f) ? 'warn' : 'info', text.slice(0, 120), `${f} · line ${l} · ${t}`, jump(f, l)));
    if (!found.length) list.innerHTML = '<p class="sub">No line in the code names this element directly. Tap its parent or a bigger part.</p>';
    box.appendChild(list);
  }
  $('dgInspect').onclick = () => {
    inspecting = !inspecting;
    $('dgInspect').setAttribute('aria-pressed', String(inspecting));
    $('dgInspect').textContent = inspecting ? 'Inspecting… tap something (tap here to stop)' : 'Inspect: tap something in the live view';
  };
  frame.addEventListener('load', () => {
    const w = win();
    if (!w) return;
    w.addEventListener('click', onInspect, true);
    setTimeout(pullErrs, 1500);
  });

  /* ---------- Config ---------- */
  function drawCfg() {
    $('cfVer').value = man.version;
    $('cfBuild').value = man.build;
    // links
    const q = $('cfLinkFilter').value.trim().toLowerCase();
    const urls = new Map();
    for (const f of man.files.map(x => x.file)) {
      files[f].split('\n').forEach((l, i) => {
        for (const m of l.matchAll(/https?:\/\/[^\s'"`<>)\\]+/g)) {
          const u = m[0].replace(/[.,;]+$/, '');
          if (/^https?:\/\/(www\.w3\.org|fonts\.g|cdnjs|cdn\.jsdelivr)/.test(u) || u.length > 200) continue;
          if (!urls.has(u)) urls.set(u, []);
          urls.get(u).push(`${f}:${i + 1}`);
        }
      });
    }
    const box = $('cfLinks');
    box.innerHTML = '';
    for (const [u, at] of [...urls].sort((a, b) => b[1].length - a[1].length)) {
      if (q && !u.toLowerCase().includes(q) && !at.join().toLowerCase().includes(q)) continue;
      const row = document.createElement('div');
      row.className = 'cf-link';
      row.innerHTML = `<input value="${esc(u)}" aria-label="Link"><button class="btn sm">Change</button><small>${at.length} place${at.length === 1 ? '' : 's'}: ${esc(at.slice(0, 6).join(', '))}${at.length > 6 ? '…' : ''}</small>`;
      row.querySelector('button').onclick = () => {
        const v = row.querySelector('input').value.trim();
        if (!v || v === u) return;
        let n = 0;
        for (const f of Object.keys(files)) { const parts = files[f].split(u); if (parts.length > 1) { n += parts.length - 1; files[f] = parts.join(v); } }
        persist();
        status('stCode', `Changed ${n} place${n === 1 ? '' : 's'}.`, 'ok');
        if (files[cur] !== ta.value) openFile(cur);
        drawCfg();
        preview();
      };
      box.appendChild(row);
    }
    // modules
    const mods = $('cfMods');
    mods.innerHTML = '';
    man.files.forEach((m, i) => {
      const row = document.createElement('div');
      row.className = 'cf-mod';
      row.innerHTML = `<span>${esc(m.file)} <em>${nl(files[m.file] || '') + 1} lines</em></span><button class="btn sm" data-up ${i ? '' : 'disabled'}>↑</button><button class="btn sm" data-dn ${i < man.files.length - 1 ? '' : 'disabled'}>↓</button><button class="btn sm" data-open>Open</button>`;
      row.querySelector('[data-up]').onclick = () => { man.files.splice(i - 1, 0, man.files.splice(i, 1)[0]); persist(); drawCfg(); preview(); };
      row.querySelector('[data-dn]').onclick = () => { man.files.splice(i + 1, 0, man.files.splice(i, 1)[0]); persist(); drawCfg(); preview(); };
      row.querySelector('[data-open]').onclick = () => { go('code'); openFile(m.file); };
      mods.appendChild(row);
    });
    // Premium replacements
    const ed = $('cfEd');
    ed.innerHTML = '';
    const free = (() => { try { return assemble(false, false).html; } catch (e) { return ''; } })();
    eds.premium.forEach((p, i) => {
      const n = free.split(p[0].split('{build}').join(man.build)).length - 1;
      const row = document.createElement('div');
      row.className = 'cf-ed-row';
      row.innerHTML = `<textarea aria-label="Find">${esc(p[0])}</textarea><textarea aria-label="Replace with">${esc(p[1])}</textarea><b class="${n === 1 ? 'okc' : 'badc'}">${n === 1 ? 'found once' : 'found ' + n + '×'}</b>`;
      const [a, b] = row.querySelectorAll('textarea');
      a.onchange = () => { eds.premium[i][0] = a.value; persist(); drawCfg(); };
      b.onchange = () => { eds.premium[i][1] = b.value; persist(); };
      ed.appendChild(row);
    });
  }
  $('cfLinkFilter').addEventListener('input', drawCfg);
  $('cfVer').onchange = e => { man.version = Math.max(1, Number(e.target.value) || man.version); persist(); };
  $('cfBuild').onchange = e => { man.build = e.target.value.trim() || man.build; persist(); preview(); };
  $('cfNew').onclick = () => {
    const name = $('cfNewName').value.trim();
    if (!/^[\w.-]+\.(css|js|html)$/.test(name)) return alert('Name it like 0900-my-fix.css, 0910-my-fix.js or 0920-part.html');
    if (files[name] != null) return alert('There is already a module with that name.');
    files[name] = isCss(name) ? '/* ' + name + ' */\n' : isJs(name) ? '/* ' + name + ' */\n' : '';
    ORIG[name] = '';
    const at = Math.max(0, man.files.findIndex(f => f.file === '0570-html.html'));
    man.files.splice(at, 0, { file: name, open: isCss(name) ? `<style id="${name.replace(/\.\w+$/, '')}">` : isJs(name) ? `<script id="${name.replace(/\.\w+$/, '')}">` : '', close: isCss(name) ? '</style>' : isJs(name) ? '</script>' : '' });
    persist();
    drawCfg();
    go('code');
    openFile(name);
  };

  /* ---------- downloads ---------- */
  async function zipOf(list, withMeta) {
    const JSZip = await loadZip();
    const z = new JSZip();
    for (const f of list) z.file('app/src/' + f, files[f]);
    if (withMeta) {
      z.file('app/src/manifest.json', JSON.stringify(man, null, 1));
      z.file('app/src/editions.json', JSON.stringify(eds, null, 1));
    }
    return z.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }
  const today = () => new Date().toISOString().slice(0, 10);
  $('meDlChanged').onclick = async () => {
    const c = changed();
    if (!c.length) return status('stCode', 'Nothing changed yet.', 'err');
    if (c.length === 1) return saveFile(new Blob([files[c[0]]], { type: 'text/plain' }), c[0]);
    saveFile(await zipOf(c, true), `KodeX_changed_modules_${today()}.zip`);
  };
  $('meDlAll').onclick = async () => saveFile(await zipOf(man.files.map(x => x.file), true), `KodeX_src_v${man.version}_${today()}.zip`);
  $('meDlFree').onclick = () => { try { saveFile(new Blob([assemble(false, false).html], { type: 'text/html' }), `Kodex_Mei_Production_v${man.version}.html`); } catch (e) { status('stCode', e.message, 'err'); } };
  $('meDlPrem').onclick = () => { try { saveFile(new Blob([assemble(true, false).html], { type: 'text/html' }), `Kodex_Mei_Premium_v${man.version}.html`); } catch (e) { status('stCode', e.message, 'err'); } };
  $('meReset').onclick = () => {
    if (!changed().length && JSON.stringify(man) === JSON.stringify(SRC.manifest)) return;
    if (!confirm('Undo every edit in every module, and the Config changes?')) return;
    for (const f of Object.keys(files)) if (ORIG[f] != null) files[f] = ORIG[f];
    man = JSON.parse(JSON.stringify(SRC.manifest));
    eds = JSON.parse(JSON.stringify(SRC.editions));
    persist();
    openFile(cur in ORIG ? cur : man.files[0].file);
    drawCfg();
    preview();
  };

  /* ---------- the Build step uses the edited code ---------- */
  async function syncBase() {
    if (!changed().length && JSON.stringify(man) === JSON.stringify(SRC.manifest) && JSON.stringify(eds) === JSON.stringify(SRC.editions)) return;
    try {
      await setBase('free', assemble(false, false).html, 'Your edited code', base.free.zip, false);
      await setBase('prem', assemble(true, false).html, 'Your edited code', base.prem.zip, false);
      if (typeof summary === 'function') summary();
    } catch (e) { status('st', e.message, 'err'); }
  }
  const go0 = go;
  go = function (p) {
    const r = go0(p);
    if (p === 'code' || p === 'diag') dock(p);
    if (p === 'cfg') drawCfg();
    if (p === 'build' || p === 'base') syncBase();
    return r;
  };
  document.querySelectorAll('[data-go=code],[data-go=diag],[data-go=cfg]').forEach(b => (b.onclick = () => go(b.dataset.go)));

  /* ---------- start ---------- */
  (async () => {
    const saved = await kv('get', 'code');
    if (saved && saved.base === BASE_ID) {
      for (const [f, t] of Object.entries(saved.files || {})) { if (ORIG[f] == null) ORIG[f] = ''; files[f] = t; }
      if (saved.man) man = saved.man;
      if (saved.eds) eds = saved.eds;
    }
    const lv = await kv('get', 'lv');
    if (lv) { $('lvDev').value = lv.dev || '412x915'; land = !!lv.land; $('lvEd').value = lv.ed || 'free'; }
    openFile(cur);
    drawChanges();
    const n = changed().length;
    if (n) status('stCode', `${n} edited module${n === 1 ? '' : 's'} brought back from last time.`, 'ok');
  })();
  window.__kxMaster = { files, assemble, whereIs, diffLines, preview, checkCode, screenIssues, openFile, get doc() { return doc; } };
})();
