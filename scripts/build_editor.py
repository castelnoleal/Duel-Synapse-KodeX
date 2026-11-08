#!/usr/bin/env python3
"""Builds KodeX_Editor.html: one tool for sponsor banners (free edition) and skins (Premium), with the newest free and
Premium KodeX pages inside. Replaces the separate Sponsor and Skin Injectors.

  python3 scripts/build_editor.py [OUT]    (default: KodeX_Editor.html in the current folder)

Created by Castel Noleal, creator of MEIOCG.
"""
import base64, json, re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
man = json.loads((ROOT / "app/src/manifest.json").read_text("utf-8"))
v = man["version"]
free = (ROOT / f"app/Kodex_Mei_Production_v{v}.html").read_bytes()
prem = (ROOT / f"app/Kodex_Mei_Premium_v{v}.html").read_bytes()
tpl = (ROOT / "scripts/editor.template.html").read_text("utf-8")
banners = (ROOT / "scripts/editor_default_banners.json").read_text("utf-8").strip()
out = (tpl.replace("%%FREE_B64%%", base64.b64encode(free).decode())
          .replace("%%PREM_B64%%", base64.b64encode(prem).decode())
          .replace("%%DEFAULT_BANNERS%%", banners.replace("</", "<\\/")))
assert "%%" not in out
dst = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "KodeX_Editor.html")
dst.write_text(out, "utf-8")
print(dst, f"{len(out)/1048576:.1f} MB", f"(KodeX v{v})")
