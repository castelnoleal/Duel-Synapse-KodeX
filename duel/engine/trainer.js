// Practice games: Synapse AI discovers lines for a deck by trying alternatives from the exact same position.
//
// The engine is deterministic once the deck order and seed are fixed, so a duel can be replayed to the start
// of any turn. For each early turn of a practice duel the trainer:
//   1. notes how the AI's normal play scores once the opponent has answered it (board value at the start of its next turn),
//   2. replays to the start of the turn several times and plays it differently (exploring other summons and activations),
//   3. keeps a variant's plays in the book only if it leaves a clearly better position than the normal play did.
// So practice only ever teaches lines that beat the AI's default from that position.
// Used by the Arena when a deck is loaded (in a background worker) and by tests/duel/ai-learn.mjs.
import { DuelHost } from "./host.js";
import { botAnswer } from "./bot.js";
import { observe } from "./smart.js";
import { Recorder, WEIGHT, boardValue, comboHints } from "./learn.js";

const MARGIN = 600;  // a variant must end the turn at least this much better than the normal play

function seededShuffle(a, rnd) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Run one duel. `script` answers are replayed first; then `policy(player, msg, ctx)` decides. Stops when stop() is true. */
function run({ core, db, scripts, decks, seed, script, policy, stop, onPrompt, onPacket }) {
  const views = [null, null], mems = [{}, {}], retry = [0, 0];
  const host = new DuelHost({ core, db, scripts, decks, names: ["A", "B"], options: { noShuffle: true }, seed,
    emit: (v, p) => { if (v < 2) { views[v] = p; observe(p, mems[v]); retry[v] = p.events.some((e) => e.type === 1) ? retry[v] + 1 : 0; if (onPacket) onPacket(v, p); } } });
  host.start();
  const hist = [];
  let steps = 0;
  while (!host.ended && host.pending) {
    if (stop && stop(host, hist, views)) break;
    const { player, msg, hint } = host.pending;
    const ans = hist.length < script.length ? script[hist.length][1]
      : policy(player, msg, { db, view: views[player], hint, mem: mems[player], retry: retry[player] });
    if (!ans) break;
    if (onPrompt) onPrompt(player, msg, ans, hint, hist.length >= script.length);
    hist.push([player, ans]);
    if (host.respond(player, ans) || ++steps > 8000 || retry[player] > 30) break;
  }
  return { host, hist, views };
}

/**
 * Play `duels` practice duels with `deck` (mirror match) and return the rows that improved on the default play.
 * book: the current Book (merged into as lines are found). turns: how many of each seat's early turns to explore.
 */
export async function practice({ core, db, scripts, deck, book, duels = 4, variants = 4, turns = 3, explore = 0.5, rnd = Math.random, shouldStop, onDuel }) {
  const codes = [...deck.main, ...deck.extra];
  await scripts.preload(codes);
  const hints = comboHints(db, codes);
  const rows = { seq: [], pick: [], resp: [] };
  const smart = (x) => (player, msg, ctx) => botAnswer(msg, { mode: "smart", db, rnd, book, hints, explore: x, ...ctx });
  const yieldNow = () => new Promise((r) => setTimeout(r, 0));
  for (let d = 0; d < duels; d++) {
    if (shouldStop && shouldStop()) break;
    const decks = [{ main: seededShuffle(deck.main, rnd), extra: deck.extra }, { main: seededShuffle(deck.main, rnd), extra: deck.extra }];
    const seed = [BigInt(Math.floor(rnd() * 2 ** 31)), BigInt(d + 1), 3n, 5n];
    // Main line: note where each turn starts in the answer history, and the board after each turn.
    const starts = [], value = [];
    let lastTurn = 0;
    const main = run({ core, db, scripts, decks, seed, script: [], policy: smart(0),
      stop: (h, hist, views) => {
        if (h.turn !== lastTurn) {
          lastTurn = h.turn; starts[h.turn] = { at: hist.length, seat: h.turnPlayer };
          // Judge turn T-2 now: its player has just seen the opponent's answer to it.
          const j = starts[h.turn - 2]; if (j) value[h.turn - 2] = boardValue(views[j.seat], j.seat);
        }
        return h.turn > turns * 2 + 2;
      } });
    main.host.destroy();
    for (let t = 1; t <= turns * 2; t++) {
      if (!starts[t] || value[t] == null || (shouldStop && shouldStop())) continue;
      const { at, seat } = starts[t];
      for (let k = 0; k < variants; k++) {
        await yieldNow();
        const rec = new Recorder();
        let end = null, explored = false;
        const br = run({ core, db, scripts, decks, seed, script: main.hist.slice(0, at),
          policy: (player, msg, ctx) => player === seat ? smart(explore)(player, msg, ctx) : smart(0)(player, msg, ctx),
          onPacket: (v, p) => { if (v === seat && p.turn <= t) rec.observe(v, p, () => 0); }, // earlier turns are only context
          onPrompt: (player, msg, ans, hint, live) => { if (live && player === seat) { rec.answer(player, msg, ans, hint); explored = true; } },
          stop: (h, hist, views) => { if (h.turn > t + 1) { end = boardValue(views[seat], seat); return true; } return false; } });
        br.host.destroy();
        if (end == null || !explored || end < value[t] + MARGIN) continue;
        // Better than the normal play from the same position: keep this turn's plays.
        const w = WEIGHT.selfplay * Math.min((end - value[t]) / 2000, 2);
        const P = rec.seats[seat].pending;
        const found = { seq: P.seq.map(([p2, p1, nx]) => [p2, p1, nx, w]), pick: P.pick.map(([src, hint, code, chosen]) => [src, hint, code, w * chosen, w]), resp: P.resp.map(([trig, code]) => [trig, code, w]) };
        for (const k of ["seq", "pick", "resp"]) rows[k].push(...found[k]);
        if (book) book.mergeRows(found);
        value[t] = end; // later variants must beat this one
      }
    }
    if (onDuel) onDuel(d + 1, rows);
  }
  return rows;
}
