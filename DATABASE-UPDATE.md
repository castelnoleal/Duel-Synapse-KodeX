# MEIOCG Database Update System

The repository can refresh its card data automatically from YGOPRODeck API v7.

The **Update MEIOCG Database** workflow (`.github/workflows/update-database.yml`) does this every 6 hours: it rebuilds `data/cards.json`, `data/cards.min.json`, the indexes in `indexes/` (including `search.json`) and the card scanner's `scan/cards.json`. The manual script below is only for local use.

## Manual update

From the repository root:

```bash
python scripts/update_database.py
```

This downloads the complete English dataset and creates:

- `data/cards.json` — complete source data
- `data/cards.min.json` — compact source data
- `data/metadata.json` — database/version information
- `indexes/name.json` — exact normalized name lookup
- `indexes/id.json` — card ID lookup
- `indexes/archetype.json` — archetype lookup
- `indexes/type.json` — card type lookup

## Images

Images are intentionally NOT downloaded by default.

To download images:

```bash
python scripts/update_database.py --download-images
```

Run image imports conservatively. YGOPRODeck asks users to download and re-host images rather than continually hotlinking them, and warns against high-volume image requests.

## Automatic updates

`.github/workflows/update-database.yml` runs weekly and can also be started manually from:

GitHub → Actions → Update MEIOCG Database → Run workflow

## Design

The database keeps the upstream card object intact so Duel Synapse can access the full information without losing fields.

The indexes are separate so a client can perform a lightweight lookup before loading the full card object.

MEIOCG-Database is an independent project and is not affiliated with or endorsed by Konami or YGOPRODeck.
