# meiocg.org deck pages, guides, MEIOCG Cup, Players and Why KodeX

DashNex pages for meiocg.org: the OCG meta deck hub (current lists and an archive tab), one page per meta deck (date-stamped list), a guide per meta deck (lessons 1–3 free, 4–6 listed as KodeX Premium), the guides hub, the MEIOCG Cup, MEIOCG Players, Why KodeX and the Duel Synapse landing page (meiocg.org/duelsynapse: features, KodeX Premium shown in action with real card art, Free vs Premium, the 5-day trial).

- `content.py`: all page text. Card names in `[[double brackets]]` link to KodeX and are checked against `data/cards.min.json` on every build.
- `decks_raw.py`: the decklists (passcodes and counts).
- `src/mdk.css`, `src/mdk.js`: the page design and script (meiocg.org theme tokens, live Yuyu-tei prices from the MEIOCG Price Guide, OCG legality badge, Arena playtest link, ydke/.ydk/text export).
- `data/jpnames.json`: Japanese card names (from the KodeX rulings mirror), used to match Yuyu-tei prices.
- `python3 build.py` writes `out/<page>/head.html`, `body.html` and `seo.txt`.

## Put a page on DashNex

For each folder in `out/`: create the page at the URL in `seo.txt`, paste `head.html` into Head Code and `body.html` into Body Code, and copy Title and Description from `seo.txt`.

Social images are served by the KodeX Worker at `https://kodex.meiocg.org/og/<name>.png` from `assets/og/`.

## Keeping it current

- **New OCG list**: set `archived=True` on the old deck entries in `content.py`, add them to `ARCHIVE`, update `LIST_TAG` and `BANLIST`. Their pages stay up with an "Archived list" banner and appear under the hub's Archive tab.
- **MEIOCG Cup**: put the date and sign-up in `CUP["status"]` / `CUP["statusNote"]`; after the event add it to `CUP["past"]` (and a deck page for the winner).
- **MEIOCG Players** reads `https://kodex.meiocg.org/api/players` live; nothing to rebuild. Icons and frames come from `duel/profile.js` / `duel/profile.css`, the same files the Arena and the app use.
- **Guides**: lessons 1–3 come from each deck's content (`how`, `line`, `stops`). Premium lesson titles are in `GUIDES["premium"]`.
