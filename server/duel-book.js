// Synapse AI shared playbooks (/api/duel/book): what players and the combo search taught the Arena AI,
// grouped by deck. One Durable Object (SQLite) per main archetype ("shard"); each row is one deck's book.
// Data is anonymous: card codes, action types and counts. No names, rooms or IPs are stored.
import { sanitizeBook, mergeBooks, similarity, emptyBook } from "../duel/engine/learn.js";

const MAX_BODY = 200 * 1024;
const MAX_ROWS = 3000;
const POSTS_PER_HOUR = 60; // per client, per shard

export class DuelBook {
  constructor(state, env) {
    this.state = state;
    this.sql = state.storage.sql;
    this.sql.exec("CREATE TABLE IF NOT EXISTS books (key TEXT PRIMARY KEY, codes TEXT NOT NULL, arche TEXT NOT NULL, updated INTEGER NOT NULL, data TEXT NOT NULL)");
    this.sql.exec("CREATE INDEX IF NOT EXISTS books_updated ON books(updated)");
    this.hits = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET") return this.get(url);
    if (request.method === "POST") return this.post(request);
    return reply({ error: "Method not allowed" }, 405);
  }

  get(url) {
    const codes = (url.searchParams.get("codes") || "").split(",").map(Number).filter((c) => Number.isInteger(c) && c > 0).slice(0, 120).sort((a, b) => a - b);
    if (!codes.length) return reply({ error: "codes required" }, 400);
    const shard = url.searchParams.get("shard") || "";
    const arche = /^a[0-9a-f]{1,4}$/.test(shard) ? [parseInt(shard.slice(1), 16)] : [];
    const profile = { key: "", codes, arche };
    const rows = this.sql.exec("SELECT key, codes, arche, data FROM books ORDER BY updated DESC LIMIT 500").toArray();
    const scored = rows.map((r) => ({ r, s: similarity(profile, { codes: JSON.parse(r.codes), arche: JSON.parse(r.arche) }) }))
      .filter((x) => x.s >= 0.4).sort((a, b) => b.s - a.s).slice(0, 6);
    const book = emptyBook(profile);
    book.key = "online";
    for (const { r, s } of scored) { const b = sanitizeBook(JSON.parse(r.data)); if (b) mergeBooks(book, b, s); }
    return reply({ book, matches: scored.length, best: scored.length ? +scored[0].s.toFixed(2) : 0 }, 200, { "Cache-Control": "public, max-age=60" });
  }

  async post(request) {
    const who = request.headers.get("CF-Connecting-IP") || "?";
    const hour = Math.floor(Date.now() / 3600000), k = who + ":" + hour;
    const n = (this.hits.get(k) || 0) + 1;
    this.hits.set(k, n);
    if (this.hits.size > 5000) this.hits.clear();
    if (n > POSTS_PER_HOUR) return reply({ error: "Too many updates, try again later" }, 429);
    const text = await request.text();
    if (text.length > MAX_BODY) return reply({ error: "Too large" }, 413);
    let body;
    try { body = JSON.parse(text); } catch (e) { return reply({ error: "Bad JSON" }, 400); }
    const add = sanitizeBook(body && body.book);
    if (!add || !add.key || !add.codes.length) return reply({ error: "Bad book" }, 400);
    // One upload can't outweigh many players: cap the counts it brings.
    for (const l of add.lines) { l.n = Math.min(l.n, 3); if (l.src === "you") l.src = "online"; }
    for (const t of [add.picks, add.chains]) for (const e of Object.values(t)) for (const c of Object.keys(e)) e[c] = Math.min(e[c], 5);
    const row = this.sql.exec("SELECT data FROM books WHERE key = ?", add.key).toArray()[0];
    const merged = row ? mergeBooks(sanitizeBook(JSON.parse(row.data)) || emptyBook(add), add) : add;
    merged.key = add.key; merged.codes = add.codes; merged.arche = add.arche;
    this.sql.exec("INSERT OR REPLACE INTO books (key, codes, arche, updated, data) VALUES (?, ?, ?, ?, ?)",
      add.key, JSON.stringify(add.codes), JSON.stringify(add.arche), Date.now(), JSON.stringify(merged));
    const count = this.sql.exec("SELECT COUNT(*) AS n FROM books").toArray()[0].n;
    if (count > MAX_ROWS) this.sql.exec("DELETE FROM books WHERE key IN (SELECT key FROM books ORDER BY updated ASC LIMIT ?)", count - MAX_ROWS);
    return reply({ ok: true, lines: merged.lines.length });
  }
}

function reply(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "X-Content-Type-Options": "nosniff", ...extra } });
}

/** /api/duel/book?shard=…&codes=… (GET) and POST {shard, book}. */
export async function handleDuelBook(request, env) {
  if (!env.DUEL_BOOKS) return reply({ error: "Playbooks are not configured" }, 503);
  const url = new URL(request.url);
  let shard = url.searchParams.get("shard") || "";
  let req = request;
  if (request.method === "POST") {
    const text = await request.text();
    if (text.length > MAX_BODY) return reply({ error: "Too large" }, 413);
    try { shard = String(JSON.parse(text).shard || ""); } catch (e) { return reply({ error: "Bad JSON" }, 400); }
    req = new Request(request.url, { method: "POST", headers: request.headers, body: text });
  } else if (request.method !== "GET") return reply({ error: "Method not allowed" }, 405);
  if (!/^(a[0-9a-f]{1,4}|misc)$/.test(shard)) shard = "misc";
  const stub = env.DUEL_BOOKS.get(env.DUEL_BOOKS.idFromName(shard));
  return stub.fetch(req);
}
