// Combos from KodeX, played on the table like a replay.
// A combo is a starting hand and lines of steps ("Primoa → Solfachord Happiness → Gracia + Cutia"). It isn't run by
// the duel engine (a combo is a plan, not a recorded duel): each step is shown as the move it stands for, so it can be
// watched, stepped through and recorded like any replay.
import * as C from "./engine/constants.js";
const M = C.MSG;

/** What a card does in a step. "auto" picks from where the card is and what it is. */
export const ACTIONS = [["auto", "Auto"], ["act", "Activate"], ["ns", "Normal Summon"], ["ss", "Special Summon"], ["add", "Add to hand"], ["set", "Set"],
  ["scale", "Pendulum Scale"], ["eff", "Use its effect"], ["gy", "Send to the GY"], ["ban", "Banish"],
  ["mat", "Use as material"], ["att", "Attach as Xyz material"], ["ex", "To the Extra Deck"], ["deck", "Return to the Deck"], ["put", "Place on the field"],
  ["trib", "Tribute"], ["dis", "Discard"], ["des", "Destroy"]];
const ACT = new Set(ACTIONS.map((a) => a[0]));
const VERB = { act: "Activate", ns: "Normal Summon", ss: "Special Summon", add: "Add", set: "Set", scale: "Scale", eff: "Effect", gy: "To the GY", ban: "Banish", mat: "Material", att: "Attach", ex: "To the Extra Deck", deck: "To the Deck", put: "Place", trib: "Tribute", dis: "Discard", des: "Destroy" };
/** Moves that are what a play led to (or what it used), not plays themselves. */
export const RESULT = new Set(["add", "gy", "ban", "mat", "att", "ex", "deck", "put", "trib", "dis", "des"]);
// optional exact placement, kept when a combo comes from a replay: z = zone (0-7), p = position (1 attack, 2 defense,
// 3 face-down), f = where the card comes from (1 hand, 2 Deck, 3 Extra Deck, 4 GY, 5 banished, 6 field, 7 attached),
// s = the zone it leaves when it comes from the field (which of two copies moved), o = 1 on the opponent's side
// (summoned or placed there, or one of their cards that the combo sends, banishes, destroys or makes them discard),
// r = the row z is in ("m" Monster Zones, "s" Spell & Trap Zones: a Pendulum Monster placed in a Pendulum Zone, a
// monster placed as a Continuous Spell, a Trap Monster)
const place = (x) => { const o = {}; if (x && (x.o === 1 || x.o === true)) o.o = 1; if (x && (x.r === "m" || x.r === "s")) o.r = x.r; for (const [k, max] of [["z", 7], ["p", 3], ["f", 7], ["s", 7]]) { const v = x && x[k] != null ? Number(x[k]) : NaN; if (Number.isInteger(v) && v >= (k === "z" || k === "s" ? 0 : 1) && v <= max) o[k] = v; } return o; };
const str = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n);
const code = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n < 1e10 ? n : 0; };
const img = (u, max) => (typeof u === "string" && u.length < max && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : "");

/** A combo as sent by KodeX (or read from storage), checked and trimmed. Returns null when it has nothing to show. */
export function cleanCombo(raw) {
  if (!raw || typeof raw !== "object") return null;
  const hand = (Array.isArray(raw.hand) ? raw.hand : []).map(code).filter(Boolean).slice(0, 12);
  const lines = [];
  for (const l of (Array.isArray(raw.lines) ? raw.lines : []).slice(0, 60)) {
    const nodes = [];
    for (const n of (Array.isArray(l) ? l : []).slice(0, 12)) {
      const cards = (Array.isArray(n && n.cards) ? n.cards : []).map((x) => ({ c: code(x && x.c), a: ACT.has(x && x.a) ? x.a : "auto", ...place(x) })).filter((x) => x.c).slice(0, 6);
      if (cards.length) nodes.push({ cards, note: str(n.note, 80) });
    }
    if (nodes.length) lines.push(nodes);
  }
  if (!hand.length && !lines.length) return null;
  const it = raw.intro && typeof raw.intro === "object" ? raw.intro : {};
  return {
    id: str(raw.id, 40), title: str(raw.title, 60) || "Combo", sub: str(raw.sub, 80), deck: str(raw.deck, 60), by: str(raw.by, 32),
    hand, lines, extra: (Array.isArray(raw.extra) ? raw.extra : []).map(code).filter(Boolean).slice(0, 15), deckSize: Math.max(0, Math.min(60, Number(raw.deckSize) || 40)),
    intro: { ms: Math.max(0, Math.min(10000, Number.isFinite(Number(it.ms)) ? Number(it.ms) : 3000)), art: code(it.art), key: code(it.key), bg: img(it.bg, 2.4e6) },
    ...(cleanBoard(raw.endBoard) ? { endBoard: cleanBoard(raw.endBoard) } : {}),
    credits: cleanCredits(raw.credits),
    fx: COMBO_FX.includes(raw.fx) ? raw.fx : "",
    opening: COMBO_OPENINGS.includes(raw.opening) ? raw.opening : "",
    speed: [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4].includes(Number(raw.speed)) ? Number(raw.speed) : 0,
  };
}
/** The dramatic effects a Premium combo can play on its summons and activations (cbfx.js draws them). */
/** The Premium openings of a combo (cbfx.js draws them): the title sequence before the first step. */
export const COMBO_OPENINGS = ["thunder", "inferno", "warp", "shatter", "eclipse", "cutin", "random"];
export const COMBO_FX = ["shockwave", "lightning", "inferno", "cosmic", "glitch", "eclipse", "random"];
const CREDIT_THEMES = ["gold", "neon", "crimson", "ice", "royal"];
/** The end credits of a combo video: who made it, the deck, a handle, a line of their own, the colours, how long.
 *  "MEIOCG · Duel Synapse: KodeX" is always shown; custom (Premium) decides whether the rest can be changed. */
export function cleanCredits(c) {
  c = c && typeof c === "object" ? c : {};
  return { by: str(c.by, 32), deck: str(c.deck, 60), handle: str(c.handle, 40), line: str(c.line, 90), theme: CREDIT_THEMES.includes(c.theme) ? c.theme : "gold",
    ms: Math.max(3000, Math.min(8000, Number(c.ms) || 4500)), custom: c.custom === true };
}
/** The table as it really stood at the end of a replay's turn: [mine, theirs], each { m: 7 Monster Zones, s: 6 Spell & Trap
 *  Zones (5 = Field Zone) }, a zone being null or { id, pos: "atk" | "def" | "down" } (the shape KodeX's sheet draws). */
function cleanBoard(b) {
  if (!Array.isArray(b) || b.length !== 2) return null;
  const z = (v) => (v && code(v.id) ? { id: String(code(v.id)), pos: ["atk", "def", "down"].includes(v.pos) ? v.pos : "atk" } : null);
  return b.map((sd) => ({ m: Array.from({ length: 7 }, (_, i) => z(sd && sd.m && sd.m[i])), s: Array.from({ length: 6 }, (_, i) => z(sd && sd.s && sd.s[i])) }));
}
/** "A + B" for a step. */
export const nodeText = (node, name) => node.cards.map((x) => name(x.c)).join(" + ");
/** A whole line as text: "A → B → C + D". */
export const lineText = (line, name) => line.map((n) => nodeText(n, name)).join(" → ");

/** The combo as a list of table states, one per move, in the same shape the duel engine sends.
 *  Both sides of the table are kept: a card marked o:1 goes to (or is taken from) the opponent's side, the way effects
 *  like "Special Summon this card to your opponent's field" or "your opponent discards 1 card" work. A card always
 *  leaves for its owner's GY, banishment, Deck or Extra Deck, wherever it stood. */
export function comboPackets(combo, db, names = ["Duelist", "Opponent"]) {
  const T = C.TYPE, me = 0;
  const info = (c) => db.get(c) || { type: 0, atk: 0, def: 0, level: 0 };
  const isX = (c) => !!(info(c).type & (T.FUSION | T.SYNCHRO | T.XYZ | T.LINK));
  const make = (c, position, owner = me) => { const d = info(c); return { code: c, position, type: d.type, attack: Math.max(0, d.atk), defense: Math.max(0, d.def), level: d.level & 0xff, link: d.type & T.LINK ? d.level & 0xff : 0, status: 0, owner }; };
  const side = (o) => ({ lp: 8000, deck: 40, deckTop: 0, hand: [], mzone: Array(7).fill(null), szone: Array(8).fill(null), grave: [], banished: [], extra: [] });
  const Z = [side(), side()];
  Z[0].deck = Math.max(0, combo.deckSize - combo.hand.length);
  Z[0].hand = combo.hand.map((c) => make(c, C.POS_FACEUP_ATTACK));
  Z[0].extra = combo.extra.map((c) => make(c, C.POS_FACEDOWN_DEFENSE));
  // the opponent holds their opening five (unknown to us) and can lose them to hand-ripping effects
  const opsOpp = combo.lines.some((l) => l.some((n) => n.cards.some((x) => x.o)));
  Z[1].deck = 35; Z[1].hand = Array.from({ length: 5 }, () => make(0, C.POS_FACEDOWN_DEFENSE, 1));
  if (!opsOpp) { Z[1].deck = 40; Z[1].hand = []; }
  const copyZ = (z) => ({ ...z, hand: z.hand.map((c) => ({ ...c })), mzone: z.mzone.map((c) => c && { ...c }), szone: z.szone.map((c) => c && { ...c }), grave: z.grave.map((c) => ({ ...c })), banished: z.banished.map((c) => ({ ...c })), extra: z.extra.map((c) => ({ ...c })) });
  const snap = () => ({ teams: [copyZ(Z[0]), copyZ(Z[1])], chain: [] });
  const out = [];
  let seq = 0, temp = [], normal = false;
  const total = combo.lines.reduce((n, l) => n + l.length, 0);
  const push = (events, meta) => out.push({ kind: "update", seq: ++seq, viewer: 3, turn: 1, turnPlayer: me, phase: C.PHASE.MAIN1, names, state: snap(), events, prompt: null, waitingFor: -1, ended: null, log: [], combo: meta });
  // where a card is now: [side, zone name, index]; the side asked for is looked at first
  const find = (c, order, pref = 0) => { for (const sd of [pref, 1 - pref]) for (const k of order) { const i = Z[sd][k].findIndex((x) => x && x.code === c); if (i >= 0) return [sd, k, i]; } return null; };
  const LOC = { hand: C.LOCATION_HAND, mzone: C.LOCATION_MZONE, szone: C.LOCATION_SZONE, grave: C.LOCATION_GRAVE, banished: C.LOCATION_REMOVED, extra: C.LOCATION_EXTRA, deck: C.LOCATION_DECK };
  const at = (k, i, pos = C.POS_FACEUP_ATTACK, sd = me) => ({ controller: sd, location: LOC[k], sequence: i, position: pos });
  /** Takes the card out of where it is (a card that is nowhere comes from its Deck or Extra Deck). */
  const SRC = { 1: ["hand"], 2: [], 3: ["extra"], 4: ["grave"], 5: ["banished"], 6: ["mzone", "szone"] };
  const take = (c, order, x) => {
    const pref = x && x.o ? 1 : 0;
    if (x && x.f === 7) return { card: make(c, C.POS_FACEUP_ATTACK), from: at("mzone", 0), k: "none", sd: me };       // was attached under an Xyz Monster
    let f = null;
    if (x && x.f === 6 && x.s != null) for (const sd of [pref, 1 - pref]) for (const k of ["mzone", "szone"]) if (!f && Z[sd][k][x.s] && Z[sd][k][x.s].code === c) f = [sd, k, x.s];
    if (!f && x && x.f && SRC[x.f] && SRC[x.f].length) f = find(c, SRC[x.f], pref);
    if (!f && !(x && x.f === 2)) f = find(c, order, pref);
    // the opponent discarding or losing a card we can't see: one of their unknown hand cards, shown as this card
    if (!f && pref === 1 && order.includes("hand")) { const i = Z[1].hand.findIndex((h) => !h.code); if (i >= 0) { const card = Z[1].hand.splice(i, 1)[0]; Object.assign(card, make(c, C.POS_FACEUP_ATTACK, 1)); return { card, from: at("hand", i, C.POS_FACEDOWN_DEFENSE, 1), k: "hand", sd: 1 }; } }
    if (!f) {
      const sd = x && x.o && !["ns", "ss", "put", "set"].includes(x.a) ? 1 : me;
      if (isX(c)) return { card: make(c, C.POS_FACEDOWN_DEFENSE, sd), from: at("extra", 0, C.POS_FACEDOWN_DEFENSE, sd), k: "extra", sd };
      Z[sd].deck = Math.max(0, Z[sd].deck - 1); return { card: make(c, C.POS_FACEDOWN_DEFENSE, sd), from: at("deck", 0, C.POS_FACEDOWN_DEFENSE, sd), k: "deck", sd };
    }
    const [sd, k, i] = f, card = Z[sd][k][i], from = at(k, i, card.position, sd);
    if (k === "mzone" || k === "szone") Z[sd][k][i] = null; else Z[sd][k].splice(i, 1);
    if (card.owner == null) card.owner = sd;
    return { card, from, k, sd };
  };
  const freeM = (sd, extra) => { const z = Z[sd].mzone; if (extra) for (const i of [5, 6]) if (!z[i] && !Z[1 - sd].mzone[i]) return i; for (const i of [2, 1, 3, 0, 4]) if (!z[i]) return i; return -1; };
  const freeS = (sd, pend) => { for (const i of pend ? [0, 4] : [2, 1, 3, 0, 4]) if (!Z[sd].szone[i]) return i; return -1; };
  const ANY = ["hand", "mzone", "szone", "grave", "banished", "extra"];
  const autoOf = (c) => {
    const d = info(c), f = find(c, ANY);
    if (f && (f[1] === "mzone" || f[1] === "szone")) { const x = Z[f[0]][f[1]][f[2]]; return x.position & C.POS_FACEDOWN ? "act" : "eff"; }
    if (f && (f[1] === "grave" || f[1] === "banished")) return "eff";
    if (f && f[1] === "extra") return "ss";
    if (f && f[1] === "hand") return d.type & T.MONSTER ? (normal ? "ss" : "ns") : "act";
    return isX(c) ? "ss" : "add";
  };
  /** Does one card's move: changes the table and returns the events that tell it. */
  const POSN = { 1: C.POS_FACEUP_ATTACK, 2: C.POS_FACEUP_DEFENSE, 3: C.POS_FACEDOWN_DEFENSE };
  // a card leaving for a pile goes to its owner's pile; a Pendulum Monster leaving the field goes face-up to the Extra Deck
  const toPile = (t, k, reason, ev, c) => {
    const o = t.card.owner != null ? t.card.owner : t.sd;
    t.card.position = k === "extra" && !(t.card.type & T.PENDULUM) ? C.POS_FACEDOWN_DEFENSE : C.POS_FACEUP_ATTACK; t.card.owner = o;
    Z[o][k].push(t.card);
    ev.push({ type: M.MOVE, code: c, from: t.from, to: at(k, Z[o][k].length - 1, t.card.position, o), reason });
  };
  const move = (c, a, x = {}) => {
    const d = info(c), ev = [], dst = x.o ? 1 : me;
    const zoneM = (extra) => (x.z != null && x.z < 7 && x.r !== "s" && !Z[dst].mzone[x.z] ? x.z : freeM(dst, extra));
    const zoneS = (pend) => (x.z != null && x.r !== "m" && !Z[dst].szone[x.z] ? x.z : d.type & T.FIELD ? 5 : freeS(dst, pend));
    if (a === "auto") a = autoOf(c);
    if ((a === "act" || a === "scale") && d.type & T.MONSTER && !(d.type & T.PENDULUM)) a = "eff";
    if (a === "act" && d.type & T.MONSTER) { const f = find(c, ["mzone", "szone"]); a = f ? "eff" : "scale"; }
    switch (a) {
      case "ns": case "ss": {
        const t = take(c, a === "ns" ? ["hand", "extra", "grave", "banished"] : ["hand", "extra", "grave", "banished", "szone", "mzone"], { ...x, o: 0, a });
        const i = zoneM(isX(c)); if (i < 0) { toPile(t, "grave", C.REASON.RULE || 0, ev, c); break; }
        const pos = a === "ss" && x.p ? POSN[x.p] : C.POS_FACEUP_ATTACK;
        t.card.position = pos; Z[dst].mzone[i] = t.card; if (a === "ns") normal = true;
        ev.push({ type: M.MOVE, code: c, from: t.from, to: at("mzone", i, pos, dst), reason: 0 });
        if (t.k === "deck") ev.push({ type: M.SHUFFLE_DECK, player: t.sd });
        ev.push({ type: a === "ns" ? M.SUMMONING : M.SPSUMMONING, code: c, controller: dst, location: C.LOCATION_MZONE, sequence: i, position: pos });
        break;
      }
      case "act": {
        const f = find(c, ["szone"], dst);
        if (f) { Z[f[0]].szone[f[2]].position = C.POS_FACEUP_ATTACK; ev.push({ type: M.CHAINING, code: c, controller: f[0], location: C.LOCATION_SZONE, sequence: f[2], chain_size: 1, description: "0" }); break; }
        const t = take(c, ["hand", "grave", "banished"], { ...x, o: 0 });
        const i = zoneS(false); if (i < 0) { toPile(t, "grave", 0, ev, c); break; }
        t.card.position = C.POS_FACEUP_ATTACK; Z[dst].szone[i] = t.card;
        if (!(d.type & (T.CONTINUOUS | T.FIELD | T.EQUIP))) temp.push(c);     // Normal, Quick-Play and Ritual Spells, Normal and Counter Traps leave after resolving
        ev.push({ type: M.MOVE, code: c, from: t.from, to: at("szone", i, C.POS_FACEUP_ATTACK, dst), reason: 0 });
        if (t.k === "deck") ev.push({ type: M.SHUFFLE_DECK, player: t.sd });
        ev.push({ type: M.CHAINING, code: c, controller: dst, location: C.LOCATION_SZONE, sequence: i, chain_size: 1, description: "0" });
        break;
      }
      case "scale": case "put": {
        const t = take(c, ["hand", "extra", "grave", "banished"], { ...x, o: 0, a });
        if (a === "put" && (x.r === "m" || (x.r !== "s" && d.type & T.MONSTER && !(d.type & T.PENDULUM)))) {      // a monster placed by an effect stands in a Monster Zone
          const i = zoneM(isX(c)); if (i < 0) { toPile(t, "grave", 0, ev, c); break; }
          t.card.position = x.p ? POSN[x.p] : C.POS_FACEUP_ATTACK; Z[dst].mzone[i] = t.card; ev.push({ type: M.MOVE, code: c, from: t.from, to: at("mzone", i, t.card.position, dst), reason: C.REASON.EFFECT }); break;
        }
        const i = zoneS(!!(d.type & T.MONSTER)); if (i < 0) { Z[t.sd].hand.push(t.card); break; }
        t.card.position = a === "put" && x.p === 3 ? C.POS_FACEDOWN_ATTACK : C.POS_FACEUP_ATTACK; Z[dst].szone[i] = t.card;
        ev.push({ type: M.MOVE, code: c, from: t.from, to: at("szone", i, t.card.position, dst), reason: a === "put" ? C.REASON.EFFECT : 0 });
        if (t.k === "deck") ev.push({ type: M.SHUFFLE_DECK, player: t.sd });
        if (a === "scale") ev.push({ type: M.CHAINING, code: c, controller: dst, location: C.LOCATION_SZONE, sequence: i, chain_size: 1, description: "0" });
        break;
      }
      case "eff": {
        const f = (x.f && SRC[x.f] && SRC[x.f].length && find(c, SRC[x.f], dst)) || find(c, ["mzone", "szone", "hand", "grave", "banished", "extra"], dst);
        ev.push({ type: M.CHAINING, code: c, controller: f ? f[0] : me, location: f ? LOC[f[1]] : C.LOCATION_DECK, sequence: f ? f[2] : 0, chain_size: 1, description: "0" });
        break;
      }
      case "add": {
        const t = take(c, ["grave", "banished", "mzone", "szone"], x);
        const o = x.o ? 1 : t.card.owner != null ? t.card.owner : t.sd;
        t.card.position = C.POS_FACEUP_ATTACK; t.card.owner = o; Z[o].hand.push(t.card);
        ev.push({ type: M.MOVE, code: c, from: t.from, to: at("hand", Z[o].hand.length - 1, C.POS_FACEUP_ATTACK, o), reason: C.REASON.EFFECT });
        if (t.k === "deck") ev.push({ type: M.SHUFFLE_DECK, player: t.sd });
        break;
      }
      case "set": {
        const t = take(c, ["hand", "grave", "banished"], { ...x, o: 0, a });
        if (d.type & T.MONSTER) { const i = zoneM(false); if (i < 0) { Z[t.sd].hand.push(t.card); break; } t.card.position = C.POS_FACEDOWN_DEFENSE; Z[dst].mzone[i] = t.card; ev.push({ type: M.MOVE, code: c, from: t.from, to: at("mzone", i, C.POS_FACEDOWN_DEFENSE, dst), reason: 0 }); }
        else { const i = zoneS(false); if (i < 0) { Z[t.sd].hand.push(t.card); break; } t.card.position = C.POS_FACEDOWN_ATTACK; Z[dst].szone[i] = t.card; ev.push({ type: M.MOVE, code: c, from: t.from, to: at("szone", i, C.POS_FACEDOWN_ATTACK, dst), reason: 0 }); }
        if (t.k === "deck") ev.push({ type: M.SHUFFLE_DECK, player: t.sd });
        ev.push({ type: M.SET, code: 0, controller: dst });
        break;
      }
      case "gy": case "ban": case "mat": case "trib": case "dis": case "des": {
        const order = a === "dis" ? ["hand"] : ["mzone", "szone", "hand", a === "ban" ? "grave" : "banished", "extra"];
        const t = take(c, order, x);
        const onField = t.k === "mzone" || t.k === "szone";
        const k = a !== "ban" && t.card.type & T.PENDULUM && onField ? "extra" : a === "ban" ? "banished" : "grave";
        const R = C.REASON, reason = a === "mat" ? R.MATERIAL : a === "trib" ? R.RELEASE : a === "dis" ? R.DISCARD | R.EFFECT : a === "des" ? R.DESTROY | R.EFFECT : R.EFFECT;
        toPile(t, k, reason, ev, c);
        break;
      }
      case "ex": {
        const t = take(c, ["mzone", "szone", "hand", "grave", "banished"], x);
        toPile(t, "extra", C.REASON.EFFECT, ev, c);
        break;
      }
      case "deck": {
        const t = take(c, ["mzone", "szone", "hand", "grave", "banished"], x);
        const o = t.card.owner != null ? t.card.owner : t.sd;
        if (t.k !== "deck") Z[o].deck++;
        ev.push({ type: M.MOVE, code: c, from: t.from, to: at("deck", 0, C.POS_FACEDOWN_DEFENSE, o), reason: C.REASON.EFFECT }, { type: M.SHUFFLE_DECK, player: o });
        break;
      }
      case "att": {
        const t = take(c, ["mzone", "szone", "hand", "grave", "extra"], x);
        let hs = dst, h = Z[dst].mzone.findIndex((m) => m && m.type & T.XYZ);
        if (h < 0) { hs = 1 - dst; h = Z[hs].mzone.findIndex((m) => m && m.type & T.XYZ); }
        ev.push({ type: M.MOVE, code: c, from: t.from, to: { controller: hs, location: C.LOCATION_MZONE | C.LOCATION_OVERLAY, sequence: Math.max(0, h), position: C.POS_FACEUP_ATTACK }, reason: C.REASON.MATERIAL });
        break;
      }
      default: break;
    }
    return { ev, a };
  };
  // the opening hand
  push([{ type: M.NEW_TURN, player: me }, { type: M.DRAW, player: me, drawn: combo.hand.map((c) => ({ code: c, position: C.POS_FACEUP_ATTACK })) }],
    { step: 0, steps: total, caption: `Starting hand: ${combo.hand.map((c) => db.name(c)).join(" + ") || "any"}`, wait: 1900 });
  let step = 0;
  combo.lines.forEach((line, li) => {
    line.forEach((node, ni) => {
      step++;
      // Spells and Traps that resolved in the step before go to their owner's Graveyard
      const clear = [];
      for (const c of temp) { const f = find(c, ["szone"]); if (f) { const [sd, , i] = f, card = Z[sd].szone[i]; Z[sd].szone[i] = null; const o = card.owner != null ? card.owner : sd; Z[o].grave.push(card); clear.push({ type: M.MOVE, code: c, from: at("szone", i, C.POS_FACEUP_ATTACK, sd), to: at("grave", Z[o].grave.length - 1, C.POS_FACEUP_ATTACK, o), reason: C.REASON.EFFECT }); } }
      temp = [];
      const prev = ni ? nodeText(line[ni - 1], (c) => db.name(c)) : "";
      node.cards.forEach((x, ci) => {
        const { ev, a } = move(x.c, x.a, x);
        const what = `${VERB[a] || ""}${VERB[a] ? ": " : ""}${db.name(x.c)}${x.o ? (a === "ss" || a === "put" || a === "set" ? " to your opponent's field" : " (your opponent's)") : ""}`;
        push([...(ci ? [] : clear), ...ev], { step, steps: total, line: li, node: ni, code: x.c, action: a, opp: !!x.o,
          caption: `${prev ? prev + " → " : ""}${nodeText(node, (c) => db.name(c))}`, what, note: node.note, wait: RESULT.has(a) || a === "set" ? 1100 : 1900 });
      });
    });
  });
  if (out.length) out[out.length - 1].combo.last = true;
  return out;
}

// ----- a replay read back as a combo -----
// The Arena's engine re-runs the replay without showing it (host-worker "replayScan") and hands back every step.
// One player's turn is then written as lines: what they played, and what each play added, summoned, sent or banished.
const isPlayEvent = (e, P) => (e.type === M.CHAINING || e.type === M.SUMMONING || e.type === M.SPSUMMONING || e.type === M.FLIPSUMMONING) && e.controller === P;
/** The turns of a scanned replay: [{ turn, tp, plays }] (plays = cards the turn player summoned or activated). */
export function replayTurns(scan) {
  const out = []; let cur = null;
  for (const s of scan.steps || []) for (const e of s.events || []) {
    if (e.type === M.NEW_TURN) { cur = { turn: out.length + 1, tp: e.player === 0 || e.player === 1 ? e.player : s.tp, plays: 0 }; out.push(cur); }
    else if (cur && isPlayEvent(e, cur.tp)) cur.plays++;
  }
  return out;
}
/** One turn of a scanned replay as a combo (the same shape KodeX makes). Returns null when the turn has no plays.
 *  Every play is its own line: [what it used] → the play → what it led to. Each card keeps the zone and position it
 *  really went to and where it came from, so the combo plays back on the table exactly as the duel went. */
export function comboFromReplay(scan, turnNo, db) {
  const T = C.TYPE, R = C.REASON, info = (c) => db.get(c) || { type: 0 };
  const turns = replayTurns(scan), tinfo = turns[turnNo - 1]; if (!tinfo) return null;
  const P = tinfo.tp, lines = [], stUp = new Set();
  let t = 0, hand = null, prevHands = null, line = null, res = null, mats = [], solving = false, actCard = 0, pend = null, endBoard = null, activating = false;
  const chainBy = [];                                     // who activated each link of the chain now building
  const myLink = () => !chainBy.length || chainBy[chainBy.length - 1] === P;
  const base = (l) => l & ~C.LOCATION_OVERLAY;
  const srcOf = (from) => (from.location & C.LOCATION_OVERLAY ? 7 : { [C.LOCATION_HAND]: 1, [C.LOCATION_DECK]: 2, [C.LOCATION_EXTRA]: 3, [C.LOCATION_GRAVE]: 4, [C.LOCATION_REMOVED]: 5, [C.LOCATION_MZONE]: 6, [C.LOCATION_SZONE]: 6 }[base(from.location)] || 0);
  const posOf = (p) => (p & C.POS_FACEDOWN ? 3 : p & C.POS_FACEUP_DEFENSE ? 2 : 1);
  const card = (c, a, mv) => { const x = { c, a }; if (mv) { const onF = mv.to && (base(mv.to.location) === C.LOCATION_MZONE || base(mv.to.location) === C.LOCATION_SZONE);
    if ((onF && mv.to.controller != null && mv.to.controller !== P) || (!onF && mv.from && mv.from.controller != null && mv.from.controller !== P)) x.o = 1; if (mv.to && (base(mv.to.location) === C.LOCATION_MZONE || base(mv.to.location) === C.LOCATION_SZONE) && !(mv.to.location & C.LOCATION_OVERLAY)) { x.z = Math.min(7, mv.to.sequence | 0); x.p = posOf(mv.to.position); x.r = base(mv.to.location) === C.LOCATION_SZONE ? "s" : "m"; } const f = mv.from ? srcOf(mv.from) : mv.f || 0; if (f) x.f = f; if (f === 6 && mv.from) x.s = Math.min(7, mv.from.sequence | 0); } return x; };
  const begin = (c, a, mv) => {
    if (!hand) hand = (prevHands && prevHands[P] ? prevHands[P] : []).filter(Boolean).slice(0, 12);
    if (lines.length >= 60) { line = null; res = null; mats = []; return; }
    line = []; lines.push(line);
    if (mats.length) line.push({ cards: mats.slice(0, 6), note: "" });
    line.push({ cards: [card(c, a, mv)], note: "" });
    mats = []; res = null; actCard = c;
  };
  const result = (c, a, mv) => {
    if (!hand) return;
    if (!line) { if (lines.length >= 60) return; line = []; lines.push(line); }
    if (!res || res.cards.length >= 6) { if (line.length >= 12) return; res = { cards: [], note: "" }; line.push(res); }
    res.cards.push(card(c, a, mv));
  };
  // a card that came to the field and was not announced as a summon or an activation was placed there by an effect
  const flush = () => { if (!pend) return; const m = pend; pend = null; if (!hand) return; const mz = base(m.to.location) === C.LOCATION_MZONE; result(m.c, mz ? "ss" : "put", m); };
  for (const s of scan.steps || []) {
    for (const e of s.events || []) {
      if (e.type === M.NEW_TURN) { flush(); t++; continue; }
      if (t !== turnNo) continue;
      const c = Number(e.code) || 0;
      const mv = pend && pend.c === c ? pend : null;
      if (e.type === M.CHAINING) chainBy.push(e.controller);
      if (e.type === M.CHAIN_SOLVING) { flush(); solving = true; activating = false; }
      if ((e.type === M.SUMMONING || e.type === M.SPSUMMONING || e.type === M.FLIPSUMMONING) && !solving) activating = false;
      if (e.type === M.CHAINING && e.controller !== P) activating = false;
      else if (e.type === M.CHAIN_SOLVED || e.type === M.CHAIN_END) { flush(); solving = false; if (e.type === M.CHAIN_END) chainBy.length = 0; else chainBy.pop(); }
      else if (e.type === M.CHAINING && e.controller === P && c) {
        const d = info(c), loc = base(e.location);
        let a = "eff";
        if (!(d.type & T.MONSTER)) { if (mv || loc === C.LOCATION_HAND || (loc & C.LOCATION_SZONE && !stUp.has(c))) a = "act"; stUp.add(c); }
        else if (d.type & T.PENDULUM && mv && base(mv.to.location) === C.LOCATION_SZONE) { a = "scale"; stUp.add(c); }
        if (mv) pend = null; else flush();
        begin(c, a, mv || { f: srcOf({ location: e.location }) });
        activating = true;                                   // its cost is paid now, before it resolves
      } else if (e.type === M.SUMMONING && e.controller === P && c) { if (mv) pend = null; else flush(); begin(c, "ns", mv); }
      else if (e.type === M.FLIPSUMMONING && e.controller === P && c) { flush(); begin(c, "eff", { f: 6 }); }
      else if (e.type === M.SPSUMMONING && e.controller === P && c) { if (mv) pend = null; else flush(); if (solving && hand) result(c, "ss", mv); else begin(c, "ss", mv); }
      else if (e.type === M.DRAW && e.player === P && hand) { flush(); for (const d of e.drawn || []) if (d && d.code) result(Number(d.code), "add", { f: 2 }); }
      else if (e.type === M.MOVE && c && e.from && e.to) {
        const fl = base(e.from.location), tl = base(e.to.location), over = !!(e.to.location & C.LOCATION_OVERLAY);
        // the turn player's own cards, and the opponent's cards that the turn player's effects move (hand-ripping,
        // destroying or banishing their board); the opponent paying for their own hand trap is not part of the combo
        const mine = e.to.controller === P || e.from.controller === P || (solving && myLink());
        if (!mine || (fl === tl && !over && !(e.from.location & C.LOCATION_OVERLAY))) continue;
        flush();
        const m = { c, from: e.from, to: e.to };
        if (over) { if (e.reason & R.MATERIAL && !solving) mats.push(card(c, "att", m)); else result(c, "att", m); continue; }
        if (tl === C.LOCATION_MZONE || tl === C.LOCATION_SZONE) {
          if (fl === C.LOCATION_HAND && e.to.position & C.POS_FACEDOWN && !solving) { begin(c, "set", m); continue; }
          pend = m; continue;                                    // a summon or an activation usually follows
        }
        // the cost of an effect being activated (Tributing, banishing, sending): part of that play, so the card has
        // left its zone before what the effect summons takes it
        if (activating && line && !solving && e.reason & R.COST && fl !== C.LOCATION_DECK) {
          const how = e.reason & R.RELEASE ? "trib" : e.reason & R.DISCARD ? "dis" : tl === C.LOCATION_REMOVED ? "ban" : tl === C.LOCATION_HAND ? "add" : tl === C.LOCATION_EXTRA ? "ex" : tl === C.LOCATION_DECK ? "deck" : "gy";
          result(c, how, m); continue;
        }
        if ((e.reason & R.MATERIAL || (e.reason & R.RELEASE && e.reason & R.SUMMON)) && !solving && (tl === C.LOCATION_GRAVE || tl === C.LOCATION_EXTRA || tl === C.LOCATION_REMOVED)) { mats.push(card(c, tl === C.LOCATION_REMOVED ? "ban" : "mat", m)); continue; }
        // a Spell or Trap going to the GY after it resolved is part of playing it, not a result
        if (tl === C.LOCATION_GRAVE && c === actCard && fl & C.LOCATION_SZONE && !(info(c).type & T.MONSTER)) continue;
        // how it left: Tributed, discarded and destroyed cards say so on the sheet instead of "sent"
        const how = e.reason & R.RELEASE ? "trib" : e.reason & R.DISCARD ? "dis" : e.reason & R.DESTROY ? "des" : "gy";
        if ((e.reason & R.RELEASE) && !solving && tl === C.LOCATION_GRAVE) { mats.push(card(c, "trib", m)); continue; }
        if (tl === C.LOCATION_HAND) result(c, "add", m); else if (tl === C.LOCATION_GRAVE) result(c, how, m); else if (tl === C.LOCATION_REMOVED) result(c, "ban", m);
        else if (tl === C.LOCATION_EXTRA) result(c, "ex", m); else if (tl === C.LOCATION_DECK) result(c, "deck", m);
      }
    }
    prevHands = s.hands;
    if (t === turnNo && s.board) endBoard = s.board;
  }
  flush();
  const clean = lines.filter((l) => l.length);
  if (!clean.length) return null;
  const names = scan.names || [], deck = (scan.decks || [])[P] || { main: 40, extra: [] };
  // the real end board of the turn, zone by zone (Pendulum Zones are Spell & Trap Zones 0 and 4; the old separate ones, 6 and 7, are shown there)
  const pos = (p) => (p & C.POS_FACEDOWN ? "down" : p & C.POS_FACEUP_DEFENSE ? "def" : "atk");
  const z = (c) => (c && c.code ? { id: String(c.code), pos: pos(c.position) } : null);
  const sideOf = (b) => { if (!b) return null; const m = (b.m || []).slice(0, 7).map(z); while (m.length < 7) m.push(null); const sz = (b.s || []).slice(0, 6).map(z); while (sz.length < 6) sz.push(null);
    for (const [from, to] of [[6, 0], [7, 4]]) if (b.s && b.s[from] && !sz[to]) sz[to] = z(b.s[from]); return { m, s: sz }; };
  // the opponent's Extra Monster Zones are numbered from their side: their zone 6 is the one above our zone 5
  const theirs = sideOf(endBoard && endBoard[1 - P]) || { m: Array(7).fill(null), s: Array(6).fill(null) };
  [theirs.m[5], theirs.m[6]] = [theirs.m[6], theirs.m[5]];
  const board = endBoard && endBoard[P] ? [sideOf(endBoard[P]), theirs] : null;
  return cleanCombo({ id: "", title: `${names[P] || "Duelist"} · Turn ${turnNo}`.slice(0, 60), deck: names[P] || "", hand: hand || [], lines: clean, extra: deck.extra || [], deckSize: deck.main || 40, intro: { ms: 3000 }, endBoard: board });
}
