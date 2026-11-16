// Deck statistics for KodeX and the Duel Arena: exact probabilities, not points.
// Every number here is a real probability or count worked out from the deck list (hypergeometric and multivariate
// hypergeometric draws, no sampling), so a deck is only called consistent when it really opens its plays that often.
// Works offline: it needs only the cards' text and stats.
// This one file is used by the Arena (as a module) and built into KodeX (app/src manifest entry "from").
// Created by Castel Noleal, creator of MEIOCG. A project of Meta Insider OCG since 2023.
const DeckStats = (() => {
  // ---------- exact counting ----------
  const LC = [0];
  const lnFact = (n) => { for (let i = LC.length; i <= n; i++) LC[i] = LC[i - 1] + Math.log(i); return LC[n]; };
  /** C(n, k) */
  const C = (n, k) => (k < 0 || k > n || n < 0 ? 0 : Math.exp(lnFact(n) - lnFact(k) - lnFact(n - k)));
  /** P(exactly k of the K copies in an n-card hand from N cards) */
  const pmf = (N, K, n, k) => (N <= 0 || n > N ? 0 : (C(K, k) * C(N - K, n - k)) / C(N, n));
  /** P(at least k) */
  const atLeast = (N, K, n, k = 1) => { let p = 0; for (let i = k; i <= Math.min(n, K); i++) p += pmf(N, K, n, i); return Math.min(1, Math.max(0, p)); };
  /** The whole distribution 0..n */
  const dist = (N, K, n) => Array.from({ length: n + 1 }, (_, k) => pmf(N, K, n, k));
  /** Multivariate hypergeometric: P(test(counts) is true) for a hand of n from groups of sizes `sizes` (exact). */
  function multi(sizes, n, test) {
    const N = sizes.reduce((a, b) => a + b, 0), tot = C(N, n), k = Array(sizes.length).fill(0);
    if (!tot) return 0;
    let p = 0;
    const go = (i, left, ways) => {
      if (i === sizes.length - 1) { if (left > sizes[i]) return; k[i] = left; if (test(k)) p += ways * C(sizes[i], left); return; }
      for (let x = 0; x <= Math.min(left, sizes[i]); x++) { k[i] = x; go(i + 1, left - x, ways * C(sizes[i], x)); }
    };
    go(0, n, 1);
    return Math.min(1, Math.max(0, p / tot));
  }
  /** The smallest number of copies of a role that reaches the target chance (null if more than `max`). */
  function needFor(N, n, target, have, max = 30) { for (let K = have; K <= Math.min(max, N); K++) if (atLeast(N, K, n) >= target) return K; return null; }

  // ---------- what each card does, from its text ----------
  const RX = {
    search: /add (?:up to \w+ |\w+ )?[^.;]{0,90}? from your (?:main )?deck[^.;]{0,40}? to your hand|add [^.;]{0,90}? from your (?:main )?deck/i,
    deckSS: /special summon [^.;]{0,90}? from your (?:main )?deck/i,
    selfSS: /special summon this card(?: from your (?:hand|gy|graveyard))?|you can special summon this card/i,
    handSS: /special summon [^.;]{0,60}? from your hand/i,
    handtrap: /(?:\(quick effect\)[^.]{0,120}?(?:discard this card|from your hand)|discard this card[^.]{0,60};|(?:during (?:either player's|your opponent's) (?:turn|main phase)|\(quick effect\))[^.]{0,80}?(?:discard this card|(?:send|banish|special summon) this card from your hand))/i,
    negate: /\bnegat/i,
    breakOne: /(?:destroy|banish|return|shuffle|send|take control of|negate the effects of)[^.;]{0,80}?(?:your opponent controls|your opponent's field|on the field|your opponent's [^.;]{0,30}?(?:monsters?|cards?|spells?|traps?))|(?:monsters?|cards?) your opponent controls[^.;]{0,80}?(?:effects are negated|destroy|banish)/i,
    breakAll: /(?:destroy|banish|return|send|shuffle) all (?:cards|monsters|spells|traps|face-up)[^.]{0,40}?(?:your opponent controls|on the field|your opponent's)/i,
    draw: /\bdraw (\d|one|two|three) cards?\b/i,
    gyUse: /(?:in your (?:gy|graveyard)|from your (?:gy|graveyard)|if this card is sent to the (?:gy|graveyard)|while this card is in your (?:gy|graveyard))/i,
    deckUse: /from your (?:main )?deck/i,
    floodgate: /your opponent cannot|neither player can|cannot special summon (?:monsters )?from the extra deck/i,
    protect: /cannot be destroyed|unaffected by|cannot be targeted/i,
    recur: /from your (?:gy|graveyard)[^.]{0,60}?(?:to your hand|special summon)|(?:add|special summon)[^.]{0,60}?from your (?:gy|graveyard)/i,
    burn: /inflict [^.]{0,40}?damage to your opponent/i,
    ssSelfLock: /you cannot special summon[^.]{0,80}?except/i,
  };
  const ROLE_ORDER = ["starter", "extender", "handtrap", "interrupt", "breaker", "draw", "brick", "other"];
  const ROLE_NAME = { starter: "Starters", extender: "Extenders", handtrap: "Hand traps", interrupt: "Interrupts", breaker: "Board breakers", draw: "Draw / dig", brick: "Hard to use alone", other: "Other" };
  /** One role per card (its main job), plus every tag that applies. */
  function rolesOf(c) {
    const t = String(c.desc || ""), tag = {};
    for (const k in RX) tag[k] = RX[k].test(t);
    const mon = c.kind === "monster", ext = !!c.ext;
    tag.handtrap = mon && !ext && tag.handtrap;
    // a Trap or Quick-Play that stops or removes something on the opponent's turn
    tag.interrupt = !mon && (c.kind === "trap" || /quick/i.test(c.sub || "")) && (tag.negate || tag.breakOne || tag.breakAll);
    // board breakers: Spells that remove or stop the opponent's cards, and monsters that clear a whole board
    tag.breaker = !tag.handtrap && !ext && ((c.kind === "spell" && tag.breakOne) || (mon && tag.breakAll));
    tag.starter = !ext && !tag.handtrap && (tag.search || tag.deckSS) && c.kind !== "trap";
    tag.extender = !ext && !tag.starter && !tag.handtrap && (tag.selfSS || tag.handSS);
    const high = mon && !ext && (c.level || 0) >= 5 && !tag.selfSS && !/ritual/i.test(c.sub || "") && !/special summon this card|cannot be normal summoned/i.test(t);
    const noRole = !tag.starter && !tag.extender && !tag.handtrap && !tag.interrupt && !tag.breaker && !tag.draw;
    tag.brick = !ext && (high || (noRole && (/ritual/i.test(c.sub || "") || (c.kind === "trap" && !tag.negate && !tag.breakOne))));
    let role = "other";
    for (const r of ["starter", "handtrap", "breaker", "interrupt", "extender", "draw", "brick"]) if (tag[r]) { role = r; break; }
    return { role, tag };
  }

  // ---------- the analysis ----------
  /**
   * main/extra: lists of cards (one entry per copy): { id, name, kind: monster|spell|trap, sub, ext, level, atk, def,
   * attr, race, desc, arch }. opts.atkPool: ATK values of every monster in the card database (for "strength").
   * opts.known: (name) => true when a card of that name exists (suggestions only name real cards).
   */
  function analyze(main, extra, opts = {}) {
    const N = main.length, uniq = new Map();
    for (const c of main) { const u = uniq.get(String(c.id)); if (u) u.n++; else uniq.set(String(c.id), { c, n: 1, ...rolesOf(c) }); }
    const cards = [...uniq.values()];
    const count = (f) => cards.reduce((a, x) => a + (f(x) ? x.n : 0), 0);
    const roles = {}; for (const r of ROLE_ORDER) roles[r] = count((x) => x.role === r);
    const tagN = (k) => count((x) => x.tag[k]);
    const S = roles.starter, E = roles.extender, H = roles.handtrap, I = roles.interrupt, B = roles.breaker, Br = roles.brick;
    const go = (n) => {
      // groups: starters, extenders, hand traps + interrupts, bricks, the rest
      const sizes = [S, E, H + I, Br, Math.max(0, N - S - E - H - I - Br)];
      return {
        n,
        starter: atLeast(N, S, n),
        strong: multi(sizes, n, (k) => k[0] >= 2 || (k[0] >= 1 && k[1] >= 1)),
        interact: atLeast(N, H + I, n),
        breaker: atLeast(N, B, n),
        answer: atLeast(N, H + I + B, n),
        brick: multi(sizes, n, (k) => k[0] === 0 && k[1] === 0),
        twoBricks: atLeast(N, Br, n, 2),
        fullCombo: multi(sizes, n, (k) => k[0] >= 1 && k[2] >= 1),
        starters: dist(N, S, n),
        mean: N ? (n * S) / N : 0,
        sd: N > 1 ? Math.sqrt(n * (S / N) * (1 - S / N) * ((N - n) / (N - 1))) : 0,
      };
    };
    const first = go(5), second = go(6);
    const at40 = N > 40 ? atLeast(40, Math.round((S * 40) / N), 5) : null;
    // the cards one by one: how often you see at least one copy in your opening hand
    const perCard = cards.map((x) => ({ id: x.c.id, name: x.c.name, n: x.n, role: x.role, first: atLeast(N, x.n, 5), second: atLeast(N, x.n, 6) }))
      .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
    // make-up
    const mons = main.filter((c) => c.kind === "monster");
    const by = (list, key) => { const o = {}; for (const c of list) { const k = key(c); if (k !== "" && k != null) o[k] = (o[k] || 0) + 1; } return o; };
    const levels = by(mons.filter((c) => !c.ext), (c) => c.level || 0);
    const atks = mons.filter((c) => c.atk >= 0).map((c) => c.atk).sort((a, b) => a - b);
    const med = (a) => (a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : 0);
    const atkMed = med(atks), atkMean = atks.length ? atks.reduce((a, b) => a + b, 0) / atks.length : 0;
    let strength = null;
    if (opts.atkPool && opts.atkPool.length && atks.length) {
      // where the deck's monsters sit among all monsters (median vs median, and the top of the deck vs everything)
      const pool = opts.atkPool, top = atks.slice(-3), topMean = top.reduce((a, b) => a + b, 0) / top.length;
      const pct = (v) => { let lo = 0, hi = pool.length; while (lo < hi) { const m = (lo + hi) >> 1; if (pool[m] < v) lo = m + 1; else hi = m; } return lo / pool.length; };
      strength = { median: pct(atkMed), top: pct(topMean), topMean };
    }
    const exMake = by(extra, (c) => c.ext || "");
    const kinds = { monster: mons.length, spell: main.filter((c) => c.kind === "spell").length, trap: main.filter((c) => c.kind === "trap").length };
    const archs = Object.entries(by(main, (c) => c.arch || "")).sort((a, b) => b[1] - a[1]);
    const attrs = Object.entries(by(mons, (c) => c.attr || "")).sort((a, b) => b[1] - a[1]);
    const races = Object.entries(by(mons, (c) => c.race || "")).sort((a, b) => b[1] - a[1]);
    // exposure to common answers: how much of the deck each one stops
    const starterCards = cards.filter((x) => x.role === "starter");
    const sOnDeck = starterCards.filter((x) => x.tag.deckUse).reduce((a, x) => a + x.n, 0);
    const ex = {
      deck: S ? sOnDeck / S : 0,                      // Ash Blossom, Droll & Lock Bird
      gy: N ? tagN("gyUse") / N : 0,                  // D.D. Crow, Ghost Belle, Dimension Shifter
      monsterFx: N ? count((x) => x.c.kind === "monster" && !x.tag.handtrap && /you can|\(quick effect\)/i.test(x.c.desc || "")) / N : 0, // Effect Veiler, Infinite Impermanence
      summons: N ? count((x) => x.tag.selfSS || x.tag.handSS || x.tag.deckSS) / N : 0, // Nibiru, Maxx "C"
      spells: N ? kinds.spell / N : 0,
    };
    // ---------- ratings: each one is a probability, so 80 means "8 hands in 10" ----------
    const pc = (v) => Math.round(v * 100);
    const band = (v, cuts, words) => { for (let i = 0; i < cuts.length; i++) if (v >= cuts[i]) return words[i]; return words[words.length - 1]; };
    const rating = [
      { k: "con", label: "Consistency", v: pc(first.starter), word: band(first.starter, [0.92, 0.84, 0.72, 0.6], ["Very consistent", "Consistent", "Average", "Shaky", "Inconsistent"]),
        why: `Chance to open at least 1 of your ${S} starters in 5 cards: ${(first.starter * 100).toFixed(1)}%` },
      { k: "pow", label: "Strong openings", v: pc(first.strong), word: band(first.strong, [0.7, 0.55, 0.4], ["High", "Good", "Fair", "Low"]),
        why: `2 starters, or a starter with an extender (${E} extenders), in 5 cards: ${(first.strong * 100).toFixed(1)}%` },
      { k: "int", label: "Interaction (going second)", v: pc(second.interact), word: band(second.interact, [0.85, 0.7, 0.5], ["High", "Good", "Fair", "Low"]),
        why: `At least 1 of ${H} hand traps / ${I} interrupts in 6 cards: ${(second.interact * 100).toFixed(1)}%` },
      { k: "brk", label: "Board breaking", v: pc(second.breaker), word: band(second.breaker, [0.6, 0.4, 0.2], ["High", "Good", "Fair", "Low"]),
        why: `At least 1 of ${B} board breakers in 6 cards: ${(second.breaker * 100).toFixed(1)}%` },
      { k: "safe", label: "Brick safety", v: pc(1 - first.brick), word: band(1 - first.brick, [0.92, 0.84, 0.72], ["Safe", "Mostly safe", "Risky", "Brick-prone"]),
        why: `Chance a 5-card hand has no starter and no extender: ${(first.brick * 100).toFixed(1)}%` },
    ];
    if (strength) rating.push({ k: "atk", label: "Monster strength", v: pc(strength.top), word: band(strength.top, [0.9, 0.7, 0.45], ["Very high", "High", "Average", "Low"]),
      why: `Your 3 strongest main-deck monsters average ${Math.round(strength.topMean)} ATK: higher than ${pc(strength.top)}% of all monsters` });
    // ---------- weaknesses, things to improve, suggestions ----------
    const weak = [], improve = [], suggest = [];
    const has = (name) => main.some((c) => c.name === name) || extra.some((c) => c.name === name);
    const known = (name) => (opts.known ? opts.known(name) : true);
    if (S && ex.deck >= 0.6) weak.push({ k: "ash", t: `Ash Blossom & Joyous Spring and Droll & Lock Bird`, d: `${pc(ex.deck)}% of your starters use the Deck. Play more than one starter per hand when you can, or a way through (Called by the Grave, Crossout Designator).` });
    if (ex.gy >= 0.3) weak.push({ k: "gy", t: "GY hate (D.D. Crow, Ghost Belle & Haunted Mansion, Dimension Shifter)", d: `${pc(ex.gy)}% of the deck has effects that use the GY.` });
    if (ex.summons >= 0.35) weak.push({ k: "ss", t: `Maxx "C" and Nibiru, the Primal Being`, d: `${pc(ex.summons)}% of the deck Special Summons; long combos give them value.` });
    if (ex.monsterFx >= 0.45) weak.push({ k: "veil", t: "Effect Veiler and Infinite Impermanence", d: `${pc(ex.monsterFx)}% of the deck are monsters that need their effects.` });
    if (second.interact < 0.6) weak.push({ k: "slow", t: "Going second", d: `Only ${pc(second.interact)}% of 6-card hands hold a hand trap or interrupt.` });
    if (kinds.trap / Math.max(1, N) > 0.3) weak.push({ k: "trap", t: "Slow starts", d: `${kinds.trap} Traps (${pc(kinds.trap / N)}% of the deck) can't be used the turn you draw them.` });
    if (Br >= 4) weak.push({ k: "brick", t: "Bricks", d: `${Br} cards are hard to use alone; ${(first.twoBricks * 100).toFixed(1)}% of hands open 2 or more of them.` });
    if (N > 40) improve.push({ t: `Go down to 40 cards`, d: `At 40 cards (same share of starters) you open one ${pc(at40)}% of the time instead of ${pc(first.starter)}%.` });
    for (const [target, label] of [[0.85, "85%"], [0.9, "90%"]]) {
      if (first.starter < target) { const need = needFor(N, 5, target, S); if (need != null) { improve.push({ t: `Starters: ${S} → ${need}`, d: `${need - S} more starter${need - S === 1 ? "" : "s"} raise your chance to open one to ${label} or more.` }); break; } }
    }
    if (H + I < 9) { const need = needFor(N, 6, 0.85, H + I); if (need != null && need > H + I) improve.push({ t: `Hand traps / interrupts: ${H + I} → ${need}`, d: `For 85% of 6-card hands to hold one.` }); }
    if (extra.length < 15) improve.push({ t: `Extra Deck: ${extra.length}/15`, d: `${15 - extra.length} free slot${15 - extra.length === 1 ? "" : "s"} for more options or answers.` });
    const pick = (names, n) => names.filter((x) => !has(x) && known(x)).slice(0, n);
    if (H + I < 9) for (const x of pick(["Ash Blossom & Joyous Spring", 'Maxx "C"', "Infinite Impermanence", "Effect Veiler", "Ghost Belle & Haunted Mansion", "Nibiru, the Primal Being", "Droll & Lock Bird", "Ghost Ogre & Snow Rabbit"], 4)) suggest.push({ t: x, d: "Hand trap: interaction on the opponent's turn, from your hand." });
    if (second.breaker < 0.4) for (const x of pick(["Forbidden Droplet", "Triple Tactics Talent", "Evenly Matched", "Dark Ruler No More", "Harpie's Feather Duster", "Lightning Storm", "Kaiju Slumber"], 3)) suggest.push({ t: x, d: "Board breaker for going second." });
    if (S && ex.deck >= 0.6) for (const x of pick(["Called by the Grave", "Crossout Designator"], 1)) suggest.push({ t: x, d: "Gets your starter through a hand trap." });
    if (first.starter < 0.84 && tagN("draw") < 3) for (const x of pick(["Pot of Prosperity", "Pot of Extravagance", "Pot of Desires", "Upstart Goblin"], 1)) suggest.push({ t: x, d: "Digs for your starters." });
    return {
      N, extraN: extra.length, roles, ROLE_ORDER, ROLE_NAME, cards: cards.map((x) => ({ id: x.c.id, name: x.c.name, n: x.n, role: x.role, tag: x.tag })),
      first, second, at40, perCard, kinds, levels, atks, atkMed, atkMean, strength, exMake, archs, attrs, races, exposure: ex,
      rating, weak, improve, suggest,
      // real-time "what if": the chance with a different number of starters or a different deck size
      whatIf: (starters, size, hand = 5) => atLeast(size, Math.min(size, starters), hand),
      seeBy: (copies, turns, goingFirst = true) => Array.from({ length: turns }, (_, t) => atLeast(N, copies, Math.min(N, (goingFirst ? 5 : 6) + t))),
    };
  }

  // ---------- turning card data into the shape analyze() reads ----------
  /** KodeX card objects (type and race as text). */
  function fromKodex(c) {
    const t = String(c.type || ""), r = String(c.race || "");
    const kind = /spell/i.test(t) ? "spell" : /trap/i.test(t) ? "trap" : "monster";
    const ext = /link/i.test(t) ? "Link" : /xyz/i.test(t) ? "Xyz" : /synchro/i.test(t) ? "Synchro" : /fusion/i.test(t) ? "Fusion" : "";
    return { id: String(c.id), name: c.name || "", kind, sub: kind === "monster" ? (/ritual/i.test(t) ? "Ritual" : /normal/i.test(t) ? "Normal" : "") : r, ext,
      level: Number(c.lv || c.rk || c.lk || c.level || 0) || 0, atk: c.atk == null ? -1 : Number(c.atk), def: c.def == null ? -1 : Number(c.def),
      attr: c.attr || c.attribute || "", race: kind === "monster" ? r : "", desc: c.desc || "", arch: c.arch || c.archetype || "" };
  }
  /** Arena engine records (type, attribute and race as bit flags). */
  function fromEngine(c, K) {
    const T = K.TYPE, ty = c.type || 0;
    const kind = ty & T.SPELL ? "spell" : ty & T.TRAP ? "trap" : "monster";
    const ext = ty & T.LINK ? "Link" : ty & T.XYZ ? "Xyz" : ty & T.SYNCHRO ? "Synchro" : ty & T.FUSION ? "Fusion" : "";
    const sub = kind === "monster" ? (ty & T.RITUAL ? "Ritual" : ty & T.NORMAL ? "Normal" : "")
      : ty & T.QUICKPLAY ? "Quick-Play" : ty & T.CONTINUOUS ? "Continuous" : ty & T.FIELD ? "Field" : ty & T.EQUIP ? "Equip" : ty & T.COUNTER ? "Counter" : ty & T.RITUAL ? "Ritual" : "Normal";
    const attr = (K.ATTRIBUTES.find((a) => a[0] === c.attribute) || [0, ""])[1];
    let race = ""; for (let i = 0; i < K.RACES.length; i++) if ((c.race || 0) & (2 ** i)) { race = K.RACES[i]; break; }
    return { id: String(c.code), name: c.name || "", kind, sub, ext, level: (c.level || 0) & 0xff, atk: c.atk == null ? -1 : c.atk, def: c.def == null ? -1 : c.def,
      attr: attr ? attr[0] + attr.slice(1).toLowerCase() : "", race: kind === "monster" ? race : "", desc: c.desc || "", arch: "" };
  }

  return { analyze, fromKodex, fromEngine, atLeast, dist, multi, needFor, rolesOf, ROLE_ORDER, ROLE_NAME };
})();
export default DeckStats;
