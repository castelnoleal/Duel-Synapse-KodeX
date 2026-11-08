#!/usr/bin/env python3
"""Builds kodex.meiocg.org/players (players.html) from scripts/players_page.template.html.

The page carries its own copy of duel/profile.js (icons, frames, banners, the profile card) and duel/profile.css, so the
same file works on kodex.meiocg.org, as a DashNex page, or saved on its own.

  python3 scripts/build_players_page.py            -> players.html (served by the Worker at /players)
  python3 scripts/build_players_page.py --dashnex DIR   also writes DIR/head.html and DIR/body.html
  python3 scripts/build_players_page.py --preview FILE  also writes a preview with sample players (no server needed)

Created by Castel Noleal, creator of MEIOCG.
"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
tpl = (ROOT / "scripts/players_page.template.html").read_text("utf-8")
pjs = (ROOT / "duel/profile.js").read_text("utf-8")
pcss = (ROOT / "duel/profile.css").read_text("utf-8")
js = re.sub(r"^export (const|function) ", r"\1 ", pjs, flags=re.M)
js = "\n".join("  " + l if l else l for l in js.splitlines())
page = tpl.replace("/*PROFILE_CSS*/", pcss.strip()).replace("  /*PROFILE_JS*/", js)
assert "/*PROFILE" not in page
(ROOT / "players.html").write_text(page, "utf-8")
print("players.html", len(page))

args = sys.argv[1:]
if "--dashnex" in args:
    d = pathlib.Path(args[args.index("--dashnex") + 1]); d.mkdir(parents=True, exist_ok=True)
    head = page.split("<!-- PAGE-HEAD:START -->")[1].split("<!-- PAGE-HEAD:END -->")[0].strip()
    body = page.split("<!-- PAGE-BODY:START -->")[1].split("<!-- PAGE-BODY:END -->")[0].strip()
    (d / "head.html").write_text(head + "\n", "utf-8"); (d / "body.html").write_text(body + "\n", "utf-8")
    (d / "seo.txt").write_text("URL: meiocg.org/players (or kodex.meiocg.org/players)\nTitle: MEIOCG Players · KodeX duelists and their profiles\n"
                               "Description: The most active KodeX duelists, their icon frames and public profiles. A project of Meta Insider OCG since 2023.\n", "utf-8")
    print("dashnex", d)
if "--preview" in args:
    out = pathlib.Path(args[args.index("--preview") + 1])
    now = "Date.now()"
    sample = [
        ("Kasuteru Kun", "Solfachord main · Manila", "Testing Solfachord lines every night. Come duel me in the Arena!", "crown", "premium", "gold", True, 1240, 62, 120, 74, 9),
        ("MeiDuelist", "Elfnote enjoyer", "Locals every Saturday.", "moon", "silver", "silver", False, 610, 40, 60, 31, 4),
        ("Rin", "Raise Moon pilot", "", "flame", "bronze", "bronze", False, 260, 18, 22, 10, 3),
        ("Taro", "", "Learning Ritual decks.", "meiocg", "rookie", "rookie", False, 80, 6, 5, 2, 1),
        ("Aya", "Ars Magna", "", "gem", "platinum", "platinum", True, 1720, 70, 140, 88, 12),
    ]
    rows = []
    for i, (n, t, b, ic, fr, tr, pr, pt, d, du, w, dk) in enumerate(sorted(sample, key=lambda x: -x[7])):
        rows.append(dict(theme={"Kasuteru Kun": "aurora", "Aya": "nebula", "MeiDuelist": "dusk"}.get(n, "default"), rank=i + 1, pid=f"{i:012x}".replace("0", "a"), name=n, title=t, bio=b, icon=ic, frame=fr, tier=tr, premium=pr, points=pt, days=d, duels=du, wins=w, decks=dk))
    stub = ("<script>/* PREVIEW ONLY: sample players instead of the live list */(function(){var rows=" + json.dumps(rows) +
            ";var now=Date.now();rows.forEach(function(r,i){r.since=now-864e5*(30+i*9);r.last=now-36e5*(1+i*7)});var f=window.fetch;window.fetch=function(u){u=String(u);"
            "if(/api\\/players\\/p\\//.test(u)){var id=u.split('/').pop();var r=rows.filter(function(x){return x.pid===id})[0];return Promise.resolve(new Response(JSON.stringify(r?{player:r}:{error:'Not found'}),{status:r?200:404}))}"
            "if(/api\\/players/.test(u)){var xs=rows.slice();if(/sort=recent/.test(u))xs.sort(function(a,b){return b.last-a.last});return Promise.resolve(new Response(JSON.stringify({total:xs.length,updated:now,players:xs.map(function(r,i){return Object.assign({},r,{rank:i+1})})}),{status:200}))}"
            "return f.apply(this,arguments)}})();</script>")
    pv = page.replace("<!-- PAGE-BODY:START -->", "<!-- PAGE-BODY:START -->\n" + stub, 1)
    pv = pv.replace("<title>MEIOCG Players", "<title>Preview · MEIOCG Players", 1)
    out.write_text(pv, "utf-8")
    print("preview", out)
