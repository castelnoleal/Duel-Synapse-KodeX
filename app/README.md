# Duel Synapse: KodeX app

`Kodex_Mei_Production_v48.html` (free) and `Kodex_Mei_Premium_v48.html` (Premium) are the current source (older versions are kept alongside it) of the **Meiocg KodeX** Android app (`com.duelsynapse.kodex`). It's built with instApped: upload this file as the project's HTML source.

It loads cards and rulings from https://kodex.meiocg.org.

## Card scanner

The search box has a scan button. It reads the card from the camera, or from a photo.

**Online first (v46).** The picture (a steady camera frame, or the whole gallery photo) is sent to `POST https://kodex.meiocg.org/api/lens`. A vision model on the server reads what is printed on the card, in any language: name, passcode, set code, ATK and DEF. The app then pulls the card from its own list by that name. The model's answer is never trusted on its own: the name has to be a real card name (or an exact match on YGOPRODeck), and the passcode, set code and ATK/DEF must not contradict the card. A name that is only half-confirmed has to come back twice in a row on the live camera. When the server can't be reached or has no key, the offline scanner below runs instead.

The server needs one secret on the Worker (Cloudflare dashboard > Workers > duel-synapse-kodex > Settings > Variables and Secrets): `ANTHROPIC_API_KEY` (model `LENS_MODEL`, default `claude-haiku-5-5`) or `GEMINI_API_KEY` (model `LENS_GEMINI_MODEL`, default `gemini-2.5-flash`, has a free tier). With neither set, `/api/lens` answers 503 and the app uses the offline scanner. The Worker caches repeat pictures for a day, accepts pictures up to 900 KB and limits each address to 30 reads a minute and 600 a day; add a Cloudflare rate-limiting rule on `/api/lens` as well. Tests: `node tests/server/lens.test.mjs`.

Offline scanner (used when the online read isn't available):

1. **Artwork first:** each camera frame's artwork is fingerprinted and compared with every card in about 20 ms. This works for any language, including Japanese cards, and needs no text reading. The fingerprints are in https://kodex.meiocg.org/scan/art.json, about 350 KB, built weekly by the *Build card art index* workflow from `scripts/build_art_index.py`. The app uses the same code as `scan/arthash.js`.
2. **Text if needed:** if the picture isn't conclusive, the app loads Tesseract.js 5.1.1 from jsDelivr and reads the passcode, then the set code and name. It matches them with `scan/match.js` against https://kodex.meiocg.org/scan/cards.json. If text and picture agree on a card, that card is accepted.
3. **Online:** a passcode or set code that isn't in the app's list is looked up on YGOPRODeck.

On real card images made to look like phone photos, the *Scanner accuracy* workflow (`tests/scan/art-accuracy.mjs`) measured:

- 88% of single photos recognised by artwork with certainty
- no wrong cards
- the right card among the top 5 suggestions for 98.7% of photos

The live camera also accepts a card when the same card leads two frames in a row. Text is read in the background, so it never holds up the picture checks, which run about every 60 ms. Choosing a photo turns the camera off while that photo is searched.

The app's Content-Security-Policy allows jsDelivr (script, worker and WebAssembly) and kodex.meiocg.org / YGOPRODeck (data). Build the app with **Camera** on under Permissions in instApped.

Test: `node tests/app/app-scan.e2e.mjs` runs the app (artwork, text, Japanese card, stuck video) with a fake camera and real text recognition, using the `tesseract` CLI.


**v44:** the scanner's data is read from the site, then from the public repository (raw.githubusercontent.com), and a copy is kept on the device. A photo is searched at several zoom levels and positions, so a card that does not fill the picture is still found. If the data cannot be loaded the scanner says so instead of "No card recognised". The site serves `/scan/art.json` and `/scan/cards.json` from the Worker.

**v45:** the live camera no longer trusts a single crop. Each frame is searched in and around the guide frame (three sizes, positions within about 6%), and a card is only accepted when it is clearly closer than every other card or the same card leads two frames in a row. Weak guesses are no longer listed or named.

**v46:** online lookup (see *Card scanner*). The offline photo search now needs a much closer picture match before it names a card, and no longer lists weak guesses.

**v47:** the sponsor strip stays visible on every screen: panels, pop-ups, the scanner and the Arena all open below it (`--adh` follows the strip's real height). Filters are a small bubble at the lower right (hidden while a panel is open); the bottom tab that held them is now **Test**, which opens the Duel Arena. Settings: *Persistent storage* is gone from the System Check, and a **Premium** row opens *Remove ads* / *Premium* (both marked Coming soon).

**v48 (8.2):** two editions from one source, told apart by `<meta name="kodex-edition">`:
- **Free** (`Kodex_Mei_Production_v48.html`): as v47.
- **Premium** (`Kodex_Mei_Premium_v48.html`): Settings › Premium › **Skins** sets pictures for the Main, Extra and Side Deck and card **sleeves** (premade skins from the Skin Injector, or the player's own from the gallery, stored on the device). Deck sections show their skin; in the Duel Arena your face-down cards use your sleeve and your Deck / Extra Deck zones show their skins. *EDOPro cross-play* is listed as coming soon.

The Arena now ships **inside the app**. Build the instApped upload with
`python3 scripts/build_app_bundle.py app/Kodex_Mei_Production_v48.html KodeX_v48.zip` (or the Premium file): a ZIP with `index.html`, the Arena in `duel/` and all 13,700 card scripts packed into `duel/data/scripts.pack.bin` (about 7 MB in total). instApped serves it from `https://appassets.androidplatform.net/`, so the Test tab opens the Arena with no connection and no connection check. Online rooms, the shared play book and card art still use kodex.meiocg.org. Without the ZIP (page only), the app opens the Arena from kodex.meiocg.org as before.

In the Arena, card details now always open on top of pop-ups such as the Extra Deck, GY and banished lists.

License: [LICENSE.md](../LICENSE.md) (all rights reserved; permission via metainsiderocg@gmail.com), shown in the app under Legal & Privacy and at https://kodex.meiocg.org/license.
