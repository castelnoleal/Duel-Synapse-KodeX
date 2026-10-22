// Deck formats: KodeX share links (deck.html payload), EDOPro .ydk files and ydke:// URLs.

/** KodeX/deck.html payload: base64url(JSON {n, m:[[id,name,count]], e:[...], s:[...]}) */
export function decodeKodex(hash) {
  const h = String(hash).replace(/^#/, "").replace(/^deck=/, "").replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(escape(atob(h)));
  const P = JSON.parse(json);
  const expand = (list) => (list || []).flatMap((x) => Array.from({ length: Math.max(1, x[2] | 0) }, () => ({ id: Number(x[0]) || 0, name: String(x[1] || "") })));
  return { name: String(P.n || "KodeX deck").slice(0, 60), main: expand(P.m), extra: expand(P.e), side: expand(P.s) };
}

export function encodeKodex(deck, db) {
  const group = (list) => {
    const m = new Map();
    for (const c of list) m.set(c, (m.get(c) || 0) + 1);
    return [...m].map(([id, n]) => [id, db ? db.name(id) : "", n]);
  };
  const json = JSON.stringify({ n: deck.name, m: group(deck.main), e: group(deck.extra), s: group(deck.side || []) });
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function parseYdk(text, name = "Imported deck") {
  const deck = { name, main: [], extra: [], side: [] };
  let cur = deck.main;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#main/i.test(line)) { cur = deck.main; continue; }
    if (/^#extra/i.test(line)) { cur = deck.extra; continue; }
    if (/^!side/i.test(line)) { cur = deck.side; continue; }
    if (line.startsWith("#") || line.startsWith("!")) continue;
    const id = parseInt(line, 10);
    if (id > 0) cur.push({ id, name: "" });
  }
  return deck;
}

export function toYdk(deck) {
  return ["#created by Duel Synapse: KodeX", "#main", ...deck.main, "#extra", ...deck.extra, "!side", ...(deck.side || [])].join("\n") + "\n";
}

export function parseYdke(url, name = "Imported deck") {
  const parts = String(url).trim().replace(/^ydke:\/\//i, "").split("!");
  const dec = (b64) => {
    if (!b64) return [];
    const bin = atob(b64);
    const out = [];
    for (let i = 0; i + 3 < bin.length; i += 4)
      out.push((bin.charCodeAt(i) | (bin.charCodeAt(i + 1) << 8) | (bin.charCodeAt(i + 2) << 16) | (bin.charCodeAt(i + 3) << 24)) >>> 0);
    return out.map((id) => ({ id, name: "" }));
  };
  return { name, main: dec(parts[0]), extra: dec(parts[1]), side: dec(parts[2]) };
}

export function toYdke(deck) {
  const enc = (list) => {
    let s = "";
    for (const id of list) s += String.fromCharCode(id & 255, (id >>> 8) & 255, (id >>> 16) & 255, (id >>> 24) & 255);
    return btoa(s);
  };
  return `ydke://${enc(deck.main)}!${enc(deck.extra)}!${enc(deck.side || [])}!`;
}

/** Accepts any supported text: ydke URL, YDK file, KodeX deck link or raw payload. */
export function parseAny(text, name) {
  const t = String(text || "").trim();
  if (!t) throw new Error("Paste a deck first.");
  if (/^ydke:\/\//i.test(t)) return parseYdke(t, name);
  if (/#main|#extra|!side/i.test(t) || /^\d{3,10}(\s+\d{3,10})*$/.test(t)) return parseYdk(t, name);
  const m = /[#]([A-Za-z0-9_-]{16,})$/.exec(t) || /deck=([A-Za-z0-9_-]{16,})/.exec(t);
  return decodeKodex(m ? m[1] : t);
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

/**
 * Map deck entries ({id,name}) to engine card codes. KodeX uses YGOPRODeck ids, which
 * match EDOPro passcodes for released cards; anything else is matched by name.
 * Returns {main, extra, side, missing:[names], moved:[...]} with codes, Extra Deck
 * monsters moved to the Extra Deck if they were listed in the Main Deck.
 */
export function resolveDeck(deck, db) {
  if (!db._byName) {
    db._byName = new Map();
    for (const k of Object.keys(db.raw)) {
      const c = db.get(k);
      const key = norm(c.name);
      const prev = db._byName.get(key);
      if (!prev || (prev.alias && !c.alias) || (prev.code > 99999999 && c.code <= 99999999)) db._byName.set(key, c);
    }
  }
  const missing = [];
  const map = (e) => {
    if (db.has(e.id)) return e.id;
    const c = e.name && db._byName.get(norm(e.name));
    if (c) return c.code;
    missing.push(e.name || "#" + e.id);
    return 0;
  };
  const main = [], extra = [];
  for (const e of [...deck.main, ...deck.extra]) {
    const code = map(e);
    if (!code) continue;
    (db.isExtra(code) ? extra : main).push(code);
  }
  const side = (deck.side || []).map(map).filter(Boolean);
  return { name: deck.name, main, extra, side, missing };
}

export function deckProblems(d, db) {
  const p = [];
  if (d.main.length < 40) p.push(`Main Deck has ${d.main.length} cards (minimum 40).`);
  if (d.main.length > 60) p.push(`Main Deck has ${d.main.length} cards (maximum 60).`);
  if (d.extra.length > 15) p.push(`Extra Deck has ${d.extra.length} cards (maximum 15).`);
  const count = new Map();
  for (const c of [...d.main, ...d.extra, ...(d.side || [])]) { const k = (db.get(c) || {}).alias || c; count.set(k, (count.get(k) || 0) + 1); }
  for (const [k, n] of count) if (n > 3) p.push(`${db.name(k)} ×${n} (maximum 3).`);
  return p;
}
