#!/usr/bin/env python3
"""Build scan/cards.json: the compact lookup the card scanner matches against.

Each row is [id, name, set_codes, alternate_ids]:
  id             passcode printed at the bottom-left of the card
  name           English card name
  set_codes      printed set codes such as "LOB-EN001" (from every printing)
  alternate_ids  passcodes of alternate artworks of the same card
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "cards.min.json"
OUT = ROOT / "scan" / "cards.json"

raw = json.loads(SRC.read_text(encoding="utf-8"))
cards = raw.get("data", raw) if isinstance(raw, dict) else raw
if not isinstance(cards, list) or len(cards) < 10000:
    raise SystemExit(f"Unexpected card count: {len(cards) if isinstance(cards, list) else 'not-list'}")

rows = []
for c in cards:
    t = f"{c.get('type', '')} {c.get('frameType', '')}"
    if any(k in t.lower() for k in ("skill", "token")):
        continue
    cid = c.get("id")
    if not isinstance(cid, int):
        continue
    sets = sorted({s.get("set_code", "").strip() for s in (c.get("card_sets") or []) if s.get("set_code")})
    alts = sorted({i.get("id") for i in (c.get("card_images") or []) if isinstance(i.get("id"), int) and i.get("id") != cid})
    rows.append([cid, c.get("name", ""), sets, alts])

rows.sort(key=lambda r: r[1].casefold())
OUT.parent.mkdir(exist_ok=True)
OUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"Built scan index: {len(rows)} cards, {sum(len(r[2]) for r in rows)} set codes -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
assert any(r[1] == "Ash Blossom & Joyous Spring" and r[0] == 14558127 for r in rows)
