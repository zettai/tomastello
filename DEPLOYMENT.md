# Deployment

Production (`https://tomas-tello.stream`) runs on **Netlify**: pages and API routes as serverless
functions, `src/middleware.ts` on the edge (Next 16's Node `proxy.ts` rename not used here),
static files from the CDN. The old self-hosted Docker
container is gone; there is no CI deploy and no container registry any more.

## How a release ships

The Netlify site is linked to this repo with **auto-publishing locked**. A push to `main` builds a
production deploy but does not publish it; the owner publishes it with "Publish deploy" in
Netlify after checking the deploy's own URL. Nothing in `.github/workflows` deploys.

This repo is public, so Netlify's sensitive variable policy is set to **Require approval**: a pull
request from a fork does not build with production secrets until it is approved.

Rollback: in the Netlify UI, "Publish deploy" on an earlier deploy. Netlify keeps every deploy.

## Configuration

- Build settings are in `netlify.toml` (Node 22, `--legacy-peer-deps`, the Next.js runtime plugin).
- Production settings are Netlify environment variables. Names are in
  [Environment variables](#environment-variables) below; local values go in `.env.local`.
- Set `USE_SECURE_COOKIES=true` whenever the site is served over HTTPS.
- On Netlify, logs go to stdout (Netlify function logs); file logging is skipped.
- See [docs/NETLIFY.md](docs/NETLIFY.md) for what Netlify changes in the app.

## Environment variables

Authoritative list of names the app and scripts read (`process.env` / `env` defaults). No values.
When you add a variable, document it here. Local overrides go in `.env.local` (gitignored).
There are no `NEXT_PUBLIC_*` variables today; if you add one, note that Next inlines it at build time.

| Name | Required in production | Used by | Notes |
|---|---|---|---|
| `JWT_SECRET` | yes | `src/lib/sessionJwt.ts`, `src/lib/auth/magic-link.ts`, middleware session verify | Secret. Signing throws without it; verify rejects all tokens. |
| `SCW_ACCESS_KEY` | yes | `src/lib/api.ts`, store/uploads, `scripts/audit-stale-site-photos.mjs` | Secret. S3 client credentials. |
| `SCW_SECRET_KEY` | yes | `src/lib/api.ts`, store/uploads, `scripts/audit-stale-site-photos.mjs` | Secret. S3 client credentials. |
| `SCALEWAY_BUCKET` | yes | `src/lib/api.ts`, object store and upload routes | Bucket name. |
| `SCW_DEFAULT_REGION` | optional | `src/lib/api.ts`, `src/lib/uploads.ts`, scripts | Defaults to `fr-par` (app) / `us-east-1` (dev seed). |
| `SCALEWAY_ENDPOINT` | optional | `src/lib/api.ts`, scripts | Defaults to Scaleway S3 URL; required for audit script. |
| `SCALEWAY_PUBLIC_BASE_URL` | optional | `next.config.ts`, `src/lib/uploads.ts` | Public object URL base and Next image remote pattern. |
| `TOMASTELLO_ADMIN_EMAILS` | yes | `src/lib/auth/magic-link.ts` | Comma-separated allowlist; empty means no one can redeem a link. |
| `TOMASTELLO_SITE_URL` | optional | `src/app/api/auth/magic-link/route.ts`, `src/lib/publicHome.ts` | Site origin for magic links / home fetch; falls back to Netlify `URL` or request origin. |
| `USE_SECURE_COOKIES` | optional | `src/app/api/auth/magic-link/route.ts` | Session cookie `secure` only when exactly `true`; set on HTTPS. |
| `RESEND_API_KEY` | optional | `src/lib/notifier.ts`, `src/lib/auth/magic-link.ts` | Secret. Without it, alerts no-op and magic links use console/outbox mailer. |
| `NOTIFY_EMAIL_TO` | optional | `src/lib/notifier.ts` | Alert recipient; notifier no-ops without it. |
| `NOTIFY_EMAIL_FROM` | optional | `src/lib/notifier.ts`, magic-link From fallback | Defaults to site noreply address. |
| `TOMASTELLO_MAGIC_LINK_FROM` | optional | `src/lib/auth/magic-link.ts` | Overrides magic-link From; else `NOTIFY_EMAIL_FROM` or default. |
| `UPLOAD_MODE` | optional | `src/lib/uploads.ts`, upload API | `presigned` unless exactly `relay` (Netlify needs presigned). |
| `UPLOAD_CHUNK_SIZE_MB` | optional | `src/lib/uploads.ts`, `/api/uploads/config` | Multipart chunk size; default/clamped in code. |
| `MAX_UPLOADS_PER_IP_HOUR` | optional | `src/lib/rateLimiter.ts` | Default `10`. |
| `MAX_UPLOADS_PER_USER_HOUR` | optional | `src/lib/rateLimiter.ts` | Default `20`. |
| `MAX_SYSTEM_BYTES_24H` | optional | `src/lib/rateLimiter.ts` | Default 1 GiB. |
| `LOG_LEVEL` | optional | `src/lib/logger.ts` | Default `info`. |
| `LOG_DIR` | no | `src/lib/logger.ts` | File logging; skipped when `NETLIFY` or `AWS_LAMBDA_FUNCTION_NAME` is set. Leave unset on Netlify. |
| `TOMASTELLO_STORE` | no | `src/lib/store/index.ts` | `memory` / `file` / `s3`; production uses S3 when Scaleway keys are set. Local/e2e. |
| `TOMASTELLO_DATA_DIR` | no | `src/lib/store/index.ts`, console magic-link mailer | File-store / outbox directory; local and e2e. |
| `TOMASTELLO_DEV_ORIGIN` | no | `scripts/dev-s3-seed.mjs` | CORS origin for local moto seed; default localhost. |
| `URL` | no | magic-link origin, `src/lib/publicHome.ts` | Set by Netlify; do not set manually unless needed. |
| `DEPLOY_PRIME_URL` | no | `src/lib/publicHome.ts` | Set by Netlify deploy previews. |
| `NETLIFY` | no | `next.config.ts`, `src/lib/cdn.ts`, `src/lib/logger.ts` | Set by Netlify builds/runtime. |
| `NETLIFY_PURGE_API_TOKEN` | optional | `src/lib/cdn.ts` | Used with Netlify cache purge; often provided on Netlify. |
| `SITE_ID` | optional | `src/lib/cdn.ts` | Netlify site id for purge; often provided on Netlify. |
| `AWS_LAMBDA_FUNCTION_NAME` | no | `src/lib/logger.ts` | Set in Lambda/Netlify functions; disables file logging. |
| `NODE_ENV` | no | logout cookie `secure`, Node/Next | Framework-managed. |
| `SONAR_TOKEN` | no | `scripts/sonarqube-scan.sh` | Secret. Local/CI quality gate only, not the deployed site. |
| `SONAR_HOST_URL` | no | `scripts/sonarqube-scan.sh` | Local/CI SonarQube host; script has a default if unset. |

## Dockerfile

The `Dockerfile` (Next.js `standalone` output, non-root user) is kept so the app can still be built
as a container. Nothing builds or deploys it today. `next.config.ts` only sets `standalone` when
`NETLIFY` is not set, so the image still builds.

## GitHub Actions

`.github/workflows/ci.yml` runs lint, typecheck and tests on pull requests and on pushes to `main`.
It is the only workflow.

## Troubleshooting

```bash
curl -s https://tomas-tello.stream/api/health   # health check
```
