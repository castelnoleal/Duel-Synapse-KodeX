// Synapse AI playbooks in the browser: kept on this device (IndexedDB) and shared online
// through kodex.meiocg.org/api/duel/book. Works in the page and in workers.
import { sanitizeBook, mergeBooks, bookFor, shardOf, emptyBook } from "./engine/learn.js";

const DB = "synapse-ai", STORE = "books";
const API = (typeof location !== "undefined" ? location.origin : "") + "/api/duel/book";

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no IndexedDB"));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "key" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function tx(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode), s = t.objectStore(STORE);
    let out;
    Promise.resolve(fn(s)).then((v) => { out = v; });
    t.oncomplete = () => { db.close(); resolve(out); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}
const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

/** Every playbook saved on this device. */
export async function localBooks() {
  try { return (await tx("readonly", (s) => req(s.getAll()))) || []; } catch (e) { return []; }
}
/** Merges `book` into the saved playbook for the same deck. */
export async function saveLocal(book) {
  if (!book || !book.key) return null;
  try {
    return await tx("readwrite", async (s) => {
      const have = await req(s.get(book.key));
      const merged = mergeBooks(have ? sanitizeBook(have) || emptyBook(book) : emptyBook(book), book);
      merged.updated = Date.now();
      s.put(merged);
      return merged;
    });
  } catch (e) { return null; }
}
export async function forgetLocal() { try { await tx("readwrite", (s) => req(s.clear())); return true; } catch (e) { return false; } }

/** Playbooks other players built for decks like this one (online), or null. */
export async function fetchOnline(profile, timeout = 3000) {
  try {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeout) : null;
    const r = await fetch(`${API}?shard=${encodeURIComponent(shardOf(profile))}&codes=${profile.codes.join(",")}`, ctl ? { signal: ctl.signal } : {});
    if (timer) clearTimeout(timer);
    if (!r.ok) return null;
    const j = await r.json();
    const b = sanitizeBook(j && j.book);
    if (b) for (const l of b.lines) if (l.src === "you") l.src = "online"; // someone else's "you"
    return b;
  } catch (e) { return null; }
}
/** Shares what was learned (anonymous: card codes and counts only). */
export async function shareOnline(book) {
  try {
    const body = JSON.stringify({ shard: shardOf(book), book });
    if (body.length > 200000) return false;
    const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    return r.ok;
  } catch (e) { return false; }
}

/** The playbook Synapse AI uses for `profile`: matching local books plus the online one. */
export async function playbookFor(profile, { online = true } = {}) {
  const [local, remote] = await Promise.all([localBooks(), online ? fetchOnline(profile) : Promise.resolve(null)]);
  const books = local.map(sanitizeBook).filter(Boolean);
  if (remote) books.push({ ...remote, key: remote.key || "online", codes: remote.codes.length ? remote.codes : profile.codes, arche: remote.arche.length ? remote.arche : profile.arche });
  const r = bookFor(profile, books);
  const fromYou = r.book.lines.filter((l) => l.src === "you").length;
  return { ...r, fromYou, online: !!remote };
}
