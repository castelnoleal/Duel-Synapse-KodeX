#!/usr/bin/env node
// Local test server for the online duel client (no Cloudflare needed).
//   node scripts/duel-dev-server.mjs [--port 8787] [--scripts /path/to/CardScripts]
// Serves /duel/* from this repository, /duel/scripts/<commit>/<path> from a local
// CardScripts checkout, and runs the real DuelRoom relay (server/duel-room.js) over
// a minimal WebSocket implementation.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { DuelRoom } from "../server/duel-room.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(arg("--port", 8787));
const SCRIPTS = arg("--scripts", "");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".png": "image/png", ".svg": "image/svg+xml" };

// ---- minimal WebSocket (RFC 6455) server socket ----
class Sock {
  constructor(socket) { this.socket = socket; this.buf = Buffer.alloc(0); this.att = null; this.open = true; this.frags = []; }
  serializeAttachment(v) { this.att = JSON.parse(JSON.stringify(v)); }
  deserializeAttachment() { return this.att; }
  send(text) {
    if (!this.open) return;
    const data = Buffer.from(String(text));
    let head;
    if (data.length < 126) head = Buffer.from([0x81, data.length]);
    else if (data.length < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(data.length, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(data.length), 2); }
    this.socket.write(Buffer.concat([head, data]));
  }
  close(code = 1000) {
    if (!this.open) return;
    this.open = false;
    const b = Buffer.alloc(4); b[0] = 0x88; b[1] = 2; b.writeUInt16BE(code >= 1000 && code < 5000 ? code : 1000, 2);
    try { this.socket.end(b); } catch { /* gone */ }
  }
  feed(chunk, onText, onClose) {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      if (this.buf.length < 2) return;
      const fin = this.buf[0] & 0x80, op = this.buf[0] & 0x0f, masked = this.buf[1] & 0x80;
      let len = this.buf[1] & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      const need = off + (masked ? 4 : 0) + len;
      if (this.buf.length < need) return;
      const mask = masked ? this.buf.subarray(off, off + 4) : null;
      const data = Buffer.from(this.buf.subarray(off + (masked ? 4 : 0), need));
      if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(need);
      if (op === 0x8) { onClose(); return; }
      if (op === 0x9) { const p = Buffer.concat([Buffer.from([0x8a, data.length]), data]); this.socket.write(p); continue; }
      if (op === 0x1 || op === 0x0) { this.frags.push(data); if (fin) { onText(Buffer.concat(this.frags).toString("utf8")); this.frags = []; } }
    }
  }
}

// ---- Durable Object state shim ----
const rooms = new Map();
function roomFor(code) {
  if (rooms.has(code)) return rooms.get(code);
  const socks = new Map(); // sock -> tags
  const state = {
    acceptWebSocket(ws, tags) { socks.set(ws, tags); },
    getWebSockets(tag) { return [...socks].filter(([ws, t]) => ws.open && (!tag || t.includes(tag))).map(([ws]) => ws); },
    setWebSocketAutoResponse() {},
    _drop(ws) { socks.delete(ws); },
  };
  const room = new DuelRoom(state, {});
  room._state = state;
  rooms.set(code, room);
  return room;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  let p = decodeURIComponent(url.pathname);
  if (p === "/duel") { res.writeHead(301, { Location: "/duel/" }); return res.end(); }
  const sm = /^\/duel\/scripts\/[0-9a-f]{40}\/(.+\.lua)$/.exec(p);
  if (sm) {
    if (!SCRIPTS) { res.writeHead(404); return res.end("no --scripts dir"); }
    const f = path.join(SCRIPTS, path.normalize(sm[1]).replace(/^(\.\.[/\\])+/, ""));
    return fs.readFile(f, (err, data) => { if (err) { res.writeHead(404); res.end(); } else { res.writeHead(200, { "Content-Type": "text/plain" }); res.end(data); } });
  }
  if (p === "/duel/") p = "/duel/index.html";
  if (p === "/" || p === "/index.html") p = "/index.html";
  const file = path.join(root, path.normalize(p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(data);
  });
});

server.on("upgrade", (req, socket) => {
  const url = new URL(req.url, "http://x");
  const m = /^\/api\/duel\/room\/([A-Z0-9]{4,12})$/.exec(url.pathname);
  const role = url.searchParams.get("role");
  if (!m || !["host", "guest", "spec"].includes(role)) { socket.destroy(); return; }
  const accept = crypto.createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  const room = roomFor(m[1]);
  const ws = new Sock(socket);
  const name = String(url.searchParams.get("name") || "Duelist").slice(0, 24);
  room.accept(ws, role, name);
  let closed = false;
  const onClose = () => { if (closed) return; closed = true; ws.open = false; room._state._drop(ws); room.webSocketClose(ws, 1000); try { socket.end(); } catch { /* */ } };
  socket.on("data", (chunk) => ws.feed(chunk, (text) => { if (text === "ping") ws.send("pong"); else room.webSocketMessage(ws, text); }, onClose));
  socket.on("close", onClose);
  socket.on("error", onClose);
});

server.listen(PORT, () => console.log(`Duel dev server: http://localhost:${PORT}/duel/  (scripts: ${SCRIPTS || "none"})`));
