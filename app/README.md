# Duel Synapse: KodeX app

`Kodex_Mei_Production_v43.html` is the current source (older versions are kept alongside it) of the **Meiocg KodeX** Android app (`com.duelsynapse.kodex`). It's built with instApped: upload this file as the project's HTML source.

It loads cards and rulings from https://kodex.meiocg.org.

## Card scanner

The search box has a scan button. It reads the card from the camera, or from a photo.

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
