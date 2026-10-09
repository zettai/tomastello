# Needs from the owner

What still needs the owner's decision or a check against production. Secret values never go in
the repo; only their names appear here.

Last reviewed 2026-10-09. Everything from the earlier POC branches is resolved: registrations
closed, presigned uploads live, the Netlify site and its env vars set. The GitHub-only and
pull-deploy route was not taken, and those branches are gone.

## Open

- [ ] **Dependency advisories.** `npm audit --omit=dev` was 39 and is 7 after `npm audit fix` and a
  `fast-xml-parser` override (critical cleared). The rest need major upgrades: `postcss` (Next 16),
  `sharp` (via Next), `sprintf-js` (swagger-ui).

## Resolved

- **Conditional writes (2026-10-09).** The bucket ignores `If-Match` on PUT and Netlify strips
  the browser's `If-Match`, so the store pre-checks the ETag itself and the site version travels
  in `X-Site-ETag` / `X-Site-If-Match`. Verified on production: stale version → 409.
