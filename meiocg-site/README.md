# meiocg.org deck pages and Why KodeX

DashNex pages for meiocg.org: the OCG meta deck hub, one page per meta deck, and Why KodeX.

- `content.py`: all page text. Card names in `[[double brackets]]` link to KodeX and are checked against `data/cards.min.json` on every build.
- `decks_raw.py`: the decklists (passcodes and counts).
- `src/mdk.css`, `src/mdk.js`: the page design and script (meiocg.org theme tokens, live Yuyu-tei prices from the MEIOCG Price Guide, OCG legality badge, Arena playtest link, ydke/.ydk/text export).
- `data/jpnames.json`: Japanese card names (from the KodeX rulings mirror), used to match Yuyu-tei prices.
- `python3 build.py` writes `out/<page>/head.html`, `body.html` and `seo.txt`.

## Put a page on DashNex

For each folder in `out/`: create the page at the URL in `seo.txt`, paste `head.html` into Head Code and `body.html` into Body Code, and copy Title and Description from `seo.txt`.

Social images are served by the KodeX Worker at `https://kodex.meiocg.org/og/<name>.png` from `assets/og/`.
