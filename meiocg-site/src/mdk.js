/* MEIOCG deck pages, deck hub and Why KodeX. Mount: <div id="mdk"></div> + window.MDK = page data (built by build.py).
   Live prices come from the MEIOCG Price Guide data (Yuyu-tei standard prices). */
(function () {
  "use strict";
  var D = window.MDK, host = document.getElementById("mdk"), root = host;
  if (!D || !host) return;
  // The page lives in a shadow root so the site stylesheet (which uses the same short class names) can't reach in.
  // Theme tokens (--bg, --ink, --brand …) and fonts still inherit from the site, so light/dark mode keeps working.
  if (host.attachShadow && !host.shadowRoot) {
    var sh = host.attachShadow({ mode: "open" }), css = document.getElementById("mdk-css"), st = document.createElement("style");
    st.textContent = (css ? css.textContent : "") + ":host{display:block;width:100%}";
    sh.appendChild(st);
    if (css) css.media = "not all";
    root = document.createElement("div"); root.id = "mdk"; sh.appendChild(root);
  }
  // DashNex wraps editor-made pages in its own header bar, a 960px container and a footer: use the full width instead.
  if (!document.getElementById("mdk-page")) {
    var pg = document.createElement("style"); pg.id = "mdk-page";
    pg.textContent = "body:has(#mdk) .dnp-header,body:has(#mdk) .dnp-footer{display:none!important}.dnp-content:has(#mdk){max-width:none!important;width:100%!important;padding:0!important;margin:0!important}body:has(#mdk){margin:0}";
    document.head.appendChild(pg);
  }
  var SITE = "https://meiocg.org", KX = "https://kodex.meiocg.org";
  var PRICE_REPO = "castelnoleal/Meiocg_Price-Check";
  var PRICE_BASES = ["https://raw.githubusercontent.com/" + PRICE_REPO + "/data/", "https://cdn.jsdelivr.net/gh/" + PRICE_REPO + "@data/"];
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]; }); };
  var IDS = D.ids || {};
  // inline markup: [[Card Name]] → KodeX card link, **bold**
  var md = function (s) {
    return esc(s).replace(/\[\[(.+?)\]\]/g, function (_, n) {
      var raw = n.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"), id = IDS[raw];
      return id ? '<a class="cn" href="' + KX + "/#card=" + id + '" target="_blank" rel="noopener">' + n + "</a>" : '<span class="cn">' + n + "</span>";
    }).replace(/\[([^\[\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  };
  var img = function (id) { return KX + "/img/" + id + ".jpg"; };
  var toast = function (t) { var e = root.querySelector(".toast"); if (!e) { e = document.createElement("div"); e.className = "toast"; root.appendChild(e); } e.textContent = t; e.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { e.classList.remove("on"); }, 2200); };
  var copy = function (t, ok) {
    var done = function () { toast(ok); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, fallback); else fallback();
    function fallback() { var a = document.createElement("textarea"); a.value = t; a.style.position = "fixed"; a.style.opacity = "0"; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); done(); } catch (e) { prompt("Copy this:", t); } a.remove(); }
  };
  var ul = function (a) { return "<ul>" + a.map(function (x) { return "<li>" + md(x) + "</li>"; }).join("") + "</ul>"; };
  var paras = function (a) { return (Array.isArray(a) ? a : [a]).map(function (x) { return "<p>" + md(x) + "</p>"; }).join(""); };
  var section = function (id, title, html) { return '<section id="' + id + '"><h2>' + esc(title) + "</h2>" + html + "</section>"; };
  var tocHTML = function (items) { var ol = "<ol>" + items.map(function (x) { return '<li><a href="#' + x[0] + '">' + esc(x[1]) + "</a></li>"; }).join("") + "</ol>"; return '<nav class="toc" aria-label="On this page"><b>On this page</b>' + ol + "</nav>"; };
  var hero = function (pill, title, lead, byline) {
    return '<header class="hero"><div class="wrap"><span class="pill"><b>' + esc(pill[0]) + "</b>" + esc(pill[1]) + "</span><h1>" + title + '</h1><p class="lead">' + md(lead) + "</p>" + (byline ? '<div class="byline">' + byline + "</div>" : "") + "</div></header>";
  };
  var faq = function (a) { return a.map(function (q) { return '<details class="faq"><summary>' + esc(q[0]) + "</summary><p>" + md(q[1]) + "</p></details>"; }).join(""); };
  var more = function (a) { return '<div class="more">' + a.map(function (m) { return '<a class="mc" href="' + esc(m.href) + '"><small>' + esc(m.k) + "</small><b>" + esc(m.t) + "</b><span>" + esc(m.d) + "</span></a>"; }).join("") + "</div>"; };
  var disc = '<p class="disc">Meta Insider OCG (MEIOCG) is an independent fan project, not affiliated with or endorsed by Konami. Yu-Gi-Oh! is a trademark of Konami.</p>';
  var fmtDate = function (s) { var d = new Date(s + "T00:00:00"); return isNaN(d) ? s : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };

  /* ---------- deck formats ---------- */
  var copiesOf = function (list) { var out = []; list.forEach(function (c) { for (var i = 0; i < c[2]; i++) out.push(c[0]); }); return out; };
  var ydke = function (L) {
    var enc = function (ids) { var s = ""; ids.forEach(function (id) { s += String.fromCharCode(id & 255, (id >>> 8) & 255, (id >>> 16) & 255, (id >>> 24) & 255); }); return btoa(s); };
    return "ydke://" + enc(copiesOf(L.main)) + "!" + enc(copiesOf(L.extra)) + "!" + enc(copiesOf(L.side)) + "!";
  };
  var ydk = function (L) { return ["#created by Meta Insider OCG (meiocg.org)", "#main"].concat(copiesOf(L.main), ["#extra"], copiesOf(L.extra), ["!side"], copiesOf(L.side)).join("\n") + "\n"; };
  var arenaLink = function (name, L) {
    var g = function (l) { return l.map(function (c) { return [c[0], c[1], c[2]]; }); };
    var json = JSON.stringify({ n: name, m: g(L.main), e: g(L.extra), s: g(L.side) });
    var b = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return KX + "/duel/#deck=" + b;
  };
  var textList = function (L) {
    var z = function (t, l) { return l.length ? [t + " (" + l.reduce(function (n, c) { return n + c[2]; }, 0) + ")"].concat(l.map(function (c) { return c[2] + " " + c[1]; })).join("\n") + "\n" : ""; };
    return [z("Main Deck", L.main), z("Extra Deck", L.extra), z("Side Deck", L.side)].filter(Boolean).join("\n");
  };
  var BANMAX = { Forbidden: 0, Limited: 1, "Semi-Limited": 2 };
  var legality = function (L) {
    var per = {}, issues = [];
    ["main", "extra", "side"].forEach(function (k) { L[k].forEach(function (c) { var e = per[c[0]] || (per[c[0]] = { n: 0, name: c[1], ban: c[4] }); e.n += c[2]; }); });
    Object.keys(per).forEach(function (k) { var e = per[k], max = e.ban in BANMAX ? BANMAX[e.ban] : 3; if (e.n > max) issues.push(e.name + ": " + (e.ban || "3-copy rule") + " (" + max + " allowed)"); });
    var cnt = function (l) { return l.reduce(function (n, c) { return n + c[2]; }, 0); }, m = cnt(L.main), x = cnt(L.extra), s = cnt(L.side);
    if (m < 40 || m > 60) issues.push("Main Deck has " + m + " cards"); if (x > 15) issues.push("Extra Deck has " + x + " cards"); if (s > 15) issues.push("Side Deck has " + s + " cards");
    return issues;
  };

  /* ---------- live prices ---------- */
  var nj = function (s) { return String(s || "").normalize("NFKC").replace(/[\s・·]/g, "").replace(/[－‐‑–—]/g, "-").toLowerCase(); };
  var priceData = null;
  function loadPrices() {
    if (priceData) return priceData;
    priceData = (function tryBase(i) {
      if (i >= PRICE_BASES.length) return Promise.reject(new Error("prices unavailable"));
      return fetch(PRICE_BASES[i] + "index.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }).catch(function () { return tryBase(i + 1); });
    })(0).then(function (j) {
      var col = {}; (j.cols || []).forEach(function (c, i) { col[c] = i; });
      var byJ = {}, byE = {}, row = {};
      (j.cards || []).forEach(function (r) {
        var y = r[col.yyt] || 0; if (!(y > 0)) return;
        var k = nj(r[col.name]); if (!byJ[k] || y < byJ[k].p) byJ[k] = { p: y, id: r[col.id] };
        var e = r[col.en]; if (e && (!byE[e] || y < byE[e].p)) byE[e] = { p: y, id: r[col.id] };
      });
      return { byJ: byJ, byE: byE, rates: j.rates || {}, date: j.date };
    });
    return priceData;
  }
  function priceDeck(L, box) {
    loadPrices().then(function (P) {
      var sum = function (l) { var t = 0, n = 0, all = 0, top = []; l.forEach(function (c) { all++; var hit = (c[5] && P.byJ[c[5]]) || P.byE[c[1]]; if (hit) { n++; t += hit.p * c[2]; top.push([c[1], hit.p, hit.id]); } }); return { t: t, n: n, all: all, top: top }; };
      var md_ = sum(L.main.concat(L.extra)), sd = sum(L.side), php = P.rates.JPY_PHP || 0;
      var yen = function (v) { return "¥" + Math.round(v).toLocaleString("en-US"); }, peso = function (v) { return php ? "₱" + Math.round(v * php).toLocaleString("en-US") : "–"; };
      md_.top.sort(function (a, b) { return b[1] - a[1]; });
      box.innerHTML = '<div class="price"><div><small>Main + Extra</small><b>' + yen(md_.t) + "</b><span class=muted>" + peso(md_.t) + '</span></div><div><small>Side Deck</small><b>' + yen(sd.t) + "</b><span class=muted>" + peso(sd.t) + '</span></div><div><small>Priciest single</small><b>' + (md_.top[0] ? yen(md_.top[0][1]) : "–") + "</b><span class=muted>" + (md_.top[0] ? esc(md_.top[0][0]) : "") + "</span></div></div>" +
        '<p class="src">Cheapest Yuyu-tei listing for each card, from the <a href="' + SITE + '/prices">MEIOCG Price Guide</a> (' + esc(P.date || "") + "). " + md_.n + " of " + md_.all + " Main/Extra card names priced" + (md_.n < md_.all ? "; unpriced cards are left out of the total" : "") + ". Peso values use the Price Guide's daily rate.</p>";
    }).catch(function () { box.innerHTML = '<p class="src">Live prices could not load right now. See the <a href="' + SITE + '/prices">MEIOCG Price Guide</a>.</p>'; });
  }

  /* ---------- deck page ---------- */
  function deckPage() {
    var L = D.list, sec = [];
    var cardTile = function (c) { var b = c[4] in BANMAX ? '<span class="lim l' + BANMAX[c[4]] + '" title="' + esc(c[4]) + '">' + BANMAX[c[4]] + "</span>" : ""; return '<a class="cd" href="' + KX + "/#card=" + c[0] + '" target="_blank" rel="noopener"><img loading="lazy" src="' + img(c[0]) + '" alt=""><span class="t"><b>' + esc(c[1]) + b + "</b><i>" + esc(c[3].split(" · ")[1] || c[3]) + '</i></span><span class="q">×' + c[2] + "</span></a>"; };
    var zone = function (title, l, groups) {
      var n = l.reduce(function (a, c) { return a + c[2]; }, 0), h = '<div class="zone"><h3>' + title + "<span>" + n + " cards</span></h3>";
      if (groups) ["Monster", "Spell", "Trap"].forEach(function (g) { var x = l.filter(function (c) { return c[3].indexOf(g) > -1; }); if (x.length) h += '<div class="grp">' + g + "s · " + x.reduce(function (a, c) { return a + c[2]; }, 0) + '</div><div class="cards">' + x.map(cardTile).join("") + "</div>"; });
      else h += '<div class="cards">' + l.map(cardTile).join("") + "</div>";
      return h + "</div>";
    };
    var duelCard = function (k) {
      return '<div class="duel"><div class="ic">⚔</div><div><h3>' + esc(k === 0 ? "Playtest " + D.name + " in Duel Synapse" : "Practice the matchup") + "</h3><p>" + md(k === 0 ? D.duel[0] : D.duel[1]) + '</p></div><div class="acts"><a class="btn p" href="' + arenaLink(D.name + " (MEIOCG)", L) + '" target="_blank" rel="noopener">Open in the Arena</a><a class="btn" href="' + SITE + '/duelsynapse">About Duel Synapse</a></div></div>';
    };
    var issues = legality(L);
    sec.push(["how", "How " + D.name + " wins", paras(D.how.intro) + ul(D.how.keys)]);
    sec.push(["line", "A core line", '<div class="start"><div><small>Start</small>' + md(D.line.start) + '</div><i>→</i><div><small>End</small>' + md(D.line.end) + '</div></div><ol class="steps">' + D.line.steps.map(function (s) { return "<li>" + md(s[0]) + (s[1] ? "<small>" + md(s[1]) + "</small>" : "") + "</li>"; }).join("") + "</ol>" + (D.line.note ? '<p class="board">' + md(D.line.note) + "</p>" : "") + duelCard(0)]);
    sec.push(["board", "What its board does on your turn", ul(D.board)]);
    sec.push(["stop", "Where to stop it", (D.stopIntro ? paras(D.stopIntro) : "") + '<div class="tbl stack"><table><thead><tr><th>Card</th><th>Where it works</th><th>What happens next</th></tr></thead><tbody>' + D.stops.map(function (r) { return '<tr><td data-l="Card">' + md(r[0]) + '</td><td data-l="Where it works">' + md(r[1]) + '</td><td data-l="What happens next">' + md(r[2]) + "</td></tr>"; }).join("") + "</tbody></table></div>" + "<h3>Takeaways</h3><ol>" + D.takeaways.map(function (x) { return "<li>" + md(x) + "</li>"; }).join("") + "</ol>"]);
    sec.push(["second", "Going second into " + D.name, ul(D.second)]);
    sec.push(["practice", "Practice against it", ul(D.practice) + duelCard(1)]);
    sec.push(["list", "Decklist", '<div class="dkhead"><span class="stamp">' + esc(D.listTag || "") + '</span><span class="src">' + md(D.source.text) + '</span><span class="badge ' + (issues.length ? "bad" : "ok") + '">' + (issues.length ? "✕ " + esc(issues.join("; ")) : "✓ OCG legal · " + esc(D.banlist)) + "</span></div>" + '<div id="mdkPrice"><p class="src">Loading today\'s prices…</p></div>' +
      '<div class="btns"><a class="btn p" href="' + arenaLink(D.name + " (MEIOCG)", L) + '" target="_blank" rel="noopener">Playtest in the Arena</a><button class="btn" data-copy="ydke">Copy deck link (ydke://)</button><button class="btn" data-copy="text">Copy text list</button><button class="btn" data-dl="ydk">Download .ydk</button></div>' +
      zone("Main Deck", L.main, true) + zone("Extra Deck", L.extra) + zone("Side Deck", L.side) + '<p class="src">Tap a card to read it and its official rulings in KodeX. Numbered dots mark OCG Limited (1) and Semi-Limited (2) cards.</p>']);
    if (D.guide) sec.splice(sec.length - 1, 0, ["learn", "Learn to play it", '<div class="duel"><div class="ic">📘</div><div><h3>Want to pilot ' + esc(D.name) + ' yourself?</h3><p>The guide walks through its engine and core line in three free lessons, each with a drill in the Arena.</p></div><div class="acts"><a class="btn p" href="' + esc(D.guide) + '">Start the free lessons</a></div></div>']);
    sec.push(["faq", "FAQ", faq(D.faq)]);
    sec.push(["more", "Keep reading", more(D.more)]);
    var toc = tocHTML(sec.map(function (s) { return [s[0], s[1]]; }));
    var by = "<span>By <b>Meta Insider OCG</b></span><span>Updated " + esc(fmtDate(D.updated)) + "</span><span>" + D.readMin + " min read</span><span>" + esc(D.metaLine) + "</span>";
    var arch = D.archived ? '<div class="wrap"><div class="archived"><b>Archived list</b> · ' + esc(D.listTag || "") + ' · legal on the ' + esc(D.banlist) + '. <a href="' + esc(D.hubUrl) + '">See the current meta decks</a></div></div>' : "";
    root.innerHTML = hero([D.label[0], D.label[1]], esc(D.name) + ": <span>how it plays, and how to beat it</span>", D.lead, by + '<span class="stamp">' + esc(D.listTag || "") + "</span>") + arch +
      '<div class="wrap"><details class="tocm"><summary>On this page</summary>' + toc + '</details><div class="grid"><aside>' + toc + "</aside><main>" + sec.map(function (s) { return section(s[0], s[1], s[2]); }).join("") + disc + "</main></div></div>";
    priceDeck(L, root.querySelector("#mdkPrice"));
    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-copy],[data-dl]"); if (!b) return;
      if (b.dataset.copy === "ydke") copy(ydke(L), "Deck link copied");
      else if (b.dataset.copy === "text") copy(textList(L), "Text list copied");
      else if (b.dataset.dl === "ydk") { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ydk(L)], { type: "application/octet-stream" })); a.download = D.slug + ".ydk"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
    });
  }

  /* ---------- hub ---------- */
  function hubPage() {
    var max = Math.max.apply(null, D.decks.map(function (d) { return d.share; }));
    var cards = D.decks.map(function (d) {
      return '<a class="dcard" href="' + esc(d.href) + '"><img loading="lazy" src="' + KX + "/img/" + d.art + '.jpg" alt=""><div><b>' + esc(d.name) + "</b><p>" + md(d.blurb) + '</p><div class="bar"><i style="width:' + Math.round((d.share / max) * 100) + '%"></i></div></div><div class="share"><b>' + d.share.toFixed(1) + "%</b><small>of top decks</small></div></a>";
    }).join("");
    var rest = '<div class="tbl cmp"><table><thead><tr><th>#</th><th>Deck</th><th>Share of top decks</th></tr></thead><tbody>' + D.table.map(function (r, i) { return "<tr><td>" + (i + 1) + "</td><td>" + esc(r[0]) + "</td><td>" + r[1].toFixed(1) + "%</td></tr>"; }).join("") + "</tbody></table></div>";
    root.innerHTML = hero(["OCG", "Meta decks · " + D.period], "OCG meta decks: <span>how they combo, and how to beat them</span>", D.lead, "<span>By <b>Meta Insider OCG</b></span><span>Updated " + esc(fmtDate(D.updated)) + "</span>") +
      '<div class="wrap"><main>' + section("top", "The decks to beat right now", '<div class="tabs" role="tablist"><button role="tab" class="on" data-tab="cur">Current lists <i>' + esc(D.listTag || "") + '</i></button><button role="tab" data-tab="arc">Archive <i>' + (D.archive || []).length + "</i></button></div>" +
        '<div data-pane="cur"><div class="meta">' + cards + "</div>" + '<p class="src">' + md(D.source) + "</p></div>" +
        '<div data-pane="arc" hidden>' + ((D.archive || []).length ? '<div class="arc">' + D.archive.map(function (a) { return '<a class="mc" href="' + esc(SITE + "/deck-" + a.slug) + '"><small>' + esc(a.tag) + "</small><b>" + esc(a.name) + "</b><span>Legal on the " + esc(a.banlist) + "</span></a>"; }).join("") + "</div>" : '<p class="empty">No archived lists yet. When the OCG Forbidden &amp; Limited list changes, the lists above move here with their date, and their pages and links keep working.</p>') + "</div>") +
      section("table", "Top 10 by share", rest) +
      section("practice", "Practice against them", paras(D.practice) + '<div class="btns"><a class="btn p" href="' + SITE + '/duelsynapse">Open Duel Synapse</a><a class="btn" href="' + esc(D.links.guides) + '">Deck guides</a><a class="btn" href="' + esc(D.links.cup) + '">MEIOCG Cup</a><a class="btn" href="' + esc(D.links.players) + '">MEIOCG Players</a><a class="btn" href="' + SITE + '/prices">OCG price guide</a><a class="btn" href="' + SITE + '/why-kodex">Why KodeX</a></div>') + disc + "</main></div>";
    tabs();
  }
  function tabs() {
    root.addEventListener("click", function (e) {
      var t = e.target.closest("[data-tab]"); if (!t) return;
      var box = t.closest("section") || root;
      box.querySelectorAll("[data-tab]").forEach(function (b) { b.classList.toggle("on", b === t); b.setAttribute("aria-selected", b === t); });
      box.querySelectorAll("[data-pane]").forEach(function (p) { p.hidden = p.dataset.pane !== t.dataset.tab; });
      if (t.dataset.tab && typeof onTab === "function") onTab(t.dataset.tab);
    });
  }
  var onTab = null;

  /* ---------- guides ---------- */
  var lockList = function () {
    return '<div class="lessons">' + D.premium.map(function (l, i) { return '<div class="lesson lock"><span class="n">' + (i + 4) + '</span><div><b>' + esc(l[0]) + "</b><small>" + esc(l[1]) + '</small></div><em>🔒 Premium</em></div>'; }).join("") + '</div><p class="src">' + md(D.premiumNote) + "</p>";
  };
  function guidePage() {
    var L = D.list, sec = [];
    var drill = function (t, p) { return '<div class="duel"><div class="ic">⚔</div><div><h3>' + esc(t) + "</h3><p>" + md(p) + '</p></div><div class="acts"><a class="btn p" href="' + arenaLink(D.name + " (MEIOCG)", L) + '" target="_blank" rel="noopener">Open in the Arena</a></div></div>'; };
    sec.push(["l1", "Lesson 1 · What " + D.name + " wants to do", '<span class="free">Free</span>' + paras(D.how.intro) + "<h3>The cards that make it work</h3>" + ul(D.how.keys) +
      drill("Drill: find the engine", "Open the list in the Arena against the dummy and draw ten opening hands. For each one, say which of the cards above starts your turn.")]);
    sec.push(["l2", "Lesson 2 · The core line", '<span class="free">Free</span><div class="start"><div><small>Start</small>' + md(D.line.start) + '</div><i>→</i><div><small>End</small>' + md(D.line.end) + '</div></div><ol class="steps">' + D.line.steps.map(function (x) { return "<li>" + md(x[0]) + (x[1] ? "<small>" + md(x[1]) + "</small>" : "") + "</li>"; }).join("") + "</ol>" + (D.line.note ? '<p class="board">' + md(D.line.note) + "</p>" : "") +
      drill("Drill: play the line", D.duel[0])]);
    sec.push(["l3", "Lesson 3 · Where opponents stop you", '<span class="free">Free</span>' + (D.stopIntro ? paras(D.stopIntro) : "") + "<p>These are the interruptions opponents aim at " + esc(D.name) + ". Know where each one lands before you start your turn, and plan which piece you can afford to lose.</p>" +
      '<div class="tbl stack"><table><thead><tr><th>Their card</th><th>Where it hits you</th><th>What it costs you</th></tr></thead><tbody>' + D.stops.map(function (r) { return '<tr><td data-l="Their card">' + md(r[0]) + '</td><td data-l="Where it hits you">' + md(r[1]) + '</td><td data-l="What it costs you">' + md(r[2]) + "</td></tr>"; }).join("") + "</tbody></table></div>" +
      drill("Drill: play into interruptions", D.duel[1])]);
    sec.push(["more", "Lessons 4–6 · KodeX Premium", lockList()]);
    var toc = tocHTML(sec.map(function (x) { return [x[0], x[1]]; }));
    var by = "<span>By <b>Meta Insider OCG</b></span><span>Updated " + esc(fmtDate(D.updated)) + '</span><span>3 free lessons</span><span class="stamp">' + esc(D.listTag) + "</span>";
    root.innerHTML = hero(["Guide", D.label[1]], "How to play <span>" + esc(D.name) + "</span>", D.lead, by) +
      '<div class="wrap"><details class="tocm"><summary>On this page</summary>' + toc + '</details><div class="grid"><aside>' + toc + "</aside><main>" + sec.map(function (x) { return section(x[0], x[1], x[2]); }).join("") +
      '<div class="btns"><a class="btn" href="' + esc(D.deckUrl) + '">How to beat ' + esc(D.name) + '</a><a class="btn" href="' + esc(D.guidesUrl) + '">All guides</a></div>' + disc + "</main></div></div>";
  }
  function guidesPage() {
    var cards = D.guides.map(function (g) { return '<a class="dcard" href="' + esc(g.href) + '"><img loading="lazy" src="' + KX + "/img/" + g.art + '.jpg" alt=""><div><b>' + esc(g.name) + "</b><p>" + esc(g.label) + ' · 3 free lessons + 3 Premium</p></div><div class="share"><b>1–3</b><small>free</small></div></a>'; }).join("");
    root.innerHTML = hero(["Guides", "OCG meta decks"], "Learn the <span>meta decks</span>", D.lead, "<span>By <b>Meta Insider OCG</b></span><span>Updated " + esc(fmtDate(D.updated)) + "</span>") +
      '<div class="wrap"><main>' + section("all", "Guides", '<div class="meta">' + cards + "</div>") +
      section("lessons", "What each guide covers", '<div class="lessons">' + ["What the deck wants to do", "The core line, step by step", "Where opponents stop you"].map(function (t, i) { return '<div class="lesson"><span class="n">' + (i + 1) + "</span><div><b>" + esc(t) + '</b><small>Free on meiocg.org, with a drill in Duel Synapse Arena</small></div><em class="ok">Free</em></div>'; }).join("") + "</div>" + lockList()) + disc + "</main></div>";
  }

  /* ---------- MEIOCG Cup ---------- */
  function cupPage() {
    var sec = [];
    sec.push(["next", "Next Cup", '<div class="duel"><div class="ic">🏆</div><div><h3>' + esc(D.status) + "</h3><p>" + md(D.statusNote) + '</p></div><div class="acts"><a class="btn p" href="https://www.facebook.com/meiocgOfficial" target="_blank" rel="noopener">Follow MEIOCG</a><a class="btn" href="mailto:metainsiderocg@gmail.com?subject=MEIOCG%20Cup">Email us</a></div></div>']);
    sec.push(["format", "Format", ul(D.format)]);
    sec.push(["join", "How to join", '<ol class="steps">' + D.steps.map(function (x) { return "<li><b>" + esc(x[0]) + "</b> · " + md(x[1]) + "</li>"; }).join("") + "</ol>" + '<div class="btns"><a class="btn p" href="' + SITE + '/duelsynapse">Get KodeX</a><a class="btn" href="' + esc(D.links.decks) + '">Practise against the meta</a></div>']);
    sec.push(["results", "Results", (D.past || []).length ? '<div class="more">' + D.past.map(function (c) { return '<a class="mc" href="' + esc(c.href) + '"><small>' + esc(fmtDate(c.date)) + " · " + c.players + " players</small><b>" + esc(c.name) + "</b><span>Won by " + esc(c.winner) + " with " + esc(c.deck) + "</span></a>"; }).join("") + "</div>" : '<p class="empty">Results, standings and the top decks of each Cup are published here after the event.</p>']);
    sec.push(["faq", "FAQ", faq(D.faq)]);
    var toc = tocHTML(sec.map(function (x) { return [x[0], x[1]]; }));
    root.innerHTML = hero(["Tournament", "OCG · Swiss"], "The <span>MEIOCG Cup</span>", D.lead, "<span>By <b>Meta Insider OCG</b></span><span>Updated " + esc(fmtDate(D.updated)) + "</span>") +
      '<div class="wrap"><details class="tocm"><summary>On this page</summary>' + toc + '</details><div class="grid"><aside>' + toc + "</aside><main>" + sec.map(function (x) { return section(x[0], x[1], x[2]); }).join("") + disc + "</main></div></div>";
  }

  /* ---------- Duel Synapse: KodeX landing (meiocg.org/duelsynapse) ---------- */
  function dsPage() {
    var K = D.cards, P = D.profile;
    var pfIcon = function (id) { var p = P.icons[id]; if (!p) return KX + "/duel/assets/meiocg-192.webp"; return "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + p[0] + '"/><stop offset="1" stop-color="' + p[1] + '"/></linearGradient></defs><rect width="48" height="48" fill="url(#g)"/><g transform="translate(12 12)" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="' + p[2] + '"/></g></svg>'); };
    var av = function (fr, icon, n) { return '<span class="pf-av fr-' + fr + '" style="--pf:' + n + 'px"><img src="' + esc(pfIcon(icon)) + '" alt="" loading="lazy"></span>'; };
    var playBtn = D.play_free ? '<a class="btn p" href="' + esc(D.play_free) + '" target="_blank" rel="noopener">Get it on Google Play</a>' : '<span class="btn p dis" aria-disabled="true">Google Play · coming soon</span>';
    var demo = {
      ace: '<div class="dsx ace"><i class="rays"></i><img class="hero" src="' + img(K.ace) + '" alt="Solfachord Happiness"><b class="t">Solfachord Happiness</b><span class="tag">ACE CARD · Kasuteru Kun</span><span class="ln">Added to the hand</span></div>',
      finish: '<div class="dsx fin"><div class="mat">' + [0, 1, 2, 3, 4].map(function (i) { return '<img src="' + img([K.dm, K.bewd, K.dmg, K.snake, K.veiler][i]) + '" alt="" style="--i:' + i + '">'; }).join("") + '</div><div class="pfb">' + av("gold", "moon", 70) + '<svg viewBox="0 0 100 100"><polyline points="50,2 44,20 58,36 40,54 56,72 46,98"/><polyline points="58,36 80,44 94,40"/><polyline points="40,54 20,60 8,74"/></svg></div><b class="k">FINISH!</b></div>',
      staple: '<div class="dsx stp"><div class="band"><img src="' + img(K.ash) + '" alt="Ash Blossom &amp; Joyous Spring"><b>Ash Blossom &amp; Joyous Spring</b></div>' + new Array(16).join(".").split(".").map(function (_, i) { return '<i class="pt" style="left:' + ((i * 37) % 96) + '%;animation-delay:' + ((i * 53) % 25) / 10 + 's;animation-duration:' + (3 + (i % 4) * .5) + 's">' + (i % 3 ? "🌸" : "✿") + "</i>"; }).join("") + '<b class="stamp">ASH BLOSSOM</b></div>',
      frames: '<div class="dsx frm">' + [["rookie", "star"], ["bronze", "flame"], ["silver", "moon"], ["gold", "crown"], ["platinum", "gem"], ["diamond", "bolt"], ["master", "sun"], ["premium", "wing"]].map(function (f, i) { return '<div style="--i:' + i + '">' + av(f[0], f[1], 54) + "<small>" + f[0][0].toUpperCase() + f[0].slice(1) + "</small></div>"; }).join("") + "</div>",
      win: '<div class="dsx win"><div class="who">' + av("premium", "crown", 64) + '<div><b>Kasuteru Kun</b><span>Winner via Comeback</span></div></div><img class="fc" src="' + img(K.finisher) + '" alt="Accesscode Talker"><small class="cap">Finishing card · Accesscode Talker</small><b class="yw">You win</b></div>'
    };
    var tabs = D.premium.map(function (x, i) { return '<button role="tab" data-ds="' + x[0] + '"' + (i ? "" : ' class="on"') + ">" + esc(x[1]) + "</button>"; }).join("");
    var info = {}; D.premium.forEach(function (x) { info[x[0]] = x; });
    root.innerHTML =
      '<header class="hero ds-hero"><div class="wrap ds-hgrid"><div><span class="pill"><b>KodeX</b>by Meta Insider OCG</span><h1>Duel Synapse: <span>KodeX</span></h1>' + (D.tagline ? '<p class="ds-tag">' + esc(D.tagline) + "</p>" : "") + '<p class="lead">' + md(D.lead) + '</p>' +
      '<div class="btns">' + playBtn + '<a class="btn" href="' + esc(D.web) + '" target="_blank" rel="noopener">Open KodeX on the web</a></div><div class="ds-chips">' + (D.chips || []).map(function (c) { return "<span>" + esc(c) + "</span>"; }).join("") + '</div></div>' +
      '<div class="ds-phone" aria-label="KodeX Arena preview"><div class="ds-scr">' + demo.ace + "</div></div></div></header>" +
      '<div class="wrap"><main>' +
      section("features", D.why_title || "Everything for the OCG, in one app", (D.why_lead ? "<p>" + md(D.why_lead) + "</p>" : "") + '<div class="ds-feat">' + D.features.map(function (f) { return '<div class="ds-f"><i>' + f[0] + "</i><b>" + esc(f[1]) + "</b><p>" + md(f[2]) + "</p></div>"; }).join("") + "</div>") +
      (D.scanner ? section("scanner", D.scanner.title, '<p class="ds-kick">' + esc(D.scanner.kicker) + "</p><p>" + md(D.scanner.lead) + "</p>" + ul(D.scanner.points)) : "") +
      section("premium", "KodeX Premium, in action", '<p>Real cards from the KodeX database, the way they play in Duel Synapse Arena.</p><div class="ds-show"><div class="ds-tabs" role="tablist">' + tabs + '</div><div class="ds-stage"><div class="ds-scr big" id="dsStage"></div><div class="ds-cap" id="dsCap"></div></div></div>') +
      section("compare", D.plans_title || "Free and Premium", (D.plans_lead ? "<p>" + md(D.plans_lead) + "</p>" : "") + (D.plans ? '<div class="ds-plans">' + D.plans.map(function (p) { return '<div class="ds-plan"><b>' + esc(p.name) + "</b><small>" + esc(p.price) + "</small>" + (p.tag ? "<em>" + esc(p.tag) + "</em>" : "") + ul(p.items) + "</div>"; }).join("") + "</div>" : "") + '<div class="tbl"><table><thead><tr><th></th><th>Free</th><th>Premium</th></tr></thead><tbody>' + D.compare.map(function (r) { return "<tr><td>" + esc(r[0]) + "</td><td>" + esc(r[1]) + '</td><td class="y">' + esc(r[2]) + "</td></tr>"; }).join("") + '</tbody></table></div><div class="ds-trial"><b>5 days of Premium, free</b><p>' + md(D.trial) + '</p>' + (D.play_premium ? '<a class="btn g" href="' + esc(D.play_premium) + '" target="_blank" rel="noopener">Get KodeX Premium</a>' : '<span class="btn g dis" aria-disabled="true">KodeX Premium · coming soon to Google Play</span>') + '</div>') +
      (D.get_title ? section("get", D.get_title, '<p class="ds-kick">' + esc(D.get_kicker) + "</p><p>" + md(D.get_lead) + '</p><div class="ds-get"><div class="btns">' + playBtn + '<a class="btn" href="' + esc(D.web) + '" target="_blank" rel="noopener">Use the web version</a></div>' + (D.qr ? '<div class="ds-qr"><img src="' + D.qr + '" alt="QR code" width="96" height="96"><small>' + esc(D.qr_note) + "</small></div>" : "") + "</div>") : "") +
      section("community", "Play with the community", '<div class="more"><a class="mc" href="' + esc(D.links.players) + '"><small>Community</small><b>MEIOCG Players</b><span>The most active duelists and their frames.</span></a><a class="mc" href="' + esc(D.links.cup) + '"><small>Tournament</small><b>MEIOCG Cup</b><span>OCG Swiss rounds, decks registered through KodeX.</span></a><a class="mc" href="' + esc(D.links.decks) + '"><small>Meta</small><b>OCG meta decks</b><span>How they combo and how to beat them, with drills in the Arena.</span></a></div>') +
      section("faq", "FAQ", faq(D.faq)) +
      '<p class="disc">A project of Meta Insider OCG since 2023 · Created by Castel Noleal. Meta Insider OCG (MEIOCG) is an independent fan project, not affiliated with or endorsed by Konami. Yu-Gi-Oh! is a trademark of Konami Digital Entertainment. KodeX is a fan-made companion app. Card images are shown for identification. Google Play and the Google Play logo are trademarks of Google LLC.</p></main></div>';
    var cur = D.premium[0][0], timer = 0, order = D.premium.map(function (x) { return x[0]; });
    var show = function (k) {
      cur = k;
      root.querySelectorAll("[data-ds]").forEach(function (b) { b.classList.toggle("on", b.dataset.ds === k); b.setAttribute("aria-selected", b.dataset.ds === k); });
      var st = root.querySelector("#dsStage"); st.innerHTML = demo[k];
      root.querySelector("#dsCap").innerHTML = "<b>" + esc(info[k][1]) + "</b><p>" + md(info[k][2]) + "</p>";
    };
    var auto = function () { clearInterval(timer); if (matchMedia("(prefers-reduced-motion: reduce)").matches) return; timer = setInterval(function () { show(order[(order.indexOf(cur) + 1) % order.length]); }, 5200); };
    root.addEventListener("click", function (e) { var t = e.target.closest("[data-ds]"); if (t) { show(t.dataset.ds); auto(); } });
    show(cur); auto();
    // the phone in the hero loops the Ace showdown
    setInterval(function () { var s = root.querySelector(".ds-phone .ds-scr"); if (s && !document.hidden) { s.innerHTML = ""; void s.offsetWidth; s.innerHTML = demo.ace; } }, 5200);
  }

  /* ---------- MEIOCG Players ---------- */
  function playersPage() {
    var P = D.profile, tierName = function (id) { var t = P.tiers.filter(function (x) { return x[0] === id; })[0]; return t ? t[1] : "Rookie"; };
    var icon = function (id) {
      var p = P.icons[id]; if (!p) return "https://kodex.meiocg.org/duel/assets/meiocg-192.webp";
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + p[0] + '"/><stop offset="1" stop-color="' + p[1] + '"/></linearGradient></defs><rect width="48" height="48" fill="url(#g)"/><g transform="translate(12 12)" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="' + p[2] + '"/></g></svg>';
      return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    };
    var FR = { none: 1, rookie: 1, bronze: 1, silver: 1, gold: 1, platinum: 1, diamond: 1, master: 1, premium: 1 };
    var av = function (p, n) { return '<span class="pf-av fr-' + (FR[p.frame] ? p.frame : "none") + '" style="--pf:' + n + 'px"><img src="' + esc(icon(p.icon)) + '" alt="" loading="lazy"></span>'; };
    var ago = function (t) { var m = Math.round((Date.now() - t) / 60000); return m < 60 ? "active now" : m < 1440 ? "active " + Math.round(m / 60) + " h ago" : "active " + Math.round(m / 1440) + " d ago"; };
    var row = function (p) {
      var rate = p.duels ? Math.round(p.wins / p.duels * 100) + "%" : "–";
      return '<div class="plr' + (p.rank <= 3 ? " top t" + p.rank : "") + '"><span class="rk">' + p.rank + "</span>" + av(p, 52) + '<div class="who"><b>' + esc(p.name) + "</b>" + (p.title ? "<span>" + esc(p.title) + "</span>" : "") +
        '<div class="tags"><em class="t-' + esc(p.tier) + '">' + esc(tierName(p.tier)) + "</em>" + (p.premium ? '<em class="prem">Premium</em>' : "") + "<small>" + ago(p.last) + "</small></div>" + (p.bio ? "<p>" + esc(p.bio) + "</p>" : "") + "</div>" +
        '<div class="st"><b>' + p.points + "</b><small>points</small></div><div class=\"st2\"><span><b>" + p.days + "</b> days</span><span><b>" + p.duels + "</b> duels</span><span><b>" + rate + "</b> wins</span></div></div>";
    };
    var frames = P.tiers.map(function (t) { return '<div class="frm">' + av({ frame: t[0], icon: "star" }, 48) + "<b>" + esc(t[1]) + "</b><small>" + t[2] + " pts</small></div>"; }).join("") + '<div class="frm">' + av({ frame: "premium", icon: "crown" }, 48) + "<b>Premium</b><small>KodeX Premium</small></div>";
    root.innerHTML = hero(["Community", "KodeX duelists"], "MEIOCG <span>Players</span>", D.lead, "<span>By <b>Meta Insider OCG</b></span><span>Updates every few minutes</span>") +
      '<div class="wrap"><main>' + section("board", "Most active players", '<div class="tabs" role="tablist"><button role="tab" class="on" data-tab="points">Most active</button><button role="tab" data-tab="recent">Recently active</button></div><div id="plist" class="plist"><p class="empty">Loading players…</p></div><p class="src" id="ptotal"></p>') +
      section("frames", "Icon frames", '<div class="frames">' + frames + "</div>") +
      section("join", "Get listed", ul(D.how) + '<div class="btns"><a class="btn p" href="' + SITE + '/duelsynapse">Get KodeX</a><a class="btn" href="' + esc(D.links.cup) + '">MEIOCG Cup</a><a class="btn" href="' + esc(D.links.why) + '">Why KodeX</a></div>') + disc + "</main></div>";
    var list = root.querySelector("#plist"), tot = root.querySelector("#ptotal");
    var load = function (sort) {
      list.innerHTML = '<p class="empty">Loading players…</p>';
      fetch(D.api + "?sort=" + sort + "&limit=100").then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
        var ps = j.players || [];
        list.innerHTML = ps.length ? ps.map(row).join("") : '<p class="empty">No players listed yet. Be the first: turn on <b>Show me on MEIOCG Players</b> in your KodeX profile.</p>';
        tot.textContent = j.total ? j.total + " player" + (j.total === 1 ? "" : "s") + " active in the last 90 days · updated " + new Date(j.updated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
      }).catch(function () { list.innerHTML = '<p class="empty">The player list could not load. Please refresh in a moment.</p>'; });
    };
    onTab = load; tabs(); load("points");
  }


  /* ---------- why kodex ---------- */
  function whyPage() {
    var sec = [];
    sec.push(["what", "What KodeX is", paras(D.what) + '<div class="feat">' + D.features.map(function (f) { return '<div class="ft"><div class="ico">' + f.i + "</div><b>" + esc(f.t) + "</b><p>" + md(f.d) + "</p>" + (f.tag ? "<em>" + esc(f.tag) + "</em>" : "") + "</div>"; }).join("") + "</div>"]);
    sec.push(["arena", "Duel Synapse Arena", paras(D.arena.intro) + ul(D.arena.points)]);
    sec.push(["table", "Free and Premium", '<div class="tbl cmp"><table><thead><tr><th>Feature</th><th>KodeX (free)</th><th>KodeX Premium</th></tr></thead><tbody>' + D.plans.map(function (r) { var c = function (v) { return v === true ? '<span class="yes">✓</span>' : v === false ? '<span class="no">–</span>' : esc(v); }; return "<tr><td>" + esc(r[0]) + "</td><td>" + c(r[1]) + "</td><td>" + c(r[2]) + "</td></tr>"; }).join("") + "</tbody></table></div>"]);
    sec.push(["not", "What KodeX is not (yet)", ul(D.not)]);
    sec.push(["get", "Get KodeX", paras(D.get) + '<div class="btns"><a class="btn p" href="' + SITE + '/duelsynapse">Open Duel Synapse: KodeX</a><a class="btn" href="' + KX + '" target="_blank" rel="noopener">KodeX on the web</a><a class="btn" href="' + SITE + '/decks">OCG meta decks</a></div>']);
    sec.push(["faq", "FAQ", faq(D.faq)]);
    var toc = tocHTML(sec.map(function (s) { return [s[0], s[1]]; }));
    root.innerHTML = hero(["KodeX", "by Meta Insider OCG"], "Why <span>KodeX</span>", D.lead, "<span>By <b>Meta Insider OCG</b></span><span>Updated " + esc(fmtDate(D.updated)) + "</span>") +
      '<div class="wrap"><details class="tocm"><summary>On this page</summary>' + toc + '</details><div class="grid"><aside>' + toc + "</aside><main>" + sec.map(function (s) { return section(s[0], s[1], s[2]); }).join("") + disc + "</main></div></div>";
  }

  /* ---------- meiocg.org site chrome ----------
     Same approach as the Price Guide: borrow the live header, footer, search dialog, theme script and stylesheet
     from the home page, so these pages always match the rest of the site (and its light/dark theme). */
  function siteChrome() {
    if (document.querySelector("header.top") || !/(^|\.)meiocg\.org$/.test(location.hostname) || window.MEIOCG_NO_CHROME) return;
    fetch("/", { credentials: "same-origin" }).then(function (r) { return r.text(); }).then(function (html) {
      var d = new DOMParser().parseFromString(html, "text/html");
      var inl = [].filter.call(d.querySelectorAll("script"), function (s) { return !s.src; });
      var run = function (code, where) { var s = document.createElement("script"); s.textContent = code; (where || document.body).appendChild(s); };
      [].forEach.call(d.querySelectorAll('link[href*="fonts.g"]'), function (l) { document.head.appendChild(document.importNode(l, true)); });
      inl.forEach(function (s) { if (s.closest("head") && (s.textContent.indexOf("data-theme") >= 0 || s.textContent.indexOf("mei-css") >= 0)) run(s.textContent, document.head); });
      var first = document.body.firstChild;
      ["a.skip", "div.progress", "header.top"].forEach(function (q) { var n = d.querySelector(q); if (n) document.body.insertBefore(document.importNode(n, true), first); });
      ["footer.foot", "div.search-dlg", "button.iconbtn", "aside.pixel"].forEach(function (q) { var n = d.querySelector(q); if (n) document.body.appendChild(document.importNode(n, true)); });
      var nav = document.querySelector("header.top .nav");
      if (nav) [].forEach.call(nav.querySelectorAll("[aria-current]"), function (a) { a.removeAttribute("aria-current"); });
      inl.forEach(function (s) { if (!s.closest("head") && s.textContent.length > 2000 && s.textContent.indexOf("createElement('script')") >= 0) run(s.textContent); });
    }).catch(function () {});
  }

  try { ({ deck: deckPage, hub: hubPage, why: whyPage, guide: guidePage, guides: guidesPage, cup: cupPage, players: playersPage, ds: dsPage })[D.kind](); } catch (e) { console.error(e); root.innerHTML = '<div class="wrap"><p>This page could not load. Please refresh.</p></div>'; }
  siteChrome();
})();
