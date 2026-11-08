// MEIOCG Players: the KodeX players who chose to be listed on meiocg.org/players, ranked by how active they are.
// One SQLite-backed Durable Object ("global"). Only what the player shows on their profile is stored: display name,
// title, icon (a preset name, never an uploaded picture), frame, tier, Premium, activity counts, first and last seen.
// No accounts, emails or devices. Each player's app keeps a random id and a secret key; only the key's hash is
// stored, so nobody else can change or remove their entry.
// GET  /api/players?sort=points|recent&limit=100  -> { total, updated, players: [...] }
// POST /api/players/ping  { id, key, name, title, bio, icon, frame, tier, premium, points, days, duels, wins, decks }
// POST /api/players/leave { id, key }

const json = (obj, status = 200, cache = "no-store") => new Response(JSON.stringify(obj), { status, headers: {
  "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache, "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
const ID = /^[a-z0-9]{16,40}$/, KEY = /^[A-Za-z0-9_-]{24,80}$/;
const ICONS = new Set(["meiocg", "star", "flame", "crown", "blade", "shield", "moon", "sun", "bolt", "eye", "gem", "wing", "spiral", "custom"]);
const FRAMES = new Set(["none", "rookie", "bronze", "silver", "gold", "platinum", "diamond", "master", "premium"]);
const THEMES = new Set(["default", "ocean", "dusk", "aurora", "nebula", "inferno", "royal", "synapse"]), FREE_THEMES = new Set(["default", "ocean", "dusk"]);
const TIERS = ["rookie", "bronze", "silver", "gold", "platinum", "diamond", "master"];
const UPDATE_EVERY = 4 * 60 * 1000, ACTIVE_DAYS = 90;
/** Display text: no markup, no control characters, trimmed. */
const text = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const int = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export class PlayerBoard {
  constructor(state) {
    this.sql = state.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS p (id TEXT PRIMARY KEY, kh TEXT NOT NULL, name TEXT NOT NULL, title TEXT, bio TEXT, icon TEXT, frame TEXT, tier TEXT,
        premium INTEGER, points INTEGER, days INTEGER, duels INTEGER, wins INTEGER, decks INTEGER, since INTEGER, last INTEGER);
      CREATE INDEX IF NOT EXISTS p_points ON p(points);
      CREATE INDEX IF NOT EXISTS p_last ON p(last);`);
    // public profile id (kodex.meiocg.org/players#<pid>): a hash of the private id, so the list never shows the id
    try { this.sql.exec("ALTER TABLE p ADD COLUMN pid TEXT"); } catch (e) { /* already there */ }
    try { this.sql.exec("ALTER TABLE p ADD COLUMN theme TEXT"); } catch (e) { /* already there */ }
    this.sql.exec("CREATE INDEX IF NOT EXISTS p_pid ON p(pid)");
  }

  async fetch(request) {
    const url = new URL(request.url);
    const one = /^\/api\/players\/p\/([a-f0-9]{12})$/.exec(url.pathname);
    if (request.method === "GET" && one) return this.one(one[1]);
    if (request.method === "GET") return this.list(url);
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    let b;
    try { b = await request.json(); } catch { return json({ error: "Bad JSON" }, 400); }
    if (!b || !ID.test(String(b.id)) || !KEY.test(String(b.key))) return json({ error: "Bad id or key" }, 400);
    const kh = await sha(String(b.key)), row = this.sql.exec("SELECT kh, last FROM p WHERE id = ?", b.id).toArray()[0];
    if (row && row.kh !== kh) return json({ error: "Not yours" }, 403);
    if (url.pathname.endsWith("/leave")) { this.sql.exec("DELETE FROM p WHERE id = ?", b.id); return json({ ok: true, removed: true }); }
    const now = Date.now();
    if (row && now - row.last < UPDATE_EVERY) return json({ ok: true, wait: Math.ceil((UPDATE_EVERY - (now - row.last)) / 1000) });
    const name = text(b.name, 24);
    if (name.length < 2) return json({ error: "Name too short" }, 400);
    const icon = ICONS.has(b.icon) ? b.icon : "meiocg", frame = FRAMES.has(b.frame) ? b.frame : "none", tier = TIERS.includes(b.tier) ? b.tier : "rookie";
    const days = int(b.days, 20000), duels = int(b.duels, 1e6), wins = Math.min(duels, int(b.wins, 1e6)), decks = int(b.decks, 5000);
    // points can't be more than the activity behind them allows
    const points = Math.min(int(b.points, 1e7), days * 40 + duels * 8 + decks * 10 + 300);
    const pid = (await sha("pid:" + b.id)).slice(0, 12);
    const theme = THEMES.has(b.theme) && (b.premium === true || FREE_THEMES.has(b.theme)) ? b.theme : "default";
    this.sql.exec(`INSERT INTO p (id, kh, name, title, bio, icon, frame, tier, premium, points, days, duels, wins, decks, since, last, pid, theme)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name = excluded.name, title = excluded.title, bio = excluded.bio, icon = excluded.icon, frame = excluded.frame,
          tier = excluded.tier, premium = excluded.premium, points = excluded.points, days = excluded.days, duels = excluded.duels,
          wins = excluded.wins, decks = excluded.decks, last = excluded.last, pid = excluded.pid, theme = excluded.theme`,
      b.id, kh, name, text(b.title, 32), text(b.bio, 140), icon, frame, tier, b.premium === true ? 1 : 0, points, days, duels, wins, decks, now, now, pid, theme);
    const rank = this.sql.exec("SELECT COUNT(*) AS n FROM p WHERE points > ? AND last > ?", points, now - ACTIVE_DAYS * 864e5).toArray()[0].n + 1;
    return json({ ok: true, rank, pid });
  }

  one(pid) {
    const since = Date.now() - ACTIVE_DAYS * 864e5;
    const r = this.sql.exec("SELECT pid, name, title, bio, icon, frame, tier, theme, premium, points, days, duels, wins, decks, since, last FROM p WHERE pid = ?", pid).toArray()[0];
    if (!r) return json({ error: "Not found" }, 404, "public, max-age=30");
    const rank = r.last > since ? this.sql.exec("SELECT COUNT(*) AS n FROM p WHERE points > ? AND last > ?", r.points, since).toArray()[0].n + 1 : 0;
    return json({ player: { ...r, premium: !!r.premium, rank } }, 200, "public, max-age=60");
  }

  list(url) {
    const sort = url.searchParams.get("sort") === "recent" ? "last" : "points";
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")) || 100));
    const since = Date.now() - ACTIVE_DAYS * 864e5;
    const rows = this.sql.exec(`SELECT pid, name, title, bio, icon, frame, tier, theme, premium, points, days, duels, wins, decks, since, last FROM p
        WHERE last > ? ORDER BY ${sort} DESC, last DESC LIMIT ?`, since, limit).toArray();
    const total = this.sql.exec("SELECT COUNT(*) AS n FROM p WHERE last > ?", since).toArray()[0].n;
    return json({ total, updated: Date.now(), players: rows.map((r, i) => ({ rank: i + 1, ...r, premium: !!r.premium })) }, 200, "public, max-age=60");
  }
}

export async function handlePlayers(request, env) {
  if (request.method === "OPTIONS") return json({});
  if (!env.PLAYERS) return json({ error: "Players board is not configured" }, 503);
  if (request.method === "POST" && Number(request.headers.get("Content-Length") || 0) > 4000) return json({ error: "Too large" }, 413);
  return env.PLAYERS.get(env.PLAYERS.idFromName("global")).fetch(request);
}
