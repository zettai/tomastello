# Needs from the owner

What still needs the owner's decision or a check against production. Secret values never go in
the repo; only their names appear here.

Last reviewed 2026-10-09. Everything from the earlier POC branches is resolved: registrations
closed, presigned uploads live, the Netlify site and its env vars set. The GitHub-only and
pull-deploy route was not taken, and those branches are gone.

## Open

- [ ] **Dependency advisories.** `npm audit --omit=dev` reports 39 (1 critical, 11 high,
  27 moderate). The critical one is `fast-xml-parser`, pulled in by the AWS SDK; it parses
  responses from the bucket, so exposure is low, but it should be updated. Most of the rest
  clear with `npm audit fix` (no major upgrades).
- [ ] **Confirm the bucket honours conditional writes** (`If-Match` / `If-None-Match` on PUT).
  Save conflicts (409) and the admin save queue depend on it. If the bucket ignores them, the
  store logs "Bucket refused conditional writes; concurrent saves are no longer protected" and
  falls back to unprotected writes. Check: watch the function logs during one admin save.
