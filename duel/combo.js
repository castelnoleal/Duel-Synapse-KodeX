// Combos from KodeX, played on the table like a replay.
// A combo is a starting hand and lines of steps ("Primoa → Solfachord Happiness → Gracia + Cutia"). It isn't run by
// the duel engine (a combo is a plan, not a recorded duel): each step is shown as the move it stands for, so it can be
// watched, stepped through and recorded like any replay.
import * as C from "./engine/constants.js";
const M = C.MSG;

/** What a card does in a step. "auto" picks from where the card is and what it is. */
export const ACTIONS = [["auto", "Auto"], ["act", "Activate"], ["ns", "Normal Summon"], ["ss", "Special Summon"], ["add", "Add to hand"], ["set", "Set"],
  ["scale", "Pendulum Scale"], ["eff", "Use its effect"], ["gy", "Send to the GY"], ["ban", "Banish"]];
const ACT = new Set(ACTIONS.map((a) => a[0]));
const VERB = { act: "Activate", ns: "Normal Summon", ss: "Special Summon", add: "Add", set: "Set", scale: "Scale", eff: "Effect", gy: "To the GY", ban: "Banish" };
const str = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, n);
const code = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n < 1e10 ? n : 0; };
const img = (u, max) => (typeof u === "string" && u.length < max && /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : "");

/** A combo as sent by KodeX (or read from storage), checked and trimmed. Returns null when it has nothing to show. */
export function cleanCombo(raw) {
  if (!raw || typeof raw !== "object") return null;
  const hand = (Array.isArray(raw.hand) ? raw.hand : []).map(code).filter(Boolean).slice(0, 12);
  const lines = [];
  for (const l of (Array.isArray(raw.lines) ? raw.lines : []).slice(0, 16)) {
    const nodes = [];
    for (const n of (Array.isArray(l) ? l : []).slice(0, 12)) {
      const cards = (Array.isArray(n && n.cards) ? n.cards : []).map((x) => ({ c: code(x && x.c), a: ACT.has(x && x.a) ? x.a : "auto" })).filter((x) => x.c).slice(0, 6);
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
  };
}
/** "A + B" for a step. */
export const nodeText = (node, name) => node.cards.map((x) => name(x.c)).join(" + ");
/** A whole line as text: "A → B → C + D". */
export const lineText = (line, name) => line.map((n) => nodeText(n, name)).join(" → ");

/** The combo as a list of table states, one per move, in the same shape the duel engine sends. */
export function comboPackets(combo, db, names = ["Duelist", "Opponent"]) {
  const T = C.TYPE, me = 0;
  const info = (c) => db.get(c) || { type: 0, atk: 0, def: 0, level: 0 };
  const isX = (c) => !!(info(c).type & (T.FUSION | T.SYNCHRO | T.XYZ | T.LINK));
  const make = (c, position) => { const d = info(c); return { code: c, position, type: d.type, attack: Math.max(0, d.atk), defense: Math.max(0, d.def), level: d.level & 0xff, link: d.type & T.LINK ? d.level & 0xff : 0, status: 0 }; };
  const Z = { lp: 8000, deck: Math.max(0, combo.deckSize - combo.hand.length), deckTop: 0, hand: combo.hand.map((c) => make(c, C.POS_FACEUP_ATTACK)), mzone: Array(7).fill(null), szone: Array(8).fill(null), grave: [], banished: [],
    extra: combo.extra.map((c) => make(c, C.POS_FACEDOWN_DEFENSE)) };
  const OP = () => ({ lp: 8000, deck: 40, deckTop: 0, hand: [], mzone: Array(7).fill(null), szone: Array(8).fill(null), grave: [], banished: [], extra: [] });
  const snap = () => ({ teams: [{ ...Z, hand: Z.hand.map((c) => ({ ...c })), mzone: Z.mzone.map((c) => c && { ...c }), szone: Z.szone.map((c) => c && { ...c }), grave: Z.grave.map((c) => ({ ...c })), banished: Z.banished.map((c) => ({ ...c })), extra: Z.extra.map((c) => ({ ...c })) }, OP()], chain: [] });
  const out = [];
  let seq = 0, temp = [], normal = false;
  const total = combo.lines.reduce((n, l) => n + l.length, 0);
  const push = (events, meta) => out.push({ kind: "update", seq: ++seq, viewer: 3, turn: 1, turnPlayer: me, phase: C.PHASE.MAIN1, names, state: snap(), events, prompt: null, waitingFor: -1, ended: null, log: [], combo: meta });
  // where a card is now: [zone name, index]
  const find = (c, order) => { for (const k of order) { const i = Z[k].findIndex((x) => x && x.code === c); if (i >= 0) return [k, i]; } return null; };
  const LOC = { hand: C.LOCATION_HAND, mzone: C.LOCATION_MZONE, szone: C.LOCATION_SZONE, grave: C.LOCATION_GRAVE, banished: C.LOCATION_REMOVED, extra: C.LOCATION_EXTRA, deck: C.LOCATION_DECK };
  const at = (k, i, pos = C.POS_FACEUP_ATTACK) => ({ controller: me, location: LOC[k], sequence: i, position: pos });
  /** Takes the card out of where it is (a card that is nowhere comes from the Deck). */
  const take = (c, order) => {
    const f = find(c, order);
    if (!f) { if (isX(c)) return { card: make(c, C.POS_FACEDOWN_DEFENSE), from: at("extra", 0, C.POS_FACEDOWN_DEFENSE), k: "extra" }; Z.deck = Math.max(0, Z.deck - 1); return { card: make(c, C.POS_FACEDOWN_DEFENSE), from: at("deck", 0, C.POS_FACEDOWN_DEFENSE), k: "deck" }; }
    const [k, i] = f, card = Z[k][i], from = at(k, i, card.position);
    if (k === "mzone" || k === "szone") Z[k][i] = null; else Z[k].splice(i, 1);
    return { card, from, k };
  };
  const freeM = (extra) => { if (extra) for (const i of [5, 6]) if (!Z.mzone[i]) return i; for (const i of [2, 1, 3, 0, 4]) if (!Z.mzone[i]) return i; return -1; };
  const freeS = (pend) => { for (const i of pend ? [0, 4] : [2, 1, 3, 0, 4]) if (!Z.szone[i]) return i; return -1; };
  const ANY = ["hand", "mzone", "szone", "grave", "banished", "extra"];
  const autoOf = (c) => {
    const d = info(c), f = find(c, ANY);
    if (f && (f[0] === "mzone" || f[0] === "szone")) { const x = Z[f[0]][f[1]]; return x.position & C.POS_FACEDOWN ? "act" : "eff"; }
    if (f && (f[0] === "grave" || f[0] === "banished")) return "eff";
    if (f && f[0] === "extra") return "ss";
    if (f && f[0] === "hand") return d.type & T.MONSTER ? (normal ? "ss" : "ns") : "act";
    return isX(c) ? "ss" : "add";
  };
  /** Does one card's move: changes the table and returns the events that tell it. */
  const move = (c, a) => {
    const d = info(c), ev = [];
    if (a === "auto") a = autoOf(c);
    if ((a === "act" || a === "scale") && d.type & T.MONSTER && !(d.type & T.PENDULUM)) a = "eff";
    if (a === "act" && d.type & T.MONSTER) { const f = find(c, ["mzone", "szone"]); a = f ? "eff" : "scale"; }
    switch (a) {
      case "ns": case "ss": {
        const t = take(c, a === "ns" ? ["hand", "extra", "grave", "banished"] : ["hand", "extra", "grave", "banished", "szone"]);
        const i = freeM(isX(c)); if (i < 0) { Z.grave.push(t.card); break; }
        t.card.position = C.POS_FACEUP_ATTACK; Z.mzone[i] = t.card; if (a === "ns") normal = true;
        ev.push({ type: M.MOVE, code: c, from: t.from, to: at("mzone", i), reason: 0 });
        if (t.k === "deck") ev.push({ type: M.SHUFFLE_DECK, player: me });
        ev.push({ type: a === "ns" ? M.SUMMONING : M.SPSUMMONING, code: c, controller: me, location: C.LOCATION_MZONE, sequence: i, position: C.POS_FACEUP_ATTACK });
        break;
      }
      case "act": {
        const f = find(c, ["szone"]);
        if (f) { Z.szone[f[1]].position = C.POS_FACEUP_ATTACK; ev.push({ type: M.CHAINING, code: c, controller: me, location: C.LOCATION_SZONE, sequence: f[1], chain_size: 1, description: "0" }); break; }
        const t = take(c, ["hand", "grave", "banished"]);
        const i = d.type & T.FIELD ? 5 : freeS(false); if (i < 0) { Z.grave.push(t.card); break; }
        t.card.position = C.POS_FACEUP_ATTACK; Z.szone[i] = t.card;
        if (!(d.type & (T.CONTINUOUS | T.FIELD | T.EQUIP))) temp.push(c);     // Normal, Quick-Play and Ritual Spells, Normal and Counter Traps leave after resolving
        ev.push({ type: M.MOVE, code: c, from: t.from, to: at("szone", i), reason: 0 });
        if (t.k === "deck") ev.push({ type: M.SHUFFLE_DECK, player: me });
        ev.push({ type: M.CHAINING, code: c, controller: me, location: C.LOCATION_SZONE, sequence: i, chain_size: 1, description: "0" });
        break;
      }
      case "scale": {
        const t = take(c, ["hand", "extra", "grave", "banished"]);
        const i = freeS(true); if (i < 0) { Z.hand.push(t.card); break; }
        t.card.position = C.POS_FACEUP_ATTACK; Z.szone[i] = t.card;
        ev.push({ type: M.MOVE, code: c, from: t.from, to: at("szone", i), reason: 0 });
        if (t.k === "deck") ev.push({ type: M.SHUFFLE_DECK, player: me });
        ev.push({ type: M.CHAINING, code: c, controller: me, location: C.LOCATION_SZONE, sequence: i, chain_size: 1, description: "0" });
        break;
      }
      case "eff": {
        const f = find(c, ["mzone", "szone", "hand", "grave", "banished", "extra"]);
        ev.push({ type: M.CHAINING, code: c, controller: me, location: f ? LOC[f[0]] : C.LOCATION_DECK, sequence: f ? f[1] : 0, chain_size: 1, description: "0" });
        break;
      }
      case "add": {
        const t = take(c, ["grave", "banished", "mzone", "szone"]);
        t.card.position = C.POS_FACEUP_ATTACK; Z.hand.push(t.card);
        ev.push({ type: M.MOVE, code: c, from: t.from, to: at("hand", Z.hand.length - 1), reason: C.REASON.EFFECT });
        if (t.k === "deck") ev.push({ type: M.SHUFFLE_DECK, player: me });
        break;
      }
      case "set": {
        const t = take(c, ["hand", "grave", "banished"]);
        if (d.type & T.MONSTER) { const i = freeM(false); if (i < 0) { Z.hand.push(t.card); break; } t.card.position = C.POS_FACEDOWN_DEFENSE; Z.mzone[i] = t.card; ev.push({ type: M.MOVE, code: c, from: t.from, to: at("mzone", i, C.POS_FACEDOWN_DEFENSE), reason: 0 }); }
        else { const i = d.type & T.FIELD ? 5 : freeS(false); if (i < 0) { Z.hand.push(t.card); break; } t.card.position = C.POS_FACEDOWN_ATTACK; Z.szone[i] = t.card; ev.push({ type: M.MOVE, code: c, from: t.from, to: at("szone", i, C.POS_FACEDOWN_ATTACK), reason: 0 }); }
        if (t.k === "deck") ev.push({ type: M.SHUFFLE_DECK, player: me });
        ev.push({ type: M.SET, code: 0, controller: me });
        break;
      }
      case "gy": case "ban": {
        const t = take(c, ["mzone", "szone", "hand", a === "gy" ? "banished" : "grave", "extra"]);
        const pend = a === "gy" && t.card.type & T.PENDULUM && (t.k === "mzone" || t.k === "szone");   // a Pendulum Monster leaving the field goes face-up to the Extra Deck
        t.card.position = C.POS_FACEUP_ATTACK;
        const k = pend ? "extra" : a === "gy" ? "grave" : "banished";
        Z[k].push(t.card);
        ev.push({ type: M.MOVE, code: c, from: t.from, to: at(k, Z[k].length - 1), reason: C.REASON.EFFECT });
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
      // Spells and Traps that resolved in the step before go to the Graveyard
      const clear = [];
      for (const c of temp) { const f = find(c, ["szone"]); if (f) { const card = Z.szone[f[1]]; Z.szone[f[1]] = null; Z.grave.push(card); clear.push({ type: M.MOVE, code: c, from: at("szone", f[1]), to: at("grave", Z.grave.length - 1), reason: C.REASON.EFFECT }); } }
      temp = [];
      const prev = ni ? nodeText(line[ni - 1], (c) => db.name(c)) : "";
      node.cards.forEach((x, ci) => {
        const { ev, a } = move(x.c, x.a);
        const what = `${VERB[a] || ""}${VERB[a] ? ": " : ""}${db.name(x.c)}`;
        push([...(ci ? [] : clear), ...ev], { step, steps: total, line: li, node: ni, code: x.c, action: a,
          caption: `${prev ? prev + " → " : ""}${nodeText(node, (c) => db.name(c))}`, what, note: node.note, wait: a === "add" || a === "gy" || a === "ban" || a === "set" ? 1300 : 1900 });
      });
    });
  });
  if (out.length) out[out.length - 1].combo.last = true;
  return out;
}
