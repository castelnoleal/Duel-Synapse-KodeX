# Security Policy — Duel Synapse: KodeX by MEIOCG

## Repository classification

Duel Synapse: KodeX is a private MEIOCG repository. Its source code, database, indexes, ruling records, and infrastructure configuration are proprietary project assets unless a file is explicitly designated for public distribution.

## Rules

1. Keep the GitHub repository private.
2. Never commit secrets or credentials.
3. Never expose GitHub authentication tokens to frontend/browser code.
4. Keep production database access server-side.
5. Expose only the minimum API data required by public applications.
6. Authenticate administrative and data-management endpoints.
7. Apply rate limiting to public endpoints.
8. Review deployment configuration before exposing a new endpoint or static directory.
9. Rotate credentials if accidental exposure occurs.
10. Preserve backwards compatibility when securing existing application paths so working Duel Synapse features are not unnecessarily disrupted.

## Incident response

If a credential, private dataset, or sensitive endpoint is accidentally exposed:

- Revoke/rotate the affected credential immediately.
- Remove the exposed secret from active configuration.
- Review recent access and deployment logs.
- Check Git history if the secret was committed.
- Update the affected application configuration.
- Verify that the public application still functions without direct private-repository access.

## Scope

This policy covers the KodeX repository and its associated application/infrastructure integration. It does not grant permission to redistribute proprietary KodeX data or implementation.
