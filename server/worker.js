import { DuelRoom, handleDuelRoom } from "./duel-room.js";
export { DuelRoom };

const REPO = "castelnoleal/Duel-Synapse-KodeX";
const BRANCH = "main";
const CACHE_NAME = "kodex-private-origin-v11";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "public, max-age=60, stale-while-revalidate=300" : "no-store",
      ...corsHeaders(),
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
      "User-Agent": "MEIOCG-KodeX-Private-Origin/8.0",
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



function translationCacheKey(text, source, target) {
  return new Request(`https://kodex-translation-cache.invalid/${encodeURIComponent(source)}/${encodeURIComponent(target)}/${encodeURIComponent(text)}`);
}

async function translateChunk(text, source, target, ctx) {
  const cache = await caches.open("kodex-translation-v1");
  const key = translationCacheKey(text, source, target);
  const hit = await cache.match(key);
  if (hit) return await hit.text();
  const headers = {
    "User-Agent": "MEIOCG-KodeX-Translation/1.0",
    "Accept": "application/json,text/plain,*/*",
  };
  let translated = "";
  let lastError = null;

  const endpoints = [
    ["https://translate.googleapis.com/translate_a/single", "gtx"],
    ["https://translate.google.com/translate_a/single", "gtx"],
  ];

  for (const [base, client] of endpoints) {
    try {
      const endpoint = new URL(base);
      endpoint.searchParams.set("client", client);
      endpoint.searchParams.set("sl", source || "auto");
      endpoint.searchParams.set("tl", target || "en");
      endpoint.searchParams.set("dt", "t");
      endpoint.searchParams.set("ie", "UTF-8");
      endpoint.searchParams.set("oe", "UTF-8");
      endpoint.searchParams.set("q", text);
      const response = await fetch(endpoint.toString(), { headers });
      if (!response.ok) {
        lastError = new Error(`Translation upstream returned ${response.status}`);
        continue;
      }
      const data = await response.json();
      translated = Array.isArray(data?.[0]) ? data[0].map(x => x?.[0] || "").join("") : "";
      if (translated.trim()) break;
      lastError = new Error("Translation upstream returned no text");
    } catch (error) {
      lastError = error;
    }
  }

  if (!translated.trim()) {
    try {
      const endpoint = new URL("https://clients5.google.com/translate_a/t");
      endpoint.searchParams.set("client", "dict-chrome-ex");
      endpoint.searchParams.set("sl", source || "auto");
      endpoint.searchParams.set("tl", target || "en");
      endpoint.searchParams.set("dt", "t");
      endpoint.searchParams.set("ie", "UTF-8");
      endpoint.searchParams.set("oe", "UTF-8");
      endpoint.searchParams.set("q", text);
      const response = await fetch(endpoint.toString(), { headers });
      if (!response.ok) throw new Error(`Translation fallback returned ${response.status}`);
      const data = await response.json();
      translated = Array.isArray(data?.sentences)
        ? data.sentences.map(x => x?.trans || "").join("")
        : "";
      if (!translated.trim()) throw new Error("Translation fallback returned no text");
    } catch (error) {
      lastError = error;
    }
  }

  if (!translated.trim()) throw (lastError || new Error("Translation upstream returned no text"));
  const cached = new Response(translated, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=604800" } });
  ctx.waitUntil(cache.put(key, cached.clone()));
  return translated;
}

async function translateText(text, source, target, ctx) {
  const chunks=[];
  let remaining=String(text||"").trim();
  while(remaining.length>0){
    if(remaining.length<=3500){chunks.push(remaining);break;}
    let cut=remaining.lastIndexOf("\n",3500);
    if(cut<1200)cut=remaining.lastIndexOf(" ",3500);
    if(cut<1200)cut=3500;
    chunks.push(remaining.slice(0,cut));
    remaining=remaining.slice(cut).trimStart();
  }
  const translated=[];
  for(const chunk of chunks) translated.push(await translateChunk(chunk,source,target,ctx));
  return translated.join("\n");
}
function withHeaders(response, headers = {}) {
  const result = new Response(response.body, response);
  Object.entries({...headers, ...corsHeaders()}).forEach(([key, value]) => result.headers.set(key, value));
  return result;
}

// ---------------------------------------------------------------------------
// Duel Synapse online duels (/duel). Static files come from the duel/ folder of this
// repository; card scripts are proxied from the pinned public Project Ignis commit.
const DUEL_TYPES = { js: "text/javascript; charset=utf-8", css: "text/css; charset=utf-8", html: "text/html; charset=utf-8",
  json: "application/json; charset=utf-8", wasm: "application/wasm", svg: "image/svg+xml",
  md: "text/plain; charset=utf-8", png: "image/png", webp: "image/webp", cpp: "text/plain; charset=utf-8", sh: "text/plain; charset=utf-8" };
const DUEL_FILE = /^duel\/(?:[a-z0-9-]+\.(?:js|css|html|svg)|README\.md|assets\/[a-z0-9-]+\.(?:png|webp)|engine\/[a-z0-9-]+\.(?:js|wasm)|engine\/build\/(?:kx_shim\.cpp|build\.sh|build-runtimes\.sh)|data\/(?:cards|strings|scripts)\.json)$/;
const DUEL_SCRIPT = /^\/duel\/scripts\/([0-9a-f]{40})\/((?:official|pre-release)\/c\d{1,10}\.lua|unofficial\/(?:proc_unofficial|rankup_functions)\.lua|[a-z_]{3,40}\.lua)$/;

async function handleDuel(request, url, env) {
  const p = url.pathname;
  const room = p.match(/^\/api\/duel\/room\/([A-Z0-9]{4,12})$/);
  if (room) return handleDuelRoom(request, env, room[1]);
  if (!p.startsWith("/duel")) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed" }, 405);
  if (p === "/duel") return Response.redirect(new URL("/duel/" + url.search + url.hash, url).toString(), 301);
  try {
    const script = p.match(DUEL_SCRIPT);
    if (script) {
      const upstream = await fetch(`https://raw.githubusercontent.com/ProjectIgnis/CardScripts/${script[1]}/${script[2]}`, {
        cf: { cacheEverything: true, cacheTtl: 31536000 },
      });
      if (!upstream.ok) return json({ error: "Script unavailable" }, upstream.status === 404 ? 404 : 502);
      return new Response(upstream.body, { headers: {
        "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff", ...corsHeaders() } });
    }
    const file = p === "/duel/" ? "duel/index.html" : p.slice(1);
    if (!DUEL_FILE.test(file)) return json({ error: "Not found" }, 404);
    const ext = file.split(".").pop();
    const big = ext === "wasm" || file.startsWith("duel/data/") || file.startsWith("duel/assets/");
    const response = await githubFile(file, env, big ? 3600 : 120);
    return withHeaders(response, {
      "Content-Type": DUEL_TYPES[ext],
      "Cache-Control": big ? "public, max-age=3600, stale-while-revalidate=86400" : "public, max-age=120, stale-while-revalidate=600",
      "X-Content-Type-Options": "nosniff",
    });
  } catch (error) {
    console.error(error);
    return json({ error: "Duel service unavailable" }, 503);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders() });
    const duel = await handleDuel(request, url, env);
    if (duel) return duel;
    if (url.pathname === "/translate") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      try {
        const body = await request.json();
        const q = String(body?.q || "").trim();
        const source = String(body?.source || "auto").trim().toLowerCase();
        const target = String(body?.target || "en").trim().toLowerCase();
        if (!q) return json({ error: "Missing q" }, 400);
        if (q.length > 15000) return json({ error: "Text too long" }, 413);
        if (target !== "en") return json({ error: "Only English translation is supported" }, 400);
        if (!/^(auto|[a-z]{2,8})$/.test(source)) return json({ error: "Invalid source language" }, 400);
        const translatedText = await translateText(q, source, target, ctx);
        return json({ translatedText, source, target });
      } catch (error) {
        console.error(error);
        return json({ error: "Translation service unavailable" }, 503);
      }
    }
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

    try {
      if (url.pathname === "/health" || url.pathname === "/api/health") {
        return json({ ok: true, service: "Duel Synapse KodeX private origin" });
      }

      if (url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/kodex" || url.pathname === "/kodex/") {
        const response = await githubFile("index.html", env, 120);
        return withHeaders(response, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=120, stale-while-revalidate=600",
        });
      }

      if (url.pathname === "/privacy-policy.html" || url.pathname === "/privacy-policy") {
        const response = await githubFile("privacy-policy.html", env, 3600);
        return withHeaders(response, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          "X-Content-Type-Options": "nosniff",
        });
      }

      const art = url.pathname.match(/^\/img\/([0-9]{3,10})\.jpg$/);
      if (art) {
        // Card art comes from YGOPRODeck, which throttles bursts: retry a few times and only cache real pictures
        // (a cached error would keep a card broken for weeks). "v=2" skips error entries cached by the first release.
        const sources = [`https://images.ygoprodeck.com/images/cards_small/${art[1]}.jpg?v=2`, `https://images.ygoprodeck.com/images/cards/${art[1]}.jpg?v=2`];
        let upstream = null;
        for (let attempt = 0; attempt < 3 && !(upstream && upstream.ok); attempt++) {
          if (attempt) await new Promise((r) => setTimeout(r, 300 * attempt));
          let gone = 0;
          for (const src of sources) {
            upstream = await fetch(src, { cf: { cacheEverything: true, cacheTtlByStatus: { "200-299": 2592000, "300-599": -1 } } }).catch(() => null);
            if (upstream && upstream.ok) break;
            if (upstream && upstream.status === 404) gone++;
          }
          if (gone === sources.length) break;
        }
        if (!upstream || !upstream.ok) {
          const status = upstream ? upstream.status : 0;
          return json({ error: "Card image unavailable", upstream: status }, status === 404 ? 404 : 502);
        }
        return new Response(upstream.body, {
          status: 200,
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=2592000, immutable",
            "X-Content-Type-Options": "nosniff",
            ...corsHeaders(),
          },
        });
      }

      if (url.pathname === "/deck.html" || url.pathname === "/deck") {
        const response = await githubFile("deck.html", env, 600);
        return withHeaders(response, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
        });
      }

      if (url.pathname === "/indexes/search.json") {
        const response = await githubFile("indexes/search.json", env, 300);
        return withHeaders(response, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
        });
      }

      const scan = url.pathname.match(/^\/scan\/(art|cards)\.json$/);
      if (scan) {
        const response = await githubFile(`scan/${scan[1]}.json`, env, 3600);
        return withHeaders(response, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        });
      }

      const ruling = url.pathname.match(/^\/data\/rulings\/cards\/([0-9]{1,12})\.json$/);
      if (ruling) {
        const response = await githubFile(`data/rulings/cards/${ruling[1]}.json`, env, 300);
        return withHeaders(response, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
        });
      }

      if (url.pathname === "/meiocglogo.png") return withHeaders(await githubFile("meiocglogo.png", env, 86400));
      if (url.pathname === "/assets/meiocg-watermark.svg") return withHeaders(await githubFile("assets/meiocg-watermark.svg", env, 86400));

      return json({ error: "Not found" }, 404);
    } catch (error) {
      console.error(error);
      return json({ error: "KodeX service unavailable" }, 503);
    }
  },
};