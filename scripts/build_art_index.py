#!/usr/bin/env python3
"""Build scan/art.json: a 64-bit artwork fingerprint (pHash) for every card image.

The KodeX app's card scanner compares a photo's artwork against these to
recognise a card by its picture (any language). The hash must match
scan/arthash.js exactly: grey -> 32x32 cell averages -> 8x8 DCT -> median.

Images are the cropped artworks from YGOPRODeck (one per artwork, so alternate
arts are included). They are cached in .art-cache/ so later runs only download
new cards.  Usage: python3 scripts/build_art_index.py [--limit N] [--cache DIR]
"""
import argparse
import concurrent.futures as cf
import io
import json
import math
import time
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "cards.min.json"
OUT = ROOT / "scan" / "art.json"
N = 32
COS = [[math.cos(((2 * x + 1) * u * math.pi) / (2 * N)) for x in range(N)] for u in range(8)]


def gray_cells(img):
    img = img.convert("RGB")
    w, h = img.size
    px = img.load()
    out = [0.0] * (N * N)
    for cy in range(N):
        y0 = (cy * h) // N
        y1 = max(y0 + 1, ((cy + 1) * h) // N)
        for cx in range(N):
            x0 = (cx * w) // N
            x1 = max(x0 + 1, ((cx + 1) * w) // N)
            s = 0.0
            for y in range(y0, y1):
                for x in range(x0, x1):
                    r, g, b = px[x, y]
                    s += 0.299 * r + 0.587 * g + 0.114 * b
            out[cy * N + cx] = s / ((y1 - y0) * (x1 - x0))
    return out


def phash_cells(g):
    rows = [[sum(g[y * N + x] * COS[u][x] for x in range(N)) for u in range(8)] for y in range(N)]
    f = [0.0] * 64
    for v in range(8):
        for u in range(8):
            f[v * 8 + u] = sum(rows[y][u] * COS[v][y] for y in range(N))
    ac = sorted(f[1:])
    median = (ac[31] + ac[32]) / 2
    hi = lo = 0
    for k in range(1, 64):
        if f[k] > median:
            if k < 32:
                hi |= 1 << (31 - k)
            else:
                lo |= 1 << (63 - k)
    return f"{hi:08x}{lo:08x}"


def phash_image(img):
    # Shrink first (area average) so the pure-Python cell averaging stays fast.
    if img.width > 128 or img.height > 128:
        img = img.convert("RGB").resize((128, 128), Image.BOX)
    return phash_cells(gray_cells(img))


def fetch(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "MEIOCG-KodeX-ArtIndex/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2 * (i + 1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--cache", default=str(ROOT / ".art-cache"))
    ap.add_argument("--workers", type=int, default=8)
    a = ap.parse_args()
    cache = Path(a.cache)
    cache.mkdir(parents=True, exist_ok=True)
    raw = json.loads(SRC.read_text(encoding="utf-8"))
    cards = raw.get("data", raw) if isinstance(raw, dict) else raw
    jobs = []
    for c in cards:
        t = f"{c.get('type', '')} {c.get('frameType', '')}".lower()
        if "skill" in t or "token" in t:
            continue
        for im in c.get("card_images") or []:
            if isinstance(im.get("id"), int) and im.get("image_url_cropped"):
                jobs.append((im["id"], im["image_url_cropped"]))
    if a.limit:
        jobs = jobs[: a.limit]

    def one(job):
        iid, url = job
        f = cache / f"{iid}.jpg"
        if not f.exists() or f.stat().st_size == 0:
            f.write_bytes(fetch(url))
        return iid, phash_image(Image.open(io.BytesIO(f.read_bytes())))

    ids, hashes, failed = [], [], []
    with cf.ThreadPoolExecutor(a.workers) as ex:
        futs = {ex.submit(one, j): j for j in jobs}
        for i, fu in enumerate(cf.as_completed(futs), 1):
            try:
                iid, h = fu.result()
                ids.append(iid)
                hashes.append(h)
            except Exception as e:
                failed.append((futs[fu][0], str(e)[:80]))
            if i % 1000 == 0:
                print(f"  {i}/{len(jobs)}", flush=True)
    order = sorted(range(len(ids)), key=lambda i: ids[i])
    out = {"v": 1, "bits": 64, "count": len(ids), "ids": [ids[i] for i in order], "h": "".join(hashes[i] for i in order)}
    OUT.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"Built art index: {len(ids)} artworks ({len(failed)} failed) -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")
    for iid, err in failed[:10]:
        print("  failed", iid, err)
    if not a.limit and len(ids) < 10000:
        raise SystemExit("Too few artworks hashed")


if __name__ == "__main__":
    main()
