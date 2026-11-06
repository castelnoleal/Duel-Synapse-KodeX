# Project: Duel Synapse

A Meta Insider OCG (MEIOCG) duel simulator for the browser and the KodeX app, served at `https://kodex.meiocg.org/duel/`.
It runs the ygopro-core rules engine with the Project Ignis card scripts. © 2023–2026 Meta Insider OCG; see [LICENSE.md](../LICENSE.md).

- **Solo playtest:** play against **Synapse AI**, an opponent that plays to win (it develops its board, attacks when the numbers work, sets walls when it's behind, saves traps and hand traps for your turn and answers your plays), against a dummy that never responds (goldfish testing), against a bot that plays random legal moves, or control both players. You can choose your opening hand, and Synapse AI can play any of your saved decks instead of a copy of yours.
- **Online duel:** open a room and send the invite link. Spectators can watch through a separate link. Chat, rematch (the loser goes first) and surrender are included.
- **KodeX integration:** decks from the KodeX app open straight into the Arena (see below). Each card in the duel links to its KodeX rulings page.
- **Deck formats:** KodeX deck links, `.ydk` files and `ydke://` links.

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

- `engine/ocgcore.wasm` is [edo9300/ygopro-core](https://github.com/edo9300/ygopro-core) 11.0 compiled with wasi-sdk.
  `engine/build/kx_shim.cpp` exposes a flat C API and routes the card/script/log callbacks to JavaScript.
- `engine/core.js` loads the module and parses every core message. It also encodes answers and reads card queries.
- `engine/host.js` drives a duel and builds a separate view for each player and for spectators. Hidden cards are masked, the same way a simulator server masks them.
  The guest and spectators never receive the host's hand, deck or face-down cards.
- `engine/learn.js` is how Synapse AI learns. Plays become tokens (summon, Special Summon, set, activate, chain + card code + effect index) and go into a play book of three kinds of counts: which play people make next after the last two plays in a turn (combo lines), how often each card is chosen when a card's effect offers it (preferences, not popularity), and what people answer an opponent's card or attack with. It also links cards to the cards their text names in quotes. Whole turns of three or more plays are also kept as **combo lines** (`lines`): when its hand allows, Synapse AI replays the remembered line step by step (skipping at most two plays it can't make), and lines that left a better board are reinforced (×1.5) while lines that didn't are weakened, so the combos you practise most are the ones it learns first (`tests/duel/ai-combo.mjs`). `engine/trainer.js` runs practice games: it replays a duel to the start of a turn (the engine is deterministic for a fixed deck order and seed), tries other lines from that exact position, and keeps a line only if it leaves a clearly better position after the opponent has answered.
- `learning.js` (page side) keeps each device's book in local storage, merges the shared book from `/api/duel/book` for the decks in a duel, sends new lines back anonymously in batches (players can turn this off in the lobby), and runs practice games for a newly loaded deck once a week in a background worker (devices with 4+ cores). The engine worker records people's plays (the solo player, or both players in an online room) and hands them to the page at the end of each turn.
- `engine/smart.js` is Synapse AI. It sees exactly what a player in its seat would see (its own hand and field, public cards, life points, the chain) and decides with board-evaluation heuristics; anything it can't judge falls back to safe defaults. It plays cards that carry a summon lock ("you cannot Special Summon … except …") first, while they are still legal, Normal Summons a starter monster (one that searches or summons when it arrives) before spending the summon on a beater, and, when nothing better is known for the first play of a turn, opens with the first play of the best-practised whole turn its cards can make, then follows it to the end. Lines learned offline are queued on the device (combo lines included) and sent as soon as it is back online, after which the shared book for the last decks is fetched again (`server/playbook.js` stores lines in a `line` table). `engine/bot.js` contains the dummy and the random bot and routes the "smart" mode to Synapse AI. `engine/rules.js` holds the shared rule helpers: card declaration filters, zone masks and sum checks.
- `data/` holds `cards.json` (card data from Project Ignis BabelCDB) and `strings.json` (Project Ignis system strings). It also holds `scripts.json`, which records which card scripts exist, where they live and what they depend on.
  Before a duel the host downloads only the scripts its two decks need, from the CardScripts commit pinned in `scripts.json`.
- The duel runs in the **host's** browser and the Durable Object only relays messages. This works like LAN hosting and keeps server cost near zero.
  The trade-off is that the host's browser holds both decks, which is fine for playtesting and friendly matches.
  `DuelHost` doesn't depend on the browser, so it can later run inside the Durable Object for fully server-authoritative ranked play.

## Replay files

`DuelHost` records the seed, duel options, both decks in the order they were given to the engine, and every answer. `replayFile()` writes them as a `.yrp` (YRP1 with the extended header, uncompressed), the same data the simulator's own server writes to `_LastReplay.yrp`; the simulator re-runs it with its engine (Replay menu). `tests/duel/replay-roundtrip.mjs` reads files the way the simulator does and re-runs them on a fresh engine. Saving is offered in KodeX Premium (the app sends `premium:true`); a guest asks the host for the file (`replayreq` → `replay`).

**Watching replay files** (everyone): *Watch a replay file* in the lobby opens a `.yrp` (from this Arena or a desktop client) or a `.yrpX` (desktop clients). `engine/replayfile.js` reads the header, un-packs LZMA bodies with its own decoder (the 5 property bytes sit in the header, as LzmaLib writes them), finds the classic replay inside a `.yrpX` (packet 231), and the worker re-runs it: `DuelHost` with `options.replay` uses the file's seed, duel options, deck order and rule cards, and the recorded answers are fed back with `respondRaw` at ½×, 1×, 2× or 4× (pause and step too). The replay is shown with every card face up (viewer 3). Only 1-vs-1 replays with a recorded seed (extended header) can be re-run; a replay recorded with different card scripts stops where it goes out of step. `tests/duel/replay-file.mjs` writes both kinds and checks that the re-run ends like the duel.

## Table layout

Chat and log live in a bubble at the bottom right; chat is the first tab (with an unread badge, a vibration and, inside the app, a notification when the app is in the background). Chain links are shown big as they are activated (tap for details), resolving and negated links are marked in the chain stack, and revealed cards open a window. Zones have solid outlines and labels on a dark backing, so they stay readable over any field skin.

In landscape the table is laid out like Master Duel (see below). On phones held upright the zones become card-shaped and grow to use the screen's height.

## Look

The Arena uses the MEIOCG website's look (`meiocg.css`, loaded after `arena.css`): night navy, electric-blue brand, foil-gold highlights, Chakra Petch headings over Plus Jakarta Sans, pill controls. The lobby keeps moving even before a duel: drifting colour blobs, a slowly panning duel-field grid, floating card backs, a ticker, and cards that deal in and lift with a foil sweep. During a duel the background calms down. The theme is the same in the browser and inside the KodeX app (it no longer takes the app's colour theme), and it only touches the Arena.

Every card in the lobby deck can be looked at: hovering with a mouse shows a preview; a click or tap opens the card with its official rulings (`rulings.js`, read from KodeX's rulings mirror at `/data/rulings/`, matched by card name). The card panel during a duel has the same rulings section. Offline inside the app, *Open in KodeX* shows the rulings the app has saved.

## Landscape layout and the log

In landscape on phones and small tablets (up to 700 px tall) the **lobby** fits one screen with no page scrolling: a slim title bar, Deck and Play side by side (each scrolls inside itself, the start button stays pinned), and the offline line under them.

In landscape (phones, tablets and computers) the table is laid out like **Master Duel**, sized from the screen so nothing needs scrolling: the field sits in the middle, big and tilted; your hand rises from the bottom edge over the field and lifts when you touch a card; the opponent's hand peeks from the top. Your Life Points are a plate in the bottom-left corner, the opponent's in the top-right (below the app's buttons inside KodeX). The phase is one round button on the right; when you can move on it offers **Battle**, **Main 2** or **End Turn** under it. Top-left: what to do now; under it a **log with card pictures** (newest first, chain links numbered with the effect used; tap one to read the card). Bottom-right: the ☰ panel button, emotes and chat. Card details slide in from the left when you tap a card, in a panel with tabs: **Card** (a smaller picture so the effect text fits, and its rulings), **Log** and **Options** (chain skipping, music, sounds, mute, field view, save log, surrender); ☰ opens it on the log. On big screens (1500 × 800 and up) that panel stays open on the left, like the computer version of Master Duel. Prompts open over the left side. On phones held upright, prompts are a single sideways row and the chat button moves into the prompt while one is open. Card stats sit inside the cards and zone labels hide under cards.

**Which effect:** when a card is activated, the chain card that pops up says which of its effects is being used (the card's own text for that effect, or "Effect 2"), the log and the picture log say it too, and a chain prompt lists the whole chain so far with each link's effect.

In portrait, if the table is taller than the screen (short phones), the zones shrink until it fits (`fitTable`). Many cards in hand (Maxx "C" turns) overlap instead of pushing the screen wider (`fitHands`), in both orientations.

**Field view** (Options): tilted, flat or a larger field, and the small opponent box; kept on the device. **Mute** (Options): the opponent (their chat, emotes and sounds), chat, emotes, card voices and emote sounds, or everything at once; kept on the device.

**Emotes**: everyone has 8 picture emotes and 5 sound emotes (original synthesised sounds in the style of well-known meme sounds: boom, air horn, sad trombone, ba-dum-tss, dun dun dunnn); KodeX Premium adds 9 more sounds, up to 8 pictures of their own (HD animated GIFs up to ~3.3 MB, each with an optional sound) and up to 8 sounds of their own (files or recordings). Custom ones travel to the room the first time they're used (`part:"em"`); anything over ~380 KB goes in pieces (`piece:{id,i,n,d}`) and is put back together, so large GIFs pass the room's 512 KB message limit. Emotes are shown without a frame. KodeX Premium shows chat messages floating by the player who sent them; a Premium player's messages float for everyone.

**Smooth in long duels:** card elements are reused while a card looks the same (no art reload, no flicker, no pile-up of discarded elements), the log keeps the last 250 lines, and :has() rules that re-ran on every change are replaced by classes. `tests/duel/perf-probe.mjs` plays a long duel and prints the browser's node and listener counts.

## Entrances and attacks

`moves.js`: every summon to a Monster Zone gets an entrance (bigger for bosses), and every attack first locks on to its target (a red reticle with TARGET or DIRECT ATTACK and a line from the attacker), then strikes. Everyone gets Rise and Lunge; KodeX Premium picks Portal, Storm, Inferno, Nova or Glitch and Beam, Comet, Claw or Phantom, as the default or per signature card (`entrance`, `attack`, `entFx`, `atkFx` in the `fx` skin part), and everyone in the duel sees them. `preview.html#entrance:portal` and `#attack:beam` play them on a demo field.

## Card moments: staples, the winning attack, Ace cards

`cardfx.js`, for everyone: about 60 of the most played hand traps and staples (Ash Blossom, Ghost Belle, Effect Veiler, Called by the Grave, Crossout Designator, Infinite Impermanence, Maxx "C", Droll & Lock Bird, Ghost Ogre, Nibiru, D.D. Crow, the Mulcharmy, Triple Tactics, Feather Duster, Raigeki, Evenly Matched, the Pots, the Kaiju, Solemns and more) get their own animation when activated, matched by card name so alt arts count. Before the blow that wins the duel a comic-style **showdown** plays: before an attack (direct, or into an Attack Position monster, for at least the defender's LP), or, for a Spell, Trap or effect, just before its damage shows (`effectFinale`). Menacing for everyone (3.3 s); KodeX Premium picks from 13 showdowns (Menacing, Rush, Time Stop, Freeze Frame, Domain Expansion, All-Out Attack, Impact Frame, Destiny Draw, Final Blow, Power Up, Energy Blast, Spotlight, Radiant) or **Random** (`finale`), sets the length from 3 to 5 seconds (`finaleMs`) and can give single cards their own (`showFx`). Random is picked from the card and the turn, so both players see the same one (`pickShow`). KodeX Premium **Ace cards** (`aces`, `aceStyle`, any card type) fill the screen with the same showdowns when summoned or activated. Choices made for a card count for all of its artworks (`cc`). Both hold the next updates until they've played (`hold()`), so the duel never runs ahead of the screen. **Card voices** (`voices`, a skin part): a Premium player's own sound or recording for chosen cards, played for everyone instead of the default activation or summon sound. `preview.html#finale:rush`, `#finale:domain:5000` (length in ms), `#finale:random`, `#ace:radiant` and `#staple:<card name>` play them on the demo field.

## Testing data

At the end of each duel the Arena records the result for the deck used (win, OTK, dead hand, turns, going first, cards used and drawn, the card that opened each of your turns, and which play followed which) in `duel:stats` and, inside KodeX, sends it to the app (`{kx:"stats"}`) for the Synapse Deck Analyzer.

## Damage and finishing moves

The field cracks and smoulders as a player's Life Points fall (75 %, 50 %, 25 %, 10 %). When a duel is won, the loser's own two rows break into shards (the middle row stays whole; a monster in an Extra Monster Zone is torn up whole) and their cards are torn in two (`finisher.js`), with FINISH! or ONE TURN KILL. KodeX Premium chooses the style (shatter, meteor, thunder, vortex, slash: `finisher` in the `skin` message) and can give each signature card its own (`sigFx`), which also plays when that card is summoned.

## Premium effects in online duels

A KodeX Premium player's finishing move, signature cards and their moves travel with their skins (`{t:"skin", part:"fx", v:{premium, finisher, signature, sigFx, entrance, attack, entFx, atkFx}}`), so every player and spectator sees them, free edition included; the player's name gets a PREMIUM tag, and free viewers see a short note naming the Premium move. `preview.html#style` plays a finishing move on a demo field (used by the KodeX app's previews).

## Card art and fonts

Card pictures are looked up once per card and remembered, at most four at a time, so redraws never reload or flicker and bursts don't trip the art host; a card whose art can't be found gets a designed stand-in. Alternate-art passcodes are played as the card they show (`CardDB.main`). Inside the KodeX app, pictures saved on the phone (the app's offline card database, `{kx:"pics", base, ids}`) are used first, so a duel needs no internet for art. The fonts ship in `assets/fonts/` (SIL OFL), so nothing outside the Arena is needed to draw the page. System texts with blanks (`%ls`, `%d`) are filled in with the card name and place.

## Sound and effects

`audio.js` makes every sound with Web Audio (synthesised, no recordings), so nothing is borrowed from other games: draw, set, summon, Special Summon, boss entrance, activation, chain links (rising pitch), attack, damage, destroy, phase, turn, win, lose and one-turn kill, plus an original looping duel theme. Music and Sounds switches are in the chat panel (saved per device). Audio starts after the first tap, as browsers require.

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

This rewrites `duel/data/*.json` and pins the new CardScripts commit. If the scripts start needing a newer core, rebuild the engine as shown below. The **Duel data weekly update** workflow does this every Monday, runs the soak, AI and replay tests, and commits if they pass, so replays saved for the simulator use the scripts the simulator has.

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
