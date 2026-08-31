const REPO = "castelnoleal/Duel-Synapse-KodeX";
const BRANCH = "main";
const CACHE_NAME = "kodex-private-origin-v7";
const ALLOWED_ORIGINS = new Set(["https://kodex.meiocg.org"]);

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
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

async function githubFile(path, env, cacheSeconds = 300) {
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not configured");
  const cache = await caches.open(CACHE_NAME);
  const cacheKey = new Request(`https://kodex-private-cache.invalid/${path}`);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  const url = `https://api.github.com/repos/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.raw",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "MEIOCG-KodeX-Private-Origin/7.0",
    },
  });
  if (!response.ok) throw new Error(`Private KodeX origin returned ${response.status}`);
  const copy = new Response(response.body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
      "Cache-Control": `public, max-age=${cacheSeconds}, stale-while-revalidate=1800`,
    },
  });
  await cache.put(cacheKey, copy.clone());
  return copy;
}

function withHeaders(response, headers) {
  const result = new Response(response.body, response);
  Object.entries(headers).forEach(([key, value]) => result.headers.set(key, value));
  return result;
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

      // Serve the original KodeX UI unchanged. The repository remains private;
      // this Worker is the only public delivery layer.
      if (url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/kodex" || url.pathname === "/kodex/") {
        const response = await githubFile("index.html", env, 120);
        return withHeaders(response, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=120, stale-while-revalidate=600",
        });
      }

      // Keep the original frontend's existing paths working, but source them
      // through the authenticated Worker rather than GitHub directly.
      if (url.pathname === "/indexes/search.json") {
        const response = await githubFile("indexes/search.json", env, 300);
        return withHeaders(response, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
          ...corsHeaders(origin),
        });
      }

      const ruling = url.pathname.match(/^\/data\/rulings\/cards\/([0-9]{1,12})\.json$/);
      if (ruling) {
        const response = await githubFile(`data/rulings/cards/${ruling[1]}.json`, env, 300);
        return withHeaders(response, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
          ...corsHeaders(origin),
        });
      }

      if (url.pathname === "/meiocglogo.png") return githubFile("meiocglogo.png", env, 86400);
      if (url.pathname === "/assets/meiocg-watermark.svg") return githubFile("assets/meiocg-watermark.svg", env, 86400);

      return json({ error: "Not found" }, 404, origin);
    } catch (error) {
      console.error(error);
      return json({ error: "KodeX service unavailable" }, 503, origin);
    }
  },
};
