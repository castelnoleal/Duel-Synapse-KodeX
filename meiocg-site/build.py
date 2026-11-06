"""Builds the MEIOCG deck pages for DashNex: out/<page>/head.html, body.html, seo.txt (+ preview/<page>.html).
DashNex strips CSS variables, collapses whitespace and mangles large inline scripts, so CSS and JS ship as
base64 loaders (same approach as the Price Guide pages)."""
import base64, json, re, sys, unicodedata
from pathlib import Path

R = Path(__file__).resolve().parent
sys.path.insert(0, str(R))
import content as C
from decks_raw import DECKS as RAW

KODEX = R.parent
cards = json.load(open(KODEX / "data/cards.min.json"))
JP = {int(k): v for k, v in json.load(open(R / "data/jpnames.json", encoding="utf-8")).items()}
by_id, by_name = {}, {}
for c in cards:
    by_id[c["id"]] = c
    by_name[c["name"]] = c
    for im in c.get("card_images") or []:
        by_id.setdefault(im["id"], c)

def nj(s):
    s = unicodedata.normalize("NFKC", s or "")
    s = re.sub(r"[\s・·]", "", s)
    s = re.sub(r"[－‐‑–—]", "-", s)
    return s.lower()

def kid(c):
    m = c.get("misc_info") or [{}]
    return m[0].get("konami_id")

def group(c):
    t = c.get("type", "")
    if "Spell" in t: return "Spell"
    if "Trap" in t: return "Trap"
    return "Monster"

def short_type(c):
    t = c.get("humanReadableCardType") or c.get("type", "")
    return t.replace(" Card", "").replace(" Monster", "")

# ---- validate every [[Card Name]] in the content ----
missing = set()
def names_in(obj):
    out = set()
    if isinstance(obj, str):
        out |= set(re.findall(r"\[\[(.+?)\]\]", obj))
    elif isinstance(obj, dict):
        for v in obj.values(): out |= names_in(v)
    elif isinstance(obj, (list, tuple)):
        for v in obj: out |= names_in(v)
    return out

def ids_for(obj):
    ids = {}
    for n in names_in(obj):
        c = by_name.get(n)
        if not c: missing.add(n); continue
        ids[n] = c["id"]
    return dict(sorted(ids.items()))

def deck_list(raw):
    L = {}
    for z in ("main", "extra", "side"):
        rows = []
        for pid, q in raw[z].items():
            c = by_id[pid]
            ban = (c.get("banlist_info") or {}).get("ban_ocg", "")
            j = JP.get(kid(c))
            rows.append([c["id"], c["name"], q, group(c) + " · " + short_type(c) if z == "main" else short_type(c), ban, nj(j) if j else ""])
        if z == "main":
            order = {"Monster": 0, "Spell": 1, "Trap": 2}
            rows.sort(key=lambda r: order[r[3].split(" · ")[0]])
        L[z] = rows
    return L

B = lambda s: base64.b64encode(s.encode("utf-8")).decode()
DEC = "function(b){return new TextDecoder().decode(Uint8Array.from(atob(b),function(c){return c.charCodeAt(0)}))}"
CSS = (R / "src/mdk.css").read_text("utf-8")
JS = (R / "src/mdk.js").read_text("utf-8")
OG = "https://kodex.meiocg.org/og/"

def head_html(title, desc, url, og_img, ld):
    e = lambda s: s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;")
    meta = (f'<meta name="description" content="{e(desc)}">'
            f'<link rel="canonical" href="{url}">'
            f'<meta property="og:type" content="article"><meta property="og:site_name" content="Meta Insider OCG">'
            f'<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}">'
            f'<meta property="og:url" content="{url}"><meta property="og:image" content="{og_img}">'
            f'<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
            f'<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="{e(title)}">'
            f'<meta name="twitter:description" content="{e(desc)}"><meta name="twitter:image" content="{og_img}">'
            f'<meta property="article:modified_time" content="{C.UPDATED}">'
            f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>')
    loader = f'<script>(function(){{var d={DEC};if(document.getElementById("mdk-css"))return;var s=document.createElement("style");s.id="mdk-css";s.textContent=d("{B(CSS)}");document.head.appendChild(s)}})();</script>'
    return meta + loader

def body_html(data):
    payload = "window.MDK=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n" + JS
    return f'<div id="mdk"></div><script>(function(){{var d={DEC};var s=document.createElement("script");s.textContent=d("{B(payload)}");document.body.appendChild(s)}})();</script>'

def faq_ld(faq):
    strip = lambda s: re.sub(r"\[\[(.+?)\]\]", r"\1", s).replace("**", "")
    return {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": strip(a)}} for q, a in faq]}

pages = {}
deck_meta = {"light-and-darkness-ritual": 15.8, "ars-magna-elfnote": 11.8, "raise-moon": 10.5}
for slug, d in C.DECKS.items():
    L = deck_list(RAW[slug])
    data = dict(kind="deck", slug=slug, name=d["name"], label=d["label"], metaLine=d["metaLine"], readMin=d["readMin"], lead=d["lead"],
                updated=C.UPDATED, banlist=C.BANLIST, source=dict(text=d["source"]["text"] + f' [Source list]({d["source"]["url"]})'),
                how=d["how"], line=d["line"], duel=d["duel"], board=d["board"], stopIntro=d.get("stopIntro"), stops=d["stops"],
                takeaways=d["takeaways"], second=d["second"], practice=d["practice"], faq=d["faq"], list=L)
    others = [k for k in C.DECKS if k != slug]
    data["more"] = [dict(k="OCG meta", t="All meta decks", d="Share of top decks and the full list.", href=C.URL("hub"))] + \
                   [dict(k="Meta deck", t=C.DECKS[k]["name"], d=C.DECKS[k]["metaLine"], href=C.URL(k)) for k in others[:1]] + \
                   [dict(k="KodeX", t="Why KodeX", d="Rulings, deck tools and the Duel Synapse Arena.", href=C.URL("why"))]
    data["ids"] = ids_for(data)
    title = f'{d["name"]} OCG Deck: Combos & How to Beat It ({C.PERIOD.split("–")[1].strip().split(",")[0].split(" ")[0]} 2026) | Meta Insider OCG'
    desc = f'How {d["name"]} wins in the OCG, the hand traps that stop it, how to play going second, and a legal winning decklist with today\'s Yuyu-tei price.'
    url = C.URL(slug)
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Article", "headline": f'{d["name"]}: how it plays, and how to beat it', "description": desc, "dateModified": C.UPDATED, "datePublished": C.UPDATED,
         "author": {"@type": "Organization", "name": "Meta Insider OCG", "url": C.SITE}, "publisher": {"@type": "Organization", "name": "Meta Insider OCG"},
         "image": OG + slug + ".png", "mainEntityOfPage": url}, faq_ld(d["faq"])]}
    pages[C.PAGES[slug]] = (title, desc, url, OG + slug + ".png", ld, data)

hub = dict(kind="hub", lead=C.HUB["lead"], updated=C.UPDATED, period=C.PERIOD, source=C.META_SRC, table=C.HUB["table"], practice=C.HUB["practice"],
           decks=[dict(name=C.DECKS[k]["name"], share=deck_meta[k], art=C.DECKS[k]["art"], href=C.URL(k),
                       blurb=C.DECKS[k]["label"][1] + ". " + C.DECKS[k]["lead"].split(". ")[0] + ".") for k in C.DECKS])
hub["ids"] = ids_for(hub)
pages[C.PAGES["hub"]] = ("OCG Meta Decks (November 2026): Tier List, Combos & How to Beat Them | Meta Insider OCG",
                         "The top OCG decks right now, Light and Darkness Ritual, Elfnote and Raise Moon, with how they combo, how to beat them and legal winning lists with prices.",
                         C.URL("hub"), OG + "decks.png",
                         {"@context": "https://schema.org", "@type": "CollectionPage", "name": "OCG Meta Decks", "url": C.URL("hub"), "dateModified": C.UPDATED}, hub)

why = dict(kind="why", lead=C.WHY["lead"], updated=C.UPDATED, what=C.WHY["what"], features=C.WHY["features"], arena=C.WHY["arena"],
           plans=C.WHY["plans"], **{"not": C.WHY["not_"]}, get=C.WHY["get"], faq=C.WHY["faq"])
why["ids"] = ids_for(why)
pages[C.PAGES["why"]] = ("Why KodeX: OCG Card Rulings, Deck Builder, Scanner & Duel Arena | Meta Insider OCG",
                         "KodeX by Meta Insider OCG: OCG card search with official rulings, a card scanner, deck builder with OCG legality check, live prices and the Duel Synapse Arena.",
                         C.URL("why"), OG + "why-kodex.png",
                         {"@context": "https://schema.org", "@graph": [{"@type": "SoftwareApplication", "name": "Duel Synapse: KodeX", "applicationCategory": "GameApplication",
                          "operatingSystem": "Android, Web", "publisher": {"@type": "Organization", "name": "Meta Insider OCG"}, "url": C.URL("why")}, faq_ld(C.WHY["faq"])]}, why)

if missing:
    raise SystemExit("Unknown card names in content: " + ", ".join(sorted(missing)))

# markdown-style [text](url) links inside strings are turned into anchors by the page script? keep it simple: convert here
def links(o):
    if isinstance(o, str): return o
    if isinstance(o, dict): return {k: links(v) for k, v in o.items()}
    if isinstance(o, list): return [links(v) for v in o]
    if isinstance(o, tuple): return [links(v) for v in o]
    return o

out = R / "out"; prev = R / "preview"
out.mkdir(exist_ok=True); prev.mkdir(exist_ok=True)
for page, (title, desc, url, og, ld, data) in pages.items():
    data = links(data)
    h, b = head_html(title, desc, url, og, ld), body_html(data)
    d = out / page; d.mkdir(exist_ok=True)
    (d / "head.html").write_text(h, "utf-8"); (d / "body.html").write_text(b, "utf-8")
    (d / "seo.txt").write_text(f"Page URL: {url}\nTitle: {title}\nDescription: {desc}\nSocial image: {og}\n", "utf-8")
    (prev / f"{page}.html").write_text(f'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{title}</title>{h}<style>body{{margin:0;background:#090b14}}</style></head><body>{b}</body></html>', "utf-8")
    print(f"{page:38s} head {len(h):6d}  body {len(b):6d}")
json.dump({k: v[5].get("name", k) for k, v in pages.items()}, open(R / "out/pages.json", "w"))
