# Duel Synapse: KodeX — Private Origin Gateway

This Worker is the server-side boundary between public Duel Synapse applications and the private KodeX repository.

## Security model

The browser must never receive `GITHUB_TOKEN` and must never fetch the private repository directly.

The Worker retrieves KodeX files with a GitHub token stored as a Cloudflare Worker Secret, then exposes only narrow application endpoints:

- `GET /api/search?q=...&limit=...&type=...`
- `GET /api/ruling/<Konami-ID>`
- `GET /health`

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
