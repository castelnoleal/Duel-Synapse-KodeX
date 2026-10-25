// Card lens: POST /api/lens with a photo of a Yu-Gi-Oh! card, get back what is printed on it.
//
// The scanner in the KodeX app sends one downscaled camera frame (or a gallery photo) here. A vision model reads
// the card the way Google Lens would (name in any language, passcode, set code, ATK/DEF) and the app then pulls
// the card from its own database by that name. Nothing here decides which card it is: the app checks every field
// against the card list, so a wrong guess from the model is caught there.
//
// Needs ONE of these Worker secrets (Cloudflare dashboard > Workers > duel-synapse-kodex > Settings > Variables and
// Secrets). Without any, the endpoint answers 503 {"error":"not_configured"} and the app falls back to its offline scanner.
//   ANTHROPIC_API_KEY   (model: LENS_MODEL, default claude-haiku-5-5)
//   GEMINI_API_KEY      (model: LENS_GEMINI_MODEL, default gemini-2.5-flash; has a free tier)

const MAX_BYTES = 900 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PER_MINUTE = 30;
const PER_DAY = 600;

const PROMPT = `This is a photo of a Yu-Gi-Oh! trading card. It may be in any language (often Japanese), tilted, in a sleeve or binder, with glare or foil.
Read what is printed on the card and answer with ONE JSON object and nothing else:
{"card":true|false,"name":string|null,"printed":string|null,"passcode":string|null,"set_code":string|null,"atk":number|null,"def":number|null}
- card: false if no Yu-Gi-Oh! card is clearly visible.
- name: the card's official English name if you are sure which card it is, otherwise null.
- printed: the card name exactly as printed on the card, in its own language.
- passcode: the 8-digit number at the bottom left, only if every digit is legible.
- set_code: the set number printed under the artwork or beside the card text, such as DBAG-JP018 or LOCH-EN001, only if legible.
- atk / def: the printed ATK and DEF numbers of a monster (null for "?" and for Spells, Traps and Link monsters' DEF).
Never guess. Use null for anything you cannot read.`;

const hits = new Map();
let dayStamp = 0;

function limited(ip) {
  const now = Date.now(), day = Math.floor(now / 86400000);
  if (day !== dayStamp) { hits.clear(); dayStamp = day; }
  const h = hits.get(ip) || { day: 0, stamps: [] };
  h.stamps = h.stamps.filter((t) => now - t < 60000);
  if (h.stamps.length >= PER_MINUTE || h.day >= PER_DAY) { hits.set(ip, h); return true; }
  h.stamps.push(now); h.day++; hits.set(ip, h);
  return false;
}

function reply(data, status, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*", ...extra },
  });
}

function b64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function sha256(bytes) {
  const d = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Pulls the JSON object out of a model reply (it may arrive wrapped in a code fence or a sentence). */
export function parseModelJson(text) {
  const s = String(text || "");
  const a = s.indexOf("{"), z = s.lastIndexOf("}");
  if (a < 0 || z <= a) return null;
  try { return JSON.parse(s.slice(a, z + 1)); } catch { return null; }
}

/** Keeps only well-formed fields, so the app never receives free text it has to trust. */
export function clean(raw) {
  if (!raw || typeof raw !== "object") return null;
  const str = (v, n) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
  const num = (v) => {
    const n = typeof v === "number" ? v : /^\d{1,5}$/.test(String(v ?? "").trim()) ? Number(v) : NaN;
    return Number.isFinite(n) && n >= 0 && n <= 99999 ? n : null;
  };
  const pass = String(raw.passcode ?? "").replace(/\D/g, "");
  const set = String(raw.set_code ?? raw.setCode ?? "").toUpperCase().replace(/\s+/g, "").match(/^[A-Z0-9]{2,6}-[A-Z]{0,3}\d{2,4}$/);
  return {
    card: raw.card !== false,
    name: str(raw.name, 120),
    printed: str(raw.printed, 120),
    passcode: /^\d{7,8}$/.test(pass) ? pass.padStart(8, "0") : null,
    setCode: set ? set[0] : null,
    atk: num(raw.atk),
    def: num(raw.def),
  };
}

async function askAnthropic(env, mime, data) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: env.LENS_MODEL || "claude-haiku-5-5",
      max_tokens: 300,
      temperature: 0,
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mime, data } }, { type: "text", text: PROMPT }] }],
    }),
  });
  if (!r.ok) throw new Error("anthropic " + r.status);
  const j = await r.json();
  return (j.content || []).map((p) => p.text || "").join("");
}

async function askGemini(env, mime, data) {
  const model = env.LENS_GEMINI_MODEL || "gemini-2.5-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": env.GEMINI_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mime, data } }, { text: PROMPT }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 300, responseMimeType: "application/json" },
    }),
  });
  if (!r.ok) throw new Error("gemini " + r.status);
  const j = await r.json();
  return ((j.candidates || [])[0]?.content?.parts || []).map((p) => p.text || "").join("");
}

export async function handleLens(request, env, ctx) {
  if (request.method !== "POST") return reply({ error: "method" }, 405);
  const providers = [];
  if (env.ANTHROPIC_API_KEY) providers.push(["anthropic", askAnthropic]);
  if (env.GEMINI_API_KEY) providers.push(["gemini", askGemini]);
  if (!providers.length) return reply({ error: "not_configured" }, 503);

  const mime = (request.headers.get("Content-Type") || "").split(";")[0].trim().toLowerCase();
  if (!TYPES.has(mime)) return reply({ error: "type" }, 415);
  const len = Number(request.headers.get("Content-Length") || 0);
  if (len > MAX_BYTES) return reply({ error: "too_large" }, 413);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length < 2000) return reply({ error: "empty" }, 400);
  if (bytes.length > MAX_BYTES) return reply({ error: "too_large" }, 413);

  // The same picture twice costs nothing.
  const key = new Request("https://kodex-lens-cache.invalid/" + (await sha256(bytes)));
  let cache = null;
  try { cache = typeof caches !== "undefined" ? caches.default || (await caches.open("kodex-lens-v1")) : null; } catch { cache = null; }
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return reply({ ...(await hit.json()), cached: true }, 200);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "local";
  if (limited(ip)) return reply({ error: "rate_limited" }, 429, { "Retry-After": "30" });

  const data = b64(bytes);
  let lastError = "unavailable";
  for (const [name, ask] of providers) {
    try {
      const out = clean(parseModelJson(await ask(env, mime, data)));
      if (!out) { lastError = "unreadable"; continue; }
      const body = { ...out, provider: name };
      if (cache && ctx && ctx.waitUntil) {
        ctx.waitUntil(cache.put(key, new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" } })));
      }
      return reply(body, 200);
    } catch (e) {
      lastError = String((e && e.message) || e).slice(0, 80);
    }
  }
  return reply({ error: "upstream", detail: lastError }, 502);
}
