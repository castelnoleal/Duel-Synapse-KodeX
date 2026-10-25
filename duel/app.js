// Duel Synapse Arena — browser client.
// Modes: solo playtest (engine in a Web Worker), online host (engine in the host's worker,
// relayed through the Worker's Durable Object), online guest and spectator.
import { CardDB, attributeName, raceName } from "./engine/data.js";
import * as C from "./engine/constants.js";
import { isDeclarable, placesFromMask, sumValid } from "./engine/rules.js";
import { parseAny, resolveDeck, deckProblems, decodeKodex, encodeKodex, toYdk } from "./deck.js";
import { Room, newRoomCode } from "./net.js";

const M = C.MSG;
const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const BASE = new URL("./", import.meta.url).href;
const OWN_HOST = location.hostname === "kodex.meiocg.org";
const FILLER = 15025844; // Mystical Elf: vanilla filler for the dummy opponent

const S = {
  db: null, deck: null, decks: [], testHand: new Set(),
  worker: null, workerReady: null, mode: null, team: 0, packet: null, packets: {}, control: "one",
  room: null, guest: null, specs: 0, hostTeam: 0, lastResult: null,
  sel: null, menuFor: null, chainSkip: false, log: [], chat: [], prevLP: [null, null], fullLog: [],
};

// ---------------------------------------------------------------------------
// Utilities
function toast(text, ms = 2600) {
  const t = $("#toast");
  t.textContent = text; t.classList.add("on");
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), ms);
}
function imgUrl(code) { return OWN_HOST ? `/img/${code}.jpg` : `https://images.ygoprodeck.com/images/cards_small/${code}.jpg`; }
function cardImg(code, alt = "") {
  const c = S.db && S.db.get(code);
  const art = c && c.alias && Math.abs(c.alias - code) < 20 ? code : code; // alt arts have their own art ids
  const i = new Image();
  i.alt = alt; i.loading = "lazy"; i.decoding = "async"; i.referrerPolicy = "no-referrer";
  i.src = imgUrl(art);
  i.onerror = () => {
    if (!i.dataset.f) { i.dataset.f = 1; i.src = `https://images.ygoprodeck.com/images/cards_small/${art}.jpg`; return; }
    i.replaceWith(el("span", "nm", S.db ? S.db.name(code) : String(code)));
  };
  return i;
}
const name = (code) => (code ? S.db.name(code) : "a face-down card");
const playerName = (t) => (S.packet && S.packet.names ? S.packet.names[t] : `Player ${t + 1}`);
const LOCNAME = { [C.LOCATION_DECK]: "Deck", [C.LOCATION_HAND]: "hand", [C.LOCATION_MZONE]: "Monster Zone", [C.LOCATION_SZONE]: "Spell & Trap Zone",
  [C.LOCATION_GRAVE]: "GY", [C.LOCATION_REMOVED]: "banishment", [C.LOCATION_EXTRA]: "Extra Deck", [C.LOCATION_OVERLAY]: "Xyz materials" };
const whose = (t) => (t === S.team ? "Your" : `${playerName(t)}'s`);
const where = (c) => `${whose(c.controller)} ${LOCNAME[c.location] || "field"}`;
const key = (con, loc, seq) => `${con}:${loc}:${seq}`;
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
function load(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }

// ---------------------------------------------------------------------------
// Boot
async function boot() {
  $("#nameInput").value = load("duel:name", "") || "";
  $("#nameInput").addEventListener("change", () => save("duel:name", $("#nameInput").value.trim()));
  const opts = load("duel:opts", null);
  if (opts) { $("#optRule").value = opts.rule; $("#optLP").value = opts.lp; $("#optHand").value = opts.start; $("#optDraw").value = opts.draw; }
  for (const id of ["#optRule", "#optLP", "#optHand", "#optDraw"]) $(id).addEventListener("change", () => { save("duel:opts", options()); rulesSummary(); });
  rulesSummary();
  S.chainSkip = load("duel:chainskip", false);
  $("#skipChains").checked = S.chainSkip;
  $("#skipChains").addEventListener("change", (e) => { S.chainSkip = e.target.checked; save("duel:chainskip", S.chainSkip); });
  bindLobby();
  bindTable();

  const status = $("#engineStatus");
  try {
    const [cards, strings] = await Promise.all([fetch(BASE + "data/cards.json").then((r) => r.json()), fetch(BASE + "data/strings.json").then((r) => r.json())]);
    S.db = new CardDB(cards, strings);
  } catch (e) {
    status.textContent = "Card data unavailable";
    $("#engineDot").className = "dot fail";
    return;
  }
  S.decks = load("duel:decks", []);
  const hash = new URLSearchParams(location.hash.slice(1));
  let fromLink = null;
  try {
    if (hash.get("deck")) fromLink = decodeKodex(hash.get("deck"));
    else if (location.hash.length > 30 && !hash.get("join") && !hash.get("watch")) fromLink = decodeKodex(location.hash.slice(1));
  } catch (e) { toast("That deck link could not be read."); }
  if (fromLink) useDeck(fromLink, true);
  else if (S.decks.length) selectDeck(load("duel:current", 0));
  renderSaved();

  startWorker().then((v) => { status.textContent = "Duel Synapse Server Ready"; $("#engineDot").className = "dot ready"; refreshButtons(); })
    .catch((e) => { console.error(e); status.textContent = "Duel Synapse Server unavailable"; $("#engineDot").className = "dot fail"; });

  applyRoomHash(hash);
  window.addEventListener("hashchange", () => {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get("deck")) { try { useDeck(decodeKodex(h.get("deck")), true); } catch (e) { toast("That deck link could not be read."); } }
    applyRoomHash(h);
  });
  refreshButtons();
}
function applyRoomHash(hash) {
  if (!$("#table").hidden) return;
  if (hash.get("join")) { setMode("join"); $("#joinCode").value = hash.get("join").toUpperCase(); }
  if (hash.get("watch")) watch(hash.get("watch").toUpperCase());
}

function startWorker() {
  if (S.workerReady) return S.workerReady;
  S.worker = new Worker(new URL("./host-worker.js", import.meta.url), { type: "module" });
  S.workerReady = new Promise((resolve, reject) => {
    S.worker.onmessage = (ev) => {
      const m = ev.data;
      if (m.t === "ready") resolve(m.version);
      else if (m.t === "fatal") { reject(new Error(m.error)); toast("Engine error: " + m.error.split("\n")[0], 6000); console.error(m.error); }
      else onWorker(m);
    };
    S.worker.onerror = (e) => reject(new Error(e.message || "worker failed"));
  });
  S.worker.postMessage({ cmd: "init", base: BASE });
  return S.workerReady;
}

function options() {
  return { rule: Number($("#optRule").value), lp: Math.max(100, Number($("#optLP").value) || 8000),
    start: Math.max(0, Number($("#optHand").value) || 0), draw: Math.max(0, Number($("#optDraw").value) || 0) };
}
function rulesSummary() { const o = options(); $("#rulesSummary").textContent = `MR${o.rule} · ${o.lp} LP`; }

// ---------------------------------------------------------------------------
// Decks
function useDeck(raw, remember) {
  const d = resolveDeck(raw, S.db);
  if (!d.main.length && !d.extra.length) { toast("That deck has no cards the engine knows."); return; }
  S.deck = d;
  if (remember) {
    const i = S.decks.findIndex((x) => x.name === d.name);
    const entry = { name: d.name, main: d.main, extra: d.extra, side: d.side };
    if (i >= 0) S.decks[i] = entry; else S.decks.unshift(entry);
    S.decks = S.decks.slice(0, 30);
    save("duel:decks", S.decks);
    save("duel:current", S.decks.findIndex((x) => x.name === d.name));
    renderSaved();
  }
  S.testHand.clear();
  renderDeck();
  refreshButtons();
}
function selectDeck(i) {
  const d = S.decks[i] || S.decks[0];
  if (!d) return;
  S.deck = { ...d, missing: [] };
  save("duel:current", S.decks.indexOf(d));
  S.testHand.clear();
  renderDeck();
  refreshButtons();
}
function renderSaved() {
  const s = $("#savedDecks");
  s.replaceChildren();
  s.hidden = !S.decks.length;
  S.decks.forEach((d, i) => { const o = el("option", null, d.name); o.value = i; if (S.deck && d.name === S.deck.name) o.selected = true; s.append(o); });
}
function renderDeck() {
  const b = $("#deckBody");
  b.replaceChildren();
  const d = S.deck;
  if (!d) return;
  const head = el("div", "deck-title");
  head.append(el("h3", null, d.name));
  const stats = el("div", "deck-stats");
  for (const [k, v] of [["Main", d.main.length], ["Extra", d.extra.length], ["Side", (d.side || []).length]]) {
    if (k === "Side" && !v) continue;
    const sp = el("span"); sp.append(el("b", null, String(v)), " " + k); stats.append(sp);
  }
  head.append(stats);
  b.append(head);
  const probs = deckProblems(d, S.db);
  if (d.missing && d.missing.length) probs.unshift(`Not found in the engine's card list (left out): ${d.missing.slice(0, 6).join(", ")}${d.missing.length > 6 ? "…" : ""}`);
  if (probs.length) {
    const w = el("div", "warn", "Not tournament-legal — fine for playtesting.");
    const ul = el("ul"); probs.slice(0, 6).forEach((p) => ul.append(el("li", null, p))); w.append(ul); b.append(w);
  }
  for (const [label, list] of [["Main Deck", d.main], ["Extra Deck", d.extra], ["Side Deck", d.side || []]]) {
    if (!list.length) continue;
    const sec = el("div", "deck-section"); sec.append(el("span", null, label), el("span", null, String(list.length))); b.append(sec);
    const g = el("div", "deck-grid");
    for (const code of list) { const x = cardImg(code, S.db.name(code)); x.title = S.db.name(code); g.append(x); }
    b.append(g);
  }
  const th = $("#testHand");
  th.replaceChildren();
  $("#testHandCount").textContent = "";
  [...new Set(d.main)].forEach((code) => {
    const btn = el("button"); btn.type = "button"; btn.title = S.db.name(code);
    btn.setAttribute("aria-pressed", "false"); btn.append(cardImg(code, S.db.name(code)));
    btn.onclick = () => {
      const count = [...S.testHand].length;
      if (S.testHand.has(code)) S.testHand.delete(code);
      else if (count < 10) S.testHand.add(code);
      btn.setAttribute("aria-pressed", String(S.testHand.has(code)));
      $("#testHandCount").textContent = S.testHand.size ? `${S.testHand.size} chosen` : "";
    };
    th.append(btn);
  });
}

// ---------------------------------------------------------------------------
// Lobby
function myName() { return ($("#nameInput").value.trim() || "Duelist").slice(0, 24); }
function refreshButtons() {
  const ready = !!(S.deck && S.db && S.worker);
  $("#soloStart").disabled = !ready;
  $("#hostOpen").disabled = !ready;
  $("#joinBtn").disabled = !(S.deck && S.db);
}

function setMode(m) {
  document.querySelectorAll(".seg [data-mode]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mode === m)));
  document.querySelectorAll(".pane[data-pane]").forEach((p) => { p.hidden = p.dataset.pane !== m; });
}
function bindLobby() {
  document.querySelectorAll(".seg [data-mode]").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
  document.querySelectorAll("#firstChips button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("#firstChips button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    $("#soloFirst").value = b.dataset.v;
  }));
  $("#savedDecks").addEventListener("change", (e) => selectDeck(Number(e.target.value)));
  $("#importBtn").addEventListener("click", () => { $("#importError").textContent = ""; $("#importDlg").showModal(); });
  $("#importFile").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    $("#importText").value = await f.text();
    if (!$("#importName").value) $("#importName").value = f.name.replace(/\.(ydk|txt)$/i, "");
  });
  $("#importForm").addEventListener("submit", (e) => {
    if (e.submitter && e.submitter.value === "cancel") return;
    try {
      const d = parseAny($("#importText").value, $("#importName").value.trim() || "Imported deck");
      if ($("#importName").value.trim()) d.name = $("#importName").value.trim();
      useDeck(d, true);
      $("#importText").value = ""; $("#importName").value = "";
    } catch (err) {
      e.preventDefault();
      $("#importError").textContent = "Not a valid deck";
    }
  });
  $("#soloStart").addEventListener("click", startSolo);
  $("#hostOpen").addEventListener("click", openRoom);
  $("#hostClose").addEventListener("click", closeRoom);
  $("#hostStart").addEventListener("click", hostStartDuel);
  $("#copyInvite").addEventListener("click", () => copy(`${location.origin}${location.pathname}#join=${S.room.code}`, "Invite link copied."));
  $("#copyWatch").addEventListener("click", () => copy(`${location.origin}${location.pathname}#watch=${S.room.code}`, "Spectator link copied."));
  $("#joinBtn").addEventListener("click", () => join($("#joinCode").value.trim().toUpperCase()));
  $("#watchBtn").addEventListener("click", () => watch($("#joinCode").value.trim().toUpperCase()));
}
function copy(text, msg) {
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast(msg), () => prompt("Copy this link:", text));
}

function soloDecks() {
  const me = { main: [...S.deck.main], extra: [...S.deck.extra] };
  const noShuffle = S.testHand.size > 0;
  if (noShuffle) {
    // Chosen cards on top (draw order), the rest shuffled underneath.
    const rest = [...me.main];
    const top = [];
    for (const c of S.testHand) { const i = rest.indexOf(c); if (i >= 0) { top.push(c); rest.splice(i, 1); } }
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    me.main = [...top, ...rest];
  }
  const oppKind = $("#soloOppDeck").value;
  const opp = oppKind === "same" ? { main: [...S.deck.main], extra: [...S.deck.extra] } : { main: Array(40).fill(FILLER), extra: [] };
  return { me, opp, noShuffle };
}

async function startSolo() {
  await startWorker();
  const { me, opp, noShuffle } = soloDecks();
  const first = $("#soloFirst").value === "random" ? (Math.random() < 0.5 ? "me" : "opp") : $("#soloFirst").value;
  const oppMode = $("#soloOpp").value;
  S.mode = "solo";
  S.control = oppMode === "both" ? "both" : "one";
  S.team = first === "me" ? 0 : 1;
  const oppTeam = 1 - S.team;
  const decks = []; decks[S.team] = me; decks[oppTeam] = opp;
  const names = []; names[S.team] = myName(); names[oppTeam] = oppMode === "both" ? "Player 2" : oppMode === "passive" ? "Dummy" : oppMode === "smart" ? "Synapse AI" : "Bot";
  const bots = oppMode === "both" ? {} : { [oppTeam]: oppMode };
  S.lastSolo = { decks, names, bots };
  const opt = { ...options(), noShuffle };
  // Shuffled test hands only apply to my deck: the opponent's deck is shuffled here.
  if (noShuffle) shuffleInPlace(decks[oppTeam].main);
  enterTable();
  S.worker.postMessage({ cmd: "start", decks, names, options: opt, bots });
  
}
function shuffleInPlace(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }

// ----- online: host -----
function openRoom() {
  const code = newRoomCode();
  S.mode = "host";
  S.guest = null; S.specs = 0;
  S.room = new Room({ code, role: "host", name: myName(), onMessage: onHostMessage, onStatus: netStatus });
  S.room.connect();
  $("#roomCode").textContent = code;
  $("#hostIdle").hidden = true; $("#hostRoom").hidden = false;
  $("#hostWaiting").hidden = false; $("#guestInfo").hidden = true; $("#hostStart").disabled = true;
}
function closeRoom() {
  if (S.room) S.room.close();
  S.room = null; S.guest = null; S.mode = null;
  $("#hostIdle").hidden = false; $("#hostRoom").hidden = true; netStatus(null);
}
function onHostMessage(m) {
  if (m.sys === "welcome") { for (const p of m.peers) if (p.role === "spec") S.specs++; return; }
  if (m.sys === "join") {
    if (m.role === "spec") { S.specs++; if (S.packets[2]) S.room.send({ to: "spec", m: { t: "packet", packet: S.packets[2] } }); }
    if (m.role === "guest") toast(`${m.name} joined the room.`);
    return;
  }
  if (m.sys === "leave") {
    if (m.role === "spec") S.specs = Math.max(0, S.specs - 1);
    if (m.role === "guest") { toast(`${m.name} left the room.`); addLog(`${m.name} disconnected. They can rejoin with the same code.`, "sys"); if (!S.packet) { S.guest = null; showGuest(); } }
    return;
  }
  const msg = m.m || {};
  if (m.from === "guest") {
    if (msg.t === "hello") {
      const d = msg.deck || {};
      const clean = (a, n) => (Array.isArray(a) ? a.map(Number).filter((x) => S.db.has(x)).slice(0, n) : []);
      const rejoin = S.guest && S.packet && !S.packet.ended;
      S.guest = { name: String(m.name || msg.name || "Guest").slice(0, 24), deck: { main: clean(d.main, 60), extra: clean(d.extra, 15), side: clean(d.side, 15) } };
      showGuest();
      sendLobby();
      if (rejoin && S.packets[1 - S.hostTeam]) S.room.send({ to: "guest", m: { t: "packet", packet: S.packets[1 - S.hostTeam] } });
    } else if (msg.t === "resp") {
      S.worker.postMessage({ cmd: "respond", team: 1 - S.hostTeam, resp: msg.resp });
    } else if (msg.t === "surrender") {
      S.worker.postMessage({ cmd: "surrender", team: 1 - S.hostTeam });
    } else if (msg.t === "rematch") {
      toast(`${S.guest ? S.guest.name : "Your opponent"} wants a rematch.`);
    }
  }
  if (msg.t === "chat") addChat(m.name, msg.text);
}
function showGuest() {
  const g = S.guest;
  $("#hostWaiting").hidden = !!g;
  $("#guestInfo").hidden = !g;
  $("#hostStart").disabled = !g;
  if (g) $("#guestInfo").textContent = `${g.name} is ready with a ${g.deck.main.length}-card deck (Extra ${g.deck.extra.length}).`;
}
function sendLobby() { if (S.room) S.room.send({ to: "others", m: { t: "lobby", host: myName(), options: options() } }); }
async function hostStartDuel(loserFirst) {
  if (!S.guest) return;
  await startWorker();
  let hostFirst;
  if (typeof loserFirst === "number") hostFirst = loserFirst === 0; // 0: host lost, goes first
  else hostFirst = Math.random() < 0.5;
  S.hostTeam = hostFirst ? 0 : 1;
  S.team = S.hostTeam;
  const g = 1 - S.hostTeam;
  const decks = []; decks[S.hostTeam] = { main: S.deck.main, extra: S.deck.extra }; decks[g] = S.guest.deck;
  const names = []; names[S.hostTeam] = myName(); names[g] = S.guest.name;
  S.packets = {};
  enterTable();
  addLog(`${names[0]} goes first.`, "sys");
  S.room.send({ to: "others", m: { t: "start", first: names[0] } });
  S.worker.postMessage({ cmd: "start", decks, names, options: options(), bots: {} });
}

// ----- online: guest / spectator -----
function join(code) {
  if (!/^[A-Z0-9]{4,12}$/.test(code)) { $("#joinStatus").textContent = "Invalid room code"; return; }
  S.mode = "guest";
  $("#joinStatus").textContent = "Connecting…";
  S.room = new Room({ code, role: "guest", name: myName(), onMessage: onGuestMessage, onStatus: (s, err) => {
    netStatus(s, err);
    if (s === "error") { $("#joinStatus").textContent = err; S.mode = null; }
    if (s === "open") S.room.send({ to: "host", m: { t: "hello", name: myName(), deck: { main: S.deck.main, extra: S.deck.extra, side: S.deck.side || [] } } });
  } });
  S.room.connect();
}
function watch(code) {
  if (!/^[A-Z0-9]{4,12}$/.test(code)) { $("#joinStatus").textContent = "Enter the room code to watch."; return; }
  S.mode = "spec"; S.team = 0;
  S.room = new Room({ code, role: "spec", name: myName(), onMessage: onGuestMessage, onStatus: (s, err) => { netStatus(s, err); if (s === "error") { toast(err, 5000); S.mode = null; } } });
  S.room.connect();
  enterTable();
  $("#loadingText").textContent = "Waiting for the duel to start…";
}
function onGuestMessage(m) {
  if (m.sys === "welcome") { if (S.mode === "guest") $("#joinStatus").textContent = "Joined. Waiting for host…"; return; }
  if (m.sys === "leave" && m.role === "host") { toast("The host left. The duel can't continue.", 6000); addLog("The host disconnected.", "sys"); return; }
  if (m.sys) return;
  const msg = m.m || {};
  if (msg.t === "start") { if ($("#table").hidden) enterTable(); S.log = []; $("#log").replaceChildren(); addLog(`${msg.first} goes first.`, "sys"); $("#result").hidden = true; }
  else if (msg.t === "packet") { if ($("#table").hidden) enterTable(); S.team = msg.packet.viewer === 2 ? 0 : msg.packet.viewer; onPacket(msg.packet); }
  else if (msg.t === "error") toast(msg.error);
  else if (msg.t === "chat") addChat(m.name, msg.text);
  else if (msg.t === "lobby" && S.mode === "guest") $("#joinStatus").textContent = `Joined ${msg.host}'s room. Waiting for them to start…`;
}
function netStatus(s, err) {
  const n = $("#netStatus");
  n.hidden = !s;
  n.className = "net " + (s === "open" ? "ok" : s === "error" || s === "reconnecting" ? "bad" : "");
  n.textContent = s === "open" ? `Online · room ${S.room ? S.room.code : ""}` : s === "reconnecting" ? "Reconnecting…" : s === "error" ? "Not connected" : "Connecting…";
  if (s === "error" && err) toast(err, 5000);
}

// ---------------------------------------------------------------------------
// Worker events
function onWorker(m) {
  if (m.t === "progress") { if (m.done === m.total || m.done % 10 === 0) $("#loadingText").textContent = `Loading card scripts · ${m.done}/${m.total}`; return; }
  if (m.t === "error") {
    if (S.mode === "host" && m.team !== S.hostTeam) { S.room.send({ to: "guest", m: { t: "error", error: m.error } }); return; }
    toast(m.error); return;
  }
  if (m.t !== "packet") return;
  const p = m.packet, v = m.viewer;
  S.packets[v] = p;
  if (S.mode === "host") {
    if (v === 1 - S.hostTeam) S.room.send({ to: "guest", m: { t: "packet", packet: p } });
    else if (v === 2) { if (S.specs > 0) S.room.send({ to: "spec", m: { t: "packet", packet: p } }); }
    else onPacket(p);
    return;
  }
  if (S.mode === "solo") {
    if (S.control === "both") {
      // Show the side that has to act; otherwise stay on the last viewed side.
      const acting = p.waitingFor;
      if (v === 2) return;
      if (acting >= 0 && acting !== v) return;
      if (acting < 0 && v !== S.team) return;
      S.team = v;
      onPacket(p);
    } else if (v === S.team) onPacket(p);
  }
}

// ---------------------------------------------------------------------------
// Table
function enterTable() {
  $("#lobby").hidden = true; $("#table").hidden = false; $("#result").hidden = true;
  S.packet = null; S.log = []; S.fullLog = []; S.prevLP = [null, null];
  $("#log").replaceChildren();
  buildField();
  closeSheet();
  $("#loading").hidden = false; $("#loadingText").textContent = "Preparing duel…";
  window.scrollTo(0, 0);
}
function leaveTable() {
  if (S.mode === "solo") S.worker.postMessage({ cmd: "stop" });
  if (S.mode === "guest" || S.mode === "spec") { if (S.room) S.room.close(); S.room = null; netStatus(null); }
  if (S.mode === "host") { S.worker.postMessage({ cmd: "stop" }); S.packet = null; }
  $("#table").hidden = true; $("#lobby").hidden = false; $("#result").hidden = true;
  closeSheet(); hideMenu();
  if (S.mode !== "host") S.mode = null;
  history.replaceState(null, "", location.pathname);
}

function bindTable() {
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    document.querySelectorAll("[data-pane]").forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.tab; });
  }));
  $("#chatForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("#chatInput").value.trim();
    if (!text) return;
    $("#chatInput").value = "";
    addChat(myName(), text);
    if (S.room) S.room.send({ to: "all", m: { t: "chat", text } });
  });
  $("#surrenderBtn").addEventListener("click", () => {
    if (!S.packet || S.packet.ended || S.mode === "spec") return;
    if (!confirm("Surrender this duel?")) return;
    if (S.mode === "guest") S.room.send({ to: "host", m: { t: "surrender" } });
    else S.worker.postMessage({ cmd: "surrender", team: S.team });
  });
  $("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([S.fullLog.join("\n") + "\n"], { type: "text/plain" });
    const a = el("a"); a.href = URL.createObjectURL(blob); a.download = "duel-log.txt"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $("#rematchBtn").addEventListener("click", rematch);
  $("#leaveBtn").addEventListener("click", leaveTable);
  $("#pileClose").addEventListener("click", () => $("#pile").close());
  // every card offered in a prompt gets an info button, so its text can be read before choosing
  new MutationObserver(() => {
    for (const d of document.querySelectorAll("#sheetBody .opt .card[data-code]:not([data-vw])")) {
      d.dataset.vw = 1;
      const b = el("button", "vw", "i"); b.type = "button"; b.setAttribute("aria-label", "Card details");
      b.addEventListener("click", (e) => { e.stopPropagation(); showInfo({ code: Number(d.dataset.code), position: Number(d.dataset.pos) }, Number(d.dataset.team), Number(d.dataset.loc)); });
      d.append(b);
    }
  }).observe($("#sheetBody"), { childList: true, subtree: true });
  $("#closeInfo").addEventListener("click", () => $("#info").classList.remove("open"));
  document.addEventListener("click", (e) => { const i = $("#info"); if (i.classList.contains("open") && !i.contains(e.target) && !e.target.closest(".c, .card, .chain-stack li, .menu")) i.classList.remove("open"); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#info").classList.remove("open"); });
  $("#sheetMin").addEventListener("click", () => { const s = $("#sheet"); s.classList.toggle("min"); $("#sheetMin").textContent = s.classList.contains("min") ? "▴" : "▾"; });
  document.addEventListener("click", (e) => { if (!e.target.closest(".menu") && !e.target.closest(".card")) hideMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideMenu(); });
}

function rematch() {
  $("#result").hidden = true;
  const ended = S.packet && S.packet.ended;
  if (S.mode === "solo" && S.lastSolo) {
    S.packet = null; S.log = []; $("#log").replaceChildren(); S.prevLP = [null, null];
    const { me, opp, noShuffle } = soloDecks();
    const decks = []; decks[S.team] = me; decks[1 - S.team] = opp;
    if (S.control === "both") { /* keep seats */ }
    S.worker.postMessage({ cmd: "start", decks, names: S.lastSolo.names, options: { ...options(), noShuffle }, bots: S.lastSolo.bots });
  } else if (S.mode === "host") {
    // The loser of the previous duel goes first.
    const loserHost = ended && ended.winner >= 0 ? (ended.winner === S.hostTeam ? 1 : 0) : undefined;
    S.log = []; $("#log").replaceChildren(); S.prevLP = [null, null];
    hostStartDuel(loserHost);
  } else if (S.mode === "guest") {
    S.room.send({ to: "host", m: { t: "rematch" } });
    toast("Asked the host for a rematch.");
  }
}

// ----- field construction -----
// Grid (7×5), my side at the bottom. Opponent rows are mirrored.
function buildField() {
  const f = $("#field");
  f.replaceChildren();
  const add = (row, col, id, cls, lbl) => {
    const z = el("div", "zone " + cls);
    z.style.gridRow = row + 1; z.style.gridColumn = col + 1; z.id = id;
    if (lbl) z.append(el("span", "lbl", lbl));
    f.append(z);
    return z;
  };
  add(0, 0, "op-deck", "op pile", "DECK");
  for (let i = 0; i < 5; i++) add(0, 5 - i, "op-s" + i, "op sz" + (i === 0 || i === 4 ? " pz" : ""), "");
  add(0, 6, "op-extra", "op pile", "EXTRA");
  add(1, 0, "op-grave", "op pile", "GY");
  for (let i = 0; i < 5; i++) add(1, 5 - i, "op-m" + i, "op mz", "");
  add(1, 6, "op-field", "op sz", "FIELD");
  add(2, 0, "op-banished", "op pile", "BANISHED");
  add(2, 2, "emz-l", "emz", "EMZ");
  add(2, 4, "emz-r", "emz", "EMZ");
  add(2, 6, "me-banished", "me pile", "BANISHED");
  add(3, 0, "me-field", "me sz", "FIELD");
  for (let i = 0; i < 5; i++) add(3, 1 + i, "me-m" + i, "me mz", "");
  add(3, 6, "me-grave", "me pile", "GY");
  add(4, 0, "me-extra", "me pile", "EXTRA");
  for (let i = 0; i < 5; i++) add(4, 1 + i, "me-s" + i, "me sz" + (i === 0 || i === 4 ? " pz" : ""), "");
  add(4, 6, "me-deck", "me pile", "DECK");
  for (const z of f.querySelectorAll(".zone")) z.addEventListener("click", (e) => onZoneClick(z, e));
  const ph = $("#phases");
  ph.replaceChildren();
  for (const [lbl, bit, title] of [["DP", C.PHASE.DRAW, "Draw Phase"], ["SP", C.PHASE.STANDBY, "Standby Phase"], ["M1", C.PHASE.MAIN1, "Main Phase 1"],
    ["BP", C.PHASE.BATTLE_START | C.PHASE.BATTLE_STEP | C.PHASE.DAMAGE | C.PHASE.DAMAGE_CAL | C.PHASE.BATTLE, "Battle Phase"], ["M2", C.PHASE.MAIN2, "Main Phase 2"], ["EP", C.PHASE.END, "End Phase"]]) {
    const b = el("button", null, lbl); b.type = "button"; b.title = title; b.dataset.bits = bit; b.dataset.k = lbl;
    b.addEventListener("click", () => phaseClick(lbl));
    ph.append(b);
  }
}

/** Zone element for a field location, from my point of view. */
function zoneId(team, location, seq) {
  const rel = team === S.team ? "me" : "op";
  if (location === C.LOCATION_MZONE) {
    if (seq < 5) return `${rel}-m${seq}`;
    const left = rel === "me" ? seq === 5 : seq === 6;
    return left ? "emz-l" : "emz-r";
  }
  if (location === C.LOCATION_SZONE) return seq < 5 ? `${rel}-s${seq}` : seq === 5 ? `${rel}-field` : null;
  const piles = { [C.LOCATION_GRAVE]: "grave", [C.LOCATION_REMOVED]: "banished", [C.LOCATION_EXTRA]: "extra", [C.LOCATION_DECK]: "deck" };
  return piles[location] ? `${rel}-${piles[location]}` : null;
}

function cardEl(c, team, location, seq, opts = {}) {
  const d = el("div", "card");
  d.dataset.key = key(team, location, seq);
  if (c && !c.hidden && c.code) { d.dataset.code = c.code; d.dataset.pos = c.position || 0; d.dataset.loc = location; d.dataset.team = team; }
  if (team !== S.team && S.team !== 2) d.classList.add("op-back");
  const pos = c && c.position;
  const faceDown = !c || c.hidden || (pos && pos & C.POS_FACEDOWN);
  const onField = location === C.LOCATION_MZONE || location === C.LOCATION_SZONE;
  if (location === C.LOCATION_MZONE && pos & C.POS_DEFENSE) d.classList.add("def");
  if (c && !c.hidden && c.code && faceDown && team === S.team && onField) {
    d.classList.add("peek"); d.append(cardImg(c.code, name(c.code)));
  } else if (faceDown && !(c && !c.hidden && location === C.LOCATION_HAND)) {
    if (c && !c.hidden && c.code && (location === C.LOCATION_EXTRA || location === C.LOCATION_REMOVED)) d.append(cardImg(c.code, name(c.code)));
    else d.classList.add("back");
  } else if (c && c.code) d.append(cardImg(c.code, name(c.code)));
  else d.classList.add("back");
  if (c && !c.hidden && c.status & C.STATUS_DISABLED && onField) d.classList.add("negated");
  if (c && !c.hidden && location === C.LOCATION_MZONE && !(pos & C.POS_FACEDOWN) && c.type & C.TYPE.MONSTER) {
    const s = c.type & C.TYPE.LINK ? `${c.attack} / L${c.link}` : `${c.attack} / ${c.defense}`;
    d.append(el("span", "stat", s));
  }
  if (c && c.overlays && c.overlays.length) d.append(el("span", "badge", String(c.overlays.length)));
  if (c && c.counters && c.counters.length) d.append(el("span", "badge ctr", String(c.counters.reduce((t, x) => t + x[1], 0))));
  if (!opts.static) {
    d.addEventListener("click", (e) => { e.stopPropagation(); onCardClick(c, team, location, seq, d); });
    d.addEventListener("mouseenter", () => { if (c && !c.hidden && c.code) showInfo(c, team, location, false); });
  }
  return d;
}

// ----- render -----
function onPacket(p) {
  const prev = S.packet;
  S.packet = p;
  if (p.log && p.log.length) for (const l of p.log) addLog("Script: " + l, "sys");
  for (const e of p.events) logEvent(e, p);
  render(p, prev);
  handlePrompt(p);
  if (p.ended) showResult(p);
}

function render(p) {
  if (!p.state) return;
  const st = p.state;
  const me = S.team === 2 ? 0 : S.team, op = 1 - me;
  $("#meName").textContent = p.names[me];
  $("#opName").textContent = p.names[op];
  $("#meAvatar").textContent = (p.names[me] || "?").trim().charAt(0).toUpperCase();
  $("#opAvatar").textContent = (p.names[op] || "?").trim().charAt(0).toUpperCase();
  $("#turnNo").textContent = `Turn ${p.turn}`;
  document.querySelector(".duelist.me").classList.toggle("active", !p.ended && p.turnPlayer === me);
  document.querySelector(".duelist.op").classList.toggle("active", !p.ended && p.turnPlayer === op);
  $("#loading").hidden = true;
  const lpMax = Math.max(options().lp, 1);
  for (const [t, id] of [[me, "me"], [op, "op"]]) {
    const z = st.teams[t];
    const prev = S.prevLP[t];
    $(`#${id}LP`).textContent = z.lp;
    $(`#${id}LPBar`).style.width = Math.min(100, (z.lp / lpMax) * 100) + "%";
    if (prev != null && prev !== z.lp) {
      const pop = el("span", "lp-pop " + (z.lp < prev ? "minus" : "plus"), (z.lp < prev ? "−" : "+") + Math.abs(z.lp - prev));
      $(`#${id}LP`).append(pop); setTimeout(() => pop.remove(), 1400);
    }
    S.prevLP[t] = z.lp;
    $(`#${id}Meta`).textContent = `Hand ${z.hand.length} · Deck ${z.deck}`;
  }
  // clear zones
  for (const z of document.querySelectorAll("#field .zone")) {
    for (const c of [...z.children]) if (!c.classList.contains("lbl")) c.remove();
    z.classList.remove("free", "picked");
  }
  for (const t of [0, 1]) {
    const z = st.teams[t];
    z.mzone.forEach((c, i) => { if (c) document.getElementById(zoneId(t, C.LOCATION_MZONE, i)).append(cardEl(c, t, C.LOCATION_MZONE, i)); });
    z.szone.forEach((c, i) => { const id = zoneId(t, C.LOCATION_SZONE, i); if (c && id) document.getElementById(id).append(cardEl(c, t, C.LOCATION_SZONE, i)); });
    const rel = t === me ? "me" : "op";
    for (const [k, loc] of [["grave", C.LOCATION_GRAVE], ["banished", C.LOCATION_REMOVED], ["extra", C.LOCATION_EXTRA]]) {
      const list = z[k];
      const zone = document.getElementById(`${rel}-${k}`);
      if (list.length) {
        const top = k === "extra" ? (list.slice().reverse().find((c) => c && !c.hidden && c.position & C.POS_FACEUP) || list[list.length - 1]) : list[list.length - 1];
        const idx = list.indexOf(top);
        const d = cardEl(top, t, loc, idx, { static: true });
        if (k === "extra" && t === me && !(top.position & C.POS_FACEUP)) { d.replaceChildren(); d.className = "card back"; }
        zone.append(d);
        zone.append(el("span", "cnt", String(list.length)));
      }
    }
    const deckZone = document.getElementById(`${rel}-deck`);
    if (z.deck) {
      const d = el("div", "card back");
      if (z.deckTop) { d.className = "card"; d.append(cardImg(z.deckTop, name(z.deckTop))); }
      deckZone.append(d, el("span", "cnt", String(z.deck)));
    }
  }
  // hands
  const mh = $("#myHand"), oh = $("#opHand");
  mh.replaceChildren(); oh.replaceChildren();
  st.teams[me].hand.forEach((c, i) => mh.append(cardEl(c, me, C.LOCATION_HAND, i)));
  st.teams[op].hand.forEach((c, i) => oh.append(cardEl(c, op, C.LOCATION_HAND, i)));
  // chain
  const ch = $("#chain");
  ch.replaceChildren();
  st.chain.forEach((link, i) => {
    const li = el("li"); li.append(el("b", null, String(i + 1)));
    const im = cardImg(link.code, name(link.code)); im.title = `Chain ${i + 1}: ${name(link.code)}`; li.append(im);
    li.addEventListener("click", () => showInfo({ code: link.code }, link.controller, link.location));
    ch.append(li);
  });
  // phases
  const phaseBits = p.phase;
  document.querySelectorAll("#phases button").forEach((b) => { b.classList.toggle("now", !!(phaseBits & Number(b.dataset.bits))); b.classList.remove("go"); });
  $("#phases").title = `Turn ${p.turn}`;
  const mine = p.waitingFor === me && S.mode !== "spec";
  const st2 = $("#status");
  st2.classList.toggle("mine", mine);
  if (p.ended) setStatus("Duel over.");
  else if (mine) setStatus("Your move");
  else if (p.waitingFor >= 0) setStatus(`Waiting for ${p.names[p.waitingFor]}…`);
  else setStatus("");
}
function setStatus(t) { $("#status").textContent = t; }

// ----- card info -----
function showInfo(c, team, location, open = true) {
  if (!c || !c.code) return;
  const panel = $("#info");
  if (open === false && !panel.classList.contains("open")) return;
  if (open === true) panel.classList.add("open");
  const data = S.db.get(c.code);
  const b = $("#infoBody");
  b.replaceChildren();
  const img = cardImg(c.code, name(c.code)); img.className = "info-img"; img.loading = "eager";
  const def = location === C.LOCATION_MZONE && c.position && (c.position & C.POS_DEFENSE) && !(c.position & C.POS_FACEDOWN);
  if (def) {
    const w = el("div", "info-art def" + (team !== S.team && S.team !== 2 ? " op" : "")); w.append(img); b.append(w);
  } else b.append(img);
  b.append(el("div", "info-name", data ? data.name : `#${c.code}`));
  if (data) {
    const pills = el("div", "pills");
    const pill = (t, hi) => pills.append(el("span", "pill" + (hi ? " hi" : ""), t));
    if (def) pill("Defense Position", true);
    else if (location === C.LOCATION_MZONE && c.position && (c.position & C.POS_ATTACK) && data.type & C.TYPE.MONSTER) pill("Attack Position", true);
    if (data.type & C.TYPE.MONSTER) {
      pill(attributeName(data.attribute), true);
      pill(raceName(data.race));
      const kinds = S.db.typeLine(data).replace(/^\[|\]$/g, "").split(" / ").slice(1);
      kinds.forEach((k) => pill(k));
    } else pill(S.db.typeLine(data), true);
    b.append(pills);
    if (data.type & C.TYPE.MONSTER) {
      const stats = el("div", "stats");
      const stat = (label, v, base) => {
        const d = el("div", "stat"); d.append(el("b", null, label));
        d.append(el("span", base == null ? "" : v > base ? "up" : v < base ? "down" : "", v < 0 ? "?" : String(v)));
        stats.append(d);
      };
      const isLink = data.type & C.TYPE.LINK, isXyz = data.type & C.TYPE.XYZ;
      stat(isLink ? "Link" : isXyz ? "Rank" : "Level", isLink ? (c.link || countBits(data.link_marker)) : (isXyz ? c.rank : c.level) || data.level);
      stat("ATK", c.attack ?? data.atk, data.atk);
      if (!isLink) stat("DEF", c.defense ?? data.def, data.def);
      if (data.type & C.TYPE.PENDULUM) stat("Scale", c.lscale ?? data.lscale);
      b.append(stats);
    }
    b.append(el("div", "info-text", data.desc));
  }
  const extra = [];
  if (c.overlays && c.overlays.length) extra.push("Materials: " + c.overlays.map((x) => S.db.name(x)).join(", "));
  if (c.counters && c.counters.length) extra.push("Counters: " + c.counters.map(([k, n]) => `${S.db.counter(k)} ×${n}`).join(", "));
  if (c.status & C.STATUS_DISABLED) extra.push("Effects negated");
  for (const x of extra) b.append(el("div", "info-extra", x));
  const a = el("a", "info-link", "Open rulings in KodeX");
  a.href = `/#card=${data && data.alias && Math.abs(data.alias - c.code) < 20 ? data.alias : c.code}`; a.target = "_blank"; a.rel = "noopener";
  b.append(a);
}
const countBits = (n) => { let k = 0; while (n) { k += n & 1; n >>>= 1; } return k; };

// ----- clicks -----
function lookup(team, location, seq) {
  const t = S.packet && S.packet.state && S.packet.state.teams[team];
  if (!t) return null;
  const m = { [C.LOCATION_HAND]: "hand", [C.LOCATION_MZONE]: "mzone", [C.LOCATION_SZONE]: "szone", [C.LOCATION_GRAVE]: "grave", [C.LOCATION_REMOVED]: "banished", [C.LOCATION_EXTRA]: "extra" }[location];
  return m ? t[m][seq] : null;
}

function onZoneClick(z, e) {
  if (S.sel && S.sel.places && z.classList.contains("free")) { togglePlace(z); return; }
  const id = z.id;
  const m = /^(me|op)-(grave|banished|extra|deck)$/.exec(id);
  if (m) openPile(m[1] === "me" ? S.team : 1 - S.team, m[2]);
}

function onCardClick(c, team, location, seq, d) {
  const peek = c && !c.hidden && c.code;
  if (peek) showInfo(c, team, location, "render");
  const k = key(team, location, seq);
  if (S.sel && S.sel.byKey && S.sel.byKey.has(k)) { S.sel.pickKey(k); return; }
  const acts = S.actions && S.actions.get(k);
  if (acts && acts.length) { showMenu(d, c, acts); return; }
  if (peek) $("#info").classList.add("open");
  const pile = { [C.LOCATION_GRAVE]: "grave", [C.LOCATION_REMOVED]: "banished", [C.LOCATION_EXTRA]: "extra" }[location];
  if (pile) openPile(team, pile);
}

function showMenu(anchor, c, acts) {
  const m = $("#menu");
  m.replaceChildren();
  if (c && c.code) m.append(el("div", "menu-title", name(c.code)));
  for (const a of acts) {
    const b = el("button", null, a.label); b.type = "button"; b.setAttribute("role", "menuitem");
    b.addEventListener("click", () => { hideMenu(); a.run(); });
    m.append(b);
  }
  if (c && c.code) {
    const info = el("button", null, "Card details"); info.type = "button";
    info.addEventListener("click", () => { hideMenu(); $("#info").classList.add("open"); });
    m.append(info);
  }
  m.hidden = false;
  const r = anchor.getBoundingClientRect();
  const w = m.offsetWidth, h = m.offsetHeight;
  let x = r.left + r.width / 2 - w / 2, y = r.top - h - 8;
  if (y < 60) y = r.bottom + 8;
  x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
  y = Math.max(8, Math.min(window.innerHeight - h - 8, y));
  m.style.left = x + "px"; m.style.top = y + "px";
  m.querySelector("button").focus();
}
function hideMenu() { $("#menu").hidden = true; }

function openPile(team, kind) {
  const st = S.packet && S.packet.state;
  if (!st) return;
  const z = st.teams[team];
  const loc = { grave: C.LOCATION_GRAVE, banished: C.LOCATION_REMOVED, extra: C.LOCATION_EXTRA, deck: C.LOCATION_DECK }[kind];
  const label = { grave: "GY", banished: "banished cards", extra: "Extra Deck", deck: "Deck" }[kind];
  $("#pileTitle").textContent = `${whose(team)} ${label}`;
  const body = $("#pileBody");
  body.replaceChildren();
  if (kind === "deck") body.append(el("p", "empty", `${z.deck} cards. The Deck is hidden.`));
  const list = (z[kind] || []).map((c, i) => [c, i]).reverse();
  if (kind !== "deck" && !list.length) body.append(el("p", "empty", "Empty."));
  for (const [c, i] of list) {
    const o = el("div", "opt");
    const d = cardEl(c, team, loc, i);
    o.append(d);
    const acts = S.actions && S.actions.get(key(team, loc, i));
    if (acts) {
      d.classList.add("act");
      for (const a of acts) { const b = el("button", "btn small", a.label); b.type = "button"; b.onclick = () => { $("#pile").close(); a.run(); }; o.append(b); }
    }
    body.append(o);
  }
  $("#pile").showModal();
}

function phaseClick(k) {
  const p = S.packet && S.packet.prompt;
  if (!p) return;
  const msg = p.msg;
  if (msg.type === M.SELECT_IDLECMD) {
    if (k === "BP" && msg.to_bp) send({ t: msg.type, action: C.IDLE.TO_BP });
    if (k === "EP" && msg.to_ep) send({ t: msg.type, action: C.IDLE.TO_EP });
  } else if (msg.type === M.SELECT_BATTLECMD) {
    if (k === "M2" && msg.to_m2) send({ t: msg.type, action: C.BATTLE_ACT.TO_M2 });
    if (k === "EP" && msg.to_ep) send({ t: msg.type, action: C.BATTLE_ACT.TO_EP });
  }
}

// ---------------------------------------------------------------------------
// Prompts
function send(resp) {
  hideMenu(); closeSheet();
  S.actions = null;
  document.querySelectorAll(".card.act").forEach((c) => c.classList.remove("act"));
  const team = S.team;
  if (S.mode === "guest") S.room.send({ to: "host", m: { t: "resp", resp } });
  else S.worker.postMessage({ cmd: "respond", team, resp });
  setStatus("…");
}

function handlePrompt(p) {
  S.actions = null; S.sel = null;
  closeSheet();
  if (!p.prompt || p.ended || S.mode === "spec") return;
  const { msg, hint } = p.prompt;
  // SELECT_PLACE/POSITION hints carry the card being placed; other hints are text ids.
  const hintCard = hint && S.db.has(Number(hint)) && Number(hint) > 9999 ? Number(hint) : 0;
  const title = hintCard ? `Choose a zone for ${name(hintCard)}` : hint && hint !== "0" ? S.db.desc(hint) : "";
  switch (msg.type) {
    case M.SELECT_IDLECMD: return idlePrompt(msg);
    case M.SELECT_BATTLECMD: return battlePrompt(msg);
    case M.SELECT_CHAIN: return chainPrompt(msg);
    case M.SELECT_EFFECTYN: return yesNo(msg, `Use the effect of ${name(msg.code)}?`, msg.description !== "0" ? S.db.desc(msg.description) : where(msg));
    case M.SELECT_YESNO: return yesNo(msg, S.db.desc(msg.description), "");
    case M.SELECT_OPTION: return optionPrompt(msg, title);
    case M.SELECT_CARD: case M.SELECT_TRIBUTE: return cardPrompt(msg, title || (msg.type === M.SELECT_TRIBUTE ? "Select monsters to Tribute" : "Select cards"));
    case M.SELECT_SUM: return sumPrompt(msg, title || "Select cards");
    case M.SELECT_UNSELECT_CARD: return unselectPrompt(msg, title || "Select cards");
    case M.SELECT_PLACE: case M.SELECT_DISFIELD: return placePrompt(msg, title);
    case M.SELECT_POSITION: return positionPrompt(msg);
    case M.SORT_CARD: case M.SORT_CHAIN: return sortPrompt(msg);
    case M.SELECT_COUNTER: return counterPrompt(msg);
    case M.ANNOUNCE_RACE: return bitsPrompt(msg, "Declare a Type", C.RACES.map((n, i) => [1n << BigInt(i), n]));
    case M.ANNOUNCE_ATTRIB: return bitsPrompt(msg, "Declare an Attribute", C.ATTRIBUTES.map(([b, n]) => [BigInt(b), n]));
    case M.ANNOUNCE_CARD: return announceCard(msg);
    case M.ANNOUNCE_NUMBER: return numberPrompt(msg);
    case M.ROCK_PAPER_SCISSORS: return rps(msg);
  }
  toast("Unhandled decision: " + C.MSG_NAME[msg.type]);
}

function addAction(map, team, loc, seq, label, run) {
  const k = key(team, loc, seq);
  if (!map.has(k)) map.set(k, []);
  map.get(k).push({ label, run });
}
function markActions() {
  document.querySelectorAll(".card.act").forEach((c) => c.classList.remove("act"));
  if (!S.actions) return;
  for (const k of S.actions.keys()) {
    const [t, loc] = k.split(":").map(Number);
    const c = document.querySelector(`.card[data-key="${k}"]`);
    if (c) c.classList.add("act");
    else {
      const z = document.getElementById(zoneId(t, loc, 0) || "");
      const top = z && z.querySelector(".card");
      if (top) top.classList.add("act");
    }
  }
}
function activateLabel(a) {
  const d = a.description && a.description !== "0" ? S.db.desc(a.description) : "";
  return d && !/^#/.test(d) && !d.endsWith("(effect 1)") ? `Activate: ${d}` : "Activate";
}

function idlePrompt(msg) {
  const map = new Map();
  const I = C.IDLE;
  msg.summons.forEach((c, i) => addAction(map, c.controller, c.location, c.sequence, "Normal Summon", () => send({ t: msg.type, action: I.SUMMON, index: i })));
  msg.special_summons.forEach((c, i) => addAction(map, c.controller, c.location, c.sequence, "Special Summon", () => send({ t: msg.type, action: I.SPSUMMON, index: i })));
  msg.pos_changes.forEach((c, i) => addAction(map, c.controller, c.location, c.sequence, "Change position", () => send({ t: msg.type, action: I.REPOS, index: i })));
  msg.monster_sets.forEach((c, i) => addAction(map, c.controller, c.location, c.sequence, "Set", () => send({ t: msg.type, action: I.MSET, index: i })));
  msg.spell_sets.forEach((c, i) => addAction(map, c.controller, c.location, c.sequence, "Set", () => send({ t: msg.type, action: I.SSET, index: i })));
  msg.activates.forEach((c, i) => addAction(map, c.controller, c.location, c.sequence, activateLabel(c), () => send({ t: msg.type, action: I.ACTIVATE, index: i })));
  S.actions = map;
  markActions();
  const go = (k, ok) => { const b = document.querySelector(`#phases button[data-k="${k}"]`); if (b && ok) b.classList.add("go"); };
  go("BP", msg.to_bp); go("EP", msg.to_ep);
  setStatus(`Your move · select a highlighted card${msg.to_bp ? ", BP to battle" : ""} or EP to end the turn`);
}

function battlePrompt(msg) {
  const map = new Map();
  msg.attacks.forEach((c, i) => addAction(map, c.controller, c.location, c.sequence, c.can_direct ? "Attack (can attack directly)" : "Attack", () => send({ t: msg.type, action: C.BATTLE_ACT.ATTACK, index: i })));
  msg.chains.forEach((c, i) => addAction(map, c.controller, c.location, c.sequence, activateLabel(c), () => send({ t: msg.type, action: C.BATTLE_ACT.ACTIVATE, index: i })));
  S.actions = map;
  markActions();
  const go = (k, ok) => { const b = document.querySelector(`#phases button[data-k="${k}"]`); if (b && ok) b.classList.add("go"); };
  go("M2", msg.to_m2); go("EP", msg.to_ep);
  setStatus(`Battle · select an attacker${msg.to_m2 ? ", M2" : ""} or EP`);
}

function chainPrompt(msg) {
  if (!msg.selects.length && !msg.forced) { send({ t: msg.type, index: null }); return; }
  if (S.chainSkip && !msg.forced) { send({ t: msg.type, index: null }); return; }
  const chain = S.packet.state.chain;
  const last = chain.length ? chain[chain.length - 1] : null;
  openSheet(msg.forced ? "Activate an effect" : "Chain a card or effect?", last ? `Chain ${chain.length}: ${name(last.code)}` : "");
  const body = $("#sheetBody");
  msg.selects.forEach((c, i) => {
    const o = optCard(c, activateLabel(c).replace(/^Activate: /, ""));
    o.querySelector(".card").addEventListener("click", (e) => { e.stopPropagation(); send({ t: msg.type, index: i }); });
    body.append(o);
  });
  if (!msg.forced) sheetButton("Don't chain", () => send({ t: msg.type, index: null }), "primary");
}

function yesNo(msg, title, text) {
  openSheet(title || "Confirm", text);
  if (msg.code) { const o = optCard({ code: msg.code, controller: msg.controller, location: msg.location, sequence: msg.sequence }, ""); $("#sheetBody").append(o); }
  sheetButton("No", () => send({ t: msg.type, yes: false }));
  sheetButton("Yes", () => send({ t: msg.type, yes: true }), "primary");
}

function optionPrompt(msg, title) {
  openSheet(title || "Choose an effect", "");
  const list = el("div", "choice-list");
  msg.options.forEach((o, i) => { const b = el("button", "btn", S.db.desc(o)); b.type = "button"; b.onclick = () => send({ t: msg.type, index: i }); list.append(b); });
  $("#sheetBody").append(list);
}

/** Card tile for a prompt; fills in what this player can see from the field state. */
function optCard(c, label) {
  const o = el("div", "opt");
  const known = lookup(c.controller, c.location, c.sequence);
  const view = c.code ? { ...(known && !known.hidden ? known : {}), code: c.code, position: c.position ?? (known && known.position) } : known || { hidden: true };
  const d = cardEl(view.hidden ? { hidden: true } : { ...view, position: C.POS_FACEUP_ATTACK }, c.controller, -1, c.sequence, { static: true });
  d.addEventListener("mouseenter", () => { if (view.code) showInfo(view, c.controller, c.location, false); });
  o.append(d);
  if (label) o.append(el("span", "where", label));
  o.append(el("span", "where", where(c)));
  return o;
}

function cardPrompt(msg, title) {
  const tribute = msg.type === M.SELECT_TRIBUTE;
  const single = msg.min === 1 && msg.max === 1 && !tribute;
  openSheet(title, single ? "" : `Choose ${msg.min === msg.max ? msg.min : `${msg.min}–${msg.max}`}.`);
  const chosen = new Set();
  const confirm = sheetButton("Confirm", () => send({ t: msg.type, indices: [...chosen] }), "primary");
  if (single) confirm.hidden = true;
  if (msg.can_cancel) sheetButton("Cancel", () => send({ t: msg.type, indices: null }));
  const value = () => tribute ? [...chosen].reduce((t, i) => t + (msg.selects[i].release_param || 1), 0) : chosen.size;
  const need = msg.min === msg.max ? `${msg.min}` : `${msg.min}–${msg.max}`;
  const update = () => {
    const v = value();
    confirm.disabled = !(v >= msg.min && v <= msg.max && chosen.size > 0);
    if (!single) { $("#sheetText").hidden = false; $("#sheetText").textContent = `Choose ${need}${tribute ? " Tributes" : ""}. Selected: ${v}.`; }
  };
  const tiles = [];
  const pick = (i) => {
    if (single) { send({ t: msg.type, indices: [i] }); return; }
    if (chosen.has(i)) chosen.delete(i); else if (chosen.size < msg.max) chosen.add(i);
    tiles.forEach((t, j) => t.querySelector(".card").classList.toggle("selected", chosen.has(j)));
    markFieldSelection(msg.selects, chosen);
    update();
  };
  msg.selects.forEach((c, i) => {
    const o = optCard(c, "");
    o.querySelector(".card").classList.add("selectable");
    o.querySelector(".card").addEventListener("click", (e) => { e.stopPropagation(); pick(i); });
    tiles.push(o); $("#sheetBody").append(o);
  });
  fieldSelection(msg.selects, pick);
  update();
}

function fieldSelection(list, pick) {
  const byKey = new Map();
  list.forEach((c, i) => byKey.set(key(c.controller, c.location, c.sequence), i));
  S.sel = { byKey, pickKey: (k) => pick(byKey.get(k)) };
  for (const k of byKey.keys()) { const c = document.querySelector(`#field .card[data-key="${k}"], .hand .card[data-key="${k}"]`); if (c) c.classList.add("selectable"); }
}
function markFieldSelection(list, chosen) {
  list.forEach((c, i) => { const d = document.querySelector(`#field .card[data-key="${key(c.controller, c.location, c.sequence)}"], .hand .card[data-key="${key(c.controller, c.location, c.sequence)}"]`); if (d) d.classList.toggle("selected", chosen.has(i)); });
}

function sumPrompt(msg, title) {
  openSheet(title, `${msg.select_max ? "Total at least" : "Total exactly"} ${msg.amount}.`);
  const chosen = [];
  const confirm = sheetButton("Confirm", () => send({ t: msg.type, indices: [...chosen] }), "primary");
  const body = $("#sheetBody");
  for (const c of msg.selects_must) { const o = optCard(c, "Must use"); o.querySelector(".card").classList.add("selected"); o.append(el("span", "amt", sumLabel(c.amount))); body.append(o); }
  const tiles = msg.selects.map((c, i) => {
    const o = optCard(c, "");
    o.append(el("span", "amt", sumLabel(c.amount)));
    const d = o.querySelector(".card");
    d.classList.add("selectable");
    d.addEventListener("click", (e) => { e.stopPropagation(); toggle(i); });
    body.append(o);
    return d;
  });
  const toggle = (i) => {
    const j = chosen.indexOf(i);
    if (j >= 0) chosen.splice(j, 1); else chosen.push(i);
    tiles.forEach((d, k) => d.classList.toggle("selected", chosen.includes(k)));
    confirm.disabled = !sumValid(msg, chosen);
  };
  fieldSelection(msg.selects, toggle);
  confirm.disabled = !sumValid(msg, chosen);
}
const sumLabel = (a) => { const lo = a & 0xffff, hi = a >>> 16; return hi && hi !== lo ? `${lo} or ${hi}` : String(lo); };

function unselectPrompt(msg, title) {
  openSheet(title, msg.can_finish ? "" : `Pick ${msg.min === msg.max ? msg.min : `${msg.min}–${msg.max}`}.`);
  const body = $("#sheetBody");
  const all = [...msg.select_cards.map((c, i) => [c, i, false]), ...msg.unselect_cards.map((c, i) => [c, msg.select_cards.length + i, true])];
  for (const [c, idx, picked] of all) {
    const o = optCard(c, picked ? "Selected (tap to undo)" : "");
    const d = o.querySelector(".card");
    d.classList.add(picked ? "selected" : "selectable");
    d.addEventListener("click", (e) => { e.stopPropagation(); send({ t: msg.type, index: idx }); });
    body.append(o);
  }
  fieldSelection(all.map(([c]) => c), (i) => send({ t: msg.type, index: all[i][1] }));
  if (msg.can_finish) sheetButton("Finish", () => send({ t: msg.type, index: -1 }), "primary");
  else if (msg.can_cancel) sheetButton("Cancel", () => send({ t: msg.type, index: -1 }));
}

function placePrompt(msg, title) {
  const free = placesFromMask(msg.field_mask, msg.player);
  openSheet(title || (msg.type === M.SELECT_DISFIELD ? "Choose a zone to make unusable" : "Choose a zone"), "");
  $("#sheet").classList.add("min"); $("#sheetMin").textContent = "▴";
  const picked = [];
  const byZone = new Map();
  for (const p of free) {
    const id = zoneId(p.player, p.location, p.sequence);
    if (!id) continue;
    const z = document.getElementById(id);
    if (!z) continue;
    // Shared Extra Monster Zones map two (player, sequence) pairs to one element: prefer my own.
    if (byZone.has(id) && byZone.get(id).player === msg.player) continue;
    byZone.set(id, p);
    z.classList.add("free");
  }
  S.sel = { places: true, byZone, picked, msg };
  if (!byZone.size) { send({ t: msg.type, places: free.slice(0, msg.count) }); }
}
function togglePlace(z) {
  const s = S.sel;
  const p = s.byZone.get(z.id);
  const i = s.picked.indexOf(p);
  if (i >= 0) { s.picked.splice(i, 1); z.classList.remove("picked"); return; }
  s.picked.push(p); z.classList.add("picked");
  if (s.picked.length >= s.msg.count) {
    document.querySelectorAll(".zone.free").forEach((x) => x.classList.remove("free", "picked"));
    send({ t: s.msg.type, places: s.picked });
  }
}

function positionPrompt(msg) {
  openSheet(`Choose a battle position for ${name(msg.code)}`, "");
  const body = $("#sheetBody");
  for (const [bit, label] of [[C.POS_FACEUP_ATTACK, "Face-up Attack"], [C.POS_FACEDOWN_ATTACK, "Face-down Attack"], [C.POS_FACEUP_DEFENSE, "Face-up Defense"], [C.POS_FACEDOWN_DEFENSE, "Face-down Defense"]]) {
    if (!(msg.positions & bit)) continue;
    const o = el("div", "opt rot");
    if (bit & C.POS_DEFENSE) { o.style.width = "calc(max(var(--ch), 85px) + 10px)"; }
    const d = cardEl({ code: msg.code, position: bit }, S.team, C.LOCATION_MZONE, -1, { static: true });
    if (bit & C.POS_FACEDOWN) { d.replaceChildren(); d.className = "card back" + (bit & C.POS_DEFENSE ? " def" : ""); }
    d.style.margin = bit & C.POS_DEFENSE ? "calc(14px - (max(var(--ch), 85px) - max(var(--cw), 58px)) / 2) 0" : "14px 0"; d.addEventListener("click", () => send({ t: msg.type, position: bit }));
    o.append(d, el("span", "where", label));
    body.append(o);
  }
}

function sortPrompt(msg) {
  openSheet(msg.type === M.SORT_CHAIN ? "Order your Chain Links" : "Choose the order", "");
  const order = [];
  const body = $("#sheetBody");
  const tiles = msg.cards.map((c, i) => {
    const o = optCard(c, "");
    const tag = el("span", "amt", "");
    o.append(tag);
    o.querySelector(".card").addEventListener("click", () => {
      const j = order.indexOf(i);
      if (j >= 0) order.splice(j, 1); else order.push(i);
      tiles.forEach((t, k) => { const n = order.indexOf(k); t.tag.textContent = n >= 0 ? `#${n + 1}` : ""; t.o.querySelector(".card").classList.toggle("selected", n >= 0); });
      confirm.disabled = order.length !== msg.cards.length;
    });
    body.append(o);
    return { o, tag };
  });
  // The core expects, for each card, its position in the new order.
  const confirm = sheetButton("Confirm order", () => { const pos = []; order.forEach((card, n) => { pos[card] = n; }); send({ t: msg.type, order: pos }); }, "primary");
  confirm.disabled = true;
  sheetButton("Keep current order", () => send({ t: msg.type, order: null }));
}

function counterPrompt(msg) {
  openSheet(`Remove ${msg.count} ${S.db.counter(msg.counter_type)}`, "");
  const vals = msg.cards.map(() => 0);
  const body = $("#sheetBody");
  const confirm = sheetButton("Confirm", () => send({ t: msg.type, counters: vals }), "primary");
  const upd = () => { confirm.disabled = vals.reduce((a, b) => a + b, 0) !== msg.count; };
  msg.cards.forEach((c, i) => {
    const o = optCard(c, `has ${c.count}`);
    const row = el("div", "row gap");
    const minus = el("button", null, "−"), plus = el("button", null, "+"), v = el("b", null, "0");
    minus.type = plus.type = "button";
    minus.onclick = () => { if (vals[i] > 0) vals[i]--; v.textContent = vals[i]; upd(); };
    plus.onclick = () => { if (vals[i] < c.count) vals[i]++; v.textContent = vals[i]; upd(); };
    row.append(minus, v, plus);
    const wrap = el("div", "counter-row"); wrap.append(o, row);
    body.append(wrap);
  });
  upd();
}

function bitsPrompt(msg, title, all) {
  const avail = BigInt(msg.available);
  openSheet(title, msg.count > 1 ? `Choose ${msg.count}.` : "");
  const chosen = new Set();
  const chips = el("div", "chips");
  const confirm = sheetButton("Declare", () => {
    let v = 0n; for (const b of chosen) v |= b;
    send({ t: msg.type, value: msg.type === M.ANNOUNCE_ATTRIB ? Number(v) : v.toString() });
  }, "primary");
  for (const [bit, label] of all) {
    if (!(avail & bit)) continue;
    const b = el("button", null, label); b.type = "button"; b.setAttribute("aria-pressed", "false");
    b.onclick = () => {
      if (chosen.has(bit)) chosen.delete(bit); else if (chosen.size < msg.count) chosen.add(bit);
      b.setAttribute("aria-pressed", String(chosen.has(bit)));
      confirm.disabled = chosen.size !== msg.count;
    };
    chips.append(b);
  }
  $("#sheetBody").append(chips);
  confirm.disabled = true;
}

function announceCard(msg) {
  openSheet("Declare a card name", "");
  const box = el("div", "announce");
  const input = el("input"); input.placeholder = "Card name"; input.setAttribute("aria-label", "Card name");
  const list = el("div", "announce-list");
  box.append(input, list);
  $("#sheetBody").append(box);
  const all = Object.keys(S.db.raw).map((c) => S.db.get(c)).filter((c) => isDeclarable(c, msg.opcodes));
  const show = () => {
    const q = input.value.trim().toLowerCase();
    list.replaceChildren();
    const hits = (q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all).slice(0, 60);
    for (const c of hits) {
      const b = el("button"); b.type = "button";
      b.append(cardImg(c.code, ""), el("span", null, c.name));
      b.onclick = () => send({ t: msg.type, code: c.code });
      b.onmouseenter = () => showInfo({ code: c.code }, 0, 0, false);
      list.append(b);
    }
    if (!hits.length) list.append(el("p", "empty", "No card matches."));
  };
  input.addEventListener("input", show);
  show();
  setTimeout(() => input.focus(), 50);
}

function numberPrompt(msg) {
  openSheet("Declare a number", "");
  const chips = el("div", "chips");
  msg.options.forEach((n, i) => { const b = el("button", null, String(n)); b.type = "button"; b.onclick = () => send({ t: msg.type, index: i }); chips.append(b); });
  $("#sheetBody").append(chips);
}

function rps(msg) {
  openSheet("Rock, paper, scissors", "");
  const chips = el("div", "chips");
  [["Scissors", 1], ["Rock", 2], ["Paper", 3]].forEach(([l, v]) => { const b = el("button", null, l); b.type = "button"; b.onclick = () => send({ t: msg.type, value: v }); chips.append(b); });
  $("#sheetBody").append(chips);
}

function openSheet(title, text) {
  const s = $("#sheet");
  s.hidden = false; s.classList.remove("min"); $("#sheetMin").textContent = "▾";
  $("#sheetTitle").textContent = title;
  $("#sheetText").textContent = text || "";
  $("#sheetText").hidden = !text;
  $("#sheetBody").replaceChildren();
  $("#sheetActions").replaceChildren();
}
function closeSheet() {
  $("#sheet").hidden = true;
  document.querySelectorAll(".card.selectable, .card.selected").forEach((c) => c.classList.remove("selectable", "selected"));
  document.querySelectorAll(".zone.free").forEach((x) => x.classList.remove("free", "picked"));
  S.sel = null;
}
function sheetButton(label, fn, kind = "") {
  const b = el("button", "btn " + kind, label); b.type = "button"; b.onclick = fn;
  $("#sheetActions").append(b);
  return b;
}

// ---------------------------------------------------------------------------
// Log, chat, result
function addLog(text, cls = "", codes = []) {
  const li = el("li", cls);
  const parts = String(text).split(/(\[\[\d+\]\])/);
  for (const part of parts) {
    const m = /^\[\[(\d+)\]\]$/.exec(part);
    if (m) { const s = el("span", "c", name(Number(m[1]))); s.onclick = () => showInfo({ code: Number(m[1]) }); li.append(s); }
    else if (part) li.append(part);
  }
  const plain = li.textContent;
  S.fullLog.push(plain);
  const log = $("#log");
  log.append(li);
  while (log.children.length > 400) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
}
function addChat(who, text) {
  const li = el("li"); li.append(el("b", null, who + ": "), String(text).slice(0, 200));
  $("#chatList").append(li); $("#chatList").scrollTop = 1e9;
  S.fullLog.push(`[chat] ${who}: ${text}`);
  const tab = document.querySelector('.tabs [data-tab="chat"]');
  if (tab.getAttribute("aria-selected") !== "true") tab.textContent = "Chat •";
  tab.onclick = () => { tab.textContent = "Chat"; };
}
const cn = (code) => (code ? `[[${code}]]` : "a face-down card");
const PHASES = { 1: "Draw Phase", 2: "Standby Phase", 4: "Main Phase 1", 8: "Battle Phase", 0x10: "Battle Step", 0x20: "Damage Step", 0x40: "Damage Calculation", 0x80: "End of Battle", 0x100: "Main Phase 2", 0x200: "End Phase" };

function logEvent(e, p) {
  const pn = (t) => (t === S.team && S.mode !== "spec" ? "You" : p.names[t]);
  const at = (l) => { const c = l && lookup(l.controller, l.location, l.sequence); return c && c.code ? cn(c.code) : "a monster"; };
  switch (e.type) {
    case M.NEW_TURN: addLog(`Turn ${p.turn}: ${p.names[e.player]}`, "turn"); break;
    case M.NEW_PHASE: addLog(PHASES[e.phase] || "Phase", "phase"); break;
    case M.SUMMONING: addLog(`${pn(e.controller)} Normal Summoned ${cn(e.code)}`); break;
    case M.SPSUMMONING: addLog(`${pn(e.controller)} Special Summoned ${cn(e.code)}`); break;
    case M.FLIPSUMMONING: addLog(`${pn(e.controller)} Flip Summoned ${cn(e.code)}`); break;
    case M.SET: addLog(`${pn(e.controller)} Set a card`); break;
    case M.CHAINING: addLog(`Chain ${e.chain_size}: ${pn(e.controller)} activated ${cn(e.code)}`, "chain"); break;
    case M.CHAIN_NEGATED: addLog(`Chain ${e.chain_size} was negated`, "chain"); break;
    case M.CHAIN_DISABLED: addLog(`Chain ${e.chain_size}'s effect was negated`, "chain"); break;
    case M.DRAW: addLog(`${pn(e.player)} drew ${e.drawn.length === 1 ? (e.drawn[0].code ? cn(e.drawn[0].code) : "1 card") : e.drawn.length + " cards"}`); break;
    case M.DAMAGE: addLog(`${pn(e.player)} took ${e.amount} damage`, "dmg"); break;
    case M.RECOVER: addLog(`${pn(e.player)} gained ${e.amount} LP`); break;
    case M.PAY_LPCOST: addLog(`${pn(e.player)} paid ${e.amount} LP`); break;
    case M.ATTACK: addLog(`${at(e.card)} attacks ${e.target ? at(e.target) : "directly"}`); break;
    case M.TOSS_COIN: addLog(`${pn(e.player)} tossed a coin: ${e.results.map((x) => (x ? "Heads" : "Tails")).join(", ")}`); break;
    case M.TOSS_DICE: addLog(`${pn(e.player)} rolled: ${e.results.join(", ")}`); break;
    case M.CONFIRM_CARDS: if (e.cards.length) addLog(`Revealed: ${e.cards.map((c) => cn(c.code)).join(", ")}`); break;
    case M.SHUFFLE_HAND: if (e.player === S.team) { /* quiet */ } break;
    case M.HINT:
      if (e.hint_type === C.HINT.OPSELECTED) addLog(`${pn(e.player)} chose: ${S.db.desc(e.hint)}`, "sys");
      else if (e.hint_type === C.HINT.CODE) addLog(`${pn(e.player)} declared ${cn(Number(e.hint))}`, "sys");
      else if (e.hint_type === C.HINT.NUMBER) addLog(`${pn(e.player)} declared ${e.hint}`, "sys");
      else if (e.hint_type === C.HINT.RACE) addLog(`${pn(e.player)} declared ${raceName(e.hint)}`, "sys");
      else if (e.hint_type === C.HINT.ATTRIB) addLog(`${pn(e.player)} declared ${attributeName(Number(e.hint))}`, "sys");
      else if (e.hint_type === C.HINT.MESSAGE) toast(S.db.desc(e.hint));
      break;
    case M.MOVE: {
      const to = e.to, from = e.from;
      if (to.location === C.LOCATION_GRAVE) addLog(`${cn(e.code)} was ${e.reason & C.REASON.DESTROY ? "destroyed" : e.reason & C.REASON.DISCARD ? "discarded" : "sent to the GY"}`);
      else if (to.location === C.LOCATION_REMOVED) addLog(`${cn(e.code)} was banished${to.position & C.POS_FACEDOWN ? " face-down" : ""}`);
      else if (to.location === C.LOCATION_HAND && from.location !== C.LOCATION_DECK) addLog(`${cn(e.code)} returned to ${pn(to.controller) === "You" ? "your" : pn(to.controller) + "'s"} hand`);
      else if (to.location === C.LOCATION_HAND && from.location === C.LOCATION_DECK) addLog(`${pn(to.controller)} added ${cn(e.code)} from the Deck to the hand`);
      else if (to.location === C.LOCATION_DECK && from.location !== C.LOCATION_DECK) addLog(`${cn(e.code)} returned to the Deck`);
      else if (to.location === C.LOCATION_EXTRA && from.location & (C.LOCATION_ONFIELD | C.LOCATION_GRAVE | C.LOCATION_REMOVED)) addLog(`${cn(e.code)} returned to the Extra Deck`);
      break;
    }
    case M.RETRY: toast("That choice isn't allowed. Try again."); break;
    case M.WIN: break;
  }
}

function showResult(p) {
  const me = S.team;
  const w = p.ended.winner;
  const title = w === 2 || w < 0 ? "Draw" : S.mode === "spec" ? `${p.names[w]} wins` : w === me ? "You win" : "You lose";
  $("#resultTitle").textContent = title;
  $("#resultTitle").className = w === me && S.mode !== "spec" ? "win" : "";
  $("#resultText").textContent = p.ended.reason || "";
  $("#rematchBtn").hidden = S.mode === "spec";
  $("#rematchBtn").textContent = S.mode === "guest" ? "Ask for a rematch" : "Rematch";
  addLog(`${title}${p.ended.reason ? ` — ${p.ended.reason}` : ""}`, "turn");
  setTimeout(() => { $("#result").hidden = false; }, 700);
}

window.__duel = S; // for automated tests and debugging
boot();
