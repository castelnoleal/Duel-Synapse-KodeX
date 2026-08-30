# Duel Synapse: KodeX — Secure Deployment Plan

## Goal

Keep `Duel-Synapse-KodeX` private while allowing `kodex.meiocg.org` to use KodeX data without exposing the GitHub repository or a GitHub credential to visitors.

## Target architecture

```text
Private GitHub repository
        |
        | read-only GitHub token held as a server secret
        v
Cloudflare Worker: duel-synapse-kodex-origin
        |
        +--> /api/search
        +--> /api/ruling/<Konami-ID>
        +--> /health
        |
        v
Public KodeX application
        |
        v
kodex.meiocg.org
```

## Required external configuration

1. Deploy `server/wrangler.jsonc` with Wrangler.
2. Create a **read-only** GitHub token that can read only this private repository.
3. Store it in Cloudflare as the Worker Secret `GITHUB_TOKEN`.
4. Attach a dedicated hostname such as `api-kodex.meiocg.org` to the Worker.
5. Test `/health`, `/api/search?q=Dark%20Magician`, and a known `/api/ruling/<Konami-ID>` endpoint.
6. Only after those tests pass, migrate the frontend data requests from direct static paths to the API paths.
7. After migration, prevent direct public serving of the private `data/` and `indexes/search.json` assets from the website deployment.

## Why the frontend migration is deliberately staged

The current KodeX frontend still uses direct paths such as `indexes/search.json` and `data/rulings/cards/<id>.json`. Those working paths are intentionally left untouched until the server gateway is actually deployed. This prevents a half-configured security change from taking the live application offline.

## What must never happen

- Never put `GITHUB_TOKEN` in `index.html` or any browser JavaScript.
- Never put the token in `wrangler.jsonc`.
- Never expose the full private repository through a raw GitHub URL.
- Never create an API endpoint that returns the complete KodeX dataset.
- Never expose server filesystem paths, GitHub API errors, or internal credentials.

## Current dataset

KodeX currently reports 14,521 cards and a populated database in `data/metadata.json`. The search-index workflow also validates a populated index before publishing it, so the existing data-update pipeline should remain intact while the access layer is migrated.
