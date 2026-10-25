// Combo search: Synapse AI teaches itself a deck by practising opening turns.
// For several opening hands it replays the duel from the same seed with different main-phase choices
// (beam search over the order of summons and activations), lets the heuristics answer every other prompt,
// and keeps the lines that leave the strongest board at the end of the turn.
// Duels are deterministic for a given seed, deck order and list of answers, so a line can be replayed exactly.
import { DuelHost } from "./host.js";
import { botAnswer } from "./bot.js";
import { observe } from "./smart.js";
import { MSG, IDLE } from "./constants.js";
import { boardScore, deckProfile, emptyBook, compactBook } from "./learn.js";

const FILLER = 15025844; // Mystical Elf: a passive opponent so the search measures our own turn
const LISTS = [["summons", IDLE.SUMMON], ["special_summons", IDLE.SPSUMMON], ["monster_sets", IDLE.MSET], ["spell_sets", IDLE.SSET], ["activates", IDLE.ACTIVATE]];

function seeded(n) { let s = (n >>> 0) || 1; return () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 2 ** 32; }; }

/**
 * core/db/store as used by DuelHost (store must be able to load the deck's scripts).
 * Returns a book fragment with src:"search" lines, or null.
 */
export async function exploreDeck({ core, db, store, deck, hands = 6, budget = 110, beam = 3, depth = 12, onProgress, shouldStop } = {}) {
  const profile = deckProfile(deck, db);
  await store.preload([...deck.main, ...(deck.extra || []), FILLER]);
  const book = emptyBook(profile);
  let sims = 0;
  for (let h = 0; h < hands; h++) {
    await new Promise((r) => setTimeout(r, 0)); // let a "stop" message in between hands
    if (shouldStop && shouldStop()) break;
    const rnd = seeded(7919 * (h + 1));
    const main = deck.main.slice();
    for (let i = main.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [main[i], main[j]] = [main[j], main[i]]; }
    const decks = [{ main, extra: (deck.extra || []).slice() }, { main: Array(40).fill(FILLER), extra: [] }];
    const seed = [BigInt(h + 101), 3n, 5n, 7n];

    // Replays the duel with `choices` for our turn-1 main-phase prompts; stops at the next one.
    const run = (choices) => {
      sims++;
      let last = null;
      const host = new DuelHost({ core, db, scripts: store, decks, names: ["AI", "Practice"], options: { noShuffle: true }, seed, emit: (v, p) => { if (v === 0) last = p; } });
      const mem0 = {}, mem1 = {};
      let k = 0, guard = 0, out = null;
      try {
        host.start();
        while (!host.ended && guard++ < 3000) {
          if (!host.pending) break;
          const { player, msg, hint } = host.pending;
          if (host.turn > 1) { out = { view: last, msg: null, over: true }; break; }
          if (player === 0 && msg.type === MSG.SELECT_IDLECMD) {
            if (k < choices.length) { const err = host.respond(0, { t: msg.type, ...choices[k].ans }); k++; if (err) { out = { bad: true }; break; } continue; }
            out = { view: last, msg }; break;
          }
          if (player === 0) observe(last, mem0);
          const ans = botAnswer(msg, { mode: player === 0 ? "smart" : "passive", db, view: player === 0 ? last : null, hint, mem: player === 0 ? mem0 : mem1 });
          if (!ans || host.respond(player, ans)) { out = { bad: true }; break; }
        }
      } catch (e) { out = { bad: true }; }
      if (!out) out = { view: last, msg: null, over: true };
      out.score = out.view ? boardScore(out.view, 0, db) : -1e9;
      host.destroy();
      return out;
    };
    const sig = (view) => {
      const t = view && view.state ? view.state.teams[0] : null;
      return t ? [t.mzone, t.szone].map((z) => z.map((c) => (c ? (c.code || "x") + ":" + c.position : "-")).join(",")).join("|") + "|" + t.hand.length + "|" + t.grave.length : "?";
    };
    const endTurn = (choices) => run([...choices, { ans: { action: IDLE.TO_EP } }]).score;

    const root = run([]);
    if (!root.msg) continue;
    const start = [...new Set((root.view.state.teams[0].hand || []).filter((c) => c && c.code).map((c) => c.code))];
    const baseline = endTurn([]);
    let frontier = [{ choices: [], res: root }], best = null;
    const seen = new Set([sig(root.view)]);
    const perHand = Math.floor(budget);
    let used = 0;
    for (let d = 0; d < depth && frontier.length && used < perHand; d++) {
      const kids = [];
      for (const node of frontier) {
        const msg = node.res.msg;
        if (!msg) continue;
        const opts = [];
        for (const [list, action] of LISTS) (msg[list] || []).forEach((o, index) => opts.push({ ans: { action, index }, step: { a: action, c: o.code, l: o.location || 0, d: o.description && o.description !== "0" ? o.description : undefined },
          pri: action === IDLE.ACTIVATE ? 3 : action === IDLE.SPSUMMON ? 2 : action === IDLE.SUMMON ? 1 : 0 }));
        opts.sort((a, b) => b.pri - a.pri);
        for (const o of opts.slice(0, 10)) {
          if (used >= perHand) break;
          used++;
          const choices = [...node.choices, o];
          const res = run(choices);
          if (res.bad) continue;
          const s = sig(res.view);
          if (seen.has(s)) continue;
          seen.add(s);
          kids.push({ choices, res });
        }
      }
      kids.sort((a, b) => b.res.score - a.res.score);
      frontier = kids.slice(0, beam);
      for (const k of frontier.slice(0, 1)) if (!best || k.res.score > best.res.score) best = k;
      if (onProgress) onProgress({ hand: h + 1, hands, sims });
    }
    if (!best) continue;
    const final = endTurn(best.choices);
    const gain = Math.round(final - baseline);
    // Trailing face-down sets are left to the heuristics; the line is the part that builds the board.
    const steps = best.choices.map((c) => c.step);
    while (steps.length && (steps[steps.length - 1].a === IDLE.SSET || steps[steps.length - 1].a === IDLE.MSET)) steps.pop();
    if (gain >= 1200 && steps.length >= 1)
      book.lines.push({ steps, start, first: true, score: gain, n: 1, w: 1, src: "search" });
  }
  compactBook(book);
  return { book: book.lines.length ? book : null, sims };
}
