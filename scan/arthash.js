/* KodeX card scanner: recognise a card by its artwork.
 *
 * Each card's artwork gets a 64-bit perceptual hash (pHash): the picture is
 * turned grey, averaged down to 32×32, transformed with a DCT, and the 63
 * lowest frequencies (without the overall brightness) are compared with their
 * median. Similar pictures give hashes that differ in few bits, even with a
 * different camera, lighting, blur or JPEG quality, and whatever the card's
 * language, since the artwork is the same.
 *
 * scripts/build_art_index.py computes the same hash in Python for every
 * card image and writes scan/art.json. This file is used by the KodeX app and by
 * tests (Node: module.exports, browser: window.KodexArt).
 */
(function (root) {
  "use strict";
  const N = 32;

  /** Grey levels (0-255) averaged down to N×N cells from RGBA pixels. */
  function grayCells(rgba, width, height) {
    const out = new Float64Array(N * N);
    for (let cy = 0; cy < N; cy++) {
      const y0 = Math.floor((cy * height) / N), y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * height) / N));
      for (let cx = 0; cx < N; cx++) {
        const x0 = Math.floor((cx * width) / N), x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * width) / N));
        let sum = 0, n = 0;
        for (let y = y0; y < y1; y++) {
          let i = (y * width + x0) * 4;
          for (let x = x0; x < x1; x++, i += 4) { sum += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]; n++; }
        }
        out[cy * N + cx] = sum / n;
      }
    }
    return out;
  }

  const COS = (() => { const c = new Float64Array(8 * N); for (let u = 0; u < 8; u++) for (let x = 0; x < N; x++) c[u * N + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)); return c; })();

  /** 64-bit pHash of N×N grey cells, as [hi, lo] 32-bit unsigned integers. */
  function phashCells(g) {
    // Separable DCT, keeping only the 8×8 lowest frequencies.
    const rows = new Float64Array(N * 8);
    for (let y = 0; y < N; y++) for (let u = 0; u < 8; u++) { let s = 0; for (let x = 0; x < N; x++) s += g[y * N + x] * COS[u * N + x]; rows[y * 8 + u] = s; }
    const f = new Float64Array(64);
    for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) { let s = 0; for (let y = 0; y < N; y++) s += rows[y * 8 + u] * COS[v * N + y]; f[v * 8 + u] = s; }
    const ac = Array.from(f).slice(1).sort((a, b) => a - b);
    const median = (ac[31] + ac[32]) / 2; // 63 values: the middle one, averaged with its neighbour for stability
    let hi = 0, lo = 0;
    for (let k = 1; k < 64; k++) {
      if (f[k] > median) { if (k < 32) hi |= 1 << (31 - k); else lo |= 1 << (63 - k); }
    }
    return [hi >>> 0, lo >>> 0];
  }

  const phashRGBA = (rgba, w, h) => phashCells(grayCells(rgba, w, h));
  const toHex = ([hi, lo]) => hi.toString(16).padStart(8, "0") + lo.toString(16).padStart(8, "0");
  const fromHex = (s) => [parseInt(s.slice(0, 8), 16) >>> 0, parseInt(s.slice(8, 16), 16) >>> 0];
  function popcount(x) { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; }

  /** Loads scan/art.json: {v, ids:[passcode...], h:"hex hex hex..."} into typed arrays. */
  function buildArtIndex(json) {
    const ids = json.ids, n = ids.length, hi = new Uint32Array(n), lo = new Uint32Array(n);
    const h = json.h;
    for (let i = 0; i < n; i++) { hi[i] = parseInt(h.substr(i * 16, 8), 16) >>> 0; lo[i] = parseInt(h.substr(i * 16 + 8, 8), 16) >>> 0; }
    return { ids, hi, lo, n };
  }

  /**
   * Best artwork matches for one or more query hashes (e.g. several crops of the same photo).
   * Returns [{id, d}] sorted by distance, one entry per passcode.
   */
  function nearest(index, queries, limit = 8) {
    const best = new Map();
    for (const [qh, ql] of queries) {
      for (let i = 0; i < index.n; i++) {
        const d = popcount((index.hi[i] ^ qh) >>> 0) + popcount((index.lo[i] ^ ql) >>> 0);
        if (d <= 24) { const id = index.ids[i], prev = best.get(id); if (prev === undefined || d < prev) best.set(id, d); }
      }
    }
    return [...best.entries()].map(([id, d]) => ({ id, d })).sort((a, b) => a.d - b.d).slice(0, limit);
  }

  /** Is the top match clearly the card? Close in absolute terms and well ahead of the next card. */
  function confident(matches, sameCard = (a, b) => a === b) {
    if (!matches.length) return false;
    const [a] = matches, b = matches.find((m) => !sameCard(m.id, a.id));
    const gap = b ? b.d - a.d : 64;
    return (a.d <= 6 && gap >= 3) || (a.d <= 10 && gap >= 6) || (a.d <= 13 && gap >= 9);
  }

  // Where the artwork sits on a card (fractions of the card's width/height): normal and Pendulum frames.
  const ART_CROPS = [{ x: 0.119, y: 0.181, w: 0.762, h: 0.523 }, { x: 0.066, y: 0.181, w: 0.868, h: 0.44 }];
  const SHIFTS = [-0.02, 0, 0.02];

  /**
   * Hashes of a card photo's artwork (browser only). The card is the whole canvas; framing is never
   * exact, so it hashes slightly shifted and zoomed crops and keeps the best match of any of them.
   */
  function queriesFromCard(card, { quick = false } = {}) {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.imageSmoothingQuality = "high";
    const W = card.width, H = card.height, out = [];
    for (const crop of ART_CROPS) {
      for (const dx of quick ? [0] : SHIFTS) for (const dy of quick ? [0] : SHIFTS) for (const s of quick ? [1] : [1, 0.95]) {
        const w = crop.w * s, h = crop.h * s, cx = crop.x + crop.w / 2 + dx, cy = crop.y + crop.h / 2 + dy;
        x.drawImage(card, (cx - w / 2) * W, (cy - h / 2) * H, w * W, h * H, 0, 0, 128, 128);
        out.push(phashRGBA(x.getImageData(0, 0, 128, 128).data, 128, 128));
      }
    }
    return out;
  }

  const api = { N, grayCells, phashCells, phashRGBA, toHex, fromHex, popcount, buildArtIndex, nearest, confident, queriesFromCard, ART_CROPS };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KodexArt = api;
})(typeof self !== "undefined" ? self : this);
