// Card database + card-script store shared by the duel host and the UI.
// Card data comes from duel/data/cards.json (built from ProjectIgnis/BabelCDB),
// scripts from ProjectIgnis/CardScripts at the commit pinned in duel/data/scripts.json.
import { TYPE, ATTRIBUTES, RACES } from "./constants.js";

export class CardDB {
  constructor(json, strings) {
    this.raw = json.cards;
    this.strings = strings || { system: {}, victory: {}, counter: {}, setname: {} };
    this.cache = new Map();
  }
  has(code) { return !!this.raw[code]; }
  /** Full card record, or null. */
  get(code) {
    code = Number(code);
    if (this.cache.has(code)) return this.cache.get(code);
    const r = this.raw[code];
    if (!r) return null;
    const [alias, setcodes, type, level, attribute, race, atk, def, lscale, rscale, link_marker, ot, name, desc, strs] = r;
    const c = { code, alias, setcodes, type, level, attribute, race, atk, def, lscale, rscale, link_marker, ot, name, desc, strs };
    this.cache.set(code, c);
    return c;
  }
  name(code) { const c = this.get(code); return c ? c.name : code ? "#" + code : "?"; }
  /** Engine-facing record (what ocgcore's card reader needs). */
  engine(code) { return this.get(code); }
  /** Text for an effect/system description id (aux.Stringid packs card code << 20 | index). */
  desc(d) {
    if (d == null) return "";
    const v = BigInt(d);
    const code = Number(v >> 20n), idx = Number(v & 0xfffffn);
    if (code) {
      const c = this.get(code);
      if (c && c.strs && c.strs[idx]) return c.strs[idx];
      return c ? `${c.name} (effect ${idx + 1})` : `Effect of #${code}`;
    }
    return this.sys(Number(v));
  }
  sys(n) { return this.strings.system[n] ?? `#${n}`; }
  counter(n) { return this.strings.counter[n] ?? `Counter 0x${Number(n).toString(16)}`; }
  setname(n) { return this.strings.setname[n] ?? `0x${Number(n).toString(16)}`; }
  victory(n) { return this.strings.victory[n] ?? ""; }
  isExtra(code) { const c = this.get(code); return !!c && !!(c.type & (TYPE.FUSION | TYPE.SYNCHRO | TYPE.XYZ | TYPE.LINK)); }
  typeLine(c) {
    if (!c) return "";
    if (c.type & TYPE.SPELL || c.type & TYPE.TRAP) {
      const base = c.type & TYPE.SPELL ? "Spell" : "Trap";
      const sub = c.type & TYPE.QUICKPLAY ? "Quick-Play " : c.type & TYPE.CONTINUOUS ? "Continuous " : c.type & TYPE.EQUIP ? "Equip "
        : c.type & TYPE.FIELD ? "Field " : c.type & TYPE.COUNTER ? "Counter " : c.type & TYPE.RITUAL ? "Ritual " : c.type & TYPE.LINK ? "Link " : "Normal ";
      return sub + base;
    }
    const parts = [];
    for (const [bit, n] of [[TYPE.FUSION, "Fusion"], [TYPE.RITUAL, "Ritual"], [TYPE.SYNCHRO, "Synchro"], [TYPE.XYZ, "Xyz"], [TYPE.PENDULUM, "Pendulum"],
      [TYPE.LINK, "Link"], [TYPE.TUNER, "Tuner"], [TYPE.SPIRIT, "Spirit"], [TYPE.UNION, "Union"], [TYPE.GEMINI, "Gemini"], [TYPE.FLIP, "Flip"], [TYPE.TOON, "Toon"],
      [TYPE.SPSUMMON, "Special Summon"], [TYPE.NORMAL, "Normal"], [TYPE.EFFECT, "Effect"], [TYPE.TOKEN, "Token"]])
      if (c.type & bit) parts.push(n);
    return `[${raceName(c.race)} / ${parts.join(" / ")}]`;
  }
}

export function raceName(race) {
  const r = BigInt(race || 0);
  const out = [];
  for (let i = 0; i < RACES.length; i++) if (r & (1n << BigInt(i))) out.push(RACES[i]);
  return out.join("/") || "—";
}
export function attributeName(a) { return ATTRIBUTES.filter(([b]) => a & b).map(([, n]) => n).join("/") || "—"; }

/**
 * Card-script store. Scripts are fetched asynchronously before the duel starts
 * (ocgcore asks for them synchronously), using the dependency graph in scripts.json.
 * fetchText(path) -> Promise<string|null>, path like "official/c123.lua" or "utility.lua".
 */
export class ScriptStore {
  constructor(index, fetchText) {
    this.index = index;
    this.fetchText = fetchText;
    this.where = new Map();
    for (const c of index.official) this.where.set(c, "official");
    for (const c of index.prerelease) this.where.set(c, "pre-release");
    this.deps = index.deps || {};
    this.src = new Map();
    this.utilPath = new Map(index.utility.map((u) => [u.split("/").pop(), u]));
  }
  pathFor(name) {
    const base = String(name).split(/[\\/]/).pop();
    const m = /^c(\d+)\.lua$/.exec(base);
    if (m) { const w = this.where.get(Number(m[1])); return w ? `${w}/${base}` : null; }
    return this.utilPath.get(base) || null;
  }
  get(name) {
    const base = String(name).split(/[\\/]/).pop();
    return this.src.has(base) ? this.src.get(base) : null;
  }
  closure(codes) {
    const out = new Set();
    const stack = [...codes].map(Number);
    while (stack.length) {
      const c = stack.pop();
      if (out.has(c) || !this.where.has(c)) continue;
      out.add(c);
      for (const d of this.deps[c] || []) if (!out.has(d)) stack.push(d);
    }
    return out;
  }
  /** Fetch utility scripts plus the scripts for `codes` and everything they reference. */
  async preload(codes, onProgress) {
    const names = [...this.utilPath.keys()];
    for (const c of this.closure(codes)) names.push(`c${c}.lua`);
    const todo = names.filter((n) => !this.src.has(n));
    let done = 0;
    const worker = async () => {
      while (todo.length) {
        const n = todo.pop();
        const p = this.pathFor(n);
        let text = null;
        if (p) { try { text = await this.fetchText(p); } catch (e) { text = null; } }
        if (text != null) this.src.set(n, text);
        done++;
        if (onProgress) onProgress(done, names.length);
      }
    };
    await Promise.all(Array.from({ length: 16 }, worker));
    return names.length;
  }
}
