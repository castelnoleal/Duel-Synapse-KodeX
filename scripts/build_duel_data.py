#!/usr/bin/env python3
"""Build the Duel Synapse online-duel data files from Project Ignis sources.

Inputs (clone these first, shallow is fine):
  --babel    https://github.com/ProjectIgnis/BabelCDB       (card databases, *.cdb)
  --scripts  https://github.com/ProjectIgnis/CardScripts    (Lua card scripts)
  --strings  https://github.com/ProjectIgnis/Distribution   config/strings.conf

Outputs in duel/data/:
  cards.json    engine stats + names/texts/prompt strings for every official card
  strings.json  system/victory/counter/setname strings used by the duel UI
  scripts.json  which cards have a script, where, and which other scripts each one needs

Scripts are not copied: the duel client fetches them on demand (through the Worker)
from the pinned CardScripts commit recorded in scripts.json.
"""
import argparse, json, os, re, sqlite3, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument("--babel", required=True)
ap.add_argument("--scripts", required=True)
ap.add_argument("--strings", required=True, help="path to strings.conf")
ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "duel", "data"))
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)

def rev(path):
    try:
        return subprocess.check_output(["git", "-C", path, "rev-parse", "HEAD"], text=True).strip()
    except Exception:
        return ""

# Official + release/prerelease databases (no Rush, skills, goat or unofficial).
dbs = ["cards.cdb"] + sorted(f for f in os.listdir(a.babel)
                             if f.endswith(".cdb") and (f.startswith("release-") or f.startswith("prerelease-"))
                             and "rush" not in f)
cards = {}
for db in dbs:
    con = sqlite3.connect(os.path.join(a.babel, db))
    q = ("select d.id,d.ot,d.alias,d.setcode,d.type,d.atk,d.def,d.level,d.race,d.attribute,d.category,"
         "t.name,t.desc," + ",".join(f"t.str{i}" for i in range(1, 17)) +
         " from datas d join texts t on t.id=d.id")
    for r in con.execute(q):
        code, ot, alias, setcode, typ, atk, df, level, race, attr, cat = r[:11]
        name, desc = r[11], r[12]
        strs = list(r[13:29])
        while strs and not strs[-1]:
            strs.pop()
        setcodes = [(setcode >> (16 * i)) & 0xFFFF for i in range(4)]
        setcodes = [s for s in setcodes if s]
        lv = level & 0xFF
        lscale = (level >> 24) & 0xFF
        rscale = (level >> 16) & 0xFF
        link = 0
        if typ & 0x4000000:  # TYPE_LINK: DEF column stores link arrows
            link, df = df, 0
        # [alias, setcodes, type, level, attribute, race, atk, def, lscale, rscale, linkmarker, ot, name, desc, strings]
        cards[code] = [alias, setcodes, typ, lv, attr, race, atk, df, lscale, rscale, link, ot, name or "", desc or "", strs]
    con.close()

with open(os.path.join(a.out, "cards.json"), "w", encoding="utf-8") as f:
    json.dump({"v": 1, "source": "ProjectIgnis/BabelCDB@" + rev(a.babel), "cards": cards}, f,
              ensure_ascii=False, separators=(",", ":"))

# System strings
strings = {"system": {}, "victory": {}, "counter": {}, "setname": {}}
with open(a.strings, encoding="utf-8") as f:
    for line in f:
        m = re.match(r"^!(system|victory|counter|setname)\s+(0x[0-9a-fA-F]+|\d+)\s+(.*)$", line.rstrip("\n"))
        if m:
            strings[m.group(1)][str(int(m.group(2), 0))] = m.group(3).split("\t")[0].strip()
with open(os.path.join(a.out, "strings.json"), "w", encoding="utf-8") as f:
    json.dump(strings, f, ensure_ascii=False, separators=(",", ":"))

# Scripts index + dependency graph
where = {}
for folder in ("official", "pre-release"):
    d = os.path.join(a.scripts, folder)
    for fn in os.listdir(d):
        m = re.match(r"^c(\d+)\.lua$", fn)
        if m:
            where.setdefault(int(m.group(1)), folder)
utility = sorted(fn for fn in os.listdir(a.scripts) if fn.endswith(".lua"))
# utility.lua also loads these helpers from the unofficial folder.
utility += [f"unofficial/{fn}" for fn in ("proc_unofficial.lua", "rankup_functions.lua") if os.path.exists(os.path.join(a.scripts, "unofficial", fn))]
num = re.compile(r"(?<![\w.])(\d{4,10})(?![\w])")
# Named card constants (CARD_DARK_MAGICIAN = 46986414, ...) from the utility scripts.
consts = {}
for fn in utility:
    with open(os.path.join(a.scripts, fn), encoding="utf-8", errors="replace") as f:
        for m in re.finditer(r"^\s*(CARD_[A-Z0-9_]+)\s*=\s*(\d+)", f.read(), re.M):
            consts[m.group(1)] = int(m.group(2))
cref = re.compile(r"\b(CARD_[A-Z0-9_]+)\b")
deps = {}
for code, folder in where.items():
    with open(os.path.join(a.scripts, folder, f"c{code}.lua"), encoding="utf-8", errors="replace") as f:
        src = f.read()
    found = set()
    for m in num.finditer(src):
        n = int(m.group(1))
        if n != code and n in where:
            found.add(n)
    for m in cref.finditer(src):
        n = consts.get(m.group(1))
        if n and n != code and n in where:
            found.add(n)
    for m in re.finditer(r"LoadScript\(\s*[\"']c(\d+)\.lua", src):
        n = int(m.group(1))
        if n in where:
            found.add(n)
    if found:
        deps[code] = sorted(found)
pre = sorted(c for c, w in where.items() if w == "pre-release")
with open(os.path.join(a.out, "scripts.json"), "w", encoding="utf-8") as f:
    json.dump({"repo": "ProjectIgnis/CardScripts", "commit": rev(a.scripts), "utility": utility,
               "prerelease": pre, "official": sorted(c for c, w in where.items() if w == "official"),
               "deps": deps}, f, separators=(",", ":"))

print(f"cards: {len(cards)}  scripts: {len(where)}  with deps: {len(deps)}  utility: {len(utility)}")
