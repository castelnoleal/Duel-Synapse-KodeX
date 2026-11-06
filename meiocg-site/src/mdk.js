/* MEIOCG deck pages, deck hub and Why KodeX. Mount: <div id="mdk"></div> + window.MDK = page data (built by build.py).
   Live prices come from the MEIOCG Price Guide data (Yuyu-tei standard prices). */
(function () {
  "use strict";
  var D = window.MDK, root = document.getElementById("mdk");
  if (!D || !root) return;
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
    sec.push(["list", "Decklist", '<div class="dkhead"><span class="src">' + md(D.source.text) + '</span><span class="badge ' + (issues.length ? "bad" : "ok") + '">' + (issues.length ? "✕ " + esc(issues.join("; ")) : "✓ OCG legal · " + esc(D.banlist)) + "</span></div>" + '<div id="mdkPrice"><p class="src">Loading today\'s prices…</p></div>' +
      '<div class="btns"><a class="btn p" href="' + arenaLink(D.name + " (MEIOCG)", L) + '" target="_blank" rel="noopener">Playtest in the Arena</a><button class="btn" data-copy="ydke">Copy deck link (ydke://)</button><button class="btn" data-copy="text">Copy text list</button><button class="btn" data-dl="ydk">Download .ydk</button></div>' +
      zone("Main Deck", L.main, true) + zone("Extra Deck", L.extra) + zone("Side Deck", L.side) + '<p class="src">Tap a card to read it and its official rulings in KodeX. Numbered dots mark OCG Limited (1) and Semi-Limited (2) cards.</p>']);
    sec.push(["faq", "FAQ", faq(D.faq)]);
    sec.push(["more", "Keep reading", more(D.more)]);
    var toc = tocHTML(sec.map(function (s) { return [s[0], s[1]]; }));
    var by = "<span>By <b>Meta Insider OCG</b></span><span>Updated " + esc(fmtDate(D.updated)) + "</span><span>" + D.readMin + " min read</span><span>" + esc(D.metaLine) + "</span>";
    root.innerHTML = hero([D.label[0], D.label[1]], esc(D.name) + ": <span>how it plays, and how to beat it</span>", D.lead, by) +
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
      '<div class="wrap"><main>' + section("top", "The decks to beat right now", '<div class="meta">' + cards + "</div>" + '<p class="src">' + md(D.source) + "</p>") +
      section("table", "Top 10 by share", rest) +
      section("practice", "Practice against them", paras(D.practice) + '<div class="btns"><a class="btn p" href="' + SITE + '/duelsynapse">Open Duel Synapse</a><a class="btn" href="' + SITE + '/prices">OCG price guide</a><a class="btn" href="' + SITE + '/why-kodex">Why KodeX</a></div>') + disc + "</main></div>";
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

  try { ({ deck: deckPage, hub: hubPage, why: whyPage })[D.kind](); } catch (e) { console.error(e); root.innerHTML = '<div class="wrap"><p>This page could not load. Please refresh.</p></div>'; }
})();
