// Synapse AI learning, page side: keeps this device's play book, merges the shared book from
// kodex.meiocg.org for the decks in a duel, sends new lines back anonymously, and runs practice
// games for a newly loaded deck in a background worker.
import { Book } from "./engine/learn.js";

const KEY = "synapse-book-v1", OUTBOX = "synapse-book-outbox", SHARE = "synapse-share", PRACTICED = "synapse-practiced";
const API = new URL("/api/duel/book", /^https?:/.test(location.origin) ? location.origin : "https://kodex.meiocg.org").toString();
const MAX_LOCAL = 25000, MAX_OUTBOX = 4000, PRACTICE_EVERY = 7 * 864e5;

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

export const Learning = {
  book: new Book(store.get(KEY, null)),
  shared: new Book(),
  outbox: store.get(OUTBOX, { seq: [], pick: [], resp: [] }),
  saveTimer: 0,
  sending: false,
  lastSend: 0,

  get share() { return store.get(SHARE, true) !== false; },
  set share(v) { store.set(SHARE, !!v); },

  /** New rows from the engine worker (a person's plays, or practice lines). */
  add(rows, source) {
    if (!rows) return;
    this.book.mergeRows(rows);
    if (this.share && source !== "shared") for (const k of ["seq", "pick", "resp"]) this.outbox[k].push(...(rows[k] || []));
    for (const k of ["seq", "pick", "resp"]) if (this.outbox[k].length > MAX_OUTBOX) this.outbox[k] = this.outbox[k].slice(-MAX_OUTBOX);
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 800);
  },
  save() {
    this.book.prune(MAX_LOCAL);
    if (!store.set(KEY, this.book.toJSON())) { this.book.prune(MAX_LOCAL / 2); store.set(KEY, this.book.toJSON()); }
    store.set(OUTBOX, this.outbox);
    // Batch uploads: at most every 20 s while playing (the page also sends when a duel ends or the tab is hidden).
    const queued = this.outbox.seq.length + this.outbox.pick.length + this.outbox.resp.length;
    if (queued > 400 || Date.now() - this.lastSend > 20000) this.flush();
  },
  /** Send queued lines to the shared book (anonymous card codes and counts only). */
  async flush() {
    if (this.sending || !this.share || !navigator.onLine) return;
    const take = { seq: this.outbox.seq.slice(0, 500), pick: this.outbox.pick.slice(0, 500), resp: this.outbox.resp.slice(0, 500) };
    if (!take.seq.length && !take.pick.length && !take.resp.length) return;
    this.sending = true; this.lastSend = Date.now();
    try {
      const r = await fetch(API + "/learn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(take), keepalive: true });
      if (r.ok) {
        for (const k of ["seq", "pick", "resp"]) this.outbox[k] = this.outbox[k].slice(take[k].length);
        store.set(OUTBOX, this.outbox);
      }
    } catch { /* offline: keep them for later */ } finally { this.sending = false; }
  },
  /** Fetch what every player has taught for these cards (gives up quickly so the duel never waits long). */
  async fetchShared(codes, ms = 2500) {
    const list = [...new Set(codes.map(Number))].filter((c) => c > 0).slice(0, 200);
    if (!list.length || !navigator.onLine) return;
    try {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
      const r = await fetch(`${API}?cards=${list.join(",")}`, { signal: ctl.signal });
      clearTimeout(t);
      if (r.ok) this.shared = new Book().mergeRows(await r.json());
    } catch { /* offline or slow: use this device's book only */ }
  },
  /** The lines a duel with these decks can use: this device's plays count double. */
  rowsFor(codes) {
    const merged = new Book().mergeRows(this.shared.subset(codes).rows()).mergeRows(this.book.subset(codes).rows(), 2);
    return merged.rows();
  },
  linesFor(codes) { return new Book().mergeRows(this.rowsFor(codes)).size(); },

  /** Practice a deck in a background worker once a week, so the AI finds lines for it. */
  practice(deck, base, onDone) {
    if (!deck || !deck.main || deck.main.length < 20 || this.trainer) return;
    const sig = [...deck.main, ...deck.extra].map(Number).sort((a, b) => a - b).join(",");
    let h = 0; for (let i = 0; i < sig.length; i++) h = (h * 31 + sig.charCodeAt(i)) | 0;
    const done = store.get(PRACTICED, {});
    if (done[h] && Date.now() - done[h] < PRACTICE_EVERY) return;
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return; // keep phones cool
    const w = new Worker(new URL("./host-worker.js", import.meta.url), { type: "module" });
    this.trainer = w;
    const stop = () => { try { w.terminate(); } catch { /* gone */ } if (this.trainer === w) this.trainer = null; };
    const timer = setTimeout(stop, 90000);
    w.onmessage = (ev) => {
      const m = ev.data;
      if (m.t === "ready") w.postMessage({ cmd: "train", deck: { main: deck.main, extra: deck.extra }, book: this.rowsFor([...deck.main, ...deck.extra]), duels: 3 });
      else if (m.t === "learn") this.add(m.rows, "practice");
      else if (m.t === "trained" || m.t === "fatal") {
        clearTimeout(timer); stop();
        if (m.t === "trained") { done[h] = Date.now(); store.set(PRACTICED, done); }
        if (onDone) onDone(m);
      }
    };
    w.onerror = () => { clearTimeout(timer); stop(); };
    w.postMessage({ cmd: "init", base });
  },
  stopPractice() { if (this.trainer) { try { this.trainer.terminate(); } catch { /* gone */ } this.trainer = null; } },
};

addEventListener("online", () => Learning.flush());
addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { clearTimeout(Learning.saveTimer); Learning.save(); Learning.flush(); } });
