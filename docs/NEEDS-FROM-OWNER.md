# Needs from the owner

Everything the overnight work stubbed, assumed or couldn't reach, grouped by branch. Secret
values never go in the repo; only their names appear here.

## Before any deploy

- [ ] **`ALLOW_NEW_REGISTRATIONS` in production's env file.** `fix/audit-minors` makes
  registration closed unless the value is exactly `true`. Confirm production has `false` or
  nothing. (Before that branch, an unset value meant open.)
- [ ] **Decision:** keep the `NOSONAR` on the about region's `tabIndex` (`fix/audit-minors`),
  or drop the scroll box instead. See that branch's `docs/PROGRESS.md`.

## `poc/presigned-uploads` (works in relay mode with nothing from you)

- [ ] **Bucket CORS** on the production bucket: `PUT` from the site's origin(s), `ExposeHeaders:
  ETag`. Example JSON and command in `docs/UPLOADS.md`. Needs a Scaleway key allowed to change
  bucket settings.
- [ ] Then set `UPLOAD_MODE=presigned` in the server's env file and restart.
- [ ] **Verify once against the real bucket** (the local stub doesn't check signatures):
  - a direct upload works (photo and a 50 MB+ audio file);
  - a PUT with a different size than the signed one is refused (403).
- [ ] Optional: `UPLOAD_CHUNK_SIZE_MB` if you want chunks other than 5 MB.

## `poc/netlify`

- [ ] **Netlify site** linked to this GitHub repo (branch `poc/netlify` or deploy previews).
  Build settings come from `netlify.toml`. Account choice is yours (rowennkalman's account holds
  only that site today).
- [ ] **Env vars in Netlify** (names in `.env.production.example`): `SCW_ACCESS_KEY`,
  `SCW_SECRET_KEY`, `SCW_DEFAULT_REGION`, `SCALEWAY_BUCKET`, `SCALEWAY_ENDPOINT`, `JWT_SECRET`,
  `ALLOW_NEW_REGISTRATIONS=false`, `USE_SECURE_COOKIES=true`, `RESEND_API_KEY`,
  `NOTIFY_EMAIL_TO`, `NOTIFY_EMAIL_FROM`. Optional: `MAX_UPLOADS_PER_IP_HOUR`,
  `MAX_UPLOADS_PER_USER_HOUR`, `MAX_SYSTEM_BYTES_24H`, `LOG_LEVEL`. Leave `LOG_DIR` unset.
- [ ] **A test bucket** (or prefix) with the same layout, plus a scoped key, for the trial. CORS
  on it for the Netlify preview origin.
- [ ] **Check that Scaleway supports conditional writes** (`If-Match` / `If-None-Match` on PUT):
  - save a link in two tabs at once on the preview; both should survive;
  - or look in the Netlify function logs for "Bucket refused conditional writes" (the store then
    falls back to unprotected writes).
- [ ] **First deploy log:** confirm the edge-function bundle (middleware) built. It couldn't be
  built in the sandbox (Deno download blocked).
- [ ] **Measure:** TTFB and LCP of `/` on the Netlify preview vs the live site, from your
  location (WebPageTest or Lighthouse, same settings). Check Netlify's current pricing against
  your traffic.
- [ ] **DNS**, only if you decide to move: point the domain at Netlify (keep the old records
  noted for rollback).

## `poc/github-only`

- [ ] **Run the "Build image" workflow** once (Actions tab → Build image → Run workflow).
- [ ] **GHCR package visibility:** make `ghcr.io/zettai/tomastello` public, or create a token
  with only `read:packages` for `docker login ghcr.io` on the server.
- [ ] **Install the pull deploy on the server** (commands in `docs/GITHUB-ONLY.md`): copy
  `deploy/pull-deploy.sh` and the systemd units, write `/etc/next-tt/pull-deploy.env` with
  `IMAGE=...`, enable the timer.
- [ ] **SonarQube decision:** keep `npm run sonar` local, or set up SonarCloud (account +
  `SONAR_TOKEN` secret in GitHub).
- [ ] When happy: archive the Gitea repo and stop the LAN registry and runner.

## General

- [ ] **Merge order**, if you take them: `fix/audit-minors` → `poc/presigned-uploads` → one
  of the POCs. Each `docs/PROGRESS.md` is a per-branch log: keep or delete it when merging.
- [ ] **`npm audit`** (not fixed, by instruction): 36 advisories in production dependencies
  (2 critical, 11 high, 23 moderate). Critical: `next` 15.3.2 (fixed in 15.5.27, a minor bump
  within 15) and `fast-xml-parser` (via the AWS SDK). Most of the rest clear with
  `npm audit fix` (no major upgrades). Your call on when to upgrade.
- [ ] **Pre-existing S4:** image-selection checkboxes on `/admin` have no accessible label.
- [ ] **Pre-existing on `main`:** `scripts/sonarqube-scan.sh` still defaults `SONAR_HOST_URL` to a
  LAN address; set it in `.env.local` and the default never matters, or change the default.
