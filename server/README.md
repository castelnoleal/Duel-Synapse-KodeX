# Duel Synapse: KodeX — Private Origin Gateway

This Worker is the server-side boundary between public Duel Synapse applications and the private KodeX repository.

## Security model

The browser must never receive `GITHUB_TOKEN` and must never fetch the private repository directly.

The Worker retrieves KodeX files with a GitHub token stored as a Cloudflare Worker Secret, then exposes only narrow application endpoints:

- `GET /api/search?q=...&limit=...&type=...`
- `GET /api/ruling/<Konami-ID>`
- `GET /health`
- `GET /api/duel/book?cards=...` and `POST /api/duel/book/learn`: Synapse AI's shared play book (`playbook.js`, a SQLite Durable Object bound as `PLAYBOOK`). It stores only anonymous counts keyed by card codes and action letters: combo lines, card-pick rates and responses. Reads return only rows whose cards are all in the requested list; writes are validated, capped at 600 rows and weight 3 per row.
- `GET /api/players?sort=points|recent&limit=100`, `POST /api/players/ping`, `POST /api/players/leave`: MEIOCG Players (`players.js`, a SQLite Durable Object bound as `PLAYERS`, migration `players-v1`). Lists KodeX players who opted in from their profile, active in the last 90 days, ranked by activity points. Stores only what the profile shows (name, title, about, a preset icon name, frame, tier, Premium, activity counts, first and last seen) plus a SHA-256 hash of the player's secret key; never a picture, email or device id. One update per player every 4 minutes; points are capped by the activity behind them. Read by meiocg.org/players (CORS open, cached 60 s).

The complete search index and complete database remain on the private GitHub side. The Worker caches origin responses server-side and returns only search results or the requested ruling record.

## Required secret

Create a Cloudflare Worker secret named:

`GITHUB_TOKEN`

The token should have the minimum repository access needed to read `castelnoleal/Duel-Synapse-KodeX`. Do not put the token in this repository, `wrangler.jsonc`, frontend JavaScript, or browser storage.

Cloudflare documents Worker secrets as the appropriate place for API keys and authentication tokens.

## Deployment

From a checkout of this repository:

```bash
npx wrangler deploy --config server/wrangler.jsonc
```

Then attach the Worker to a dedicated API hostname such as:

`api-kodex.meiocg.org`

Do not point the public site directly at GitHub after this gateway is active.

## Important compatibility rule

The existing KodeX frontend is intentionally not rewritten in this security pass. This gateway is additive so the existing application can be migrated to `/api/search` and `/api/ruling/<id>` after the Worker has been deployed and tested. That prevents a partially configured backend from breaking currently working features.
