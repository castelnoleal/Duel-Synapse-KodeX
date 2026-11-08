// MEIOCG Players board (server/players.js) against an in-memory SQLite stand-in for the Durable Object storage.
// usage: node tests/server/players.test.mjs   (Node 22.5+ for node:sqlite)
import { PlayerBoard } from "../../server/players.js";
import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(":memory:");
const sql = { exec(q, ...a) { const st = q.trim().split(";").filter((x) => x.trim()); if (st.length > 1) { db.exec(q); return { toArray: () => [] }; } const s = db.prepare(q); if (!/^\s*SELECT/i.test(q)) { s.run(...a); return { toArray: () => [] }; } const rows = s.all(...a); return { toArray: () => rows }; } };
const pb = new PlayerBoard({ storage: { sql } });
const post = (path, b) => pb.fetch(new Request("https://x" + path, { method: "POST", body: JSON.stringify(b) })).then((r) => r.json().then((j) => [r.status, j]));
const get = (q = "") => pb.fetch(new Request("https://x/api/players" + q)).then((r) => r.json());
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const A = { id: "abcdefghijklmnop1", key: "k".repeat(30) };
let r = await post("/api/players/ping", { ...A, name: "Kasuteru <b>", title: "Solfachord main", icon: "crown", frame: "gold", tier: "gold", premium: true, points: 999999, days: 10, duels: 20, wins: 25, decks: 3, img: "data:image/png;base64,AAAA" });
ok(r[0] === 200 && r[1].rank === 1, "first ping lists the player");
r = await post("/api/players/ping", { ...A, key: "x".repeat(30), name: "Thief" });
ok(r[0] === 403, "another key cannot change the entry");
r = await post("/api/players/ping", { ...A, name: "Again" });
ok(r[0] === 200 && r[1].wait > 0, "updates are rate limited");
await post("/api/players/ping", { id: "zzzzzzzzzzzzzzzz2", key: "y".repeat(30), name: "Mei", icon: "bad", points: 50, days: 2 });
const l = await get();
const k = l.players.find((p) => p.name.startsWith("Kasuteru"));
ok(l.total === 2 && l.players[0].name === "Kasuteru b", "listed by points, markup removed");
ok(k.points === 10 * 40 + 20 * 8 + 3 * 10 + 300 && k.wins === 20, "points capped by activity, wins capped by duels");
ok(!("img" in k) && !("kh" in k) && !("id" in k), "no picture, key hash or id in the list");
ok(l.players[1].icon === "meiocg", "unknown icon falls back to MEIOCG");
r = await post("/api/players/leave", A);
ok(r[0] === 200 && (await get()).total === 1, "leave removes the entry");
process.exit(fails ? 1 : 0);
