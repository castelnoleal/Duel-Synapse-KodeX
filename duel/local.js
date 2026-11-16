// Nearby duels without the internet: two phones on the same Wi-Fi or hotspot connect directly (WebRTC data channel,
// no server). The phones swap two short codes, shown as QR codes: the host's invite, then the guest's answer.
// LocalRoom works like Room (net.js), so hosting, joining, chat, emotes and skins work the same way.
// Created by Castel Noleal, creator of MEIOCG. A project of Meta Insider OCG since 2023.

// ---------- the codes: only what a direct connection needs ----------
const MAGIC = "DSN1";
/** A session description cut down to the fields that matter, as a short text. */
export function packDesc(sdp, kind) {
  const get = (re) => (re.exec(sdp) || [])[1] || "";
  const ufrag = get(/a=ice-ufrag:(\S+)/), pwd = get(/a=ice-pwd:(\S+)/);
  const fp = get(/a=fingerprint:sha-256 ([0-9A-F:]+)/i).split(":").map((h) => String.fromCharCode(parseInt(h, 16))).join("");
  const setup = get(/a=setup:(\w+)/);
  const cands = [];
  for (const m of sdp.matchAll(/a=candidate:\S+ 1 udp \d+ (\S+) (\d+) typ host/gi)) if (!cands.includes(m[1] + " " + m[2])) cands.push(m[1] + " " + m[2]);
  if (!ufrag || !pwd || !fp || !cands.length) throw new Error("This phone has no Wi-Fi connection to share. Turn on Wi-Fi or a hotspot.");
  return [MAGIC, kind === "offer" ? "o" : "a", ufrag, pwd, btoa(fp), { actpass: "x", active: "c", passive: "p" }[setup] || "x", cands.slice(0, 6).join(",")].join("|");
}
export function unpackDesc(code) {
  const p = String(code || "").trim().split("|");
  if (p[0] !== MAGIC || p.length < 7) throw new Error("That isn't a Duel Synapse nearby code.");
  const fp = [...atob(p[4])].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0").toUpperCase()).join(":");
  const setup = { x: "actpass", c: "active", p: "passive" }[p[5]] || (p[1] === "o" ? "actpass" : "active");
  const lines = ["v=0", "o=- 1 2 IN IP4 127.0.0.1", "s=-", "t=0 0", "a=group:BUNDLE 0", "a=msid-semantic: WMS",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel", "c=IN IP4 0.0.0.0"];
  p[6].split(",").forEach((c, i) => { const [ip, port] = c.split(" "); lines.push(`a=candidate:${i + 1} 1 udp ${2122260223 - i} ${ip} ${port} typ host generation 0`); });
  lines.push("a=end-of-candidates", `a=ice-ufrag:${p[2]}`, `a=ice-pwd:${p[3]}`, `a=fingerprint:sha-256 ${fp}`, `a=setup:${setup}`, "a=mid:0", "a=sctp-port:5000", "a=max-message-size:262144");
  return { type: p[1] === "o" ? "offer" : "answer", sdp: lines.join("\r\n") + "\r\n" };
}

// ---------- the room ----------
const CHUNK = 60000;
export class LocalRoom {
  constructor({ role, name, onMessage, onStatus }) {
    Object.assign(this, { role, name, onMessage, onStatus });
    this.code = "NEARBY";
    this.queue = []; this.parts = new Map(); this.closed = false; this.peer = "";
    this.pc = new RTCPeerConnection({ iceServers: [] });
    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState;
      if ((s === "failed" || s === "closed" || s === "disconnected") && this.open) this.lost();
    };
  }
  connect() {}  // the codes do the connecting
  wire(ch) {
    this.ch = ch;
    ch.onopen = () => { this.open = true; ch.send(JSON.stringify({ hi: this.name })); for (const s of this.queue.splice(0)) this.raw(s); this.onStatus && this.onStatus("open"); };
    ch.onclose = () => this.lost();
    ch.onmessage = (ev) => this.got(ev.data);
  }
  lost() {
    if (!this.open) return;
    this.open = false;
    const other = this.role === "host" ? "guest" : "host";
    this.onMessage && this.onMessage({ sys: "leave", role: other, name: this.peer });
    if (!this.closed) this.onStatus && this.onStatus("reconnecting");
  }
  async gathered() {
    if (this.pc.iceGatheringState === "complete") return;
    await new Promise((ok) => { const t = setTimeout(ok, 3500); this.pc.addEventListener("icegatheringstatechange", () => { if (this.pc.iceGatheringState === "complete") { clearTimeout(t); ok(); } }); });
  }
  /** Host: the invite code. */
  async invite() {
    this.wire(this.pc.createDataChannel("duel", { ordered: true }));
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await this.gathered();
    return packDesc(this.pc.localDescription.sdp, "offer");
  }
  /** Host: the guest's answer code. */
  async accept(code) {
    const d = unpackDesc(code);
    if (d.type !== "answer") throw new Error("Scan the code on your opponent's phone after they scanned yours.");
    await this.pc.setRemoteDescription(d);
  }
  /** Guest: reads the host's invite and returns the answer code to show. */
  async answer(code) {
    const d = unpackDesc(code);
    if (d.type !== "offer") throw new Error("Scan the host's invite code.");
    this.pc.ondatachannel = (e) => this.wire(e.channel);
    await this.pc.setRemoteDescription(d);
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    await this.gathered();
    return packDesc(this.pc.localDescription.sdp, "answer");
  }
  raw(s) {
    if (s.length <= CHUNK) { this.ch.send(s); return; }
    const id = Math.random().toString(36).slice(2, 9), n = Math.ceil(s.length / CHUNK);
    for (let i = 0; i < n; i++) this.ch.send(JSON.stringify({ part: { id, i, n, d: s.slice(i * CHUNK, (i + 1) * CHUNK) } }));
  }
  got(data) {
    let m; try { m = JSON.parse(data); } catch { return; }
    if (m.part) {
      const p = m.part; let b = this.parts.get(p.id);
      if (!b) { b = { n: p.n, got: 0, d: [] }; this.parts.set(p.id, b); }
      if (b.d[p.i] === undefined) { b.d[p.i] = p.d; b.got++; }
      if (b.got < b.n) return;
      this.parts.delete(p.id);
      try { m = JSON.parse(b.d.join("")); } catch { return; }
    }
    if (m.hi !== undefined) {
      this.peer = String(m.hi || "").slice(0, 24) || (this.role === "host" ? "Guest" : "Host");
      if (this.role === "host") this.onMessage && this.onMessage({ sys: "join", role: "guest", name: this.peer });
      else this.onMessage && this.onMessage({ sys: "welcome", role: "guest", name: this.name, peers: [{ role: "host", name: this.peer }] });
      return;
    }
    if (!m.m) return;
    this.onMessage && this.onMessage({ from: this.role === "host" ? "guest" : "host", name: this.peer, m: m.m });
  }
  /** Same shape as Room.send: { to, m }. Only the two phones are in a nearby room. */
  send(obj) {
    if (!obj || !obj.m) return;
    if (this.role === "host" && obj.to === "spec") return;
    const s = JSON.stringify({ m: obj.m });
    if (this.open && this.ch && this.ch.readyState === "open") this.raw(s); else this.queue.push(s);
  }
  close() { this.closed = true; try { this.ch && this.ch.close(); } catch {} try { this.pc.close(); } catch {} }
}

// ---------- QR codes (byte mode, error correction level L, versions 1-20) ----------
const ECC_L = [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28];
const BLOCKS_L = [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8];
const rawModules = (v) => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
const dataCodewords = (v) => Math.floor(rawModules(v) / 8) - ECC_L[v] * BLOCKS_L[v];
const gmul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 255; };
function rsDivisor(deg) { const r = Array(deg).fill(0); r[deg - 1] = 1; let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = gmul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; } root = gmul(root, 2); } return r; }
function rsRemainder(data, div) { const r = Array(div.length).fill(0); for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => (r[i] ^= gmul(c, f))); } return r; }
/** The QR code for a text as a grid of booleans (true = dark). */
export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(text)];
  let v = 1;
  for (; v <= 20; v++) if (4 + (v <= 9 ? 8 : 16) + bytes.length * 8 <= dataCodewords(v) * 8) break;
  if (v > 20) throw new Error("code too long");
  const cap = dataCodewords(v) * 8, bits = [];
  const put = (x, n) => { for (let i = n - 1; i >= 0; i--) bits.push((x >>> i) & 1); };
  put(4, 4); put(bytes.length, v <= 9 ? 8 : 16); for (const b of bytes) put(b, 8);
  put(0, Math.min(4, cap - bits.length)); put(0, (8 - (bits.length % 8)) % 8);
  for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) put(p, 8);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  // error correction, in blocks, interleaved
  const nb = BLOCKS_L[v], ecl = ECC_L[v], raw = Math.floor(rawModules(v) / 8), nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb), div = rsDivisor(ecl), blocks = [];
  for (let i = 0, k = 0; i < nb; i++) { const len = shortLen - ecl + (i < nShort ? 0 : 1), dat = data.slice(k, k + len); k += len; const e = rsRemainder(dat, div); if (i < nShort) dat.push(0); blocks.push(dat.concat(e)); }
  const all = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - ecl || j >= nShort) all.push(b[i]); });
  // the grid
  const n = v * 4 + 17, M = Array.from({ length: n }, () => Array(n).fill(false)), F = Array.from({ length: n }, () => Array(n).fill(false));
  const fn = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
  for (let i = 0; i < n; i++) { fn(6, i, i % 2 === 0); fn(i, 6, i % 2 === 0); }
  const finder = (x, y) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), xx = x + dx, yy = y + dy; if (xx >= 0 && xx < n && yy >= 0 && yy < n) fn(xx, yy, d !== 2 && d !== 4); } };
  finder(3, 3); finder(n - 4, 3); finder(3, n - 4);
  const al = []; if (v > 1) { const na = Math.floor(v / 7) + 2, step = Math.ceil((v * 4 + 4) / (na * 2 - 2)) * 2; al.push(6); for (let p = n - 7; al.length < na; p -= step) al.splice(1, 0, p); }
  al.forEach((a, i) => al.forEach((b, j) => { if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) fn(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
  const format = (mask) => {
    const d = (1 << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((d << 10) | r) ^ 0x5412, bit = (i) => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) fn(8, i, bit(i));
    fn(8, 7, bit(6)); fn(8, 8, bit(7)); fn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) fn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) fn(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) fn(8, n - 15 + i, bit(i));
    fn(8, n - 8, true);
  };
  format(0);
  if (v >= 7) { let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25); const b = (v << 12) | r; for (let i = 0; i < 18; i++) { const d = ((b >>> i) & 1) === 1, a = n - 11 + (i % 3), c = Math.floor(i / 3); fn(a, c, d); fn(c, a, d); } }
  let i = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? n - 1 - vert : vert;
      if (!F[y][x] && i < all.length * 8) { M[y][x] = ((all[i >>> 3] >>> (7 - (i & 7))) & 1) === 1; i++; }
    }
  }
  const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
  const apply = (k) => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!F[y][x] && MASKS[k](x, y)) M[y][x] = !M[y][x]; };
  const penalty = () => {
    let p = 0, dark = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (M[y][x]) dark++;
      if (x < n - 1 && y < n - 1 && M[y][x] === M[y][x + 1] && M[y][x] === M[y + 1][x] && M[y][x] === M[y + 1][x + 1]) p += 3;
    }
    for (let y = 0; y < n; y++) for (const line of [M[y], M.map((r) => r[y])]) { let run = 1; for (let x = 1; x <= n; x++) { if (x < n && line[x] === line[x - 1]) run++; else { if (run >= 5) p += run - 2; run = 1; } } }
    return p + Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
  };
  let best = 0, bestP = Infinity;
  for (let k = 0; k < 8; k++) { apply(k); format(k); const p = penalty(); if (p < bestP) { bestP = p; best = k; } apply(k); }
  apply(best); format(best);
  return M;
}
/** The QR code as an SVG picture. */
export function qrSvg(text, px = 260) {
  const M = qrMatrix(text), n = M.length, q = 4, s = n + q * 2;
  let d = ""; M.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + q} ${y + q}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

// ---------- reading a code with the camera (phones that can read barcodes) ----------
export const canScan = () => typeof window !== "undefined" && "BarcodeDetector" in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
/** Opens the camera in `box` and resolves with the first Duel Synapse code it sees. stop() ends it early. */
export function scanCode(box) {
  let stream = null, done = false, timer = 0;
  const video = document.createElement("video"); video.playsInline = true; video.muted = true; video.className = "nb-video";
  box.replaceChildren(video);
  const stop = () => { done = true; clearTimeout(timer); if (stream) stream.getTracks().forEach((t) => t.stop()); video.remove(); };
  const p = (async () => {
    const det = new window.BarcodeDetector({ formats: ["qr_code"] });
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    video.srcObject = stream; await video.play();
    return await new Promise((ok, no) => {
      const tick = async () => {
        if (done) { no(new Error("stopped")); return; }
        try { const r = await det.detect(video); const hit = r.find((x) => String(x.rawValue).startsWith(MAGIC)); if (hit) { stop(); ok(hit.rawValue); return; } } catch {}
        timer = setTimeout(tick, 220);
      };
      tick();
    });
  })();
  p.catch(() => stop());
  return { done: p, stop };
}
