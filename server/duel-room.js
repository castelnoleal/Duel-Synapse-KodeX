// Duel Synapse online rooms: one Durable Object per room code.
// It only relays messages; the duel itself runs in the host's browser.
// Roles: one "host", one "guest", any number of "spec" (spectators).
const MAX_SPECTATORS = 50;
const MAX_MESSAGE = 512 * 1024;

export class DuelRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Keep-alive pings are answered without waking the object.
    if (typeof WebSocketRequestResponsePair !== "undefined")
      this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  peers() {
    return this.state.getWebSockets().map((ws) => ws.deserializeAttachment() || {}).filter((a) => a.role && !a.rejected)
      .map(({ role, name }) => ({ role, name }));
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    const url = new URL(request.url);
    const role = url.searchParams.get("role");
    const name = String(url.searchParams.get("name") || "Duelist").replace(/[\u0000-\u001f<>]/g, "").slice(0, 24) || "Duelist";
    if (!["host", "guest", "spec"].includes(role)) return new Response("Bad role", { status: 400 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.accept(server, role, name);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Registers a server-side socket for `role`; rejects it with a reason when the seat is taken. */
  accept(server, role, name) {
    this.state.acceptWebSocket(server, [role]);
    server.serializeAttachment({ role, name, at: Date.now() });

    const taken = (r) => this.state.getWebSockets(r).some((ws) => ws !== server && !(ws.deserializeAttachment() || {}).rejected);
    let error = null;
    if (role === "host" && taken("host")) error = "This room already has a host. Create a new room.";
    if (role === "guest" && !taken("host")) error = "Room not found. Check the code, or ask the host to open the room again.";
    if (role === "guest" && taken("guest")) error = "This room already has two duelists. You can watch instead.";
    if (role === "spec" && this.state.getWebSockets("spec").length > MAX_SPECTATORS) error = "Too many spectators in this room.";
    if (error) {
      server.serializeAttachment({ rejected: true });
      server.send(JSON.stringify({ sys: "error", error }));
      server.close(4000, "rejected");
      return false;
    }
    server.send(JSON.stringify({ sys: "welcome", role, name, peers: this.peers() }));
    this.broadcast({ sys: "join", role, name }, server);
    return true;
  }

  broadcast(obj, except, tags) {
    const s = JSON.stringify(obj);
    const list = tags ? tags.flatMap((t) => this.state.getWebSockets(t)) : this.state.getWebSockets();
    for (const ws of list) if (ws !== except) { try { ws.send(s); } catch (e) { /* closed */ } }
  }

  async webSocketMessage(ws, data) {
    if (typeof data !== "string" || data.length > MAX_MESSAGE) return;
    const me = ws.deserializeAttachment() || {};
    if (me.rejected) return;
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (!msg || typeof msg !== "object" || !msg.m) return;
    let to = msg.to;
    if (me.role === "host") {
      if (!["guest", "spec", "all", "others"].includes(to)) return;
    } else {
      // Guests and spectators may only talk to the host, or chat with everyone.
      if (to !== "host" && !(to === "all" && msg.m && msg.m.t === "chat")) to = "host";
      if (me.role === "spec" && to === "host" && msg.m.t !== "chat") return;
    }
    const out = { from: me.role, name: me.name, m: msg.m };
    if (to === "all") this.broadcast(out, ws);
    else if (to === "others") this.broadcast(out, ws, ["guest", "spec"]);
    else this.broadcast(out, ws, [to]);
  }

  async webSocketClose(ws, code) {
    const me = ws.deserializeAttachment() || {};
    try { ws.close(1000, "closed"); } catch (e) { /* already closed */ }
    if (me.role && !me.rejected) this.broadcast({ sys: "leave", role: me.role, name: me.name }, ws);
  }

  async webSocketError(ws) { await this.webSocketClose(ws); }
}

export async function handleDuelRoom(request, env, code) {
  if (!env.DUEL_ROOMS) return new Response(JSON.stringify({ error: "Online rooms are not configured" }), { status: 503 });
  const id = env.DUEL_ROOMS.idFromName(code);
  return env.DUEL_ROOMS.get(id).fetch(request);
}
