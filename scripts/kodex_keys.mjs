#!/usr/bin/env node
// KodeX Premium keys and promo codes (for MEIOCG only). Premium bought outside Google Play (another payment method)
// is unlocked in the free app with a signed key; promo codes unlock it for a while.
//
//   Keys: signed with the private key (keep it secret, never commit it). Each key can say how long Premium lasts.
//     node scripts/kodex_keys.mjs key <private-key.jwk.json> [--days 365] [--count 1] [--note "who it is for"]
//       --days 0 (or no --days): no end. The days count from today (the day the key is made).
//     The app checks a key with the public key built into it (app/premium-codes.json → "pub"); nothing goes online.
//
//   Promo codes: short words you choose. Only a hash of each code is built into the app, so it needs a new build.
//     node scripts/kodex_keys.mjs promo add <CODE> [--days 30] [--until 2027-06-30] [--note "..."]
//       --days: how long Premium lasts after the code is redeemed (0 = no end); --until: last day it can be redeemed.
//     node scripts/kodex_keys.mjs promo remove <CODE>   (Premium from that code ends with the next app update)
//     node scripts/kodex_keys.mjs promo list
//
//   Revoke a key (with the next app update): node scripts/kodex_keys.mjs revoke <key or its id>
//   Check a key or code:                     node scripts/kodex_keys.mjs check <key>
//   A new signing key pair (only if the old private key is lost; every key made before stops working):
//     node scripts/kodex_keys.mjs init <new-private-key.jwk.json>
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CFG = path.join(ROOT, "app", "premium-codes.json");
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";          // Crockford base32: no I, L, O, U
const EPOCH = Date.UTC(2024, 0, 1), DAY = 864e5;

const cfg = () => JSON.parse(fs.readFileSync(CFG, "utf8"));
const saveCfg = (c) => fs.writeFileSync(CFG, JSON.stringify(c, null, 2) + "\n");
const arg = (name, d) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : d; };
const normPromo = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const promoHash = (code) => crypto.createHash("sha256").update("kodex-promo|" + normPromo(code)).digest("hex");

function b32(bytes) {
  let bits = 0, v = 0, out = "";
  for (const b of bytes) { v = (v << 8) | b; bits += 8; while (bits >= 5) { out += B32[(v >>> (bits - 5)) & 31]; bits -= 5; } v &= (1 << bits) - 1; }
  if (bits) out += B32[(v << (5 - bits)) & 31];
  return out;
}
function unb32(s) {
  s = String(s).toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  let bits = 0, v = 0; const out = [];
  for (const ch of s) { const i = B32.indexOf(ch); if (i < 0) return null; v = (v << 5) | i; bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } v &= (1 << bits) - 1; }
  return Uint8Array.from(out);
}
const pretty = (s) => "KX1-" + s.match(/.{1,6}/g).join("-");

function makeKey(priv, days) {
  const issued = Math.floor((Date.now() - EPOCH) / DAY);
  const body = Buffer.alloc(10);
  body[0] = 1; body[1] = 1;                                // version 1, Premium
  crypto.randomFillSync(body, 2, 4);                       // the key's id
  body.writeUInt16BE(issued, 6); body.writeUInt16BE(Math.max(0, Math.min(65535, days | 0)), 8);
  const sig = crypto.sign("sha256", body, { key: priv, dsaEncoding: "ieee-p1363" });
  return { key: pretty(b32(Buffer.concat([body, sig]))), id: body.subarray(2, 6).toString("hex"), issued, days };
}
function readKey(key) {
  const s = String(key).toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!s.startsWith("KX1")) return null;
  const b = unb32(s.slice(3));
  if (!b || b.length < 74) return null;
  const body = b.subarray(0, 10), sig = b.subarray(10, 74);
  return { body, sig, id: Buffer.from(body.subarray(2, 6)).toString("hex"), issued: (body[6] << 8) | body[7], days: (body[8] << 8) | body[9] };
}

const [cmd, a1, a2] = process.argv.slice(2);
if (cmd === "init") {
  if (!a1) throw new Error("usage: init <new-private-key.jwk.json>");
  if (fs.existsSync(a1)) throw new Error(a1 + " already exists");
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  fs.writeFileSync(a1, JSON.stringify({ ...privateKey.export({ format: "jwk" }), note: "KodeX Premium key signer. Keep this file private." }, null, 2), { mode: 0o600 });
  const c = cfg(); c.pub = publicKey.export({ format: "der", type: "spki" }).toString("base64"); c.revoked = []; saveCfg(c);
  console.log("New key pair. Private key: " + a1 + " (keep it secret). The public key is in app/premium-codes.json: rebuild the app.");
} else if (cmd === "key") {
  if (!a1) throw new Error("usage: key <private-key.jwk.json> [--days N] [--count N] [--note text]");
  const priv = crypto.createPrivateKey({ key: JSON.parse(fs.readFileSync(a1, "utf8")), format: "jwk" });
  const days = Number(arg("days", 0)) || 0, n = Math.max(1, Math.min(500, Number(arg("count", 1)) || 1)), note = arg("note", "");
  for (let i = 0; i < n; i++) {
    const k = makeKey(priv, days);
    console.log(k.key + "\t# id " + k.id + " · " + (days ? `${days} days from ${new Date(EPOCH + k.issued * DAY).toISOString().slice(0, 10)}` : "no end") + (note ? " · " + note : ""));
  }
} else if (cmd === "check") {
  const c = cfg(), k = readKey(a1);
  if (!k) {
    const h = promoHash(a1), p = (c.promos || []).find((x) => x.h === h);
    console.log(p ? `Promo code: ${p.days ? p.days + " days" : "no end"}${p.until ? ", redeem by " + p.until : ""}` : "Not a key or a promo code this app knows.");
  } else {
    const pub = crypto.createPublicKey({ key: Buffer.from(c.pub, "base64"), format: "der", type: "spki" });
    const good = crypto.verify("sha256", k.body, { key: pub, dsaEncoding: "ieee-p1363" }, k.sig);
    const end = k.days ? new Date(EPOCH + (k.issued + k.days) * DAY).toISOString().slice(0, 10) : "no end";
    console.log(good ? `Valid key ${k.id} · Premium until ${end}${(c.revoked || []).includes(k.id) ? " · REVOKED" : ""}` : "Not a valid key (the signature does not match).");
  }
} else if (cmd === "revoke") {
  const c = cfg(), k = readKey(a1), id = k ? k.id : String(a1 || "").toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(id)) throw new Error("give the key or its 8-character id");
  c.revoked = [...new Set([...(c.revoked || []), id])]; saveCfg(c);
  console.log("Revoked " + id + ". Rebuild the app: the key stops working with that update.");
} else if (cmd === "promo") {
  const c = cfg(); c.promos = c.promos || [];
  if (a1 === "add") {
    const code = normPromo(a2);
    if (code.length < 6) throw new Error("a promo code needs at least 6 letters or digits");
    const h = promoHash(code); c.promos = c.promos.filter((x) => x.h !== h);
    const e = { h, days: Number(arg("days", 30)) || 0 }; const until = arg("until", ""); if (until) e.until = until; const note = arg("note", ""); if (note) e.note = note;
    c.promos.push(e); saveCfg(c);
    console.log(`Added ${code}: ${e.days ? e.days + " days of Premium" : "Premium with no end"}${e.until ? ", redeem by " + e.until : ""}. Rebuild the app.`);
  } else if (a1 === "remove") {
    const h = promoHash(a2), n = c.promos.length; c.promos = c.promos.filter((x) => x.h !== h); saveCfg(c);
    console.log(n === c.promos.length ? "No such code." : "Removed. Rebuild the app.");
  } else for (const p of c.promos) console.log(`${p.h.slice(0, 12)}…  ${p.days ? p.days + " days" : "no end"}${p.until ? "  until " + p.until : ""}${p.note ? "  " + p.note : ""}`);
} else {
  console.log(fs.readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
}
