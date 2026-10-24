#!/usr/bin/env python3
"""
MEIOCG Database updater.

Downloads the complete English Yu-Gi-Oh! card dataset from YGOPRODeck v7,
creates compact lookup indexes, and updates metadata.

Usage:
  python scripts/update_database.py

Optional image download:
  python scripts/update_database.py --download-images
"""

import argparse
import hashlib
import json
import re
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# misc=yes includes misc_info (Konami IDs, release dates); KodeX needs it to find rulings.
API = "https://db.ygoprodeck.com/api/v7/cardinfo.php?misc=yes"
VERSION_API = "https://db.ygoprodeck.com/api/v7/checkDBVer.php"
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
INDEXES = ROOT / "indexes"
IMAGES = ROOT / "images"

def fetch_json(url):
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "MEIOCG-Database-Updater/1.0"}
    )
    with urllib.request.urlopen(req, timeout=120) as response:
        return json.loads(response.read())

def normalize(text):
    text = (text or "").lower().strip()
    return re.sub(r"\s+", " ", text)

def write_json(path, obj, compact=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        if compact:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(obj, f, ensure_ascii=False, indent=2)

def build_indexes(cards):
    by_name = {}
    by_id = {}
    by_archetype = {}
    by_type = {}

    for card in cards:
        cid = str(card["id"])
        name = card.get("name", "")
        by_id[cid] = {
            "id": card["id"],
            "name": name
        }

        key = normalize(name)
        if key:
            by_name.setdefault(key, []).append(card["id"])

        archetype = card.get("archetype")
        if archetype:
            by_archetype.setdefault(archetype, []).append(card["id"])

        ctype = card.get("type")
        if ctype:
            by_type.setdefault(ctype, []).append(card["id"])

    return by_name, by_id, by_archetype, by_type

def download_images(cards):
    # Conservative: one request at a time with a delay.
    target = IMAGES / "cards"
    target.mkdir(parents=True, exist_ok=True)
    downloaded = 0
    skipped = 0

    for card in cards:
        for image in card.get("card_images", []):
            cid = str(image["id"])
            dest = target / f"{cid}.jpg"
            if dest.exists():
                skipped += 1
                continue

            url = image["image_url"]
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "MEIOCG-Database-Updater/1.0"}
            )
            try:
                with urllib.request.urlopen(req, timeout=60) as response:
                    dest.write_bytes(response.read())
                downloaded += 1
                time.sleep(0.15)
            except Exception as exc:
                print(f"Image failed {cid}: {exc}")

    print(f"Images downloaded: {downloaded}; already present: {skipped}")
    return downloaded + skipped

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--download-images", action="store_true")
    args = parser.parse_args()

    DATA.mkdir(parents=True, exist_ok=True)
    INDEXES.mkdir(parents=True, exist_ok=True)

    print("Checking YGOPRODeck database version...")
    source_version = fetch_json(VERSION_API)

    print("Downloading complete English card database...")
    payload = fetch_json(API)
    cards = payload.get("data", [])

    if not cards:
        raise RuntimeError("No cards were returned. Database update aborted.")

    # Preserve the complete upstream card objects.
    write_json(DATA / "cards.json", cards)
    write_json(DATA / "cards.min.json", cards, compact=True)

    by_name, by_id, by_archetype, by_type = build_indexes(cards)
    write_json(INDEXES / "name.json", by_name)
    write_json(INDEXES / "id.json", by_id)
    write_json(INDEXES / "archetype.json", by_archetype)
    write_json(INDEXES / "type.json", by_type)

    image_count = sum(len(c.get("card_images", [])) for c in cards)
    if args.download_images:
        image_count = download_images(cards)

    cards_path = DATA / "cards.json"
    sha256 = hashlib.sha256(cards_path.read_bytes()).hexdigest()
    now = datetime.now(timezone.utc).isoformat()

    metadata = {
        "database": "MEIOCG-Database",
        "version": "1.0.0",
        "schema_version": 1,
        "status": "populated",
        "last_import_utc": now,
        "source": {
            "name": "YGOPRODeck API",
            "api_version": "v7",
            "database_version": source_version
        },
        "card_count": len(cards),
        "image_count": image_count,
        "cards_sha256": sha256,
        "files": {
            "full": "data/cards.json",
            "compact": "data/cards.min.json",
            "name_index": "indexes/name.json",
            "id_index": "indexes/id.json",
            "archetype_index": "indexes/archetype.json",
            "type_index": "indexes/type.json"
        }
    }

    write_json(DATA / "metadata.json", metadata)

    print(f"Database updated successfully: {len(cards)} cards")
    print(f"Source database version: {source_version}")
    print(f"SHA-256: {sha256}")

if __name__ == "__main__":
    main()
