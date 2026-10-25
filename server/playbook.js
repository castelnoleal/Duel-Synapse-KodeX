// Synapse AI shared play book: anonymous counts of the lines players use with each card.
// One SQLite-backed Durable Object ("global") stores three tables:
//   seq  — "after these two plays in a turn, players made this play" (combo lines)
//   pick — "when this card's effect asked for this kind of choice and this card was offered, how often players chose it"
//   resp — "when the opponent played this card (0 = declared an attack), players answered with this card"
// Only card codes, action letters and counts are stored: no names, accounts or decks.
// GET  /api/duel/book?cards=1,2,3     -> rows that only involve those cards (the requester's decks)
// POST /api/duel/book/learn  {seq:[[c2,c1,next,w]], pick:[[src,hint,code,chosen,offered]], resp:[[trig,code,w]]}

const TOKEN = /^[SPAMTC][0-9]{1,10}(\.[0-9]{1,7})?$/;
const MAX_ROWS = 600, MAX_W = 3, MAX_CARDS = 200, OUT_LIMIT = 4000;
const codeOf = (t) => (t ? Number(t.slice(1).split(".")[0]) : 0);
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: {
  "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });

export class PlayBook {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS seq (c2 TEXT NOT NULL, c1 TEXT NOT NULL, nx TEXT NOT NULL, k2 INTEGER, k1 INTEGER, kn INTEGER, n REAL NOT NULL, PRIMARY KEY (c2, c1, nx));
      CREATE INDEX IF NOT EXISTS seq_kn ON seq(kn);
      CREATE TABLE IF NOT EXISTS pick (src INTEGER NOT NULL, hint INTEGER NOT NULL, code INTEGER NOT NULL, n REAL NOT NULL, seen REAL NOT NULL DEFAULT 0, PRIMARY KEY (src, hint, code));
      CREATE TABLE IF NOT EXISTS resp (trig INTEGER NOT NULL, code INTEGER NOT NULL, n REAL NOT NULL, PRIMARY KEY (trig, code));
      CREATE INDEX IF NOT EXISTS resp_code ON resp(code);`);
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET") return this.read(url);
    if (request.method === "POST") return this.learn(request);
    return json({ error: "Method not allowed" }, 405);
  }

  read(url) {
    const cards = [...new Set((url.searchParams.get("cards") || "").split(",").map(Number).filter((c) => Number.isInteger(c) && c > 0))].slice(0, MAX_CARDS);
    if (!cards.length) return json({ v: 1, seq: [], pick: [], resp: [] });
    const list = cards.join(",");
    const seq = this.sql.exec(`SELECT c2, c1, nx, n FROM seq WHERE kn IN (${list}) AND (k1 = 0 OR k1 IN (${list})) AND (k2 = 0 OR k2 IN (${list})) ORDER BY n DESC LIMIT ${OUT_LIMIT}`).toArray().map((r) => [r.c2, r.c1, r.nx, r.n]);
    const pick = this.sql.exec(`SELECT src, hint, code, n, seen FROM pick WHERE src IN (${list}) ORDER BY seen DESC LIMIT ${OUT_LIMIT}`).toArray().map((r) => [r.src, r.hint, r.code, r.n, r.seen]);
    const resp = this.sql.exec(`SELECT trig, code, n FROM resp WHERE code IN (${list}) ORDER BY n DESC LIMIT ${OUT_LIMIT}`).toArray().map((r) => [r.trig, r.code, r.n]);
    return json({ v: 1, seq, pick, resp });
  }

  async learn(request) {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
    const w = (x) => Math.max(0, Math.min(MAX_W, Number(x) || 0));
    const ok = (t) => t === "" || TOKEN.test(t);
    let rows = 0;
    for (const [c2, c1, nx, n] of (Array.isArray(body.seq) ? body.seq : []).slice(0, MAX_ROWS)) {
      if (!ok(c2) || !ok(c1) || !TOKEN.test(nx) || !(w(n) > 0)) continue;
      this.sql.exec(`INSERT INTO seq (c2, c1, nx, k2, k1, kn, n) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(c2, c1, nx) DO UPDATE SET n = n + excluded.n`,
        c2, c1, nx, codeOf(c2), codeOf(c1), codeOf(nx), w(n));
      rows++;
    }
    for (const [src, hint, code, chosen, offered] of (Array.isArray(body.pick) ? body.pick : []).slice(0, MAX_ROWS)) {
      const o = w(offered), c = Math.min(o, w(chosen));      // picks are rates: chosen out of offered
      if (![src, hint, code].every((x) => Number.isInteger(x) && x >= 0 && x < 2 ** 32) || !(o > 0)) continue;
      this.sql.exec(`INSERT INTO pick (src, hint, code, n, seen) VALUES (?, ?, ?, ?, ?) ON CONFLICT(src, hint, code) DO UPDATE SET n = n + excluded.n, seen = seen + excluded.seen`, src, hint, code, c, o);
      rows++;
    }
    for (const [trig, code, n] of (Array.isArray(body.resp) ? body.resp : []).slice(0, MAX_ROWS)) {
      if (![trig, code].every((x) => Number.isInteger(x) && x >= 0 && x < 2 ** 32) || !(w(n) > 0)) continue;
      this.sql.exec(`INSERT INTO resp (trig, code, n) VALUES (?, ?, ?) ON CONFLICT(trig, code) DO UPDATE SET n = n + excluded.n`, trig, code, w(n));
      rows++;
    }
    return json({ ok: true, rows });
  }
}

export async function handlePlayBook(request, env) {
  if (request.method === "OPTIONS") return json({});
  if (!env.PLAYBOOK) return json({ error: "Play book is not configured" }, 503);
  const len = Number(request.headers.get("Content-Length") || 0);
  if (request.method === "POST" && len > 200000) return json({ error: "Too large" }, 413);
  return env.PLAYBOOK.get(env.PLAYBOOK.idFromName("global")).fetch(request);
}
