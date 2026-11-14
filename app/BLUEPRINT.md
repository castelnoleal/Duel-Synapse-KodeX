# KodeX Blueprint

**Duel Synapse: KodeX** — created by **Castel Noleal**, creator of **MEIOCG (Meta Insider OCG)**.
A project of Meta Insider OCG since 2023. © 2023–2026 Meta Insider OCG. All rights reserved.
Contact: metainsiderocg@gmail.com · instapped@gmail.com

This is the map of how KodeX is built, so any part can be found and changed on its own.

---

## 1. What KodeX is

| Part | What it does | Where |
|---|---|---|
| **KodeX app** | Card search, rulings, decks, scanner, profile, Premium features. One HTML page. | `app/src/` → `app/Kodex_Mei_*_vNN.html` |
| **Duel Synapse Arena** | The duel engine and table (solo, online rooms, replays). Opened inside KodeX. | `duel/` |
| **Server** | `kodex.meiocg.org`: card data, images, Arena files, online rooms, MEIOCG Players. A Cloudflare Worker. | `server/` |
| **Android app** | The KodeX page in instApped (WebView). Bundles the Arena so duels need no download. | `scripts/build_app_bundle.py` → ZIP for instApped |
| **meiocg.org pages** | Deck pages, guides, Cup, Players, Why KodeX. DashNex pages (head + body code each). | `meiocg-site/` |
| **Players page** | kodex.meiocg.org/players: leaderboard and public profiles. | `scripts/players_page.template.html` → `players.html` |
| **KodeX Editor** | One tool for sponsor banners (free) and skins (Premium) on top of any KodeX build. | `scripts/editor.template.html` → `KodeX_Editor.html` |

## 2. Editions

There is **one source** and **two editions**:

- **Free** (`Kodex_Mei_Production_vNN.html`): `<meta name="kodex-edition" content="free">`, sponsor strip on top.
- **Premium** (`Kodex_Mei_Premium_vNN.html`): the free page plus the changes in `app/src/editions.json` (edition meta,
  title, no-ads style, skin packs slot).
- In code, `PREMIUM` is true in the Premium edition **or** during a 5-day trial (`KX_TRIAL`, module
  `premium-pitch-and-trial`). Everything Premium checks `PREMIUM`.

Rules that always hold: the free edition keeps its ad; Premium has none. No other simulator is named anywhere a player
can see. Reverse engineering is not allowed.

## 3. Source files (`app/src/`)

Files are joined in the order of `manifest.json`. Each `.css`/`.js` file is the inside of one `<style>`/`<script>`;
the main script (`core-…`) is cut at its section comments. Later modules may replace a function from an earlier one
(a later `function x(){}` wins); a top-level `const`/`let` must never be declared twice.

| Files | Module |
|---|---|
| `0010-head.html` | `<head>`: meta (edition, build, author), licence comment |
| `0020-base-styles.css` | All base styles: layout, theme variables, lists, sheets, settings |
| `0030-app-markup.html` | The page: header, search, card list, nav, layers (Decks, Settings, Arena) |
| `0040-kx-v55-js.js` | Premium entrances, attacks, emotes (8.8) |
| `0060-kx-v56-js.js` | Winning-attack finale, Ace cards (8.9) |
| `0080-core-00-setup.js` … `0280-core-20-start.js` | **Core**, one file per section: setup & data, search & filters, layers & Back button, card page & rulings, translation, settings, icons/dialogs/toast, deck data, deck form, deck screens, favourites, exports, official deck list, deck links & legality, deck events, offline rulings, wallpaper & diagnostics, art cache, self-check, start |
| `0300-scanner.css`, `0320-…`, `0340-…`, `0360-scanner-camera-ocr.js` | Card scanner (text, artwork, camera) |
| `0380`–`0400` | Deck image (poster) |
| `0420`–`0440` | 8.9 late module (replaces earlier functions) |
| `0460`–`0480` | 9.0: Premium Studio |
| `0500`–`0520` | 9.2: player profile, help bubble, legality tags, deck banner, Arena integration |
| `0540`–`0560` | 9.3: Premium pitch and 5-day trial, blueprint constant |
| `0580`–`0600` | 9.4: square deck image (three designs, editable preset, date, MEIOCG profile), saving Arena video clips |
| `0620`–`0640` | 9.5: Test hub (Combo + Synapse Arena), combo generator (`cb*` functions, stored under `combos`), combo image, More from MEIOCG apps (`KX_APPS`), Arena vibration |
| `0660`–`0680` | 9.6: performance overrides (no blur-behind, transform/opacity-only animations), combo hand-off to the Arena with a cover (`cbCover`, `cbSend`) |
| `0700`–`0720` | 9.7: button-shape fixes, Arena closes to the Test tab, combo plays read from card text (`cbxPlays`, `cbxOpen`, `cbNextStep`, `cbFirstStep`, `cbxPick`) |
| `0740`–`0760` | 9.8: no zoom in the app (`kxInApp`), Arena only in the app (`kxGetApp`, `KX_STORE`), combo code in images (`cbqPack`, `cbqBand`, `cbqRead`), image import (`cbImportImage`), replay combos from the Arena (`comboNew`) |

To add a feature: add a new numbered pair (for example `0780-kx-v66.css`, `0800-kx-v66-late.js`) to `manifest.json`, or edit
the module that owns it. The constant `KODEX_BLUEPRINT` in the last module names the creator in the running app.

## 4. Build and release

```
python3 scripts/build_kodex.py build            # app/src → both editions (version and build from manifest.json)
python3 scripts/build_kodex.py build --check    # confirm app/ matches app/src
python3 scripts/build_app_bundle.py app/Kodex_Mei_Premium_vNN.html out.zip --cardscripts <scripts dir>   # ZIP for instApped
python3 scripts/build_players_page.py           # players.html
python3 scripts/build_editor.py                 # KodeX_Editor.html with the newest free and Premium pages inside
cd meiocg-site && python3 build.py              # DashNex pages
```
Bump `version` and `build` in `manifest.json` for each release (Play Store needs a higher versionName every time).
Merge to `main` when tests pass; the Worker deploys from `main`.

## 5. KodeX ↔ Arena messages (`postMessage`)

| From KodeX | Meaning |
|---|---|
| `{kx:"skin", …}` | Premium look: sleeves, field, finisher, entrances, showdowns, Ace cards, emotes, voices |
| `{kx:"profile", p}` | The player's profile (both editions) |
| `{kx:"decks", decks}` | KodeX decks by passcode |
| `{kx:"banlist", map}` | OCG Forbidden & Limited (passcode → 0/1/2) |
| `{kx:"pics", base, ids}` | Card pictures saved on the phone |
| `{kx:"audio", …}` | Music and sounds |

| From the Arena | Meaning |
|---|---|
| `ready` | Arena loaded: KodeX sends the above |
| `stats` | A duel ended: result, turns, cards used (feeds deck stats and profile activity) |
| `card`, `rulings`, `chat`, `duel`, `save` | Open a card, look up rulings, chat, duel state, save a replay |
| `saveVideo` (`name`, `mime`, `buf`) | Save a replay video clip (Premium; mp4 or webm, up to 400 MB) |
| `vibrate` (`p`) | Vibrate the phone (showdowns, Ace cards, big hits) |

KodeX → Arena also sends `combo` (`combo`, `keep`): play a combo as a replay and keep it in the Replays list, and `practice` (`hand`): set the playtest's opening hand.

## 6. Arena (`duel/`)

`app.js` (table, prompts, effects), `cardfx.js` (staple animations, showdowns), `finisher.js` (finishing moves),
`ending.js` (profile break, comeback), `video.js` (replay video clips drawn on a canvas: 1080p–4K, landscape, portrait or square; a combo's title card), `combo.js` (a KodeX combo turned into table states, played like a replay), `moves.js` (entrances, attacks), `profile.js` + `profile.css` (profiles, shared
with KodeX and the Players page), `audio.js`, `net.js` (rooms), `host-worker.js` + `engine/` (duel engine; replays play, seek by move or turn, and are kept in IndexedDB `arena-replays`).
The engine uses ygopro-core and Project Ignis card scripts under the GNU AGPL-3.0 (`duel/source.html`).

## 7. Stored data (on the phone)

| Key | What |
|---|---|
| `pf`, `kx_pf_img` | Profile (Premium picture separately) |
| `pf_act`, `pf_rank`, `pf_pid` | Activity counts, Players rank and public id |
| `kx_trial` (+ IndexedDB `kx_trial_bk`) | Premium trial start |
| `duel:pref`, `duel:pt`, `duel:mute` | Arena: reveal time and staple animations, playtest settings, mutes |

## 8. Server (`server/`)

`/api/players` (list), `/api/players/p/<pid>` (one profile), `/api/players/ping`, `/api/players/leave`
(`players.js`, Durable Object `PLAYERS`); `/players` (page); `/api/duel/room/<code>` (online rooms, `DUEL_ROOMS`);
`/api/duel/book` (`PLAYBOOK`); `/duel/*` (Arena files). Config: `wrangler.json` (root, used by the deploy).

## 9. Tests

App suite (`run_all.py`, one file per feature, both editions), Arena UI tests in `tests/duel/` (`ui-*.mjs`),
server tests in `tests/server/`.

---
*KodeX — created by Castel Noleal, creator of MEIOCG.*
