// Duel Synapse Arena — browser client.
// Modes: solo playtest (engine in a Web Worker), online host (engine in the host's worker,
// relayed through the Worker's Durable Object), online guest and spectator.
import { SITE, BUNDLED } from "./site.js";
import { CardDB, attributeName, raceName } from "./engine/data.js";
import * as C from "./engine/constants.js";
import { isDeclarable, placesFromMask, sumValid } from "./engine/rules.js";
import { parseAny, resolveDeck, deckProblems, decodeKodex, encodeKodex, toYdk } from "./deck.js";
import { Room, newRoomCode } from "./net.js";
import { Learning } from "./learning.js";
import * as Sound from "./audio.js";
import { rulingsFor } from "./rulings.js";
import { runFinisher, zoneStrike, STYLES } from "./finisher.js";
import { entrance, attack, ENTRANCES, ATTACKS } from "./moves.js";
import { staple, finale, ace, SHOWS, pickShow, SHOW_MIN, SHOW_MAX } from "./cardfx.js";
import { cleanProfile, avatarHTML, cardHTML } from "./profile.js";

const M = C.MSG;
const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const BASE = new URL("./", import.meta.url).href;
const OWN_HOST = location.hostname === "kodex.meiocg.org" || BUNDLED;
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
function imgUrl(code) { return OWN_HOST ? `${SITE}/img/${code}.jpg` : `https://images.ygoprodeck.com/images/cards_small/${code}.jpg`; }
/** A designed stand-in for a card whose art couldn't be loaded: the card's frame colour, its name and type. */
function cardStandIn(code) {
  const c = S.db && S.db.get(code), t = c ? c.type : 0;
  const kind = !c ? "x" : t & C.TYPE.SPELL ? "spell" : t & C.TYPE.TRAP ? "trap" : t & C.TYPE.LINK ? "link" : t & C.TYPE.XYZ ? "xyz" : t & C.TYPE.SYNCHRO ? "synchro" : t & C.TYPE.FUSION ? "fusion" : t & C.TYPE.RITUAL ? "ritual" : t & C.TYPE.EFFECT ? "effect" : "normal";
  const sp = el("span", "nm stand " + kind);
  sp.append(el("b", null, S.db ? S.db.name(code) : String(code)));
  if (c) sp.append(el("i", null, t & C.TYPE.MONSTER ? `${c.atk < 0 ? "?" : c.atk} / ${t & C.TYPE.LINK ? "L" + (c.level & 0xff) : c.def < 0 ? "?" : c.def}` : t & C.TYPE.SPELL ? "Spell" : "Trap"));
  return sp;
}
// Card art: each card's picture is looked up once and remembered (a redraw never reloads or flickers), at most a few
// at a time (bursts made the art host refuse pictures), trying the other sizes and the card's main art before
// settling on a designed stand-in, which is tried again later.
const ART = new Map();          // code -> { url } | { fail: time } | { wait: [callbacks] }
const artQueue = []; let artBusy = 0;
// Pictures saved on the phone by the KodeX app (its offline card database): used first, no internet needed.
const LOCAL_PICS = { base: "", ids: new Set() };
function localPic(code) { return LOCAL_PICS.base && LOCAL_PICS.ids.has(Number(code)) ? LOCAL_PICS.base + Number(code) + ".jpg" : ""; }
function artSources(code) {
  const c = S.db && S.db.get(code);
  const local = [localPic(code), c && c.alias && Math.abs(c.alias - code) < 20 ? localPic(c.alias) : ""].filter(Boolean);
  const t = [...local, imgUrl(code), `https://images.ygoprodeck.com/images/cards_small/${code}.jpg`, `https://images.ygoprodeck.com/images/cards/${code}.jpg`];
  if (c && c.alias && Math.abs(c.alias - code) < 20) t.push(imgUrl(c.alias), `https://images.ygoprodeck.com/images/cards/${c.alias}.jpg`);
  return [...new Set(t)];
}
function artPump() {
  while (artBusy < 4 && artQueue.length) {
    const code = artQueue.shift(), rec = ART.get(code);
    artBusy++;
    const src = artSources(code);
    let n = 0;
    const probe = new Image(); probe.referrerPolicy = "no-referrer"; probe.decoding = "async";
    const done = (url) => { artBusy--; const w = rec.wait; ART.set(code, url ? { url } : { fail: Date.now() }); for (const f of w) f(url); artPump(); };
    probe.onload = () => done(probe.src);
    probe.onerror = () => { n++; if (n < src.length) setTimeout(() => { probe.src = src[n]; }, n === 1 ? 600 : 120); else done(null); };
    probe.src = src[0];
  }
}
/** The art already found for a card, or the first place to look for it. */
function artUrl(code) { const r = ART.get(Number(code)); return r && r.url ? r.url : imgUrl(code); }
function artFor(code, cb) {
  const r = ART.get(code);
  if (r && r.url) { cb(r.url); return; }
  if (r && r.fail && Date.now() - r.fail < 20000) { cb(null); return; }
  if (r && r.wait) { r.wait.push(cb); return; }
  ART.set(code, { wait: [cb] }); artQueue.push(code); artPump();
}
function cardImg(code, alt = "") {
  code = Number(code);
  const known = ART.get(code);
  if (known && known.fail && Date.now() - known.fail < 20000) { const ph = cardStandIn(code); setTimeout(() => artFor(code, (u) => { if (u && ph.isConnected) { const i = new Image(); i.alt = alt; i.decoding = "async"; i.referrerPolicy = "no-referrer"; i.src = u; if (ph.className) i.className = ph.className.replace(/\b(nm|stand|spell|trap|effect|normal|fusion|synchro|xyz|link|ritual|x)\b/g, "").trim(); ph.replaceWith(i); } }), 20500); return ph; }
  const i = new Image();
  i.alt = alt; i.decoding = "async"; i.referrerPolicy = "no-referrer";
  if (known && known.url) { i.src = known.url; return i; }
  i.classList.add("art-wait");
  i.src = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";   // blank while the art loads (no broken-picture icon)
  artFor(code, (url) => {
    i.classList.remove("art-wait");
    if (url) { i.src = url; return; }
    const ph = cardStandIn(code);
    if (i.className) ph.classList.add(...i.classList);
    if (i.isConnected) i.replaceWith(ph); else i.dataset.stand = "1";
  });
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
  $("#aiShare").checked = Learning.share;
  $("#aiShare").addEventListener("change", (e) => { Learning.share = e.target.checked; if (e.target.checked) Learning.flush(); });
  const opts = load("duel:opts", null);
  if (opts) { $("#optRule").value = opts.rule; $("#optLP").value = opts.lp; $("#optHand").value = opts.start; $("#optDraw").value = opts.draw; }
  for (const id of ["#optRule", "#optLP", "#optHand", "#optDraw"]) $(id).addEventListener("change", () => { save("duel:opts", options()); rulesSummary(); });
  rulesSummary();
  S.chainSkip = load("duel:chainskip", false);
  $("#skipChains").checked = S.chainSkip;
  $("#skipChains").addEventListener("change", (e) => { S.chainSkip = e.target.checked; save("duel:chainskip", S.chainSkip); });
  const sp = Sound.getPrefs();
  $("#musicOn").checked = sp.music; $("#sfxOn").checked = sp.sfx;
  $("#musicOn").addEventListener("change", (e) => Sound.setPref("music", e.target.checked));
  $("#sfxOn").addEventListener("change", (e) => Sound.setPref("sfx", e.target.checked));
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
  deckLearning();
}
function selectDeck(i) {
  const d = S.decks[i] || S.decks[0];
  if (!d) return;
  S.deck = { ...d, missing: [] };
  save("duel:current", S.decks.indexOf(d));
  S.testHand.clear();
  renderDeck();
  refreshButtons();
  deckLearning();
}
// Synapse AI learning for the current deck: shared lines from other players, practice games, and a status line.
function deckCodes(d) { return d ? [...d.main, ...d.extra] : []; }
function aiNote() {
  const n = S.deck ? Learning.linesFor(deckCodes(S.deck)) : 0;
  $("#aiNote").textContent = !S.deck ? "" : Learning.trainer ? `Synapse AI is practicing with this deck… it already knows ${n} line${n === 1 ? "" : "s"} for it.`
    : n ? `Synapse AI knows ${n} line${n === 1 ? "" : "s"} for this deck from your games, other players and practice.` : "Synapse AI learns this deck as you play it.";
}
async function deckLearning() {
  if (!S.deck) return;
  const d = S.deck;
  aiNote();
  await Learning.fetchShared(deckCodes(d));
  if (S.deck !== d) return;
  aiNote();
  // Practice once the engine is up (it may still be loading when a deck arrives from a link).
  (S.workerReady || startWorker()).then(() => setTimeout(() => { if (S.deck === d && $("#table").hidden) { Learning.practice(d, BASE, () => aiNote()); aiNote(); } }, 3000)).catch(() => {});
}
function renderSaved() {
  const s = $("#savedDecks");
  s.replaceChildren();
  s.hidden = !S.decks.length;
  S.decks.forEach((d, i) => { const o = el("option", null, d.name); o.value = i; if (S.deck && d.name === S.deck.name) o.selected = true; s.append(o); });
  // The AI can play any saved deck, not only a mirror.
  const od = $("#soloOppDeck"), was = od.value;
  od.querySelectorAll("option[data-deck]").forEach((o) => o.remove());
  S.decks.forEach((d, i) => { if (!d.main || d.main.length < 20) return; const o = el("option", null, `Deck: ${d.name}`); o.value = "deck:" + i; o.dataset.deck = "1"; od.append(o); });
  if ([...od.options].some((o) => o.value === was)) od.value = was;
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
    list.forEach((code, i) => {
      const x = el("button", "deck-card"); x.type = "button"; x.setAttribute("aria-label", S.db.name(code));
      x.style.setProperty("--i", String(Math.min(i, 40)));
      x.append(cardImg(code, S.db.name(code)));
      peekable(x, code);
      g.append(x);
    });
    b.append(g);
  }
  const th = $("#testHand");
  th.replaceChildren();
  $("#testHandCount").textContent = "";
  [...new Set(d.main)].forEach((code) => {
    const btn = el("button"); btn.type = "button"; btn.setAttribute("aria-label", S.db.name(code));
    btn.setAttribute("aria-pressed", "false"); btn.append(cardImg(code, S.db.name(code)));
    peekable(btn, code, { click: false });
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
  $("#peekClose").addEventListener("click", () => $("#peek").close());
  $("#peek").addEventListener("click", (e) => { if (e.target === $("#peek")) $("#peek").close(); });
  addEventListener("scroll", hideHoverPeek, { passive: true });
  $("#importBtn").addEventListener("click", () => { $("#importError").textContent = ""; $("#importDlg").showModal(); });
  $("#importFile").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    $("#importError").textContent = "";
    try { $("#importText").value = await f.text(); } catch (err) { $("#importError").textContent = "That file couldn't be read"; return; }
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
      $("#importError").textContent = $("#importText").value.trim() ? "Not a valid deck" : "Choose a .ydk file or paste a deck first";
    }
  });
  $("#soloStart").addEventListener("click", startSolo);
  $("#hostOpen").addEventListener("click", openRoom);
  $("#hostClose").addEventListener("click", closeRoom);
  $("#hostStart").addEventListener("click", hostStartDuel);
  $("#copyInvite").addEventListener("click", () => copy(`${BUNDLED ? SITE + "/duel/" : location.origin + location.pathname}#join=${S.room.code}`, "Invite link copied."));
  $("#copyWatch").addEventListener("click", () => copy(`${BUNDLED ? SITE + "/duel/" : location.origin + location.pathname}#watch=${S.room.code}`, "Spectator link copied."));
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
  const pick = /^deck:(\d+)$/.exec(oppKind), chosen = pick && S.decks[Number(pick[1])];
  const opp = chosen ? { main: [...chosen.main].map(Number), extra: [...(chosen.extra || [])].map(Number) }
    : oppKind === "same" ? { main: [...S.deck.main], extra: [...S.deck.extra] } : { main: Array(40).fill(FILLER), extra: [] };
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
  Learning.stopPractice();
  S.worker.postMessage({ cmd: "start", decks, names, options: opt, bots, ...learningFor(decks) });
  
}
// ----- replay files (.yrp from this Arena or desktop clients, .yrpX from desktop clients) -----
async function watchReplay(file) {
  if (!file) return;
  if (file.size > 8e6) { toast("That file is too large to be a replay."); return; }
  const bytes = await file.arrayBuffer();
  await startWorker();
  S.mode = "replay"; S.team = 0; S.control = "one";
  enterTable();
  $("#loadingText").textContent = "Reading the replay…";
  $("#replayBar").hidden = false; $("#rbPos").textContent = ""; document.body.classList.add("replaying");
  S.replay = { paused: false, speed: 1 };
  replayBarState();
  S.worker.postMessage({ cmd: "playReplay", bytes, speed: 1 }, [bytes]);
}
function replayBarState() {
  const r = S.replay || {};
  $("#rbPlay").textContent = r.paused ? "▶" : "❚❚"; $("#rbPlay").setAttribute("aria-label", r.paused ? "Play" : "Pause");
  document.querySelectorAll("#replayBar [data-sp]").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.sp) === r.speed)));
}
$("#replayFile").addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; watchReplay(f); });
$("#rbPlay").addEventListener("click", () => { S.replay.paused = !S.replay.paused; replayBarState(); S.worker.postMessage({ cmd: "replayCtl", paused: S.replay.paused }); });
$("#rbStep").addEventListener("click", () => { S.replay.paused = true; replayBarState(); S.worker.postMessage({ cmd: "replayCtl", step: true }); });
document.querySelectorAll("#replayBar [data-sp]").forEach((b) => b.addEventListener("click", () => { S.replay.speed = Number(b.dataset.sp); replayBarState(); S.worker.postMessage({ cmd: "replayCtl", speed: S.replay.speed }); }));
$("#rbExit").addEventListener("click", () => leaveTable());
function learningFor(decks) {
  const codes = decks.flatMap((d) => deckCodes(d));
  return { book: Learning.rowsFor(codes), learn: true };
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
    if (m.role === "spec") {
      S.specs++; if (S.packets[2]) S.room.send({ to: "spec", m: { t: "packet", packet: S.packets[2] } });
      S.room.send({ to: "spec", m: { t: "seat", hostTeam: S.hostTeam || 0 } });
      sendSkin("spec"); sendSkin("spec", S.peerSkins.guest, "guest");
    }
    if (m.role === "guest") { toast(`${m.name} joined the room.`); sendSkin("guest"); }
    return;
  }
  if (m.sys === "leave") {
    if (m.role === "spec") S.specs = Math.max(0, S.specs - 1);
    if (m.role === "guest") { toast(`${m.name} left the room.`); addLog(`${m.name} disconnected. They can rejoin with the same code.`, "sys"); if (!S.packet) { S.guest = null; showGuest(); } }
    return;
  }
  const msg = m.m || {};
  if (msg.t === "skin") {
    onSkin(m, msg);
    // Guests can only talk to the host: pass their skins on to the spectators.
    if (m.from === "guest" && S.specs > 0) S.room.send({ to: "spec", m: { ...msg, of: "guest" } });
    return;
  }
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
  if (msg.t === "chat") addChat(m.name, msg.text, true, sideOfRole(m.from));
  if (msg.t === "emote") { showEmote(sideOfRole(m.from), msg.id, m.from); if (m.from === "guest" && S.specs > 0) S.room.send({ to: "spec", m: { ...msg, of: "guest" } }); }
  if (msg.t === "replayreq" && m.from === "guest") sendReplay("guest");
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
  S.room.send({ to: "others", m: { t: "start", first: names[0], hostTeam: S.hostTeam } });
  Learning.stopPractice();
  S.worker.postMessage({ cmd: "start", decks, names, options: options(), bots: {}, ...learningFor(decks) });
}

// ----- online: guest / spectator -----
function join(code) {
  if (!/^[A-Z0-9]{4,12}$/.test(code)) { $("#joinStatus").textContent = "Invalid room code"; return; }
  S.mode = "guest";
  $("#joinStatus").textContent = "Connecting…";
  S.room = new Room({ code, role: "guest", name: myName(), onMessage: onGuestMessage, onStatus: (s, err) => {
    netStatus(s, err);
    if (s === "error") { $("#joinStatus").textContent = err; S.mode = null; }
    if (s === "open") { S.room.send({ to: "host", m: { t: "hello", name: myName(), deck: { main: S.deck.main, extra: S.deck.extra, side: S.deck.side || [] } } }); sendSkin("others"); }
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
  if (msg.t === "skin") { onSkin(m, msg); return; }
  if (msg.t === "seat") { S.specHostTeam = msg.hostTeam === 1 ? 1 : 0; applySkins(); return; }
  if (msg.t === "start") { if (msg.hostTeam === 0 || msg.hostTeam === 1) S.specHostTeam = msg.hostTeam; if ($("#table").hidden) enterTable(); S.log = []; $("#log").replaceChildren(); $("#feed").replaceChildren(); addLog(`${msg.first} goes first.`, "sys"); $("#result").hidden = true; }
  else if (msg.t === "packet") { if ($("#table").hidden) enterTable(); const t = msg.packet.viewer === 2 ? 0 : msg.packet.viewer; if (t !== S.team) { S.team = t; applySkins(); } onPacket(msg.packet); }
  else if (msg.t === "error") toast(msg.error);
  else if (msg.t === "chat") addChat(m.name, msg.text, true, sideOfRole(m.from));
  else if (msg.t === "emote") { const role = msg.of && m.from === "host" ? msg.of : m.from; showEmote(sideOfRole(role), msg.id, role); }
  else if (msg.t === "replay" && typeof msg.b64 === "string" && msg.b64.length < 400000) saveFile(msg.name || "duel.yrp", "data:application/octet-stream;base64," + msg.b64);
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
  if (m.t === "learn") { Learning.add(m.rows, m.source); return; }
  if (m.t === "progress") { if (m.done === m.total || m.done % 10 === 0) $("#loadingText").textContent = `Loading card scripts · ${m.done}/${m.total}`; return; }
  if (m.t === "error") {
    if (S.mode === "host" && m.team !== S.hostTeam) { S.room.send({ to: "guest", m: { t: "error", error: m.error } }); return; }
    toast(m.error); return;
  }
  if (m.t === "replayinfo") { S.replayInfo = m; addLog(`Replay: ${m.names.join(" vs ")} · ${m.answers} answers${m.turns ? ` · ${m.turns} turns` : ""}${m.unknown ? ` · ${m.unknown} cards this Arena doesn't know yet` : ""}`, "sys"); return; }
  if (m.t === "replaypos") { $("#rbPos").textContent = `${m.i} / ${m.n}`; return; }
  if (m.t === "replayerr") { toast(m.error, 6000); leaveTable(); return; }
  if (m.t !== "packet") return;
  const p = m.packet, v = m.viewer;
  if (S.mode === "replay") { if (v === 3) { S.team = 0; onPacket(p); } return; }
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
function duelState(active) {
  S.active = active;
  Sound.music(active);
  if (window.parent !== window) window.parent.postMessage({ kx: "duel", active }, "*");
}
function enterTable() {
  CARD_CACHE.clear(); S.fitted = false; S.pfDrawn = false;
  $("#lobby").hidden = true; $("#table").hidden = false; $("#result").hidden = true;
  duelState(true); S.unread = 0; badge(); toggleSide(false);
  trackReset();
  S.packet = null; S.log = []; S.fullLog = []; $("#feed").replaceChildren(); S.prevLP = [null, null]; S.fxEnded = false; S.turnStartLP = null; S.lastBlow = 0; S.lastBlowBy = [0, 0]; S.finPromise = null;
  $("#log").replaceChildren(); $("#feed").replaceChildren();
  buildField();
  closeSheet();
  $("#loading").hidden = false; $("#loadingText").textContent = "Preparing duel…";
  window.scrollTo(0, 0);
}
function leaveTable() {
  duelState(false);
  $("#replayBar").hidden = true; document.body.classList.remove("replaying");
  if (S.mode === "solo" || S.mode === "replay") S.worker.postMessage({ cmd: "stop" });
  if (S.mode === "guest" || S.mode === "spec") { if (S.room) S.room.close(); S.room = null; netStatus(null); }
  if (S.mode === "host") { S.worker.postMessage({ cmd: "stop" }); S.packet = null; }
  $("#table").hidden = true; $("#lobby").hidden = false; $("#result").hidden = true;
  closeSheet(); hideMenu();
  if (S.mode !== "host") S.mode = null;
  history.replaceState(null, "", location.pathname);
}

function bindTable() {
  document.querySelectorAll(".tabs [data-tab]").forEach((b) => b.addEventListener("click", () => selectTab(b)));
  $("#chatForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("#chatInput").value.trim();
    if (!text) return;
    $("#chatInput").value = "";
    addChat(myName(), text, false, "me");
    if (S.room) S.room.send({ to: "all", m: { t: "chat", text } });
  });
  $("#surrenderBtn").addEventListener("click", async () => {
    if (!S.packet || S.packet.ended || S.mode === "spec") return;
    if (!(await ask("Surrender this duel?", "You lose this duel.", "Surrender"))) return;
    if (S.mode === "guest") S.room.send({ to: "host", m: { t: "surrender" } });
    else S.worker.postMessage({ cmd: "surrender", team: S.team });
  });
  $("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([S.fullLog.join("\n") + "\n"], { type: "text/plain" });
    const a = el("a"); a.href = URL.createObjectURL(blob); a.download = "duel-log.txt"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $("#rematchBtn").addEventListener("click", rematch);
  $("#sideFab").addEventListener("click", () => toggleSide());
  // landscape: the duel log and the options are in the left panel, behind this button
  $("#panelBtn").addEventListener("click", (e) => { e.stopPropagation(); const i = $("#info"); if (i.classList.contains("open")) { closeInfo(); return; } openInfo(); selectTab(document.querySelector('.dock-tabs [data-tab="log"]')); });
  $("#sheetChat").addEventListener("click", () => toggleSide());
  $("#sideClose").addEventListener("click", () => toggleSide(false));
  $("#replayBtn").addEventListener("click", saveReplay);
  $("#resultReplay").addEventListener("click", saveReplay);
  $("#revealOk").addEventListener("click", () => $("#reveal").close());
  $("#revealClose").addEventListener("click", () => $("#reveal").close());
  try { new ResizeObserver(() => fabAboveSheet()).observe($("#sheet")); } catch (e) { /* older browsers */ }
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
  $("#closeInfo").addEventListener("click", closeInfo);
  document.addEventListener("click", (e) => { const i = $("#info"); if (i.classList.contains("open") && !i.contains(e.target) && !e.target.closest(".c, .card, .chain-stack li, .menu, .chain-card, dialog")) closeInfo(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeInfo(); });
  $("#sheetMin").addEventListener("click", () => { const s = $("#sheet"); s.classList.toggle("min"); $("#sheetMin").textContent = s.classList.contains("min") ? "▴" : "▾"; });
  document.addEventListener("click", (e) => { if (!e.target.closest(".menu") && !e.target.closest(".card")) hideMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideMenu(); });
}

function rematch() {
  $("#result").hidden = true;
  const ended = S.packet && S.packet.ended;
  if (S.mode === "solo" && S.lastSolo) {
    S.packet = null; S.log = []; $("#log").replaceChildren(); $("#feed").replaceChildren(); S.prevLP = [null, null]; S.fxEnded = false; S.turnStartLP = null; S.lastBlow = 0; S.lastBlowBy = [0, 0]; S.finPromise = null;
    const { me, opp, noShuffle } = soloDecks();
    const decks = []; decks[S.team] = me; decks[1 - S.team] = opp;
    if (S.control === "both") { /* keep seats */ }
    S.worker.postMessage({ cmd: "start", decks, names: S.lastSolo.names, options: { ...options(), noShuffle }, bots: S.lastSolo.bots, ...learningFor(decks) });
  } else if (S.mode === "host") {
    // The loser of the previous duel goes first.
    const loserHost = ended && ended.winner >= 0 ? (ended.winner === S.hostTeam ? 1 : 0) : undefined;
    S.log = []; $("#log").replaceChildren(); $("#feed").replaceChildren(); S.prevLP = [null, null]; S.fxEnded = false; S.turnStartLP = null; S.lastBlow = 0; S.lastBlowBy = [0, 0]; S.finPromise = null;
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
  for (const side of ["op", "me"]) { const k = el("div", "mat-skin " + side); k.hidden = true; k.setAttribute("aria-hidden", "true"); f.prepend(k); }
  applySkins();
  const ph = $("#phases");
  ph.replaceChildren();
  for (const [lbl, bit, title] of [["DP", C.PHASE.DRAW, "Draw Phase"], ["SP", C.PHASE.STANDBY, "Standby Phase"], ["M1", C.PHASE.MAIN1, "Main Phase 1"],
    ["BP", C.PHASE.BATTLE_START | C.PHASE.BATTLE_STEP | C.PHASE.DAMAGE | C.PHASE.DAMAGE_CAL | C.PHASE.BATTLE, "Battle Phase"], ["M2", C.PHASE.MAIN2, "Main Phase 2"], ["EP", C.PHASE.END, "End Phase"]]) {
    const b = el("button", null, lbl); b.type = "button"; b.title = title; b.dataset.bits = bit; b.dataset.k = lbl;
    b.dataset.long = { DP: "Draw", SP: "Standby", M1: "Main 1", BP: "Battle", M2: "Main 2", EP: "End Turn" }[lbl];
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

// Card elements are reused while a card looks the same: a redraw keeps the picture already on screen (no reload,
// no flicker) and the page doesn't pile up thousands of thrown-away elements over a long duel.
const CARD_CACHE = new Map();
// body.at-table while the duel table shows (cheaper for the browser than a :has() rule re-checked on every change)
new MutationObserver(() => document.body.classList.toggle("at-table", !$("#table").hidden)).observe($("#table"), { attributes: true, attributeFilter: ["hidden"] });
function cardSig(c, team, location, seq, opts) {
  return JSON.stringify([c ? [c.code, c.hidden, c.position, c.attack, c.defense, c.link, c.overlays && c.overlays.length, c.counters, c.status & C.STATUS_DISABLED, c.type] : 0, team, location, seq, !!opts.static, S.team]);
}
function cardEl(c, team, location, seq, opts = {}) {
  const ck = key(team, location, seq) + (opts.static ? "s" : ""), sig = cardSig(c, team, location, seq, opts);
  const hit = opts.reuse && CARD_CACHE.get(ck);
  if (hit && hit.sig === sig && !hit.el.isConnected && !hit.el.querySelector("img[data-stand]")) { hit.el.classList.remove("act", "selectable", "selected", "picked", "atk-src", "atk-tgt"); return hit.el; }
  const d = el("div", "card");
  if (opts.reuse) CARD_CACHE.set(ck, { sig, el: d });
  d.dataset.key = key(team, location, seq);
  d.dataset.side = team === (S.team === 2 ? 0 : S.team) ? "me" : "op";
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

// ----- the field shows the damage taken: cracks and embers grow as Life Points fall -----
function matDamage(side, lvl) {
  const f = $("#field");
  let d = f.querySelector(".mat-dmg." + side);
  if (!d) { d = el("div", "mat-dmg " + side); d.setAttribute("aria-hidden", "true"); f.append(d); }
  if (d.dataset.l !== String(lvl)) {
    d.dataset.l = String(lvl);
    if (lvl) { d.classList.remove("hit"); void d.offsetWidth; d.classList.add("hit"); }
  }
  document.querySelector(`.duelist.${side}`).classList.toggle("danger", lvl >= 3);
}

// ----- render -----
// Big moments (the finale before a winning attack, Ace cards) hold the next packets until they've played, so the
// duel never runs ahead of what's on screen.
S.pq = []; S.holdUntil = 0; let pqTimer = 0;
function hold(ms) { S.holdUntil = Math.max(S.holdUntil, Date.now() + ms); }
function onPacket(p) {
  if (S.pq.length || Date.now() < S.holdUntil) { S.pq.push(p); pumpPackets(); return; }
  if (effectFinale(p)) { S.pq.push(p); pumpPackets(); return; }
  applyPacket(p);
}
function pumpPackets() {
  clearTimeout(pqTimer);
  const wait = S.holdUntil - Date.now();
  if (wait > 0) { pqTimer = setTimeout(pumpPackets, wait + 20); return; }
  while (S.pq.length) {
    if (effectFinale(S.pq[0])) { pqTimer = setTimeout(pumpPackets, S.holdUntil - Date.now() + 20); return; }
    applyPacket(S.pq.shift());
    if (Date.now() < S.holdUntil) { pqTimer = setTimeout(pumpPackets, S.holdUntil - Date.now() + 20); return; }
  }
}
/** A winning blow that isn't an attack (a burn Spell or Trap, a monster effect): the finale plays before the damage
 *  shows, for the card that dealt it. Battle damage already had its finale when the attack was declared. */
function effectFinale(p) {
  if (!p || p.efChecked || !S.packet || !S.packet.state || !p.events) return false;
  p.efChecked = true;
  if (S.lastFinaleAt && Date.now() - S.lastFinaleAt < 9000) return false;
  const lp = S.packet.state.teams.map((t) => t.lp), dmg = [0, 0];
  const DMG = C.PHASE.DAMAGE | C.PHASE.DAMAGE_CAL;
  let src = 0, battle = !!((S.packet.phase & DMG) || (p.phase & DMG));
  for (const e of p.events) {
    if (e.type === M.CHAINING || e.type === M.CHAIN_SOLVING && e.code) src = Number(e.code) || src;
    if (e.type === M.BATTLE || e.type === M.ATTACK || e.type === M.DAMAGE_STEP_START) battle = true;
    if (e.type === M.DAMAGE && (e.player === 0 || e.player === 1)) dmg[e.player] += e.amount || 0;
  }
  const loser = dmg[0] && dmg[0] >= lp[0] ? 0 : dmg[1] && dmg[1] >= lp[1] ? 1 : -1;
  if (loser < 0 || battle) return false;
  const by = 1 - loser, code = src || S.lastBlowBy[by] || S.lastBlow;
  if (!code) return false;
  const sh = finaleOf(by, code);
  hold(sh.ms + 200); S.lastFinaleAt = Date.now() + sh.ms;
  finale(sh.style, { ms: sh.ms, src: artUrl(code), title: name(code), line: `${name(code)} deals the final blow` });
  return true;
}
function applyPacket(p) {
  const prev = S.packet;
  S.packet = p;
  if (p.log && p.log.length) for (const l of p.log) addLog("Script: " + l, "sys");
  trackEvents(p);
  for (const e of p.events) logEvent(e, p);
  render(p, prev);
  fxEvents(p);
  bigFx(p);
  handlePrompt(p);
  if (p.ended) showResult(p);
}

function render(p) {
  if (!p.state) return;
  const st = p.state;
  const me = S.team === 2 ? 0 : S.team, op = 1 - me;
  $("#meName").textContent = p.names[me];
  $("#opName").textContent = p.names[op];
  if (!profileOf("me")) $("#meAvatar").textContent = (p.names[me] || "?").trim().charAt(0).toUpperCase();
  if (!profileOf("op")) $("#opAvatar").textContent = (p.names[op] || "?").trim().charAt(0).toUpperCase();
  if (!S.pfDrawn) { S.pfDrawn = true; renderProfiles(); }
  $("#turnNo").textContent = `Turn ${p.turn}`;
  document.querySelector(".duelist.me").classList.toggle("active", !p.ended && p.turnPlayer === me);
  document.querySelector(".duelist.op").classList.toggle("active", !p.ended && p.turnPlayer === op);
  document.body.classList.toggle("op-turn", !p.ended && p.turnPlayer === op);
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
    const ratio = z.lp / lpMax, lvl = z.lp <= 0 ? 4 : ratio <= .1 ? 4 : ratio <= .25 ? 3 : ratio <= .5 ? 2 : ratio <= .75 ? 1 : 0;
    matDamage(id, lvl);
    $(`#${id}Meta`).textContent = `Hand ${z.hand.length} · Deck ${z.deck}`;
  }
  // clear zones
  for (const z of document.querySelectorAll("#field .zone")) {
    for (const c of [...z.children]) if (!c.classList.contains("lbl")) c.remove();
    z.classList.remove("free", "picked");
  }
  queueMicrotask(() => { for (const z of document.querySelectorAll("#field .zone")) z.classList.toggle("filled", !!z.querySelector(".card")); });
  for (const t of [0, 1]) {
    const z = st.teams[t];
    z.mzone.forEach((c, i) => { if (c) document.getElementById(zoneId(t, C.LOCATION_MZONE, i)).append(cardEl(c, t, C.LOCATION_MZONE, i, { reuse: true })); });
    z.szone.forEach((c, i) => { const id = zoneId(t, C.LOCATION_SZONE, i); if (c && id) document.getElementById(id).append(cardEl(c, t, C.LOCATION_SZONE, i, { reuse: true })); });
    const rel = t === me ? "me" : "op";
    for (const [k, loc] of [["grave", C.LOCATION_GRAVE], ["banished", C.LOCATION_REMOVED], ["extra", C.LOCATION_EXTRA]]) {
      const list = z[k];
      const zone = document.getElementById(`${rel}-${k}`);
      if (list.length) {
        const top = k === "extra" ? (list.slice().reverse().find((c) => c && !c.hidden && c.position & C.POS_FACEUP) || list[list.length - 1]) : list[list.length - 1];
        const idx = list.indexOf(top);
        const d = cardEl(top, t, loc, idx, { static: true, reuse: k !== "extra" });
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
  st.teams[me].hand.forEach((c, i) => mh.append(cardEl(c, me, C.LOCATION_HAND, i, { reuse: true })));
  st.teams[op].hand.forEach((c, i) => oh.append(cardEl(c, op, C.LOCATION_HAND, i, { reuse: true })));
  if (!S.fitted) { S.fitted = true; fitTable(); }
  fitHands();
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
  const mine = p.waitingFor === me && S.mode !== "spec" && S.mode !== "replay";
  const st2 = $("#status");
  st2.classList.toggle("mine", mine);
  if (S.mode === "replay" && !p.ended) setStatus(`Replay · ${p.names.join(" vs ")}${p.waitingFor >= 0 ? ` · ${p.names[p.waitingFor]} is deciding` : ""}`);
  else if (p.ended) setStatus("Duel over.");
  else if (mine) setStatus("Your move");
  else if (p.waitingFor >= 0) setStatus(`Waiting for ${p.names[p.waitingFor]}…`);
  else setStatus("");
}
function setStatus(t) { $("#status").textContent = t; }

// ----- card info -----
// Card details always sit on top. An open pop-up (a modal <dialog>, e.g. the Extra Deck or GY list) is drawn in the
// browser's top layer, above any z-index, so while one is open the details move into their own modal on top of it.
function otherModalOpen() {
  try { return [...document.querySelectorAll("dialog:modal")].some((d) => d.id !== "infoTop"); }
  catch (e) { return [...document.querySelectorAll("dialog[open]")].some((d) => d.id !== "infoTop"); }
}
function infoTop() {
  let d = $("#infoTop");
  if (d) return d;
  d = document.createElement("dialog"); d.id = "infoTop"; d.className = "info-top"; d.setAttribute("aria-label", "Card details");
  const i = $("#info"), home = i.parentNode, next = i.nextSibling;
  d.addEventListener("close", () => { i.classList.remove("open"); home.insertBefore(i, next); });
  d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  document.body.append(d);
  return d;
}
function openInfo() {
  const i = $("#info");
  if (otherModalOpen()) { const d = infoTop(); if (i.parentNode !== d) d.append(i); if (!d.open) d.showModal(); }
  i.classList.add("open");
}
function closeInfo() {
  $("#info").classList.remove("open");
  const d = $("#infoTop"); if (d && d.open) d.close();
}
const LANDSCAPE = matchMedia("(orientation: landscape) and (min-width: 640px)");
function showInfo(c, team, location, open = true) {
  if (!c || !c.code) return;
  const panel = $("#info");
  if (open === false && !panel.classList.contains("open") && !LANDSCAPE.matches) return;
  if (open === true) { openInfo(); if (LANDSCAPE.matches) selectTab(document.querySelector('.dock-tabs [data-tab="card"]')); }
  const b = $("#infoBody");
  b.replaceChildren();
  fillInfo(b, c, team, location);
  rulingsBlock(b, c.code, false);
}
/** Card details (art, type, stats, text, materials) into `b`. */
function fillInfo(b, c, team, location) {
  const data = S.db.get(c.code);
  const img = cardImg(c.code, name(c.code)); img.classList.add("info-img");
  const def = location === C.LOCATION_MZONE && c.position && (c.position & C.POS_DEFENSE) && !(c.position & C.POS_FACEDOWN);
  if (def) {
    const w = el("div", "info-art def" + (team !== S.team && S.team !== 2 ? " op" : "")); w.append(img); b.append(w);
  } else b.append(img);
  b.append(el("div", "info-name", data ? data.name : `#${c.code}`));
  if (data) {
    const pills = el("div", "pills");
    const pill = (t, hi) => pills.append(el("span", "pill" + (hi ? " hi" : ""), t));
    const bn = S.ban && (S.ban[c.code] ?? S.ban[cc(c.code)]);
    if (bn !== undefined) pills.append(el("span", "pill ban b" + bn, ["Forbidden", "Limited", "Semi-Limited"][bn]));
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
}
/** Official rulings for a card, read in place (online), plus a way to open the card in KodeX. */
function rulingsBlock(b, code, auto) {
  const data = S.db.get(code);
  const cid = data && data.alias && Math.abs(data.alias - code) < 20 ? data.alias : code;
  const box = el("section", "rulings");
  const head = el("div", "rulings-head");
  const load = el("button", "btn small primary", "Show rulings"); load.type = "button";
  const kx = el("a", "btn small ghost", "Open in KodeX");
  kx.href = `${BUNDLED ? SITE : ""}/#card=${cid}`; kx.target = "_blank"; kx.rel = "noopener";
  // Inside the KodeX app the app itself shows the card (with rulings saved for offline use).
  if (window.parent !== window) kx.addEventListener("click", (e) => { e.preventDefault(); window.parent.postMessage({ kx: "rulings", id: cid }, "*"); });
  head.append(el("h4", null, "Rulings"), load, kx);
  const list = el("div", "rulings-list");
  box.append(head, list);
  b.append(box);
  const go = async () => {
    load.disabled = true; load.textContent = "Loading…";
    list.replaceChildren(el("div", "rulings-skel"), el("div", "rulings-skel"));
    try {
      const items = await rulingsFor(data ? data.name : String(code));
      list.replaceChildren();
      load.remove();
      if (!items.length) { list.append(el("p", "hint", "No official Q&A for this card yet.")); return; }
      head.querySelector("h4").textContent = `Rulings (${items.length})`;
      items.forEach((r, i) => {
        const d = el("details", "ruling"); if (i === 0) d.open = true;
        d.style.setProperty("--i", String(Math.min(i, 12)));
        const sm = el("summary"); sm.append(el("span", "rq", "Q"), el("span", null, r.q));
        d.append(sm);
        const a = el("div", "ra"); a.append(el("span", "rq a", "A"), el("span", null, r.a)); d.append(a);
        if (r.date) d.append(el("small", "rdate", r.date));
        list.append(d);
      });
    } catch {
      load.disabled = false; load.textContent = "Try again";
      list.replaceChildren(el("p", "hint", window.parent !== window ? "Rulings need a connection here. Open the card in KodeX to read your saved rulings." : "Couldn't load rulings. Check your connection."));
    }
  };
  load.addEventListener("click", go);
  if (auto) go();
}

// ----- deck cards in the lobby: hover preview (mouse) and full details with rulings (tap/click) -----
const canHover = () => matchMedia("(hover: hover) and (pointer: fine)").matches;
let hoverTimer = 0;
function peekable(node, code, { click = true } = {}) {
  node.dataset.code = code;
  node.addEventListener("pointerenter", () => {
    if (!canHover()) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => showHoverPeek(node, code), 140);
  });
  node.addEventListener("pointerleave", hideHoverPeek);
  if (click) node.addEventListener("click", () => { hideHoverPeek(); openPeek(code); });
}
function showHoverPeek(node, code) {
  const h = $("#hoverPeek");
  h.replaceChildren();
  fillInfo(h, { code }, S.team, 0);
  const rul = el("div", "peek-rul", "Checking rulings…");
  h.append(rul, el("div", "peek-tip", "Click for full rulings"));
  const data = S.db.get(code);
  rulingsFor(data ? data.name : String(code)).then((items) => {
    if (!rul.isConnected) return;
    rul.replaceChildren();
    if (!items.length) { rul.textContent = "No official Q&A yet"; return; }
    rul.append(el("b", null, `${items.length} ruling${items.length > 1 ? "s" : ""}`), el("span", null, items[0].q.length > 160 ? items[0].q.slice(0, 157) + "…" : items[0].q));
  }).catch(() => { if (rul.isConnected) rul.textContent = "Rulings need a connection"; });
  h.hidden = false;
  const r = node.getBoundingClientRect(), w = h.offsetWidth, ht = h.offsetHeight;
  let x = r.right + 12; if (x + w > innerWidth - 8) x = r.left - w - 12; if (x < 8) x = 8;
  let y = r.top + r.height / 2 - ht / 2; y = Math.max(8, Math.min(y, innerHeight - ht - 8));
  h.style.left = x + "px"; h.style.top = y + "px";
  requestAnimationFrame(() => h.classList.add("in"));
}
function hideHoverPeek() { clearTimeout(hoverTimer); const h = $("#hoverPeek"); h.classList.remove("in"); h.hidden = true; }
function openPeek(code) {
  const d = $("#peek"), b = $("#peekBody");
  b.replaceChildren();
  const info = el("div", "peek-info");
  fillInfo(info, { code }, S.team, 0);
  b.append(info);
  rulingsBlock(b, code, true);
  if (!d.open) d.showModal();
  b.scrollTop = 0;
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
  if (peek) openInfo();
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
  const cd = c && c.code && S.db.get(c.code);
  if (cd && cd.type & (C.TYPE.SPELL | C.TYPE.TRAP) && acts.every((x) => /^Set\b/.test(x.label)))
    m.append(el("div", "menu-note", cd.type & C.TYPE.TRAP ? "Traps are Set first and activated on a later turn." : "Can't be activated right now: its conditions aren't met, its once-per-turn was used, or another effect is stopping it."));
  if (c && c.code) {
    const info = el("button", null, "Card details"); info.type = "button";
    info.addEventListener("click", () => { hideMenu(); openInfo(); });
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
    const d = cardEl(c, team, loc, i, { static: true });
    if (c && !c.hidden && c.code) d.addEventListener("click", (e) => { e.stopPropagation(); showInfo(c, team, loc, true); });
    o.append(d);
    const acts = S.actions && S.actions.get(key(team, loc, i));
    if (acts) {
      d.classList.add("act");
      for (const a of acts) { const b = el("button", "btn small", a.label); b.type = "button"; b.onclick = () => { $("#pile").close(); a.run(); }; o.append(b); }
    }
    body.append(o);
  }
  $("#pile").classList.toggle("pile-extra", kind === "extra");
  $("#pile").classList.toggle("pile-op", team !== S.team);
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
  const title = hintCard ? `Choose a zone for ${name(hintCard)}` : hint && hint !== "0" ? fdesc(S.db.desc(hint), S.lastHintCode, 0) : "";
  switch (msg.type) {
    case M.SELECT_IDLECMD: return idlePrompt(msg);
    case M.SELECT_BATTLECMD: return battlePrompt(msg);
    case M.SELECT_CHAIN: return chainPrompt(msg);
    case M.SELECT_EFFECTYN: return yesNo(msg, `Use the effect of ${name(msg.code)}?`, msg.description !== "0" ? fdesc(S.db.desc(msg.description), msg.code, msg.location) : where(msg));
    case M.SELECT_YESNO: return yesNo(msg, fdesc(S.db.desc(msg.description), S.lastHintCode, 0), "");
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
/** What an activation does, from its description id: the card's own text for that effect ("Special Summon 1 …"),
 *  or "Effect 2" when the card has no text for it. Empty when there's nothing to say. */
function effectText(code, description, location) {
  if (!description || description === "0") return "";
  const t = fdesc(S.db.desc(description), code, location);
  const m = /\(effect (\d+)\)$/.exec(t);
  if (m) { const d = S.db.get(Number(code)), multi = d && d.strs && d.strs.filter(Boolean).length > 1; return multi || Number(m[1]) > 1 ? `Effect ${m[1]}` : ""; }
  if (/^#\d+$/.test(t)) return "";
  return t;
}
function activateLabel(a) {
  const d = a.description && a.description !== "0" ? fdesc(S.db.desc(a.description), a.code, a.location) : "";
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
  openSheet(msg.forced ? "Activate an effect" : "Chain a card or effect?", last ? `Chain ${chain.length}: ${name(last.code)}${effectText(last.code, last.description, last.location) ? " · " + effectText(last.code, last.description, last.location) : ""}` : "");
  const body = $("#sheetBody");
  if (chain.length) {
    const ol = el("ol", "chain-list"); ol.setAttribute("aria-label", "The chain so far");
    chain.forEach((c, i) => {
      const li = el("li", c.controller === S.team ? "me" : "op"), th = el("span", "th"); th.append(cardImg(c.code, ""));
      const tx = el("span"); tx.append(el("strong", null, name(c.code))); const ef = effectText(c.code, c.description, c.location); if (ef) tx.append(el("em", null, ef));
      li.append(el("b", null, String(i + 1)), th, tx); li.addEventListener("click", () => showInfo({ code: c.code }, c.controller, c.location, true));
      ol.append(li);
    });
    body.append(ol);
  }
  msg.selects.forEach((c, i) => {
    const o = optCard(c, activateLabel(c).replace(/^Activate: /, ""));
    o.querySelector(".card").addEventListener("click", (e) => { e.stopPropagation(); send({ t: msg.type, index: i }); });
    body.append(o);
  });
  if (!msg.forced) sheetButton("Don't chain", () => send({ t: msg.type, index: null }), "primary");
}

/** System strings carry printf-style blanks ("%ls", "%d"): fill them with the card's name, its place and numbers. */
function fdesc(text, code, location, n) {
  let k = 0;
  return String(text || "").replace(/%ls|%d|%s/g, (m) => {
    if (m === "%d") return String(n == null ? "" : n);
    k++;
    return k === 1 ? (code ? name(code) : "this card") : (LOCNAME[location] || "the field");
  });
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
  msg.options.forEach((o, i) => { const b = el("button", "btn", fdesc(S.db.desc(o), S.lastHintCode, 0)); b.type = "button"; b.onclick = () => send({ t: msg.type, index: i }); list.append(b); });
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
  const code = Number((/\[\[(\d+)\]\]/.exec(text) || [])[1] || 0) || (codes && codes[0]) || 0;
  if (code) { const t = el("span", "lth"); t.append(cardImg(code, "")); li.prepend(t); }
  feed(plain, code, cls);
  // newest first: the latest actions are always at the top
  const log = $("#log");
  log.prepend(li);
  while (log.children.length > 250) log.lastChild.remove();
  log.scrollTop = 0;
}
/** Landscape log with card pictures, newest first (Master Duel style). Tap an entry to read the card. */
function feed(text, code, cls) {
  const f = $("#feed");
  if (!f || cls === "phase" || cls === "sys" && !code) return;
  const d = el("div", "fd" + (cls === "turn" ? " turn" : ""));
  if (cls === "turn") d.textContent = text;
  else {
    const th = el("span", "th"); if (code) th.append(cardImg(code, "")); d.append(th, el("span", null, text));
    const ch = /^Chain (\d+)/.exec(text); if (ch) d.append(el("b", "cl", ch[1]));
    const mine = /^You\b/.test(text) || / You /.test(text);
    d.classList.add(mine ? "me" : /^(Synapse AI|Opponent)/.test(text) || (S.packet && S.packet.names && text.startsWith(S.packet.names[1 - (S.team === 2 ? 0 : S.team)])) ? "op" : "x");
    if (code) d.addEventListener("click", () => showInfo({ code }, S.team, 0, true));
  }
  f.prepend(d);
  while (f.children.length > 60) f.lastChild.remove();
}
function addChat(who, text, fromOther, side) {
  if (fromOther && (MUTE.chat || (MUTE.opp && side === "op"))) { S.mutedChat = (S.mutedChat || 0) + 1; return; }
  const li = el("li"); li.append(el("b", null, who + ": "), String(text).slice(0, 200));
  $("#chatList").append(li); $("#chatList").scrollTop = 1e9;
  S.fullLog.push(`[chat] ${who}: ${text}`);
  const seen = chatVisible();
  if (!seen) for (const t of document.querySelectorAll('.tabs [data-tab="chat"]')) t.classList.add("unread");
  if (side) floatChat(side, who, text);
  if (fromOther && !seen) { S.unread = (S.unread || 0) + 1; badge(); notifyChat(who, text); }
}
/** Is the chat on screen right now (the side panel's or the landscape panel's Chat tab)? */
function chatVisible() {
  const pane = document.querySelector(".chat[data-pane=chat]");
  if (!pane || pane.hidden) return false;
  return $("#side").classList.contains("open");
}
function badge() { const b = $("#sideBadge"); b.hidden = !S.unread; b.textContent = S.unread > 9 ? "9+" : String(S.unread || 0); $("#sideFab").classList.toggle("ping", !!S.unread); $("#sheetChat").classList.toggle("unread", !!S.unread); }
/** A new chat message while the player isn't looking: vibrate, and a system notification when the app is in the background. */
function notifyChat(who, text) {
  try { navigator.vibrate && navigator.vibrate([60, 40, 60]); } catch (e) { /* not supported */ }
  if (window.parent !== window) { window.parent.postMessage({ kx: "chat", from: String(who).slice(0, 24), text: String(text).slice(0, 200) }, "*"); return; }
  try { if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification(`${who} · Duel Synapse`, { body: String(text).slice(0, 200), tag: "duel-chat" }); } catch (e) { /* ignore */ }
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
    case M.CHAINING: { S.lastHintCode = e.code; const ef = effectText(e.code, e.description, e.location); addLog(`Chain ${e.chain_size}: ${pn(e.controller)} activated ${cn(e.code)}${ef ? " · " + ef : ""}`, "chain"); break; }
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
      if (e.hint_type === C.HINT.OPSELECTED) addLog(`${pn(e.player)} chose: ${fdesc(S.db.desc(e.hint), S.lastHintCode, 0)}`, "sys");
      else if (e.hint_type === C.HINT.CODE) addLog(`${pn(e.player)} declared ${cn(Number(e.hint))}`, "sys");
      else if (e.hint_type === C.HINT.NUMBER) addLog(`${pn(e.player)} declared ${e.hint}`, "sys");
      else if (e.hint_type === C.HINT.RACE) addLog(`${pn(e.player)} declared ${raceName(e.hint)}`, "sys");
      else if (e.hint_type === C.HINT.ATTRIB) addLog(`${pn(e.player)} declared ${attributeName(Number(e.hint))}`, "sys");
      else if (e.hint_type === C.HINT.MESSAGE) toast(fdesc(S.db.desc(e.hint), S.lastHintCode, 0));
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
  duelState(false);
  $("#resultReplay").hidden = !(S.premium && S.mode !== "spec");
  setTimeout(() => Learning.flush(), 1500); // send what this duel taught
  const me = S.team;
  const w = p.ended.winner;
  const title = w === 2 || w < 0 ? "Draw" : S.mode === "spec" ? `${p.names[w]} wins` : w === me ? "You win" : "You lose";
  $("#resultTitle").textContent = title;
  $("#resultTitle").className = w === me && S.mode !== "spec" ? "win" : "";
  $("#resultText").textContent = p.ended.reason || "";
  $("#rematchBtn").hidden = S.mode === "spec" || S.mode === "replay";
  $("#rematchBtn").textContent = S.mode === "guest" ? "Ask for a rematch" : "Rematch";
  addLog(`${title}${p.ended.reason ? ` — ${p.ended.reason}` : ""}`, "turn");
  trackEnd(p);
  Promise.resolve(S.finPromise).then(() => setTimeout(() => { $("#result").hidden = false; S.finPromise = null; }, 250));
}

// ----- log & chat bubble -----
function toggleSide(open) {
  const s = $("#side"), on = open === undefined ? !s.classList.contains("open") : open;
  s.classList.toggle("open", on);
  $("#sideFab").setAttribute("aria-expanded", String(on));
  if (on) {
    const chatTab = document.querySelector('#side .tabs [data-tab="chat"]');
    if (chatTab && (S.unread || LANDSCAPE.matches)) chatTab.click();
    if (chatTab && chatTab.getAttribute("aria-selected") === "true") { chatTab.classList.remove("unread"); S.unread = 0; badge(); }
    $("#log").scrollTop = 1e9; $("#chatList").scrollTop = 1e9;
  }
}
/** Keeps the bubble above the prompt panel when one is open. */
function fabAboveSheet() {
  const sh = $("#sheet"), f = $("#sideFab");
  f.style.bottom = "";
  if (sh.hidden || LANDSCAPE.matches || matchMedia("(orientation: portrait), (max-width: 639px)").matches) return;
  const r = sh.getBoundingClientRect(), fr = f.getBoundingClientRect();
  if (r.right > fr.left && r.left < fr.right) f.style.bottom = `${Math.round(window.innerHeight - r.top + 10)}px`;
}
new MutationObserver(fabAboveSheet).observe(document.getElementById("sheet"), { attributes: true, attributeFilter: ["hidden", "class"] });

// ----- in-page confirmation -----
function ask(title, text, yes = "OK") {
  return new Promise((done) => {
    const d = $("#ask");
    $("#askTitle").textContent = title; $("#askText").textContent = text || ""; $("#askYes").textContent = yes;
    const end = (v) => { d.close(); done(v); };
    $("#askYes").onclick = () => end(true); $("#askNo").onclick = () => end(false);
    d.oncancel = (e) => { e.preventDefault(); end(false); };
    d.showModal();
  });
}

// ----- reveals and chains, shown as they happen -----
const fxQueue = [];
let fxBusy = false;
function fxEvents(p) {
  const shown = [];
  for (const e of p.events) {
    if (e.type === M.CONFIRM_CARDS || e.type === M.CONFIRM_DECKTOP || e.type === M.CONFIRM_EXTRATOP) {
      const cards = (e.cards || []).filter((c) => c && c.code);
      if (cards.length) shown.push({ player: e.player, cards });
    } else if (e.type === M.CHAINING) fxQueue.push({ kind: "chain", e, name: p.names[e.controller] });
    else if (e.type === M.CHAIN_SOLVING) fxQueue.push({ kind: "solve", n: e.chain_size });
    else if (e.type === M.CHAIN_NEGATED || e.type === M.CHAIN_DISABLED) fxQueue.push({ kind: "negate", n: e.chain_size });
  }
  if (shown.length) showReveal(shown, p);
  runFx();
}
function showReveal(groups, p) {
  const d = $("#reveal"), body = $("#revealBody");
  if (!d.open) body.replaceChildren();
  for (const g of groups) {
    for (const c of g.cards) {
      const o = el("div", "opt");
      const card = cardEl({ code: c.code, position: C.POS_FACEUP_ATTACK }, c.controller, c.location, c.sequence, { static: true });
      card.addEventListener("click", (ev) => { ev.stopPropagation(); showInfo({ code: c.code }, c.controller, c.location, true); });
      o.append(card, el("small", null, name(c.code)));
      body.append(o);
    }
  }
  const who = groups[0].cards[0].controller === S.team && S.mode !== "spec" ? "Your card" : `${p.names[groups[0].cards[0].controller] || "Opponent"}'s card`;
  const n = body.children.length;
  $("#revealTitle").textContent = n > 1 ? `Revealed (${n})` : `${who} revealed`;
  if (!d.open) d.showModal();
}
function runFx() {
  if (fxBusy || !fxQueue.length) return;
  const f = fxQueue.shift();
  if (f.kind !== "chain") {
    const li = document.querySelectorAll("#chain li")[f.n - 1];
    if (li) { li.classList.remove("solving", "negated"); void li.offsetWidth; li.classList.add(f.kind === "solve" ? "solving" : "negated"); }
    runFx(); return;
  }
  fxBusy = true;
  const e = f.e, box = $("#chainFx");
  const card = el("button", "chain-card"); card.type = "button"; card.setAttribute("aria-label", `Chain ${e.chain_size}: ${name(e.code)}`);
  card.append(cardImg(e.code, name(e.code)), el("b", null, String(e.chain_size)));
  const cap = el("div", "chain-cap");
  cap.append(el("strong", null, `Chain ${e.chain_size}`), el("span", null, `${e.controller === S.team && S.mode !== "spec" ? "You" : f.name} activated ${name(e.code)}`));
  const ef = effectText(e.code, e.description, e.location); if (ef) cap.append(el("span", "eff", ef));
  card.addEventListener("click", () => showInfo({ code: e.code }, e.controller, e.location, true));
  const wrap = el("div", "chain-show"); wrap.append(card, cap);
  box.replaceChildren(wrap);
  requestAnimationFrame(() => wrap.classList.add("in"));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(() => {
    wrap.classList.add("out");
    setTimeout(() => { wrap.remove(); fxBusy = false; runFx(); }, reduce ? 0 : 320);
  }, reduce ? 500 : 1100);
}

// ----- summon glow, boss splash, big damage and OTK (sounds come from audio.js) -----
S.signature = new Set();      // KodeX Premium: cards the player marked for the full show
S.sigFx = {};                 // KodeX Premium: finishing-move style per signature card
S.finisher = "";              // KodeX Premium: the player's finishing move
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function isBoss(code, fx) {
  if (fx && fx.signature.has(cc(code))) return true;
  const c = S.db && S.db.get(code);
  if (!c || !(c.type & C.TYPE.MONSTER)) return false;
  const lv = c.level & 0xff;
  return c.atk >= 3000 || (c.type & C.TYPE.LINK ? lv >= 4 : lv >= 8);
}
function glowZone(t, seq, cls) {
  const z = document.getElementById(zoneId(t, C.LOCATION_MZONE, seq));
  if (!z) return;
  z.classList.remove("summon-glow", "boss-glow"); void z.offsetWidth; z.classList.add(cls);
  setTimeout(() => z.classList.remove(cls), 1600);
}
function splash(code, title, sub, kind = "boss") {
  const box = $("#bigFx");
  const w = el("div", "splash " + kind);
  if (code) { const art = el("div", "splash-art"); art.append(cardImg(code, name(code))); w.append(art); }
  const txt = el("div", "splash-txt"); txt.append(el("strong", null, title)); if (sub) txt.append(el("span", null, sub)); w.append(txt);
  box.replaceChildren(w);
  if (!reduceMotion() && kind !== "small") { document.body.classList.remove("shake"); void document.body.offsetWidth; document.body.classList.add("shake"); }
  requestAnimationFrame(() => w.classList.add("in"));
  setTimeout(() => { w.classList.add("out"); setTimeout(() => w.remove(), 400); }, reduceMotion() ? 900 : kind === "otk" ? 2600 : 1700);
}
function bigFx(p) {
  const me = S.team === 2 ? 0 : S.team;
  const sideOf = (t) => (t === me ? "me" : "op");
  const viewerFree = !S.premium;
  S.lastBlowBy = S.lastBlowBy || [0, 0];
  for (const e of p.events) {
    switch (e.type) {
      case M.NEW_TURN: S.turnStartLP = p.state ? p.state.teams.map((t) => t.lp) : null; Sound.play("turn"); break;
      case M.NEW_PHASE: Sound.play("phase"); break;
      case M.DRAW: Sound.play("draw"); break;
      case M.SET: Sound.play("set"); break;
      case M.SUMMONING: case M.SPSUMMONING: case M.FLIPSUMMONING: {
        const fx = fxOf(sideOf(e.controller)), boss = isBoss(e.code, fx), sig = fx.signature.has(cc(e.code));
        if (e.location === C.LOCATION_MZONE) {
          glowZone(e.controller, e.sequence, boss ? "boss-glow" : "summon-glow");
          const st = (fx.premium && (fx.entFx[cc(e.code)] || fx.entrance)) || "rise";
          entrance(st, document.getElementById(zoneId(e.controller, C.LOCATION_MZONE, e.sequence)), { big: boss });
        }
        if (sig) zoneStrike(fx.sigFx[cc(e.code)] || fx.finisher || "shatter", document.getElementById(zoneId(e.controller, C.LOCATION_MZONE, e.sequence)));
        if (fx.aces.has(cc(e.code))) showAce(e.code, e.controller, fx);
        else if (boss) {
          Sound.play("boss");
          splash(e.code, name(e.code), sig ? (viewerFree ? "Signature summon · KodeX Premium" : "Signature summon") : e.type === M.SPSUMMONING ? "Special Summon" : "Summon", sig ? "boss sig" : "boss");
        } else if (!cardVoice(e.controller, e.code)) Sound.play(e.type === M.SPSUMMONING ? "spsummon" : "summon");
        if (boss) cardVoice(e.controller, e.code);
        break;
      }
      case M.CHAINING:
      {
        S.lastBlow = Number(e.code); S.lastBlowBy[e.controller] = Number(e.code);
        const fx = fxOf(sideOf(e.controller)), sig = fx.signature.has(cc(e.code));
        if (!cardVoice(e.controller, e.code)) Sound.play(sig ? "boss" : e.chain_size > 1 ? "chain" : "activate", e.chain_size);
        if (fx.aces.has(cc(e.code))) showAce(e.code, e.controller, fx);
        else if (sig) splash(e.code, name(e.code), viewerFree ? "Signature card · KodeX Premium" : "Signature card", "boss sig");
        if (!fx.aces.has(cc(e.code))) staple(name(e.code), document.getElementById(zoneId(e.controller, e.location, e.sequence)) || document.querySelector(`.duelist.${sideOf(e.controller)}`));
        break;
      }
      case M.ATTACK: {
        Sound.play("attack");
        const a = e.card && lookup(e.card.controller, e.card.location, e.card.sequence);
        if (a && a.code) { S.lastBlow = Number(a.code); S.lastBlowBy[e.card.controller] = Number(a.code); }
        if (e.card) {
          const fx = fxOf(sideOf(e.card.controller)), st = (fx.premium && ((a && fx.atkFx[cc(a.code)]) || fx.attack)) || "lunge";
          const from = document.querySelector(`#field .card[data-key="${key(e.card.controller, e.card.location, e.card.sequence)}"]`);
          const to = e.target ? document.querySelector(`#field .card[data-key="${key(e.target.controller, e.target.location, e.target.sequence)}"]`) : document.querySelector(`.duelist.${sideOf(1 - e.card.controller)}`);
          const lethal = lethalAttack(p, e, a);
          if (lethal) {
            const sh = finaleOf(e.card.controller, a.code);
            hold(sh.ms + 200); S.lastFinaleAt = Date.now() + sh.ms;
            finale(sh.style, { ms: sh.ms, src: artUrl(a.code), title: name(a.code), line: e.target ? `${name(a.code)} attacks for the win` : `${name(a.code)} attacks directly for the win` })
              .then(() => attack(st, from, to, { direct: !e.target }));
          } else attack(st, from, to, { direct: !e.target });
        }
        break;
      }
      case M.DAMAGE: {
        const big = e.amount >= 2000;
        Sound.play("damage", big);
        if (big && !reduceMotion()) { document.body.classList.remove("shake"); void document.body.offsetWidth; document.body.classList.add("shake"); }
        break;
      }
      case M.MOVE: {
        if (e.to && e.to.location === C.LOCATION_GRAVE && e.reason & C.REASON.DESTROY) Sound.play("destroy");
        // an Ace card searched or added to the hand (from the Deck, GY, banishment or Extra Deck) gets its showdown too
        if (e.to && e.to.location === C.LOCATION_HAND && e.from && e.code && (C.LOCATION_DECK | C.LOCATION_GRAVE | C.LOCATION_REMOVED | C.LOCATION_EXTRA) & e.from.location) {
          const fx = fxOf(sideOf(e.to.controller));
          if (fx.aces.has(cc(e.code))) showAce(e.code, e.to.controller, fx, "added to the hand");
        }
        break;
      }
    }
  }
  if (p.ended && !S.fxEnded) {
    S.fxEnded = true;
    const w = p.ended.winner, start = S.turnStartLP, full = options().lp;
    const loser = w === 0 || w === 1 ? 1 - w : -1;
    const otk = loser >= 0 && start && start[loser] >= full && p.turnPlayer === w && (p.state ? p.state.teams[loser].lp <= 0 : true);
    if (loser >= 0) {
      // The finishing move: the loser's half of the field breaks and their cards are torn up.
      // The winner's own move: a KodeX Premium player's choice shows on everyone's screen.
      const wfx = fxOf(sideOf(w)), blow = S.lastBlowBy[w] || S.lastBlow;
      const style = (wfx.premium && (wfx.sigFx[cc(blow)] || wfx.finisher)) || "shatter";
      const side = loser === me ? "me" : "op";
      if (wfx.premium && viewerFree) setTimeout(() => toast(`${p.names[w]} finished with a KodeX Premium move: ${style[0].toUpperCase() + style.slice(1)}`), 2400);
      Sound.play("finish");
      setTimeout(() => Sound.play(otk ? "otk" : w === me && S.mode !== "spec" ? "win" : "lose"), 1600);
      S.finPromise = runFinisher({ style, side, mat: $("#field"), title: otk ? "ONE TURN KILL" : "FINISH!" });
    } else Sound.play("lose");
  }
}
addEventListener("pointerdown", () => Sound.unlock(), { capture: true });

// ----- replay files (KodeX Premium) -----
function replayName() {
  const p = S.packet, n = p ? p.names : ["Duelist", "Opponent"], d = new Date(), z = (x) => String(x).padStart(2, "0");
  const safe = (s) => String(s || "").replace(/[^\w-]+/g, "_").slice(0, 20) || "Duelist";
  return `${safe(n[0])}_vs_${safe(n[1])}_${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}.yrp`;
}
const b64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
function workerReplay() {
  return new Promise((done) => {
    const on = (ev) => { if (ev.data && ev.data.t === "replay") { S.worker.removeEventListener("message", on); done(ev.data.bytes || null); } };
    S.worker.addEventListener("message", on);
    S.worker.postMessage({ cmd: "replay" });
    setTimeout(() => { S.worker.removeEventListener("message", on); done(null); }, 5000);
  });
}
async function saveReplay() {
  if (!S.premium) return;
  if (S.mode === "guest") { S.room.send({ to: "host", m: { t: "replayreq" } }); toast("Asking the host for the replay…"); return; }
  if (!S.worker) return;
  const bytes = await workerReplay();
  if (!bytes || !bytes.length) { toast("No replay for this duel"); return; }
  saveFile(replayName(), "data:application/octet-stream;base64," + b64(bytes));
}
async function sendReplay(to) {
  if (!S.worker) return;
  const bytes = await workerReplay();
  if (bytes && bytes.length) S.room.send({ to, m: { t: "replay", name: replayName(), b64: b64(bytes) } });
}
function saveFile(fileName, dataUrl) {
  if (window.parent !== window) { window.parent.postMessage({ kx: "save", name: fileName, data: dataUrl }, "*"); return; }
  const a = el("a"); a.href = dataUrl; a.download = fileName; document.body.append(a); a.click(); a.remove();
  toast("Replay saved (.yrp).");
}

// Browsers: ask before closing the tab mid-duel. (Inside the KodeX app, the app asks.)
if (window.parent === window) addEventListener("beforeunload", (e) => { if (S.active && S.packet && !S.packet.ended) { e.preventDefault(); e.returnValue = ""; } });

window.__duel = S; // for automated tests and debugging
window.__arena = { fxEvents, showReveal, toggleSide };
window.__arenaFx = (p) => bigFx(p);
window.__arenaFin = (side, style) => runFinisher({ side, style, mat: $("#field") });
window.__arenaDmg = (side, lvl) => matDamage(side, lvl);
boot();

// ----- skins (KodeX Premium) -----
// My skins come from the KodeX app. In a room, each player's skins are sent to everyone else, so the opponent and
// spectators see them too (any edition of KodeX, and the website, shows them; only Premium can set them).
// Only data: images are accepted, so a skin can't load anything from the internet.
const SKIN_PARTS = ["sleeve", "xsleeve", "field"];
const imgOk = (u) => typeof u === "string" && u.length < 480000 && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u);
const clampN = (v, a, b, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
const SHOW_OK = [...SHOWS, "random"];
function cleanFx(v) {
  if (!v || typeof v !== "object" || v.premium !== true) return null;
  const sigFx = {};
  if (v.sigFx && typeof v.sigFx === "object") for (const [k, x] of Object.entries(v.sigFx).slice(0, 60)) if (/^\d{3,10}$/.test(k) && STYLES.includes(x)) sigFx[k] = x;
  const perCard = (o, list) => { const out = {}; if (o && typeof o === "object") for (const [k, x] of Object.entries(o).slice(0, 80)) if (/^\d{3,10}$/.test(k) && list.includes(x)) out[k] = x; return out; };
  return { premium: true, finisher: STYLES.includes(v.finisher) ? v.finisher : "shatter",
    signature: Array.isArray(v.signature) ? v.signature.map(Number).filter((n) => n > 0 && n < 1e10).slice(0, 60) : [], sigFx,
    entrance: ENTRANCES.includes(v.entrance) ? v.entrance : "rise", attack: ATTACKS.includes(v.attack) ? v.attack : "lunge",
    entFx: perCard(v.entFx, ENTRANCES), atkFx: perCard(v.atkFx, ATTACKS),
    finale: SHOW_OK.includes(v.finale) ? v.finale : "menacing", aceStyle: SHOW_OK.includes(v.aceStyle) ? v.aceStyle : "spotlight",
    finaleMs: Math.round(clampN(v.finaleMs, SHOW_MIN, SHOW_MAX, 3300)), showFx: perCard(v.showFx, SHOW_OK),
    aces: Array.isArray(v.aces) ? v.aces.map(Number).filter((n) => n > 0 && n < 1e10).slice(0, 12) : [] };
}
// KodeX Premium media: pictures up to ~4.5 MB (HD animated GIFs), sounds up to ~900 KB, only data: URLs.
const MEDIA_IMG = 4.6e6, MEDIA_SND = 9e5;
const imgBig = (u) => typeof u === "string" && u.length < MEDIA_IMG && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u);
const sndOk = (u) => typeof u === "string" && u.length < MEDIA_SND && /^data:audio\/[a-z0-9.+-]+(;codecs=[a-z0-9.,"-]+)?;base64,[A-Za-z0-9+/=]+$/i.test(u);
/** KodeX Premium emotes: up to 8 pictures, each with an optional sound. */
function cleanEmotes(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => x && imgBig(x.src)).slice(0, 8)
    .map((x, i) => ({ id: "c" + i, name: String(x.name || "Emote " + (i + 1)).slice(0, 24), src: x.src, snd: sndOk(x.snd) ? x.snd : "" }));
}
function cleanSounds(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => x && sndOk(x.snd)).slice(0, 8).map((x, i) => ({ id: "cs" + i, name: String(x.name || "Sound " + (i + 1)).slice(0, 24), src: "", snd: x.snd }));
}
function cleanMedia(v) {
  if (!v || !/^(c|cs)\d$/.test(String(v.id))) return null;
  const src = imgBig(v.src) ? v.src : "", snd = sndOk(v.snd) ? v.snd : "";
  return src || snd ? { id: v.id, name: String(v.name || "Emote").slice(0, 24), src, snd } : null;
}
function cleanVoices(v) {
  const out = {}; let n = 0, total = 0;
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (/^\d{3,10}$/.test(k) && sndOk(x) && n < 16 && (total += x.length) < 6e6) { out[k] = x; n++; }
  return n ? out : null;
}
function cleanPart(k, v) {
  if (k === "fx") return cleanFx(v);
  if (k === "voices") return cleanVoices(v);
  if (k === "profile") return cleanProfile(v, imgOk);
  if (k === "field") return v && imgOk(v.img) ? { img: v.img, zoom: clampN(v.zoom, 100, 300, 100), x: clampN(v.x, 0, 100, 50), y: clampN(v.y, 0, 100, 50), dim: clampN(v.dim, 0, 90, 35) } : null;
  return SKIN_PARTS.includes(k) && imgOk(v) ? v : null;
}
S.mySkin = {}; S.peerSkins = { host: {}, guest: {} }; S.specHostTeam = 0;
function sideSkins() {
  if (S.mode === "host") return { me: S.mySkin, op: S.peerSkins.guest };
  if (S.mode === "guest") return { me: S.mySkin, op: S.peerSkins.host };
  if (S.mode === "spec") return S.specHostTeam === S.team ? { me: S.peerSkins.host, op: S.peerSkins.guest } : { me: S.peerSkins.guest, op: S.peerSkins.host };
  return { me: S.mySkin, op: {} };
}
/** Premium effects of the player on `side` ("me"/"op"): theirs travel with their skins, so everyone sees them. */
/** A card's main code: alternate artworks count as the card itself (choices made for a card follow every artwork). */
const cc = (code) => { const n = Number(code); try { return S.db ? S.db.main(n) : n; } catch (e) { return n; } };
const ccKeys = (o) => { const out = {}; for (const [k, v] of Object.entries(o || {})) { out[k] = v; out[cc(k)] = v; } return out; };
function fxOf(side) {
  const f = (sideSkins()[side] || {}).fx;
  return f ? { premium: true, finisher: f.finisher, signature: new Set(f.signature.map(cc)), sigFx: ccKeys(f.sigFx), entrance: f.entrance || "rise", attack: f.attack || "lunge", entFx: ccKeys(f.entFx), atkFx: ccKeys(f.atkFx),
      finale: f.finale || "menacing", aceStyle: f.aceStyle || "spotlight", aces: new Set((f.aces || []).map(cc)), finaleMs: f.finaleMs || 3300, showFx: ccKeys(f.showFx) }
    : { premium: false, finisher: "", signature: new Set(), sigFx: {}, entrance: "rise", attack: "lunge", entFx: {}, atkFx: {}, finale: "menacing", aceStyle: "spotlight", aces: new Set(), finaleMs: 3300, showFx: {} };
}
function applySkins() {
  renderProfiles();
  const r = document.documentElement, sk = sideSkins();
  for (const side of ["me", "op"]) { const d = document.querySelector(`.duelist.${side}`); if (d) d.classList.toggle("is-premium", !!(sk[side] && sk[side].fx)); }
  for (const side of ["me", "op"]) {
    const s = sk[side] || {};
    for (const k of ["sleeve", "xsleeve"]) {
      if (s[k]) { r.style.setProperty(`--${side}-${k}`, `url("${s[k]}")`); r.classList.add(`${side}-${k}`); }
      else { r.style.removeProperty(`--${side}-${k}`); r.classList.remove(`${side}-${k}`); }
    }
    const m = document.querySelector(`#field > .mat-skin.${side}`), f = s.field;
    if (!m) continue;
    m.hidden = !f;
    if (f) {
      const a = (f.dim / 100).toFixed(2);
      m.style.backgroundImage = `linear-gradient(rgba(5,8,15,${a}),rgba(5,8,15,${a})), url("${f.img}")`;
      m.style.backgroundSize = `auto, ${f.zoom}% auto`;
      m.style.backgroundPosition = `center, ${f.x}% ${f.y}%`;
    } else m.style.backgroundImage = "";
  }
}
const PARTS = [...SKIN_PARTS, "fx", "voices", "profile"];
/** One skin part to the room; anything over ~380 KB (HD GIFs, sounds) goes in pieces and is put back together. */
function sendPart(to, part, v, of) {
  if (!S.room) return;
  const json = JSON.stringify(v), CH = 380000;
  if (json.length <= CH) { S.room.send({ to, m: { t: "skin", part, v, of } }); return; }
  const id = Math.random().toString(36).slice(2, 9), n = Math.ceil(json.length / CH);
  for (let i = 0; i < n; i++) S.room.send({ to, m: { t: "skin", part, of, piece: { id, i, n, d: json.slice(i * CH, (i + 1) * CH) } } });
}
function sendSkin(to, skin = S.mySkin, of) {
  if (!S.room) return;
  for (const k of PARTS) if (skin[k]) sendPart(to, k, skin[k], of);
  S.room.send({ to, m: { t: "skin", part: "done", have: PARTS.filter((k) => skin[k]), of } });
  // custom emotes already shown in this duel follow along for whoever joins later
  if (skin === S.mySkin) for (const id of sentMedia) { const e = [...S.myEmotes, ...S.mySounds].find((x) => x.id === id); if (e) sendPart(to, "em", { id: e.id, name: e.name, src: e.src || "", snd: e.snd || "" }); }
  else if (skin.media) for (const e of Object.values(skin.media)) sendPart(to, "em", e, of);
}
const pieces = new Map();
function onSkin(m, msg) {   // eslint-disable-line no-param-reassign
  let role = m.from;
  if (msg.of && m.from === "host") role = msg.of;   // the host passes the guest's skins on to spectators
  if (role !== "host" && role !== "guest") return;
  const cur = S.peerSkins[role];
  if (msg.piece && typeof msg.piece === "object") {
    const p = msg.piece, k = `${role}|${msg.part}|${p.id}`;
    if (!(p.n > 1 && p.n <= 80 && p.i >= 0 && p.i < p.n) || typeof p.d !== "string") return;
    let buf = pieces.get(k); if (!buf) { buf = { n: p.n, got: 0, parts: [] }; pieces.set(k, buf); if (pieces.size > 30) pieces.delete(pieces.keys().next().value); }
    if (buf.parts[p.i] === undefined) { buf.parts[p.i] = p.d; buf.got++; }
    if (buf.got < buf.n) return;
    pieces.delete(k);
    try { msg = { ...msg, v: JSON.parse(buf.parts.join("")) }; } catch { return; }
  }
  if (msg.part === "done") { const have = Array.isArray(msg.have) ? msg.have : []; for (const k of PARTS) if (!have.includes(k)) delete cur[k]; }
  else if (msg.part === "em") { const e = cleanMedia(msg.v); if (e) { cur.media = cur.media || {}; cur.media[e.id] = e; } return; }
  else if (msg.part === "emotes") { for (const e of cleanEmotes(msg.v)) { cur.media = cur.media || {}; cur.media[e.id] = e; } return; }
  else { const v = cleanPart(msg.part, msg.v); if (v) cur[msg.part] = v; }
  applySkins();
}
window.addEventListener("message", (e) => {
  if (window.parent === window || e.source !== window.parent) return;
  const d = e.data;
  if (!d || d.kx !== "skin") return;
  const next = {};
  for (const [k, v] of [["sleeve", d.sleeve], ["xsleeve", d.xsleeve], ["field", d.field]]) { const c = cleanPart(k, v); if (c) next[k] = c; }
  if (S.myProfile) next.profile = S.myProfile;
  S.mySkin = next;
  S.premium = d.premium === true;
  $("#replayBtn").hidden = !S.premium;
  S.signature = new Set(S.premium && Array.isArray(d.signature) ? d.signature.map(Number).filter((n) => n > 0).slice(0, 60) : []);
  S.finisher = S.premium && STYLES.includes(d.finisher) ? d.finisher : "";
  S.sigFx = {};
  if (S.premium && d.sigFx && typeof d.sigFx === "object") for (const [k, v] of Object.entries(d.sigFx)) if (/^\d{3,10}$/.test(k) && STYLES.includes(v)) S.sigFx[Number(k)] = v;
  if (S.premium) S.mySkin.fx = cleanFx({ premium: true, finisher: S.finisher || "shatter", signature: [...S.signature], sigFx: S.sigFx, entrance: d.entrance, attack: d.attack, entFx: d.entFx, atkFx: d.atkFx, finale: d.finale, aces: d.aces, aceStyle: d.aceStyle, finaleMs: d.finaleMs, showFx: d.showFx });
  S.myEmotes = S.premium ? cleanEmotes(d.emotes) : [];
  S.mySounds = S.premium ? cleanSounds(d.sounds) : [];
  const vo = S.premium ? cleanVoices(d.voices) : null;
  if (vo) S.mySkin.voices = vo;
  sentMedia.clear();
  renderEmotes(); applyView();
  applySkins();
  if (S.room && (S.mode === "host" || S.mode === "guest")) sendSkin("others");
});
// KodeX Premium: the player's own music and sound effects (ArrayBuffers), sent by the app.
window.addEventListener("message", (e) => {
  if (window.parent === window || e.source !== window.parent) return;
  const d = e.data;
  if (d && d.kx === "audio" && d.premium === true) Sound.setCustom(d);
  // the player's KodeX profile (free and Premium): name, icon, frame, banner; the opponent sees it too
  if (d && d.kx === "profile") {
    S.myProfile = cleanProfile(d.p, imgOk);
    document.body.classList.toggle("has-pf", !!S.myProfile);
    if (S.myProfile) { S.mySkin.profile = S.myProfile; const n = $("#nameInput"); if (n && !n.value.trim()) { n.value = S.myProfile.name; n.dispatchEvent(new Event("input")); } }
    applySkins();
    if (S.room && (S.mode === "host" || S.mode === "guest")) sendSkin("others");
  }
  // the player's KodeX decks, so the lobby always has them (they're kept up to date by name)
  if (d && d.kx === "decks" && Array.isArray(d.decks)) {
    let changed = false;
    for (const x of d.decks.slice(0, 200)) {
      if (!x || typeof x.name !== "string" || !Array.isArray(x.main)) continue;
      const clean = { name: x.name.slice(0, 60), main: x.main.map(Number).filter((n) => n > 0).slice(0, 60), extra: (x.extra || []).map(Number).filter((n) => n > 0).slice(0, 15), side: (x.side || []).map(Number).filter((n) => n > 0).slice(0, 15), kodex: true };
      if (!clean.main.length) continue;
      const i = S.decks.findIndex((y) => y.name === clean.name);
      if (i < 0) { S.decks.push(clean); changed = true; }
      else if (JSON.stringify(S.decks[i].main) !== JSON.stringify(clean.main) || JSON.stringify(S.decks[i].extra) !== JSON.stringify(clean.extra)) { S.decks[i] = clean; changed = true; }
    }
    if (changed) { save("duel:decks", S.decks); if (S.db) { renderSaved(); if (!S.deck && S.decks.length) selectDeck(load("duel:current", 0)); } }
  }
  // OCG Forbidden & Limited list from KodeX (card details show it)
  if (d && d.kx === "banlist" && d.map && typeof d.map === "object") { S.ban = {}; for (const [k, v] of Object.entries(d.map)) if (/^\d{3,10}$/.test(k) && [0, 1, 2].includes(v)) S.ban[k] = v; }
  if (d && d.kx === "pics" && typeof d.base === "string" && /^https:\/\/appassets\.androidplatform\.net\/castel-files\/[\w/.-]*\/$/.test(d.base) && Array.isArray(d.ids)) {
    LOCAL_PICS.base = d.base; LOCAL_PICS.ids = new Set(d.ids.map(Number).filter((n) => n > 0 && n < 1e10));
    for (const [k, r] of ART) if (r && (r.fail || r.url) && localPic(k)) ART.delete(k);   // look again: the phone may have it now
  }
});


// ----- testing data for the Synapse Deck Analyzer (KodeX): what each of your duels with a deck looked like -----
// Kept on this device ("duel:stats", by deck) and sent to the KodeX app when the Arena runs inside it.
function deckKey(d) { const a = (d && d.main ? d.main : []).map(Number).sort((x, y) => x - y).join(","); let h = 0; for (let i = 0; i < a.length; i++) h = (h * 31 + a.charCodeAt(i)) | 0; return "d" + (h >>> 0).toString(36); }
function trackReset() { S.track = { myTurns: 0, firstPlays: 0, used: {}, drawn: {}, open: {}, links: {}, last: 0, turnFirst: true, done: false }; }
function trackEvents(p) {
  const T = S.track; if (!T || S.mode === "spec" || S.mode === "replay") return;
  const me = S.team, bump = (o, c) => { c = Number(c); if (c) o[c] = (o[c] || 0) + 1; };
  for (const e of p.events) {
    if (e.type === M.NEW_TURN) { if (p.turn === 1) T.first = p.turnPlayer === me; if (p.turnPlayer === me) T.myTurns++; T.last = 0; T.turnFirst = true; }
    else if ((e.type === M.SUMMONING || e.type === M.SPSUMMONING || e.type === M.FLIPSUMMONING || e.type === M.CHAINING) && e.controller === me) {
      const c = Number(e.code);
      bump(T.used, c); if (T.myTurns <= 1 && p.turnPlayer === me) T.firstPlays++;
      // what started each of my turns, and which play followed which (the deck's real combo links)
      if (p.turnPlayer === me && T.turnFirst) { bump(T.open, c); T.turnFirst = false; }
      if (p.turnPlayer === me && T.last && T.last !== c && Object.keys(T.links).length < 300) { const k = T.last + ">" + c; T.links[k] = (T.links[k] || 0) + 1; }
      if (p.turnPlayer === me) T.last = c;
    }
    else if (e.type === M.DRAW && e.player === me) for (const c of e.drawn || []) bump(T.drawn, c.code);
  }
}
function trackEnd(p) {
  const T = S.track; if (!T || T.done || S.mode === "spec" || S.mode === "replay" || !S.deck) return;
  T.done = true;
  const me = S.team, w = p.ended.winner, start = S.turnStartLP, full = options().lp;
  const res = { at: Date.now(), win: w === me, draw: !(w === 0 || w === 1), turns: p.turn || 0, dead: T.myTurns >= 1 && T.firstPlays === 0,
    otk: w === me && !!start && start[1 - me] >= full && p.turnPlayer === me, first: !!T.first, vs: S.mode === "solo" ? "ai" : "online",
    used: T.used, drawn: T.drawn, open: T.open, links: T.links };
  const key = deckKey(S.deck), all = load("duel:stats", {});
  const st = all[key] || { name: S.deck.name || "Deck", games: [] };
  st.name = S.deck.name || st.name; st.games.push(res); st.games = st.games.slice(-200);
  all[key] = st;
  const keys = Object.keys(all); if (keys.length > 40) delete all[keys[0]];
  save("duel:stats", all);
  if (window.parent !== window) window.parent.postMessage({ kx: "stats", key, deck: { name: S.deck.name || "", main: S.deck.main.map(Number) }, result: res }, "*");
}
trackReset();

// ----- hands: many cards (Maxx "C" turns) overlap instead of pushing the screen wider -----
function fitHands() {
  for (const h of [$("#myHand"), $("#opHand")]) {
    const cards = h.children, n = cards.length;
    h.classList.remove("packed"); h.style.removeProperty("--ov");
    if (n < 2) continue;
    const cs = getComputedStyle(h), avail = h.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const w = cards[0].getBoundingClientRect().width;
    const ml = parseFloat(getComputedStyle(cards[1]).marginLeft) || 0, mr = parseFloat(getComputedStyle(cards[0]).marginRight) || 0;
    if (!w || h.scrollWidth <= h.clientWidth + 1 && n * w + (n - 1) * (ml + mr) <= avail) continue;
    const step = Math.max(w * .18, (avail - w) / (n - 1));
    h.style.setProperty("--ov", (step - w).toFixed(1) + "px");
    h.classList.add("packed");
  }
}
/** Portrait: if the table is taller than the screen (short phones), shrink the zones until it fits, so nothing needs
 *  scrolling. Landscape already sizes itself from the screen height. */
function fitTable() {
  const root = document.documentElement, t = $("#table");
  t.style.removeProperty("--zh"); t.style.removeProperty("--ch");
  if (t.hidden || LANDSCAPE.matches) return;
  for (let i = 0; i < 3; i++) {
    const over = root.scrollHeight - innerHeight, z = document.querySelector("#field .zone");
    if (over <= 1 || !z) break;
    const zh = z.getBoundingClientRect().height, next = Math.max(26, zh - over / 6.4 - 0.5);
    t.style.setProperty("--zh", next.toFixed(1) + "px"); t.style.setProperty("--ch", (next * .92).toFixed(1) + "px");
  }
}
let fitT = 0;
addEventListener("resize", () => { if ($("#table").hidden) return; cancelAnimationFrame(fitT); fitT = requestAnimationFrame(() => { fitTable(); fitHands(); }); });

// ----- panels: in landscape and on computers the left panel has tabs (Card, Log, Chat, Options), like a desktop
// duel client, so everything is one click away and nothing covers the field. In portrait the log and chat live in
// the bubble panel instead. The same elements move between the two, so nothing is duplicated.
function selectTab(b) {
  if (!b) return;
  const box = b.closest(".info, .side") || document;
  box.querySelectorAll(".tabs [data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  box.querySelectorAll("[data-pane]").forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.tab; });
  if (b.dataset.tab === "chat") {
    b.classList.remove("unread"); S.unread = 0; badge();
    const l = $("#chatList"); l.scrollTop = 1e9;
    if (box.classList.contains("info") && matchMedia("(pointer: fine)").matches) $("#chatInput").focus({ preventScroll: true });
  }
  if (b.dataset.tab === "log") $("#log").scrollTop = 0;
}
function dockLayout() {
  const info = $("#info"), side = $("#side"), log = $("#log"), chat = document.querySelector(".chat[data-pane=chat]"), acts = document.querySelector(".side-actions");
  if (!acts.dataset.pane) { acts.dataset.pane = "opts"; acts.hidden = true; }   // the settings have their own tab
  if (LANDSCAPE.matches) {
    if (log.parentNode === info) return;
    info.append(log, acts);
    acts.dataset.pane = "opts";
    toggleSide(false);
    selectTab(document.querySelector('#side .tabs [data-tab="chat"]'));
    selectTab(info.querySelector('.dock-tabs [aria-selected="true"]') || info.querySelector(".dock-tabs [data-tab]"));
  } else {
    if (log.parentNode === side) return;
    side.insertBefore(log, chat);
    side.append(acts);
    acts.dataset.pane = "opts";   // its own tab next to Chat and Log, so it never covers the chat
    $("#infoBody").hidden = false;
    selectTab(side.querySelector('.tabs [aria-selected="true"]') || side.querySelector(".tabs [data-tab]"));
  }
}
LANDSCAPE.addEventListener("change", dockLayout);
dockLayout();

// ----- field view options (kept on this device) -----
const VIEW = Object.assign({ mode: "tilt", compactOp: true, floatChat: true }, load("duel:view", {}));
function applyView() {
  const b = document.body;
  b.classList.toggle("view-flat", VIEW.mode === "flat");
  b.classList.toggle("view-wide", VIEW.mode === "wide");
  b.classList.toggle("op-compact", !!VIEW.compactOp);
  document.querySelectorAll("#viewSeg [data-view]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.view === VIEW.mode)));
  $("#viewCompactOp").checked = !!VIEW.compactOp;
  $("#viewFloatChat").checked = !!VIEW.floatChat;
  $("#viewFloatChat").closest(".toggle").hidden = !S.premium;
}
document.querySelectorAll("#viewSeg [data-view]").forEach((x) => x.addEventListener("click", () => { VIEW.mode = x.dataset.view; save("duel:view", VIEW); applyView(); }));
$("#viewCompactOp").addEventListener("change", (e) => { VIEW.compactOp = e.target.checked; save("duel:view", VIEW); applyView(); });
$("#viewFloatChat").addEventListener("change", (e) => { VIEW.floatChat = e.target.checked; save("duel:view", VIEW); });
applyView();

// ----- emotes: pictures and sounds. Everyone has a set; KodeX Premium adds more sounds, their own pictures (HD
// animated GIFs too) and their own sounds, and a picture can carry a sound. Custom ones travel to the other players
// the first time they're used (in pieces when large), so a duel doesn't start by uploading every GIF.
const BASE_EMOTES = [["hi", "👋", "Hi"], ["gg", "🤝", "Good game"], ["nice", "👍", "Nice"], ["wow", "😮", "Wow"], ["think", "🤔", "Hmm…"], ["oops", "😅", "Oops"], ["fire", "🔥", "Let's go"], ["gl", "🍀", "Good luck"]];
const SOUND_EMOTES = [["boom", "💥", "Boom", 0], ["airhorn", "📯", "Air horn", 0], ["sadtrom", "🎺", "Sad trombone", 0], ["rimshot", "🥁", "Ba-dum-tss", 0], ["dramatic", "😱", "Dun dun dunnn", 0],
  ["crickets", "🦗", "Crickets", 1], ["bonk", "🔨", "Bonk", 1], ["honk", "🦢", "Honk", 1], ["applause", "👏", "Applause", 1], ["scratch", "💿", "Record scratch", 1], ["riser", "📈", "Tension", 1], ["levelup", "⭐", "Level up", 1], ["buzzer", "❌", "Wrong!", 1], ["tada", "🎉", "Ta-da", 1]];
S.myEmotes = []; S.mySounds = []; S.myVoices = {};
let emoteAt = 0;
const sentMedia = new Set();
// mute: per device
const MUTE = Object.assign({ opp: false, chat: false, emotes: false, voices: false }, load("duel:mute", {}));
function sideOfRole(role) {
  if (S.mode === "host") return role === "host" ? "me" : "op";
  if (S.mode === "guest") return role === "guest" ? "me" : "op";
  if (S.mode === "spec") { const hostSide = S.specHostTeam === S.team ? "me" : "op"; return role === "host" ? hostSide : hostSide === "me" ? "op" : "me"; }
  return role === "host" ? "me" : "op";
}
const mine = (role) => role === undefined || S.mode === "solo" || (sideOfRole(role) === "me" && S.mode !== "spec");
function emoteFor(id, role) {
  const b = BASE_EMOTES.find((x) => x[0] === id);
  if (b) return { text: b[1], name: b[2] };
  if (id.startsWith("s:")) { const x = SOUND_EMOTES.find((y) => y[0] === id.slice(2)); return x ? { text: x[1], name: x[2], meme: x[0] } : null; }
  const list = mine(role) ? [...S.myEmotes, ...S.mySounds] : Object.values((S.peerSkins[role] && S.peerSkins[role].media) || {});
  const c = list.find((x) => x.id === id);
  return c ? { src: c.src, snd: c.snd, name: c.name, text: c.src ? "" : "🔊" } : null;
}
function renderEmotes() {
  const box = $("#emotePick");
  if (!box) return;
  box.replaceChildren();
  const btn = (id, label, kids, cls = "") => { const b = el("button", "em " + cls); b.type = "button"; b.title = label; b.setAttribute("aria-label", label); b.dataset.id = id; b.append(...kids); box.append(b); return b; };
  for (const [id, t, n] of BASE_EMOTES) btn(id, n, [t]);
  box.append(el("div", "em-sep", "Sounds"));
  for (const [id, t, n, prem] of SOUND_EMOTES) {
    const b = btn("s:" + id, n, [el("span", null, t), el("i", null, n)], "snd");
    if (prem && !S.premium) { b.disabled = true; b.classList.add("lock"); b.title = n + " · KodeX Premium"; }
  }
  if (S.myEmotes.length || S.mySounds.length) {
    box.append(el("div", "em-sep", "Yours"));
    for (const e of S.myEmotes) { const i = el("img"); i.src = e.src; i.alt = ""; const b = btn(e.id, e.name, [i], "img"); if (e.snd) b.append(el("i", "snd-dot", "🔊")); }
    for (const e of S.mySounds) btn(e.id, e.name, [el("span", null, "🔊"), el("i", null, e.name)], "snd");
  } else if (!S.premium) box.append(el("div", "em-sep up", "More sounds, your own emotes, HD GIFs and sounds: KodeX Premium"));
}
/** Sends one of my custom emotes / sounds to the room before its first use. */
function shareMedia(id) {
  if (!S.room || S.mode === "spec" || sentMedia.has(id)) return;
  const e = [...S.myEmotes, ...S.mySounds].find((x) => x.id === id);
  if (!e) return;
  sentMedia.add(id);
  sendPart("all", "em", { id: e.id, name: e.name, src: e.src || "", snd: e.snd || "" });
}
function sendEmote(id) {
  const now = Date.now();
  if (now - emoteAt < 1500) return;
  emoteAt = now;
  if (/^(c|cs)\d+$/.test(id)) shareMedia(id);
  showEmote("me", id, S.mode === "guest" ? "guest" : "host");
  if (S.room && S.mode !== "spec") S.room.send({ to: "all", m: { t: "emote", id } });
}
/** An emote or a chat line floating by the player's box for a few seconds. */
function floatAt(side, node, ms) {
  const box = document.querySelector(`.duelist.${side}`);
  if (!box || $("#table").hidden) return;
  let lay = $("#sayFx"); if (!lay) { lay = el("div", "say-fx"); lay.id = "sayFx"; lay.setAttribute("aria-live", "polite"); document.body.append(lay); }
  for (const old of lay.querySelectorAll(`.say.${side}`)) old.remove();
  const r = box.getBoundingClientRect(), w = el("div", "say " + side);
  w.append(node);
  const top = side === "op" ? r.bottom + 8 : r.top - 8;
  Object.assign(w.style, { left: Math.round(Math.min(Math.max(8, r.left + 10), innerWidth - 230)) + "px", top: Math.round(top) + "px" });
  lay.append(w);
  setTimeout(() => { w.classList.add("out"); setTimeout(() => w.remove(), 400); }, ms);
}
function showEmote(side, id, role) {
  if (side === "op" && (MUTE.opp || MUTE.emotes)) return;
  const e = emoteFor(String(id || ""), role);
  if (!e) return;
  const n = el("div", "say-emote");
  if (e.src) { const i = el("img"); i.src = e.src; i.alt = e.name; n.append(i); } else n.append(el("span", "em-big", e.text));
  n.append(el("small", null, e.name));
  floatAt(side, n, e.src ? 3200 : 2600);
  if (!(side === "op" && MUTE.voices)) { if (e.meme) Sound.meme(e.meme); else if (e.snd) Sound.clip(e.snd); }
}
function floatChat(side, who, text) {
  const senderPremium = !!((sideSkins()[side] || {}).fx);
  if (!(S.premium ? VIEW.floatChat : senderPremium)) return;
  const n = el("div", "say-chat"); n.append(el("b", null, who), el("span", null, String(text).slice(0, 120)));
  floatAt(side, n, 4200);
}
/** Will this attack win the duel if nothing answers it? (direct, or into an Attack Position monster) */
function lethalAttack(p, e, a) {
  if (!a || !p.state || !(a.attack > 0)) return false;
  const def = 1 - e.card.controller, lp = p.state.teams[def] && p.state.teams[def].lp;
  if (!(lp > 0)) return false;
  if (!e.target) return a.attack >= lp;
  const t = lookup(e.target.controller, e.target.location, e.target.sequence);
  if (!t || !t.position || !(t.position & C.POS_ATTACK)) return false;
  return a.attack - (t.attack || 0) >= lp;
}
/** KodeX Premium Ace card: shown big before its effect resolves; everyone sees it. */
/** The showdown a player gets before their winning blow: the card's own choice, else their default (which may be
 *  "random"; every screen picks the same one). KodeX free: Menacing, 3.3 s. */
function finaleOf(controller, code) {
  const f = fxOf(sideOfTeam(controller)), seed = Number(code) ^ ((S.packet && S.packet.turn) || 0) * 7919;
  if (!f.premium) return { style: "menacing", ms: 3300 };
  return { style: pickShow(f.showFx[cc(code)] || f.finale, seed), ms: f.finaleMs || 3300 };
}
function showAce(code, controller, fx, how = "") {
  const side = sideOfTeam(controller), who = (S.packet && S.packet.names && S.packet.names[controller]) || "";
  // once per moment: a card summoned and then activating its effect right away shows once
  S.aceLast = S.aceLast || {};
  if (Date.now() - (S.aceLast[cc(code)] || 0) < 4500) return;
  S.aceLast[cc(code)] = Date.now();
  const style = pickShow(fx.showFx[cc(code)] || fx.aceStyle, Number(code) ^ ((S.packet && S.packet.turn) || 0) * 104729 ^ (S.aceN = (S.aceN || 0) + 1));
  hold(2900);
  Sound.play("boss");
  ace(style, { src: artUrl(code), title: name(code), owner: who, line: how ? `${name(code)} is ${how}` : "", premiumNote: viewerFreeNow() && side === "op" ? "Ace cards · KodeX Premium" : "" });
}
const viewerFreeNow = () => !S.premium;
// ----- profiles on the Life Point plates; tap one to see the player's profile card -----
const LOGO = "./assets/meiocg-192.webp";
const AI_PROFILE = { name: "Synapse AI", title: "Learns from every duel", bio: "MEIOCG's duel AI. It plays your decks' real lines and learns from players.", icon: "bolt", img: "", frame: "diamond", theme: "synapse", premium: false, tier: "diamond", stats: {} };
function profileOf(side) {
  const p = (sideSkins()[side] || {}).profile;
  if (p) return p;
  if (side === "op" && S.mode === "solo") return AI_PROFILE;
  return null;
}
function renderProfiles() {
  for (const side of ["me", "op"]) {
    const a = document.querySelector(`.duelist.${side} .avatar`), p = profileOf(side);
    if (!a) continue;
    a.classList.toggle("has-pf", !!p);
    if (p) { a.innerHTML = avatarHTML(p, LOGO); a.setAttribute("role", "button"); a.tabIndex = 0; a.setAttribute("aria-label", `${p.name}'s profile`); }
    else { a.textContent = ((S.packet && S.packet.names && S.packet.names[side === "me" ? S.team : 1 - S.team]) || (side === "me" ? "Y" : "O")).slice(0, 1).toUpperCase(); a.removeAttribute("role"); a.tabIndex = -1; }
  }
}
function openProfile(side) {
  const p = profileOf(side), v = $("#pfView");
  if (!p || !v) return;
  v.querySelector(".pf-body").innerHTML = cardHTML(p, LOGO, { ai: p === AI_PROFILE });
  v.hidden = false;
}
for (const side of ["me", "op"]) {
  const a = document.querySelector(`.duelist.${side} .avatar`);
  if (a) { a.addEventListener("click", (e) => { e.stopPropagation(); openProfile(side); }); a.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openProfile(side); } }); }
}
{ const v = document.getElementById("pfView"); if (v) v.addEventListener("click", (e) => { if (e.target === v || e.target.closest("[data-pfclose]")) v.hidden = true; }); }
/** KodeX Premium card voices: the player's own sound when their chosen card is activated or summoned. */
function cardVoice(controller, code) {
  const side = sideOfTeam(controller), sk = sideSkins()[side] || {};
  if (side === "op" && (MUTE.opp || MUTE.voices)) return false;
  const v = sk.voices && (sk.voices[Number(code)] || sk.voices[cc(code)] || Object.entries(sk.voices).find(([k]) => cc(k) === cc(code))?.[1]);
  if (!v) return false;
  Sound.clip(v); return true;
}
function sideOfTeam(t) { return t === (S.team === 2 ? 0 : S.team) ? "me" : "op"; }
// mute panel
function applyMute() {
  for (const k of Object.keys(MUTE)) { const x = document.getElementById("mute-" + k); if (x) x.checked = !!MUTE[k]; }
  const all = MUTE.opp && MUTE.chat && MUTE.emotes && MUTE.voices && !Sound.getPrefs().music && !Sound.getPrefs().sfx;
  const b = $("#muteAll"); if (b) b.textContent = all ? "Unmute all" : "Mute all";
}
for (const k of Object.keys(MUTE)) { const x = document.getElementById("mute-" + k); if (x) x.addEventListener("change", () => { MUTE[k] = x.checked; save("duel:mute", MUTE); applyMute(); }); }
$("#muteAll").addEventListener("click", () => {
  const on = $("#muteAll").textContent === "Mute all";
  for (const k of Object.keys(MUTE)) MUTE[k] = on;
  save("duel:mute", MUTE);
  Sound.setPref("music", !on); Sound.setPref("sfx", !on); $("#musicOn").checked = !on; $("#sfxOn").checked = !on;
  applyMute();
});
applyMute();
$("#emoteBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  const p = $("#emotePick"), on = p.hidden;
  if (on) renderEmotes();
  p.hidden = !on; $("#emoteBtn").setAttribute("aria-expanded", String(on));
  if (on) { const r = $("#emoteBtn").getBoundingClientRect(); p.style.left = Math.max(8, Math.min(r.left, innerWidth - 300)) + "px"; p.style.bottom = Math.round(innerHeight - r.top + 8) + "px"; p.style.maxHeight = Math.round(r.top - 16) + "px"; }
});
$("#emotePick").addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (!b || b.disabled) return; Sound.unlock(); sendEmote(b.dataset.id); $("#emotePick").hidden = true; $("#emoteBtn").setAttribute("aria-expanded", "false"); });
document.addEventListener("click", (e) => { if (!e.target.closest("#emotePick, #emoteBtn")) { $("#emotePick").hidden = true; $("#emoteBtn").setAttribute("aria-expanded", "false"); } });
renderEmotes();
if (window.parent !== window) window.parent.postMessage({ kx: "ready" }, "*");
