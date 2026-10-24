// Unit tests for the card scanner's matching, against the real scan index.
// Run: node --test tests/scan/
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const M = require("../../scan/match.js");

const rows = JSON.parse(fs.readFileSync(path.join(__dirname, "../../scan/cards.json"), "utf8"));
const index = M.buildIndex(rows);
const ASH = 14558127;

test("an exact passcode identifies the card", () => {
  const r = M.identify(index, { passcode: "14558127" });
  assert.equal(r.card.id, ASH);
  assert.equal(r.sure, true);
  assert.equal(r.via, "passcode");
});

test("passcode digits misread as letters are corrected", () => {
  assert.equal(M.identify(index, { passcode: "l4558l27" }).card.id, ASH);
  assert.equal(M.identify(index, { passcode: "I4SS8I27 " }).card.id, ASH);
});

test("leading-zero passcodes and alternate artworks are found", () => {
  const dm = rows.find((r) => r[1] === "Dark Magician");
  assert.ok(dm[3].length > 0, "Dark Magician has alternate artworks");
  assert.equal(M.identify(index, { passcode: String(dm[3][0]).padStart(8, "0") }).card.id, dm[0]);
  const zero = rows.find((r) => r[0] < 10000000 && r[0] > 1000000);
  assert.equal(M.identify(index, { passcode: String(zero[0]).padStart(8, "0") }).card.id, zero[0]);
});

test("a set code identifies the card, with or without the region letters", () => {
  const card = rows.find((r) => r[2].some((s) => /^LOB-EN001$/.test(s)) || r[2].includes("LOB-001"));
  assert.ok(card, "LOB-001 exists");
  for (const read of ["LOB-EN001", "L0B-EN0O1", "LOB-001", "LOB - EN 001"]) {
    const r = M.identify(index, { setCode: read, name: card[1] });
    assert.equal(r.card && r.card.id, card[0], read);
  }
});

test("names are matched despite OCR mistakes", () => {
  const cases = [
    ["Ash Blossom & Joyous Spring", ASH],
    ["Ash Bl0ssom & Joyous Spr1ng", ASH],
    ["ASH BLOSSOM & JOYOUS SPRI", ASH],
    ["Blue-Eyes White Dragon", rows.find((r) => r[1] === "Blue-Eyes White Dragon")[0]],
    ["BIue-Eyes Whlte Dragon", rows.find((r) => r[1] === "Blue-Eyes White Dragon")[0]],
    ["Accesscode Talker", rows.find((r) => r[1] === "Accesscode Talker")[0]],
  ];
  for (const [read, id] of cases) {
    const r = M.identify(index, { name: read });
    assert.equal(r.card && r.card.id, id, read);
  }
});

test("a garbled name gives choices instead of a wrong answer", () => {
  const r = M.identify(index, { name: "Bl ue Eye" });
  assert.equal(r.sure, false);
  assert.ok(r.candidates.some((c) => /Blue-Eyes/.test(c.card.name)), "suggests Blue-Eyes cards");
  assert.equal(M.identify(index, { name: "zzqx" }).card, null);
});

test("a misread passcode that hits another card loses to a clear name", () => {
  // 14558128 is not Ash; if it happens to be a real card the name should win.
  const other = rows.find((r) => r[0] !== ASH && String(r[0]).length === 8);
  const r = M.identify(index, { passcode: String(other[0]), name: "Ash Blossom & Joyous Spring" });
  assert.equal(r.card.id, ASH);
});

test("matching every card name is fast enough for live scanning", () => {
  const t = Date.now();
  for (const r of rows.slice(0, 200)) M.identify(index, { name: r[1] });
  assert.ok((Date.now() - t) / 200 < 40, "under 40 ms per scan");
});

test("junk read from shading or artwork doesn't suggest cards", () => {
  for (const junk of ["iii iii", "lll", "| | |", "mmmm", "-_-"]) {
    const r = M.identify(index, { name: junk });
    assert.equal(r.card, null, junk);
    assert.equal(r.candidates.length, 0, junk);
  }
});
