# Netlify (proof of concept)

This branch (`poc/netlify`) makes the app runnable on Netlify: pages and API routes run as
serverless functions, `src/middleware.ts` runs on Netlify's edge, and static files come from the
CDN. Nothing here has been deployed; the owner checklist is in `docs/NEEDS-FROM-OWNER.md`.

## What Netlify changes, and how the app copes

| Netlify constraint | Effect on this app | What this branch does |
|---|---|---|
| Function request bodies are capped at **6 MB** | Relayed uploads (photos up to 30 MB, 5 MB audio chunks plus encoding) fail | `UPLOAD_MODE` defaults to `presigned`: files go browser → bucket; functions only see small JSON (`docs/UPLOADS.md`) |
| Many short-lived instances, no shared memory | Read-modify-write of the JSON documents can lose a save when two run at once; in-memory rate-limit counters are per instance | All JSON writes go through `src/lib/jsonStore.ts` (ETag + `If-Match`, retry, then 409). Upload counters live in the bucket (`metadata/upload-usage.json`) |
| Object storage | Production uses Scaleway (`SCW_*`, `SCALEWAY_BUCKET`) | Optional `TOMASTELLO_STORE=s3` (default when those vars are set). Local dev / Playwright: `TOMASTELLO_STORE=file` and `TOMASTELLO_DATA_DIR` (see `docs/E2E.md`). Binary uploads still use S3 or presigned URLs. |
| No writable disk worth using | `LOG_DIR` file logging | Skipped on Netlify (`NETLIFY` or `AWS_LAMBDA_FUNCTION_NAME` set); logs go to stdout, which Netlify keeps as function logs |
| Middleware runs on the edge runtime | Node-only libraries can't run there | Already `jose` on `main` |
| Short function timeouts (seconds) | Long requests would be cut off | Nothing long runs on the server any more: uploads are direct, `complete` is one S3 call plus a HEAD |
| Build: Netlify's Next.js runtime | `output: "standalone"` is for Docker | `next.config.ts` sets it only when `NETLIFY` is not set, so the Docker image still builds |
| Build: `npm ci` | The lockfile needs legacy peer deps | `netlify.toml` sets `NPM_FLAGS=--legacy-peer-deps` |

## Concurrent saves

`jsonStore.updateJson` reads a document with its ETag, applies the change and writes it with
`If-Match` (or `If-None-Match: *` for a new document). If another request saved first, the
bucket answers 412; the change is re-applied to the fresh copy, up to 4 attempts, then the route
answers **409** ("Someone else saved at the same moment"). Covered: users (sign-up, last
login), links, photo and audio metadata, track order, security events, the upload lock, upload
counters.

Not covered, by design: `PUT /api/site` replaces the about text, photo selection and links with
what the admin page sends. Two admins editing at once still means the last save wins; fixing
that needs the page to send the version it loaded. One admin, as today, is unaffected.

If the bucket doesn't support conditional writes it answers `NotImplemented`; the store then
logs an error once and falls back to plain writes, so the site keeps working unprotected.
**Check this once against the real bucket** (owner checklist).

## Rate limiting and the upload lock

- Per-IP and per-user hourly limits and the daily byte cap read the shared usage log in the
  bucket, so every instance enforces the same numbers. Recording an upload is a conditional
  write, so simultaneous uploads are all counted.
- The upload lock was already in the bucket; each instance caches it for at most 60 seconds.
- The abuse-email counter stays per instance: it only decides when to email, so the worst case
  is a few more or fewer alerts.

## Setting it up (owner)

1. Netlify → Add new site → Import from GitHub → this repository, branch `poc/netlify`
   (or a deploy preview of it). Build settings come from `netlify.toml`.
2. Site settings → Environment variables: the names in `.env.production.example`
   (`SCW_*`, `SCALEWAY_*`, `JWT_SECRET`, `RESEND_API_KEY`, `NOTIFY_EMAIL_*`,
   `TOMASTELLO_ADMIN_EMAILS`, `TOMASTELLO_SITE_URL`, optional `TOMASTELLO_MAGIC_LINK_FROM`,
   `ALLOW_NEW_REGISTRATIONS=false`, `USE_SECURE_COOKIES=true`). Leave `LOG_DIR` unset.
3. Bucket CORS: allow `PUT` from the Netlify site's origin(s) and expose `ETag`
   (`docs/UPLOADS.md`). Use a **test bucket** first.
4. Try it on the preview: sign in, upload a photo and a 50 MB+ audio file, reorder tracks, edit
   links in two tabs.

## Rollback

Netlify serves whatever was last deployed and keeps every deploy: "Publish deploy" on an older
one rolls back in seconds. Moving the domain back to the self-hosted container is a DNS change.
The self-hosted pipeline still builds from `main`/Gitea untouched, so it remains a fallback until
the switch is final.

## Measured locally (not on Netlify)

See `docs/POC-COMPARISON.md`.
