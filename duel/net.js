// Room connection through the Duel Synapse relay (Cloudflare Durable Object at /api/duel/room/<code>).
import { SITE } from "./site.js";
export function roomUrl(code, role, name) {
  const u = new URL(SITE);
  const proto = u.protocol === "https:" ? "wss:" : "ws:";
  const q = new URLSearchParams({ role, name: name.slice(0, 24) });
  return `${proto}//${u.host}/api/duel/room/${encodeURIComponent(code)}?${q}`;
}

export function newRoomCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const r = new Uint32Array(6);
  crypto.getRandomValues(r);
  return [...r].map((x) => abc[x % abc.length]).join("");
}

export class Room {
  constructor({ code, role, name, onMessage, onStatus }) {
    Object.assign(this, { code, role, name, onMessage, onStatus });
    this.closed = false;
    this.tries = 0;
    this.queue = [];
  }
  connect() {
    if (this.closed) return;
    this.onStatus && this.onStatus("connecting");
    const ws = new WebSocket(roomUrl(this.code, this.role, this.name));
    this.ws = ws;
    ws.onopen = () => {
      this.tries = 0;
      this.onStatus && this.onStatus("open");
      for (const m of this.queue.splice(0)) ws.send(m);
      clearInterval(this.ping);
      this.ping = setInterval(() => { if (ws.readyState === 1) ws.send("ping"); }, 25000);
    };
    ws.onmessage = (ev) => {
      if (ev.data === "pong") return;
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (m.sys === "error") { this.closed = true; this.onStatus && this.onStatus("error", m.error); ws.close(); return; }
      this.onMessage && this.onMessage(m);
    };
    ws.onclose = () => {
      clearInterval(this.ping);
      if (this.closed) return;
      this.onStatus && this.onStatus("reconnecting");
      const wait = Math.min(10000, 500 * 2 ** this.tries++);
      setTimeout(() => this.connect(), wait);
    };
  }
  send(obj) {
    const s = JSON.stringify(obj);
    if (this.ws && this.ws.readyState === 1) this.ws.send(s);
    else this.queue.push(s);
  }
  close() { this.closed = true; clearInterval(this.ping); if (this.ws) this.ws.close(); }
}
