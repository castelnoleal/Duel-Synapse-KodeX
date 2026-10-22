# Duel Synapse Arena

An EDOPro-compatible duel simulator for the browser, served at `https://kodex.meiocg.org/duel/`.
It runs the real EDOPro rules engine, so every card effect resolves exactly as it does in EDOPro.

- **Solo playtest:** play against a dummy that never responds (goldfish testing), against a bot that plays random legal moves, or control both players. You can choose your opening hand.
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
- `engine/bot.js` contains the dummy and the random bot. `engine/rules.js` holds the shared rule helpers: card declaration filters, zone masks and sum checks.
- `data/` holds `cards.json` (card data from Project Ignis BabelCDB) and `strings.json` (EDOPro's system strings). It also holds `scripts.json`, which records which card scripts exist, where they live and what they depend on.
  Before a duel the host downloads only the scripts its two decks need, from the CardScripts commit pinned in `scripts.json`.
- The duel runs in the **host's** browser and the Durable Object only relays messages. This works like EDOPro's LAN hosting and keeps server cost near zero.
  The trade-off is that the host's browser holds both decks, which is fine for playtesting and friendly matches.
  `DuelHost` doesn't depend on the browser, so it can later run inside the Durable Object for fully server-authoritative ranked play.

## KodeX app integration

The Arena reads the same deck payload as `deck.html`: base64url of `{"n": name, "m": [[id, name, count]], "e": [...], "s": [...]}`.

- Open `https://kodex.meiocg.org/duel/#deck=<payload>` from the KodeX app's deck builder to start a playtest with that deck. `deck.html` now shows a **Playtest** button that does this.
- `#join=<CODE>` opens the join screen. `#watch=<CODE>` opens the room as a spectator.
- Card ids are YGOPRODeck passcodes. Cards the engine knows by a different id, such as pre-release cards, are matched by name. Cards it can't find are listed in the lobby.

## Deploying

1. Merge to `main`. The Worker gains:
   - the `DuelRoom` Durable Object (binding `DUEL_ROOMS`, SQLite-backed, migration `duel-rooms-v1`)
   - the routes `kodex.meiocg.org/duel` and `kodex.meiocg.org/duel/*`
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

This rewrites `duel/data/*.json` and pins the new CardScripts commit. If the scripts start needing a newer core, rebuild the engine as shown below.

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
node tests/duel/ui-solo.mjs http://localhost:8787 .                    # browser smoke test (Playwright)
node tests/duel/ui-online.mjs http://localhost:8787 .                  # host + guest + spectator through the relay
node tests/duel/ui-fuzz.mjs http://localhost:8787 600 7 .              # random clicks through every prompt type
```

The dev server runs the real `server/duel-room.js` relay on a small built-in WebSocket server.

## Licences

The rules engine (`ygopro-core`) and the Project Ignis card scripts are **AGPL-3.0-or-later**. The Arena serves them to visitors over the network, so the source of this duel client must be available to its users.
That covers the WebAssembly build files in `engine/build/` and the JavaScript in this folder. The lobby footer links to it.
If this repository stays private, publish the `duel/` folder in a public repository and point that link at it.
The message and response layouts in `engine/core.js` follow [n1xx1/ocgcore-wasm](https://github.com/n1xx1/ocgcore-wasm) (MIT).
Card data comes from Project Ignis. MEIOCG is not affiliated with or endorsed by Konami.
