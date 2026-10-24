/* KodeX card scanner: turns text read from a card photo into a card.
 * A card is identified by, in order of reliability:
 *   1. its passcode (8 digits, bottom-left corner)
 *   2. its set code (e.g. "LOB-EN001", under the artwork on the right)
 *   3. its name (top banner), matched approximately because OCR makes mistakes
 * Works in the browser (window.KodexMatch) and in Node (module.exports) for tests.
 */
(function (root) {
  "use strict";

  const normName = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

  // Characters OCR confuses with digits, for fields that only contain digits.
  const DIGIT_FIX = { O: "0", o: "0", Q: "0", D: "0", I: "1", l: "1", i: "1", "|": "1", "!": "1", Z: "2", z: "2", S: "5", s: "5", B: "8", G: "6", b: "6", T: "7", g: "9", q: "9" };
  const toDigits = (s) => String(s || "").replace(/[OoQDIli|!ZzSsBGbTgq]/g, (c) => DIGIT_FIX[c]);

  function setKey(code) {
    const m = /^([A-Z0-9]{2,5})-([A-Z]{0,2})(\d{3})$/.exec(String(code || "").toUpperCase().replace(/\s+/g, ""));
    return m ? m[1] + "-" + m[3] : "";
  }

  function trigrams(s) {
    const t = new Set();
    const x = "  " + s + " ";
    for (let i = 0; i < x.length - 2; i++) t.add(x.slice(i, i + 3));
    return t;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = new Array(b.length + 1), cur = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
      cur[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      [prev, cur] = [cur, prev];
    }
    return prev[b.length];
  }

  /** Builds lookup tables from scan/cards.json rows: [id, name, setCodes, altIds]. */
  function buildIndex(rows) {
    const cards = [], byId = new Map(), bySet = new Map();
    for (const [id, name, sets, alts] of rows) {
      const card = { id, name, n: normName(name), sets: sets || [], alts: alts || [] };
      card.i = cards.length;
      cards.push(card);
      byId.set(id, card);
      for (const a of card.alts) if (!byId.has(a)) byId.set(a, card);
      for (const s of card.sets) {
        const k = setKey(s);
        if (!k) continue;
        if (!bySet.has(k)) bySet.set(k, new Set());
        bySet.get(k).add(card);
      }
    }
    return { cards, byId, bySet, grams: null };
  }

  /** The name search table (trigram → cards), built the first time a name is matched: it takes a moment. */
  function nameGrams(index) {
    if (index.grams) return index.grams;
    const grams = new Map();
    for (const card of index.cards) for (const g of trigrams(card.n)) { if (!grams.has(g)) grams.set(g, []); grams.get(g).push(card.i); }
    return (index.grams = grams);
  }

  /** Similarity in [0,1] between an OCR'd name and a card name (both normalised). */
  function nameSimilarity(read, name) {
    if (!read || !name) return 0;
    if (read === name) return 1;
    const d = levenshtein(read, name);
    let s = 1 - d / Math.max(read.length, name.length);
    // The banner is often cut off on the right: also compare against the card name's prefix.
    if (read.length >= 6 && name.length > read.length) {
      const p = 1 - levenshtein(read, name.slice(0, read.length)) / read.length;
      s = Math.max(s, p * 0.94);
    }
    return Math.max(0, s);
  }

  /** Best name matches for OCR text, highest first: [{card, score}]. */
  /** OCR of shading or artwork gives junk like "iii iii": a real name has a word of 3+ letters with a vowel that isn't one letter repeated. */
  const looksLikeName = (read) => read.split(" ").some((w) => w.length >= 3 && new Set(w).size >= 2 && /[aeiouy]/.test(w));

  function matchName(index, text, limit = 6) {
    const read = normName(text);
    if (read.length < 3 || !looksLikeName(read)) return [];
    const counts = new Map();
    const grams = nameGrams(index);
    for (const g of trigrams(read)) {
      const list = grams.get(g);
      if (!list || list.length > 4000) continue; // very common trigrams don't help
      for (const i of list) counts.set(i, (counts.get(i) || 0) + 1);
    }
    const pool = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 300).map(([i]) => index.cards[i]);
    return pool.map((card) => ({ card, score: nameSimilarity(read, card.n) }))
      .sort((a, b) => b.score - a.score || a.card.n.length - b.card.n.length).slice(0, limit);
  }

  /** Passcodes (8 digits) found in OCR text that belong to a card. */
  function findPasscodes(index, text) {
    const found = [];
    const digits = toDigits(text).replace(/[^0-9]+/g, " ");
    for (const m of digits.matchAll(/\d{8,9}/g)) {
      const n = Number(m[0]);
      const card = index.byId.get(n) || (m[0].length === 9 ? index.byId.get(Number(m[0].slice(0, 8))) || index.byId.get(Number(m[0].slice(1))) : null);
      if (card && !found.includes(card)) found.push(card);
    }
    return found;
  }

  /** Cards whose printed set code appears in OCR text. */
  function findSetCodes(index, text) {
    const found = [];
    const up = String(text || "").toUpperCase().replace(/[–—_]/g, "-");
    for (const m of up.matchAll(/([A-Z0-9]{2,5})\s*-\s*([A-Z0-9]{3,6})/g)) {
      const tail = m[2];
      const region = (/^([A-Z]{0,2})/.exec(tail.replace(/\d.*$/, "")) || ["", ""])[1].slice(0, 2);
      const num = toDigits(tail.slice(region.length)).slice(0, 3);
      if (!/^\d{3}$/.test(num)) continue;
      for (const card of index.bySet.get(m[1] + "-" + num) || []) if (!found.includes(card)) found.push(card);
    }
    return found;
  }

  /**
   * Decides which card was scanned from the three reads.
   * Returns {card, sure, via, candidates:[{card, score}]} or {card:null, candidates} when unsure.
   */
  function identify(index, { name = "", setCode = "", passcode = "" } = {}) {
    const byName = matchName(index, name, 6);
    const nameScore = (card) => (byName.find((x) => x.card === card) || { score: nameSimilarity(normName(name), card.n) }).score;
    const nameRead = normName(name).length >= 3 && looksLikeName(normName(name));

    const pass = findPasscodes(index, passcode + " " + setCode);
    for (const card of pass) {
      // A misread digit can land on another real card: trust it unless the name clearly disagrees.
      if (!nameRead || nameScore(card) >= 0.35 || !byName[0] || byName[0].score < 0.8) {
        return { card, sure: true, via: "passcode", candidates: rank(card, byName) };
      }
    }
    const sets = findSetCodes(index, setCode + " " + passcode);
    if (sets.length === 1 && (!nameRead || nameScore(sets[0]) >= 0.3)) return { card: sets[0], sure: true, via: "set", candidates: rank(sets[0], byName) };
    if (sets.length > 1) {
      const best = sets.map((card) => ({ card, score: nameScore(card) })).sort((a, b) => b.score - a.score);
      if (best[0].score >= 0.5) return { card: best[0].card, sure: true, via: "set", candidates: rank(best[0].card, byName) };
    }
    const top = byName[0], second = byName[1];
    if (top && top.score >= 0.84 && (!second || top.score - second.score >= 0.06 || top.score === 1)) {
      return { card: top.card, sure: true, via: "name", candidates: byName };
    }
    const cands = [...sets.map((card) => ({ card, score: Math.max(0.5, nameScore(card)) })), ...byName].filter((x, i, a) => a.findIndex((y) => y.card === x.card) === i);
    if (top && top.score >= 0.6) return { card: top.card, sure: false, via: "name", candidates: cands.slice(0, 6) };
    return { card: null, sure: false, via: "", candidates: cands.filter((x) => x.score >= 0.5).slice(0, 6) };
  }

  function rank(card, byName) {
    return [{ card, score: 1 }, ...byName.filter((x) => x.card !== card)].slice(0, 6);
  }

  const api = { buildIndex, identify, matchName, findPasscodes, findSetCodes, normName, setKey, nameSimilarity, levenshtein };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.KodexMatch = api;
})(typeof self !== "undefined" ? self : this);
