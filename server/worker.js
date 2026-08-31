const REPO = "castelnoleal/Duel-Synapse-KodeX";
const BRANCH = "main";
const INDEX_PATH = "indexes/search.json";
const RULING_PREFIX = "data/rulings/cards/";
const ALLOWED_ORIGINS = new Set(["https://kodex.meiocg.org"]);
const CACHE_NAME = "kodex-private-origin-v5";

function corsHeaders(origin) {
  const h = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "public, max-age=60, stale-while-revalidate=300" : "no-store",
      ...corsHeaders(origin),
    },
  });
}

function normalize(value) {
  return String(value ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function score(card, query) {
  const q = normalize(query);
  if (!q) return 0;
  const name = normalize(card.name);
  const archetype = normalize(card.archetype);
  const id = String(card.id ?? "");
  const kid = String(card.konami_id ?? "");
  if (name === q) return 100000;
  if (id === q || kid === q) return 95000;
  if (name.startsWith(q)) return 80000;
  if (name.includes(q)) return 60000;
  if (archetype.includes(q)) return 40000;
  const words = q.split(" ").filter(Boolean);
  const hits = words.filter(w => name.includes(w) || archetype.includes(w)).length;
  return hits ? 20000 + hits * 100 : 0;
}

async function githubFetch(path, env) {
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not configured");
  const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`;
  const cache = await caches.open(CACHE_NAME);
  const cacheKey = new Request(`https://private-origin.invalid/${encodeURIComponent(path)}`);
  const hit = await cache.match(cacheKey);
  if (hit) return hit;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.raw",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "MEIOCG-KodeX-Private-Origin/5.0",
    },
  });
  if (!r.ok) {
    console.error(`GitHub Contents API returned ${r.status} for ${path}`);
    throw new Error(`Private KodeX origin returned ${r.status}`);
  }
  const copy = new Response(r.body, {
    status: 200,
    headers: {
      "Content-Type": r.headers.get("Content-Type") || "application/octet-stream",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
    },
  });
  await cache.put(cacheKey, copy.clone());
  return copy;
}

async function getIndex(env) {
  const r = await githubFetch(INDEX_PATH, env);
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error("Invalid KodeX search index");
  return data;
}

async function servePublicUi(pathname, env) {
  // Only these UI assets are exposed. The repository itself remains private.
  let repoPath = null;
  let contentType = "text/plain; charset=utf-8";
  if (pathname === "/" || pathname === "/index.html" || pathname === "/kodex" || pathname === "/kodex/") {
    repoPath = "kodex/index.html";
    contentType = "text/html; charset=utf-8";
  } else if (pathname === "/sw.js" || pathname === "/kodex/sw.js") {
    repoPath = "kodex/sw.js";
    contentType = "application/javascript; charset=utf-8";
  } else if (pathname === "/assets/meiocg-watermark.svg") {
    repoPath = "assets/meiocg-watermark.svg";
    contentType = "image/svg+xml";
  }
  if (!repoPath) return null;
  const r = await githubFetch(repoPath, env);
  return new Response(r.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, origin);
    try {
      if (url.pathname === "/health" || url.pathname === "/api/health") {
        return json({ ok: true, service: "Duel Synapse KodeX private origin" }, 200, origin);
      }
      if (url.pathname === "/api/search") {
        const q = (url.searchParams.get("q") || "").trim();
        if (!q) return json({ results: [] }, 200, origin);
        if (q.length > 120) return json({ error: "Query too long" }, 400, origin);
        const requestedLimit = Number(url.searchParams.get("limit") || 40);
        const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 40, 1), 80);
        const filter = (url.searchParams.get("type") || "all").toLowerCase();
        const cards = await getIndex(env);
        const results = cards.map(c => [score(c, q), c]).filter(x => x[0] > 0).filter(x => filter === "all" || String(x[1].type || "").toLowerCase().includes(filter)).sort((a,b) => b[0] - a[0] || String(a[1].name).localeCompare(String(b[1].name))).slice(0, limit).map(x => x[1]);
        return json({ results, count: results.length }, 200, origin);
      }
      const m = url.pathname.match(/^\/api\/ruling\/(\d+)$/);
      if (m) {
        const id = m[1];
        if (!/^[0-9]{1,12}$/.test(id)) return json({ error: "Invalid ruling id" }, 400, origin);
        const r = await githubFetch(`${RULING_PREFIX}${id}.json`, env);
        return new Response(r.body, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300, stale-while-revalidate=1800", ...corsHeaders(origin) } });
      }
      const ui = await servePublicUi(url.pathname, env);
      if (ui) return ui;
      return json({ error: "Not found" }, 404, origin);
    } catch (error) {
      console.error(error);
      return json({ error: "KodeX service unavailable" }, 503, origin);
    }
  },
};
