#!/usr/bin/env python3
"""Builds KodeX_Editor.html (the KodeX Master Editor): sponsor banners (free edition), skins (Premium), and the master
tools: every source module to edit with a live phone/browser view, diagnostics, and config. The newest free and
Premium KodeX pages and all app/src modules are inside.

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
# the master tools: the source modules, and the tools' own markup, style and script
src = {"manifest": man, "editions": json.loads((ROOT / "app/src/editions.json").read_text("utf-8")),
       "files": {f["file"]: (ROOT / "app/src" / f["file"]).read_text("utf-8") for f in man["files"]}}
src_json = json.dumps(src, ensure_ascii=False).replace("<", "\\u003c")
out = (out.replace("%%MASTER_HTML%%", (ROOT / "scripts/editor.master.html").read_text("utf-8"))
          .replace("%%MASTER_CSS%%", (ROOT / "scripts/editor.master.css").read_text("utf-8"))
          .replace("%%MASTER_JS%%", (ROOT / "scripts/editor.master.js").read_text("utf-8").replace("</script", "<\\/script"))
          .replace("%%SRC_JSON%%", src_json))
assert not any(k in out for k in ("%%FREE_B64%%", "%%PREM_B64%%", "%%DEFAULT_BANNERS%%", "%%MASTER_HTML%%", "%%MASTER_CSS%%", "%%MASTER_JS%%", "%%SRC_JSON%%"))
dst = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "KodeX_Editor.html")
dst.write_text(out, "utf-8")
print(dst, f"{len(out)/1048576:.1f} MB", f"(KodeX v{v})")
