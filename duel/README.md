# Project: Duel Synapse

An EDOPro-compatible duel simulator for the browser, served at `https://kodex.meiocg.org/duel/`.
It runs the real EDOPro rules engine, so every card effect resolves exactly as it does in EDOPro.

- **Solo playtest:** play against **Synapse AI**, an opponent that plays to win (it develops its board, attacks when the numbers work, sets walls when it's behind, saves traps and hand traps for your turn and answers your plays), against a dummy that never responds (goldfish testing), against a bot that plays random legal moves, or control both players. You can choose your opening hand, and Synapse AI can play any of your saved decks instead of a copy of yours.
- **Online duel:** open a room and send the invite link. Spectators can watch through a separate link. Chat, rematch (the loser goes first) and surrender are included.
- **KodeX integration:** decks from the KodeX app open straight into the Arena (see below). Each card in the duel links to its KodeX rulings page.
- **Deck formats:** KodeX deck links, EDOPro `.ydk` files and `ydke://` links.

## How it works

```
 browser (host or solo)                         Cloudflare Worker (server/worker.js)
 ┌──────────────────────────────┐               ┌──────────────────────────────────┐
 │ app.js  UI ─ postMessage ─┐  │   WebSocket   │ /api/duel/room/<CODE>            │
 │                           ▼  │ ◄───────────► │   DuelRoom Durable Object        │
 │ host-worker.js (Web Worker)  │               │   (relay only: host/guest/spec)  │
 │   engine/host.js  DuelHost   │               │ /duel/*        static files       │
 │   engine/core.js  ── ocgcore.wasm            │ /duel/scripts/<commit>/<file>     │
 └──────────────────────────────┘               │   → ProjectIgnis/CardScripts     │
 browser (guest / spectator): app.js only        └──────────────────────────────────┘
```

- `engine/ocgcore.wasm` is [edo9300/ygopro-core](https://github.com/edo9300/ygopro-core) 11.0 (the EDOPro core) compiled with wasi-sdk.
  `engine/build/kx_shim.cpp` exposes a flat C API and routes the card/script/log callbacks to JavaScript.
- `engine/core.js` loads the module and parses every core message. It also encodes answers and reads card queries.
- `engine/host.js` drives a duel and builds a separate view for each player and for spectators. Hidden cards are masked, the same way EDOPro's server masks them.
  The guest and spectators never receive the host's hand, deck or face-down cards.
- `engine/learn.js` is how Synapse AI learns. Plays become tokens (summon, Special Summon, set, activate, chain + card code + effect index) and go into a play book of three kinds of counts: which play people make next after the last two plays in a turn (combo lines), how often each card is chosen when a card's effect offers it (preferences, not popularity), and what people answer an opponent's card or attack with. It also links cards to the cards their text names in quotes. Whole turns of three or more plays are also kept as **combo lines** (`lines`): when its hand allows, Synapse AI replays the remembered line step by step (skipping at most two plays it can't make), and lines that left a better board are reinforced (×1.5) while lines that didn't are weakened, so the combos you practise most are the ones it learns first (`tests/duel/ai-combo.mjs`). `engine/trainer.js` runs practice games: it replays a duel to the start of a turn (the engine is deterministic for a fixed deck order and seed), tries other lines from that exact position, and keeps a line only if it leaves a clearly better position after the opponent has answered.
- `learning.js` (page side) keeps each device's book in local storage, merges the shared book from `/api/duel/book` for the decks in a duel, sends new lines back anonymously in batches (players can turn this off in the lobby), and runs practice games for a newly loaded deck once a week in a background worker (devices with 4+ cores). The engine worker records people's plays (the solo player, or both players in an online room) and hands them to the page at the end of each turn.
- `engine/smart.js` is Synapse AI. It sees exactly what a player in its seat would see (its own hand and field, public cards, life points, the chain) and decides with board-evaluation heuristics; anything it can't judge falls back to safe defaults. `engine/bot.js` contains the dummy and the random bot and routes the "smart" mode to Synapse AI. `engine/rules.js` holds the shared rule helpers: card declaration filters, zone masks and sum checks.
- `data/` holds `cards.json` (card data from Project Ignis BabelCDB) and `strings.json` (EDOPro's system strings). It also holds `scripts.json`, which records which card scripts exist, where they live and what they depend on.
  Before a duel the host downloads only the scripts its two decks need, from the CardScripts commit pinned in `scripts.json`.
- The duel runs in the **host's** browser and the Durable Object only relays messages. This works like EDOPro's LAN hosting and keeps server cost near zero.
  The trade-off is that the host's browser holds both decks, which is fine for playtesting and friendly matches.
  `DuelHost` doesn't depend on the browser, so it can later run inside the Durable Object for fully server-authoritative ranked play.

## Replays for EDOPro

`DuelHost` records the seed, duel options, both decks in the order they were given to the engine, and every answer. `replayFile()` writes them as an EDOPro `.yrp` (YRP1 with the extended header, uncompressed), the same data EDOPro's own server writes to `_LastReplay.yrp`; EDOPro re-runs it with its engine (Replay menu). `tests/duel/replay-roundtrip.mjs` reads files the way EDOPro does and re-runs them on a fresh engine. Saving is offered in KodeX Premium (the app sends `premium:true`); a guest asks the host for the file (`replayreq` → `replay`).

## Table layout

Chat and log live in a bubble at the bottom right; chat is the first tab (with an unread badge, a vibration and, inside the app, a notification when the app is in the background). Chain links are shown big as they are activated (tap for details), resolving and negated links are marked in the chain stack, and revealed cards open a window. Zones have solid outlines and labels on a dark backing, so they stay readable over any field skin.

On landscape screens up to 620 px tall the table is laid out like Master Duel: the field is centred and tilted, the duelists sit in the corners, the opponent's hand is at the top, yours at the bottom, and the phases run down the right edge. On phones held upright the zones become card-shaped and grow to use the screen's height.

## Sound and effects

`audio.js` makes every sound with Web Audio (synthesised, no recordings), so nothing is borrowed from EDOPro or other games: draw, set, summon, Special Summon, boss entrance, activation, chain links (rising pitch), attack, damage, destroy, phase, turn, win, lose and one-turn kill, plus an original looping duel theme. Music and Sounds switches are in the chat panel (saved per device). Audio starts after the first tap, as browsers require.

Summons make the zone glow. A boss (3000+ ATK, Level/Rank 8+, Link 4+) gets a full-width entrance with its art and a screen shake; 2000+ damage shakes the table; winning in one turn from full LP shows ONE TURN KILL. Reduced-motion settings turn the motion off.

KodeX Premium can send its own music and sounds (`{kx:"audio", premium:true, music, sfx:{summon, activate, damage, win}}`, ArrayBuffers) and a list of **signature cards** (`signature:[codes]` in the `skin` message); signature cards get the biggest entrance when summoned or activated.

## Skins

KodeX Premium sends the player's skins to the Arena with `postMessage({kx:"skin", sleeve, main, extra, field:{img, zoom, x, y, dim}})`. In a room each player sends theirs as `{t:"skin", part, v}` messages (one per picture, then `{part:"done", have:[...]}`); the host passes the guest's skins on to spectators (`of:"guest"`) and tells spectators its seat (`{t:"seat"}`, also in `start`). Your skins are drawn on your side (bottom), your opponent's on theirs: sleeves on face-down cards, the field on that half of the mat (`.mat-skin.me` / `.mat-skin.op`, the opponent's turned around), pictures on the Deck and Extra Deck zones. Only `data:image` pictures are accepted.

## KodeX app integration

The Arena reads the same deck payload as `deck.html`: base64url of `{"n": name, "m": [[id, name, count]], "e": [...], "s": [...]}`.

- Open `https://kodex.meiocg.org/duel/#deck=<payload>` from the KodeX app's deck builder to start a playtest with that deck. `deck.html` now shows a **Playtest** button that does this.
- `#join=<CODE>` opens the join screen. `#watch=<CODE>` opens the room as a spectator.
- Card ids are YGOPRODeck passcodes. Cards the engine knows by a different id, such as pre-release cards, are matched by name. Cards it can't find are listed in the lobby.

## Offline play

**Inside the KodeX app** (`scripts/build_app_bundle.py`), the Arena's files ship with the app and every card script is packed into `data/scripts.pack.bin` (gzip, unpacked once by the engine worker on the first script a duel needs) with its index `data/scripts.pack.json`; `data/bundled.json` marks the bundle. `site.js` sends rooms, the play book and card art to kodex.meiocg.org when the Arena isn't served from it.


`sw.js` (scope `/duel/`) keeps the engine, card data, UI files, card scripts and card art on the device, so solo playtests against Synapse AI, the dummy and the random bot work without a connection. Online rooms always need the network.
`offline.js` registers it and adds the **Offline play** panel to the lobby: **Save decks for offline** stores the scripts and art for every deck saved in the Arena.
Scripts are pinned to a commit and never change. Bump `VERSION` in `sw.js` when the engine or data files change.

From the KodeX app, `https://kodex.meiocg.org/duel/?app=1` opens the Arena (the `KodeX` links then return to the app) and `#prepare=<payload>` (`{"d":[<deck payload>, ...]}`, base64url) stores all of the app's decks and saves them for offline play.

## Deploying

1. Merge to `main`. The Worker gains:
   - the `DuelRoom` Durable Object (binding `DUEL_ROOMS`, SQLite-backed, migration `duel-rooms-v1`)
   - `/api/duel/room/<CODE>`, which is already covered by the existing `kodex.meiocg.org/api/*` route.
2. Check `https://kodex.meiocg.org/duel/` and open a room from two devices.

Static files are read from this private repository by the Worker, the same way `deck.html` is. Nothing is fetched from GitHub by visitors.

## Updating cards and scripts

```bash
git clone --depth 1 https://github.com/ProjectIgnis/BabelCDB
git clone --depth 1 https://github.com/ProjectIgnis/CardScripts
git clone --depth 1 --filter=blob:none --sparse https://github.com/ProjectIgnis/Distribution && (cd Distribution && git sparse-checkout set config)
python scripts/build_duel_data.py --babel BabelCDB --scripts CardScripts --strings Distribution/config/strings.conf
```

This rewrites `duel/data/*.json` and pins the new CardScripts commit. If the scripts start needing a newer core, rebuild the engine as shown below. The **Duel data weekly update** workflow does this every Monday, runs the soak, AI and replay tests, and commits if they pass, so replays saved for EDOPro use the scripts EDOPro has.

## Rebuilding the engine

```bash
# wasi-sdk 30 from https://github.com/WebAssembly/wasi-sdk/releases
git clone --depth 1 https://github.com/edo9300/ygopro-core && (cd ygopro-core && git submodule update --init --depth 1)
# C++ exception-enabled runtimes (needs a sparse llvm-project checkout at llvmorg-21.1.4)
WASI_SDK=... LLVM_SRC=... OUT=$PWD/eh duel/engine/build/build-runtimes.sh
WASI_SDK=... SYSROOT=$PWD/eh/sysroot EH_PREFIX=$PWD/eh CORE_DIR=$PWD/ygopro-core duel/engine/build/build.sh
```

## Testing locally

```bash
node scripts/duel-dev-server.mjs --scripts /path/to/CardScripts      # http://localhost:8787/duel/
node tests/duel/engine-sim.mjs /path/to/CardScripts 30 random 1        # headless bot-vs-bot soak test
node tests/duel/ai-match.mjs /path/to/CardScripts 20 smart random classic 0.9   # Synapse AI must beat the random bot
node tests/duel/ai-learn.mjs /path/to/CardScripts                               # Synapse AI learns a teacher's style and practice lines
TRACE=3 node tests/duel/ai-match.mjs /path/to/CardScripts 3 smart random classic # print every decision of duel 3
node tests/duel/ui-solo.mjs http://localhost:8787 .                    # browser smoke test (Playwright)
node tests/duel/ui-online.mjs http://localhost:8787 .                  # host + guest + spectator through the relay
node tests/duel/ui-fuzz.mjs http://localhost:8787 600 7 .              # random clicks through every prompt type
```

The dev server runs the real `server/duel-room.js` relay on a small built-in WebSocket server.

## Licences

The rules engine (`ygopro-core`) and the Project Ignis card scripts are **AGPL-3.0-or-later**. The Arena serves them to visitors over the network, so their source must be offered to those visitors.
`duel/source.html`, linked from the lobby footer, does this. It links the exact engine and script commits, and the Worker serves the bridge, the build scripts and every client file in full.
Keep the commit hashes on that page in step when the engine or the scripts are updated.
The message and response layouts in `engine/core.js` follow [n1xx1/ocgcore-wasm](https://github.com/n1xx1/ocgcore-wasm) (MIT).
Card data comes from Project Ignis. MEIOCG is not affiliated with or endorsed by Konami.
