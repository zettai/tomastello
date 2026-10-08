# Security

This repository is public: no secret values in git, ever.

## Reporting a vulnerability

Please report privately through GitHub's
[private vulnerability reporting](https://github.com/zettai/tomastello/security/advisories/new)
rather than opening a public issue.

## Accounts

There are no roles: every account can edit everything and upload files. Keep
`ALLOW_NEW_REGISTRATIONS` unset or `false` (registration is off unless it is exactly `true`),
and turn it on only long enough to create an account.

## Secrets

The app reads every secret from the environment:

- Storage: `SCW_ACCESS_KEY`, `SCW_SECRET_KEY` (plus the non-secret `SCALEWAY_*` settings)
- Auth: `JWT_SECRET`
- Email alerts: `RESEND_API_KEY`
- CI/deploy (stored in the CI system): `SONAR_TOKEN`, `SSH_PRIVATE_KEY`, `REGISTRY_TOKEN`,
  `REGISTRY_USERNAME`

Local values live in `.env.local` (gitignored). The names are listed in
`.env.production.example`, names only, never values.

## Pre-commit secret scan

`.husky/pre-commit` runs `scripts/secret-scan.sh` before the tests. It is a
dependency-free scan of staged changes that **blocks commits** containing credential-shaped
strings (Scaleway/AWS keys, private-key blocks, JWTs, `re_*`, `ghp_*`, `*_TOKEN=…`, and so
on). Doc and example files (`.env*.example`, `AGENTS.md`, `SECURITY.md`, the script itself)
are skipped.

False positive? Review it, then `git commit --no-verify`.

## If a secret was committed

1. **Rotate or revoke it immediately** and assume it is compromised.
2. Scrub it from history (`git filter-repo` or BFG) and force-push.
3. Deleting it in a new commit is **not** enough: it stays in history.
