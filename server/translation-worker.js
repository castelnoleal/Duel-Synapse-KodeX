/**
 * Duel Synapse KodeX — separate translation proxy
 * Deploy at: translate.meiocg.org
 * Does not access the KodeX database or GitHub credentials.
 *
 * Upstream strategy:
 * 1) Google Translate web endpoint (two host variants)
 * 2) MyMemory fallback
 * 3) short retry/backoff for transient 429/5xx responses
 * 4) Cloudflare edge cache for successful translations
 */

const ALLOWED_ORIGINS = new Set([
  "https://kodex.meiocg.org",
  "https://www.kodex.meiocg.org",
  "http://localhost",
  "http://127.0.0.1"
]);

const MAX_TEXT_LENGTH = 5000;
const CACHE_TTL = 86400;

function corsHeaders(origin) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "Cache-Control": "no-store"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin)
    }
  });
}

function normalizeSource(source) {
  const s = String(source || "auto").trim();
  return ["auto", "ja", "ko", "zh", "zh-CN", "zh-TW"].includes(s) ? s : "auto";
}

function normalizeTarget(target) {
  const t = String(target || "en").trim();
  return t || "en";
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGoogle(text, source, target, baseUrl) {
  const endpoint = new URL(baseUrl);
  endpoint.searchParams.set("client", "gtx");
  endpoint.searchParams.set("sl", source || "auto");
  endpoint.searchParams.set("tl", target || "en");
  endpoint.searchParams.set("dt", "t");
  endpoint.searchParams.set("ie", "UTF-8");
  endpoint.searchParams.set("oe", "UTF-8");
  endpoint.searchParams.set("q", text);

  const response = await fetchWithTimeout(endpoint.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36",
      "Accept": "application/json,text/plain,*/*"
    }
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: `Google upstream returned HTTP ${response.status}`
    };
  }

  const data = await response.json();
  const sentences = Array.isArray(data?.[0]) ? data[0] : [];
  const translatedText = sentences
    .map(row => Array.isArray(row) ? String(row[0] || "") : "")
    .join("")
    .trim();

  if (!translatedText) {
    return {
      ok: false,
      status: 502,
      error: "Google returned no translated text"
    };
  }

  return {
    ok: true,
    translatedText,
    detectedLanguage: data?.[2] || source,
    source: "google-translate-web-endpoint"
  };
}

async function fetchLingva(text, source, target) {
  const langSource = source || "auto";
  const endpoint = new URL(
    `https://lingva.ml/api/v1/${encodeURIComponent(langSource)}/${encodeURIComponent(target)}`
  );

  const response = await fetchWithTimeout(endpoint.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "MEIOCG-KodeX-Translation/3.0"
    },
    body: JSON.stringify({ query: text })
  }, 5000);

  if (!response.ok) {
    return { ok: false, status: response.status, error: `Lingva upstream returned HTTP ${response.status}` };
  }

  const data = await response.json();
  const translatedText = String(data?.translation || "").trim();

  if (!translatedText) {
    return { ok: false, status: 502, error: "Lingva returned no translated text" };
  }

  return {
    ok: true,
    translatedText,
    detectedLanguage: data?.info?.detectedSourceLanguage || source,
    source: "lingva"
  };
}

async function fetchMyMemory(text, source, target) {
  const langSource = source === "auto" ? "auto" : source;
  const endpoint = new URL("https://api.mymemory.translated.net/get");
  endpoint.searchParams.set("q", text);
  endpoint.searchParams.set("langpair", `${langSource}|${target}`);

  const response = await fetchWithTimeout(endpoint.toString(), {
    headers: {
      "Accept": "application/json",
      "User-Agent": "MEIOCG-KodeX-Translation/2.0"
    }
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: `MyMemory upstream returned HTTP ${response.status}`
    };
  }

  const data = await response.json();
  const translatedText = String(
    data?.responseData?.translatedText || ""
  ).trim();

  if (!translatedText) {
    return {
      ok: false,
      status: 502,
      error: "MyMemory returned no translated text"
    };
  }

  return {
    ok: true,
    translatedText,
    detectedLanguage: source === "auto" ? "auto" : source,
    source: "mymemory"
  };
}

async function translate(text, source, target) {
  // Prefer Google for translation quality. Only use Lingva if Google fails.
  try {
    const result = await fetchGoogle(
      text, source, target,
      "https://translate.googleapis.com/translate_a/single"
    );
    if (result.ok) return result;
  } catch {}

  // Alternate Google host, in case the primary endpoint is rate-limited.
  try {
    const result = await fetchGoogle(
      text, source, target,
      "https://translate.google.com/translate_a/single"
    );
    if (result.ok) return result;
  } catch {}

  // Secondary provider; used only when Google is unavailable.
  try {
    const result = await fetchLingva(text, source, target);
    if (result.ok) return result;
  } catch {}

  try {
    const result = await fetchMyMemory(text, source, target);
    if (result.ok) return result;
  } catch {}

  return {
    ok: false,
    status: 502,
    error: "All translation providers failed"
  };
}

function cacheKey(text, source, target) {
  const encoded = encodeURIComponent(text);
  return new Request(
    `https://kodex-translation-cache.invalid/v2/${encodeURIComponent(source)}/${encodeURIComponent(target)}/${encoded}`
  );
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return json(
        {
          ok: true,
          service: "kodex-translation-proxy"
        },
        200,
        origin
      );
    }

    if (url.pathname !== "/translate" || request.method !== "POST") {
      return json({ error: "not_found" }, 404, origin);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400, origin);
    }

    const q = String(body?.q || "").trim();
    const source = normalizeSource(body?.source);
    const target = normalizeTarget(body?.target);

    if (!q) return json({ error: "empty_text" }, 400, origin);

    if (q.length > MAX_TEXT_LENGTH) {
      return json(
        { error: "text_too_long", max: MAX_TEXT_LENGTH },
        413,
        origin
      );
    }

    const key = cacheKey(q, source, target);
    const cache = caches.default;

    try {
      const cached = await cache.match(key);
      if (cached) {
        const cachedData = await cached.json();
        return json(
          {
            ...cachedData,
            cached: true
          },
          200,
          origin
        );
      }
    } catch {
      // Cache failure must never break translation.
    }

    const result = await translate(q, source, target);

    if (!result.ok) {
      return json(
        {
          error: "translation_upstream_unavailable",
          status: result.status,
          message: result.error
        },
        502,
        origin
      );
    }

    const responseData = {
      translatedText: result.translatedText,
      source: result.source,
      detectedLanguage: result.detectedLanguage
    };

    // Cache only successful translations.
    try {
      await cache.put(
        key,
        new Response(JSON.stringify(responseData), {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": `public, max-age=${CACHE_TTL}`
          }
        })
      );
    } catch {
      // Cache failure must never break a successful translation.
    }

    return json(responseData, 200, origin);
  }
};
