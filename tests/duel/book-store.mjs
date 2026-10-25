// Unit test for the shared playbook store (server/duel-book.js) using Node's SQLite in place of Durable Object storage.
// usage: node tests/duel/book-store.mjs
import { DatabaseSync } from "node:sqlite";
import { DuelBook, handleDuelBook } from "../../server/duel-book.js";
import { deckProfile, emptyBook, shardOf } from "../../duel/engine/learn.js";

const fail = (m) => { console.error("FAIL", m); process.exit(1); };
function fakeState() {
  const db = new DatabaseSync(":memory:");
  return { storage: { sql: { exec(q, ...p) { const st = db.prepare(q); const rows = /^\s*select/i.test(q) ? st.all(...p) : (st.run(...p), []); return { toArray: () => rows }; } } } };
}
const objects = new Map();
const env = { DUEL_BOOKS: { idFromName: (n) => n, get: (id) => { if (!objects.has(id)) objects.set(id, new DuelBook(fakeState(), {})); return objects.get(id); } } };

const deck = { main: [1, 1, 2, 3, 4, 5, 6, 7, 8, 9], extra: [100] };
const profile = deckProfile(deck, null);
const book = emptyBook(profile);
book.lines.push({ steps: [{ a: 5, c: 2, l: 2 }, { a: 1, c: 100, l: 64 }], start: [2, 3], first: true, score: 4000, n: 50, w: 1, src: "you" });
book.picks["2|506"] = { 7: 3 };
book.chains["c:999"] = { 9: 2 };
const post = (b, ip = "1.1.1.1") => handleDuelBook(new Request("https://k/api/duel/book", { method: "POST", headers: { "CF-Connecting-IP": ip }, body: JSON.stringify({ shard: shardOf(profile), book: b }) }), env);
const get = (codes) => handleDuelBook(new Request(`https://k/api/duel/book?shard=${shardOf(profile)}&codes=${codes.join(",")}`), env);

let r = await post(book); if (r.status !== 200) fail("post " + r.status + " " + await r.text());
r = await post(book, "2.2.2.2"); if (r.status !== 200) fail("second post");
r = await get(profile.codes); let j = await r.json();
if (!j.book.lines.length || j.book.lines[0].n !== 6) fail("expected merged line with capped counts (3+3), got " + JSON.stringify(j.book.lines));
if (j.book.lines[0].src !== "online") fail("player lines must come back as online");
if (j.book.picks["2|506"]["7"] !== 6) fail("picks merged " + JSON.stringify(j.book.picks));
// A similar deck (shares most cards) gets the book; an unrelated deck doesn't.
r = await get([1, 2, 3, 4, 5, 6, 7, 8, 100, 555]); j = await r.json(); if (!j.book.lines.length) fail("similar deck should match");
r = await get([500, 501, 502, 503]); j = await r.json(); if (j.book.lines.length) fail("unrelated deck should not match");
// Junk is rejected; oversized bodies too.
r = await post({ lines: "x" }); if (r.status !== 400) fail("junk accepted");
r = await handleDuelBook(new Request("https://k/api/duel/book", { method: "POST", body: "x".repeat(300000) }), env); if (r.status !== 413) fail("oversize accepted");
// Rate limit.
let last; for (let i = 0; i < 70; i++) last = await post(book, "9.9.9.9"); if (last.status !== 429) fail("rate limit");
console.log("book store OK");
