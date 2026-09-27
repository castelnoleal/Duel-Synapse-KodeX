/**
 * Duel Synapse KodeX — separate translation proxy
 * Deploy at: translate.meiocg.org
 * Does not access the KodeX database or GitHub credentials.
 */

const ALLOWED_ORIGINS = new Set([
  "https://kodex.meiocg.org",
  "https://www.kodex.meiocg.org",
  "http://localhost",
  "http://127.0.0.1"
]);

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
    headers: {"Content-Type": "application/json; charset=utf-8", ...corsHeaders(origin)}
  });
}

function normalizeSource(source) {
  const s = String(source || "auto").trim();
  return ["auto","ja","ko","zh","zh-CN","zh-TW"].includes(s) ? s : "auto";
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers:corsHeaders(origin)});
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ok:true,service:"kodex-translation-proxy"},200,origin);
    }
    if (url.pathname !== "/translate" || request.method !== "POST") {
      return json({error:"not_found"},404,origin);
    }

    let body;
    try { body = await request.json(); }
    catch { return json({error:"invalid_json"},400,origin); }

    const q = String(body?.q || "").trim();
    const source = normalizeSource(body?.source);
    const target = String(body?.target || "en").trim() || "en";

    if (!q) return json({error:"empty_text"},400,origin);
    if (q.length > 5000) return json({error:"text_too_long",max:5000},413,origin);

    try {
      const googleUrl =
        "https://translate.googleapis.com/translate_a/single" +
        "?client=gtx" +
        "&sl=" + encodeURIComponent(source) +
        "&tl=" + encodeURIComponent(target) +
        "&dt=t" +
        "&ie=UTF-8" +
        "&oe=UTF-8" +
        "&q=" + encodeURIComponent(q);

      const upstream = await fetch(googleUrl,{
        headers:{
          "User-Agent":"Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36",
          "Accept":"application/json,text/plain,*/*"
        }
      });

      if (!upstream.ok) return json({error:"upstream_http_error",status:upstream.status},502,origin);

      const data = await upstream.json();
      const sentences = Array.isArray(data?.[0]) ? data[0] : [];
      const translatedText = sentences
        .map(row => Array.isArray(row) ? String(row[0] || "") : "")
        .join("")
        .trim();

      if (!translatedText) return json({error:"empty_translation"},502,origin);

      return json({
        translatedText,
        source:"google-translate-web-endpoint",
        detectedLanguage:data?.[2] || source
      },200,origin);
    } catch (error) {
      return json({error:"translation_failed",message:String(error?.message || error)},502,origin);
    }
  }
};
