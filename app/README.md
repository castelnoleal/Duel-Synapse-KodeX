# Duel Synapse: KodeX app

`Kodex_Mei_Production_v40.html` is the source of the **Meiocg KodeX** Android app (`com.duelsynapse.kodex`). It's built with instApped: upload this file as the project's HTML source.

It loads cards and rulings from https://kodex.meiocg.org.

## Card scanner

The search box has a scan button that opens the card scanner:

- **How it reads:** the phone camera, or a photo, is read with Tesseract.js 5.1.1 from jsDelivr, downloaded the first time it's used. The app's Content-Security-Policy allows that library, its worker and WebAssembly.
- **How it matches:** cards are matched by passcode, set code or name against https://kodex.meiocg.org/scan/cards.json. That list is rebuilt with the card database. When the app is offline, it falls back to the cards it already has loaded.
- **Shared matching code:** the matching code is a copy of `scan/match.js`, embedded in the app. If you change `scan/match.js`, copy it into the app's scanner block again.
- **Camera permission:** build the app with **Camera** turned on under Permissions in instApped.

Test: `node tests/app/app-scan.e2e.mjs` runs the app with a fake camera and real text recognition, using the `tesseract` CLI.
