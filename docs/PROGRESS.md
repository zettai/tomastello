# Progress: poc/netlify

Overnight work log, so a restarted session can resume. One file per branch.

- **Branch:** `poc/netlify`, cut from `poc/presigned-uploads` at `9d90e96`
- **Feature head:** `b97aafd` (docs commits follow)
- **Status:** code complete. Not deployed (needs a Netlify site, env vars and bucket CORS: see
  `docs/NEEDS-FROM-OWNER.md`).

## Done

- `netlify.toml`: `@netlify/plugin-nextjs`, Node 22, `NPM_FLAGS=--legacy-peer-deps` (plain
  `npm ci` rejects the lockfile: verified).
- `output: "standalone"` only when `NETLIFY` is unset, so the Docker image still builds.
- `UPLOAD_MODE` defaults to `presigned` (6 MB function body cap); compose still passes `relay`.
- `src/lib/jsonStore.ts`: optimistic concurrency (ETag + `If-Match` / `If-None-Match: *`,
  jittered backoff, 6 attempts, then 409). Users, links, image/audio metadata, track order,
  security events and the upload lock all go through it. `PUT /api/site` still replaces the
  whole document (documented limitation).
- Upload rate limits and the daily byte cap use a shared usage log in the bucket instead of
  per-instance memory. The abuse-email counter stays per instance (documented).
- File logging is skipped on Netlify/Lambda even if `LOG_DIR` is set.
- `docs/NETLIFY.md`: each Netlify constraint and what the app does about it.

## Checks

- `npm test`: 610 passed, 63 suites. Coverage: statements 95.7%, branches 87.8%. New store,
  limiter and logger code: 100%.
- `npm run lint`, `npm run typecheck`: clean.

## Sanity check (deterministic-audit, local production build + moto S3 stub)

| Round | Result |
|---|---|
| 1 | Concurrency test (25 simultaneous `POST /api/links`): **no acknowledged save lost**, but 17/25 gave up with 409 (retries ran back to back). **S3 fixed**: jittered backoff, 6 attempts. |
| 2 | 25/25 and 10/10 simultaneous saves all stored. **Control** on `poc/presigned-uploads` (no conditional writes): 25 answered success, **1** stored. Probe of 27 routes clean; logged-in uploads clean in both modes (15 direct PUTs, 0 relayed; and the reverse); sizes match. |

Also verified:
- `NETLIFY=true next build` succeeds without `standalone`.
- `netlify build --offline` (Netlify CLI 27.10.2, Next.js Runtime v5.16.1): the server function
  bundles (25 MB zipped, under the 50 MB limit).
- Cold start of the standalone server locally (spawn → first `/api/health` 200): 574–641 ms
  over 5 runs.

Open / logged:
- **T:** edge-function bundling (the middleware) could not run here: it downloads Deno, which
  this container's network blocks (403). Netlify's own build will do it; check the first deploy
  log.
- **T:** moto honours `If-Match`/`If-None-Match`; whether **Scaleway** does is unverified
  (owner checklist). If it answers `NotImplemented`, the store falls back to plain writes.
- **S4:** public-page findings here (unfocusable about text, `/swagger` served) are fixed on
  `fix/audit-minors`, which this branch doesn't include.
- **S4 (pre-existing):** unlabelled image-selection checkboxes on `/admin`.

## Deliverables (all branches done)

- `docs/POC-COMPARISON.md`: per option what changed, done vs stubbed, local measurements, what
  needs real-world measuring, ops burden, rollback, recommendation.
- `docs/NEEDS-FROM-OWNER.md`: every credential, account, DNS step and decision stubbed.

## Next

Nothing: all four branches are code complete. Waiting on the owner (see the two files above).

---

## Story 1: Local S3 mock (moto)

- **Status:** code + `e2e:local-s3` green; owner sign-off pending.
- **Backend:** moto (spike passed CORS/ACL). RustFS not pursued for Story 1.
- **Env templates:** `.env.development.local.example` not committed — LLNZ guard blocks `.env*`
  writes; full override block is in `docs/LOCAL-S3-DEV.md` (overrides production `.env.local`).
- **Deliverables:** `docker-compose.dev.yml`, `scripts/dev-s3-*`, `SCALEWAY_PUBLIC_BASE_URL` /
  `publicObjectUrl`, `npm run e2e:local-s3`, `.gitignore` for `.data-dev` / `.data-local-s3`.
