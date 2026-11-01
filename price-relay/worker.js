// MEIOCG price relay — lets the Meiocg_Price-Check GitHub Action read Yuyu-tei,
// which blocks GitHub's servers. Only relays GET requests to https://yuyu-tei.jp.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";
export default {
  async fetch(req) {
    const u = new URL(req.url);
    const t = u.searchParams.get("url");
    if (!t) return new Response("meiocg price relay ok", { headers: { "content-type": "text/plain" } });
    if (req.method !== "GET") return new Response("method not allowed", { status: 405 });
    let target;
    try { target = new URL(t); } catch { return new Response("bad url", { status: 400 }); }
    if (target.protocol !== "https:" || target.hostname !== "yuyu-tei.jp") return new Response("forbidden", { status: 403 });
    const r = await fetch(target.toString(), {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja-JP,ja;q=0.9,en;q=0.7",
      },
      redirect: "follow",
    });
    return new Response(r.body, {
      status: r.status,
      headers: { "content-type": r.headers.get("content-type") || "text/html; charset=utf-8", "x-relay-status": String(r.status) },
    });
  },
};
