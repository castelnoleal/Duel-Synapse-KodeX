# Duel Synapse: KodeX by MEIOCG

Private, centralized card-data and ruling repository powering Duel Synapse and related MEIOCG applications.

## Repository status

**Visibility:** Private  
**Primary project:** Duel Synapse  
**Database name:** KodeX  
**Owner/brand:** MEIOCG

KodeX is intended to remain a private source repository. Public applications must not depend on unauthenticated access to this GitHub repository or expose repository credentials in browser-side code.

## Planned consumers

- Duel Synapse
- MEIOCG card-search tools
- Future authorized MEIOCG applications

## Architecture

The repository is designed around static, versioned data so authorized application infrastructure can retrieve data efficiently without repeatedly querying an external card API.

```text
Duel-Synapse-KodeX
├── data/
│   ├── cards.json
│   ├── cards.min.json
│   ├── metadata.json
│   └── rulings/
├── indexes/
│   ├── name.json
│   ├── id.json
│   ├── archetype.json
│   ├── type.json
│   └── search.json
├── images/
│   ├── thumbnails/
│   └── cards/
└── index.html
```

## Security model

- Keep this repository **private**.
- Never place GitHub tokens, server credentials, API keys, private keys, or deployment secrets in tracked files.
- Never ship GitHub credentials to client-side JavaScript.
- Public frontends should consume only intentionally public application/API responses.
- Sensitive database files and administration endpoints should remain behind server-side authentication/authorization.
- Do not create unrestricted endpoints that mirror or download the entire KodeX dataset.
- Use environment variables or the deployment platform's secret store for credentials.
- Rotate any credential immediately if it has ever been committed to Git history.
- Treat GitHub repository access and production-server access as separate security boundaries.

## Data source

The initial Yu-Gi-Oh! dataset is intended to be imported from YGOPRODeck and stored locally, following its API guidance to cache/store pulled data and avoid unnecessary API calls.

Source: https://ygoprodeck.com/api-guide/

## Important

Do not treat the database as complete until `metadata.json` reports a populated dataset. Changes to the schema or indexes should preserve compatibility with existing Duel Synapse consumers unless deliberately versioned.

MEIOCG is an independent project and is not affiliated with or endorsed by Konami or YGOPRODeck.

## Card scanner

`/scan/` scans a Yu-Gi-Oh! card with the phone camera (or a photo) and opens it in KodeX. The **Scan** button next to the search box opens it.

- Text recognition runs on the device with [Tesseract.js](https://github.com/naptha/tesseract.js) 5.1.1, loaded from jsDelivr the first time it's used.
- It reads the passcode (bottom-left), the set code (under the artwork) and the name (top banner), and matches them against `scan/cards.json` in `scan/match.js`. The passcode or set code identifies a card exactly. A name alone needs a close match, otherwise the scanner offers the closest cards to choose from.
- `scan/cards.json` is built from `data/cards.min.json` by `scripts/build_scan_index.py`, and rebuilt by the *Build Kodex Search Index* workflow.
- Other apps can open `/scan/?pick=1` to get the card back instead of opening it. The scanner calls `window.KodexScanResult.onCard(json)` if the app provides it, and posts `{type:"kodex-scan", id, name}` to the opener or parent window. `/scan/?return=/deck.html` opens `/deck.html#card=<passcode>` instead of the KodeX page.
- In an Android app built with instApped, turn on **Camera** under Permissions so the scanner can use the camera.

Tests: `node --test tests/scan/match.test.cjs` covers matching. `node tests/scan/scanner.e2e.mjs` scans rendered test cards through a fake camera and photo upload, using the native `tesseract` CLI.
