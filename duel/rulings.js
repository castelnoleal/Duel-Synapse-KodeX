// Official OCG rulings (Q&A) for a card, from KodeX's rulings mirror (data/rulings on kodex.meiocg.org).
// Rulings are filed by Konami card id; the name index turns a card name into that id. Both files are fetched
// only when someone first asks for rulings, and kept for the session.
import { SITE, BUNDLED } from "./site.js";

const BASE = BUNDLED ? SITE : "";
let names = null, byId = null, loading = null;
const cache = new Map();
const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

async function loadNames() {
  if (names) return;
  if (!loading) loading = (async () => {
    const r = await fetch(`${BASE}/data/rulings/card-name-index.json`);
    if (!r.ok) throw new Error("rulings " + r.status);
    const raw = await r.json();
    names = new Map(); byId = new Map();
    for (const [n, ids] of Object.entries(raw)) {
      const clean = n.replace(/^"|"$/g, "");
      names.set(norm(clean), ids);
      for (const id of ids) if (!byId.has(id)) byId.set(id, clean);
    }
  })().catch((e) => { loading = null; throw e; });
  await loading;
}

/** The card's rulings as plain text: [{ q, a, date }] (English where available). Throws when offline. */
export async function rulingsFor(cardName) {
  const key = norm(cardName);
  if (cache.has(key)) return cache.get(key);
  await loadNames();
  const ids = names.get(key);
  if (!ids || !ids.length) { cache.set(key, []); return []; }
  const r = await fetch(`${BASE}/data/rulings/cards/${ids[0]}.json`);
  if (r.status === 404) { cache.set(key, []); return []; }
  if (!r.ok) throw new Error("rulings " + r.status);
  const d = await r.json();
  const named = (s) => String(s || "").replace(/<<(\d+)>>/g, (_, id) => `"${byId.get(Number(id)) || "this card"}"`).replace(/\n?~~~\n?/g, "\n");
  const out = (d.records || []).map((x) => {
    const en = x.api && x.api.qaData && x.api.qaData.en;
    const h = x.history || {};
    return en && en.question ? { q: named(en.question), a: named(en.answer), date: h.databaseDate || "" } : null;
  }).filter(Boolean);
  cache.set(key, out);
  return out;
}
