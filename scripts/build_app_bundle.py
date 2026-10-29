#!/usr/bin/env python3
"""Builds the KodeX app as a ZIP for instApped, with the Duel Arena inside it (works with no connection).

    python3 scripts/build_app_bundle.py app/Kodex_Mei_Production_v48.html out/KodeX_v48.zip [--cardscripts DIR]

The ZIP holds index.html (the app, marked with <meta name="kodex-arena" content="local">), duel/ (the Arena: UI,
engine, card data) and every card script packed into duel/data/scripts.pack.bin (gzip) + scripts.pack.json.
Without --cardscripts, the CardScripts commit pinned in duel/data/scripts.json is downloaded with git.
"""
import gzip, json, os, re, subprocess, sys, tempfile, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUEL = os.path.join(ROOT, "duel")
KEEP = re.compile(r"^(?:[a-z0-9-]+\.(?:js|css|html)|assets/[a-z0-9-]+\.(?:png|webp)|engine/[a-z0-9-]+\.(?:js|wasm)|engine/build/[a-z0-9_-]+\.(?:cpp|sh)|data/(?:cards|strings|scripts)\.json)$")

def cardscripts(commit, repo, given):
    if given: return given
    d = tempfile.mkdtemp(prefix="cardscripts-")
    run = lambda *a: subprocess.run(["git", "-C", d, *a], check=True, capture_output=True)
    run("init", "-q"); run("remote", "add", "o", f"https://github.com/{repo}")
    run("fetch", "-q", "--depth", "1", "o", commit); run("checkout", "-q", "FETCH_HEAD")
    return d

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    cs = sys.argv[sys.argv.index("--cardscripts") + 1] if "--cardscripts" in sys.argv else None
    if cs in args: args.remove(cs)
    app, out = args
    html = open(app, encoding="utf-8").read()
    if 'name="kodex-arena"' not in html:
        html = html.replace('<meta name="kodex-build"', '<meta name="kodex-arena" content="local">\n<meta name="kodex-build"', 1)
    idx = json.load(open(os.path.join(DUEL, "data", "scripts.json")))
    src = cardscripts(idx["commit"], idx["repo"], cs)
    files = list(idx["utility"]) + [f"official/c{c}.lua" for c in idx["official"]] + [f"pre-release/c{c}.lua" for c in idx["prerelease"]]
    blob, table = bytearray(), {}
    for f in files:
        p = os.path.join(src, f)
        if not os.path.isfile(p): continue
        b = open(p, "rb").read(); table[f] = [len(blob), len(b)]; blob += b
    os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        z.writestr("index.html", html)
        for base, _, names in os.walk(DUEL):
            for n in names:
                rel = os.path.relpath(os.path.join(base, n), DUEL).replace(os.sep, "/")
                if KEEP.match(rel): z.write(os.path.join(base, n), "duel/" + rel)
        z.writestr("duel/data/bundled.json", json.dumps({"scripts": "pack", "commit": idx["commit"]}))
        z.writestr("duel/data/scripts.pack.json", json.dumps({"commit": idx["commit"], "files": table}, separators=(",", ":")))
        z.writestr(zipfile.ZipInfo("duel/data/scripts.pack.bin"), gzip.compress(bytes(blob), 9), compress_type=zipfile.ZIP_STORED)
        z.write(os.path.join(ROOT, "LICENSE.md"), "LICENSE.md")
    print(f"{out}: {os.path.getsize(out) / 1048576:.1f} MB, {len(table)} card scripts")

if __name__ == "__main__":
    main()
