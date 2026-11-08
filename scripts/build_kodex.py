#!/usr/bin/env python3
"""KodeX source, one module per file.

KodeX ships as one HTML page (index.html in the app ZIP). Its source lives in app/src/ as numbered files, one per
module: the page's HTML, each stylesheet and each script, with the main script cut into its sections. The build
joins them back, in order, into the exact page; the Premium edition is the same page plus the changes in
app/src/editions.json.

  python3 scripts/build_kodex.py build                 -> app/Kodex_Mei_Production_vNN.html and app/Kodex_Mei_Premium_vNN.html
  python3 scripts/build_kodex.py build --check         -> builds in memory and compares with the files in app/
  python3 scripts/build_kodex.py split app/Kodex_Mei_Production_vNN.html   -> (re)creates app/src/ from a built page

The version (vNN) and build numbers come from app/src/manifest.json. See app/BLUEPRINT.md.
KodeX is created by Castel Noleal, creator of MEIOCG (Meta Insider OCG).
"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "app/src"
SECTION = re.compile(r"^/\* -{3,} (.+?) -{3,} \*/$", re.M)   # "/* ---------- search + filters ---------- */"


def slug(s, n=40):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return (s[:n].rstrip("-") or "part")


def name_for(kind, attrs, body):
    m = re.search(r'id="([^"]+)"', attrs)
    if m:
        return slug(m.group(1))
    c = re.match(r"\s*/\*+\s*(?:-+\s*)?(.+?)(?:\s*-+)?\s*(?:\*/|\n)", body)
    if c:
        return slug(c.group(1))
    if "'use strict'" in body[:40]:
        return "core"
    return kind


def split(page_path):
    s = pathlib.Path(page_path).read_text("utf-8")
    parts, pos, n = [], 0, 0
    for m in re.finditer(r"<(style|script)\b([^>]*)>", s):
        if m.start() < pos:
            continue
        kind = m.group(1)
        end = s.find(f"</{kind}>", m.end())
        if m.start() > pos:
            parts.append({"kind": "html", "text": s[pos:m.start()]})
        body, close = s[m.end():end], f"</{kind}>"
        ext = "css" if kind == "style" else ("json" if "application/json" in m.group(2) else "js")
        nm = name_for(kind, m.group(2), body)
        # the main script: one file per section
        cuts = [c.start() for c in SECTION.finditer(body)] if len(body) > 50000 and ext == "js" else []
        if cuts:
            pieces, starts = [], [0] + cuts
            for i, a in enumerate(starts):
                b = starts[i + 1] if i + 1 < len(starts) else len(body)
                sec = SECTION.match(body, a)
                pieces.append((slug(sec.group(1)) if sec else "setup", body[a:b]))
            for i, (pn, txt) in enumerate(pieces):
                parts.append({"kind": ext, "name": f"{nm}-{i:02d}-{pn}", "text": txt,
                              "open": m.group(0) if i == 0 else "", "close": close if i == len(pieces) - 1 else ""})
        else:
            parts.append({"kind": ext, "name": nm, "text": body, "open": m.group(0), "close": close})
        pos = end + len(close)
    if pos < len(s):
        parts.append({"kind": "html", "text": s[pos:]})
    SRC.mkdir(parents=True, exist_ok=True)
    for f in SRC.glob("[0-9]*"):
        f.unlink()
    files, used = [], set()
    for i, p in enumerate(parts):
        nm = p.get("name") or ("page" if i == 0 else "html")
        base = f"{(i + 1) * 10:04d}-{nm}"
        while base in used:
            base += "-x"
        used.add(base)
        fn = f"{base}.{p['kind']}"
        (SRC / fn).write_text(p["text"], "utf-8")
        files.append({"file": fn, "open": p.get("open", ""), "close": p.get("close", "")})
    build = re.search(r'name="kodex-build" content="KODEX-([\d.]+)"', s).group(1)
    ver = re.search(r"_v(\d+)\.html$", str(page_path))
    man = {"about": "KodeX source: files are joined in this order. 'open'/'close' are the <style>/<script> tags around a file. "
                    "Created by Castel Noleal, creator of MEIOCG. See app/BLUEPRINT.md.",
           "version": int(ver.group(1)) if ver else 0, "build": build, "files": files}
    (SRC / "manifest.json").write_text(json.dumps(man, indent=1, ensure_ascii=False) + "\n", "utf-8")
    print(f"split into {len(files)} files in {SRC}")


def assemble():
    man = json.loads((SRC / "manifest.json").read_text("utf-8"))
    out = []
    for f in man["files"]:
        out.append(f.get("open", "") + (SRC / f["file"]).read_text("utf-8") + f.get("close", ""))
    free = "".join(out)
    ed = json.loads((SRC / "editions.json").read_text("utf-8"))
    prem = free
    for old, new in ed["premium"]:
        old = old.replace("{build}", man["build"]); new = new.replace("{build}", man["build"])
        if prem.count(old) != 1:
            raise SystemExit(f"editions.json: '{old[:60]}' must appear exactly once (found {prem.count(old)})")
        prem = prem.replace(old, new)
    return man, free, prem


def build(check=False):
    man, free, prem = assemble()
    v = man["version"]
    targets = {ROOT / f"app/Kodex_Mei_Production_v{v}.html": free, ROOT / f"app/Kodex_Mei_Premium_v{v}.html": prem}
    bad = 0
    for p, text in targets.items():
        if check:
            same = p.exists() and p.read_text("utf-8") == text
            print(("same     " if same else "DIFFERENT"), p.name); bad += not same
        else:
            p.write_text(text, "utf-8"); print("wrote", p.name, len(text))
    if bad:
        sys.exit(1)


if __name__ == "__main__":
    a = sys.argv[1:]
    if not a or a[0] not in ("build", "split"):
        print(__doc__); sys.exit(2)
    if a[0] == "split":
        split(a[1])
    else:
        build("--check" in a)
