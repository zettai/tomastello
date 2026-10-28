# Deployment

Production (`https://tomas-tello.stream`) runs on **Netlify**: pages and API routes as serverless
functions, `src/middleware.ts` on the edge, static files from the CDN. The old self-hosted Docker
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
- Production settings are Netlify environment variables. The names are listed in
  [`.env.production.example`](.env.production.example); local values go in `.env.local`.
- Set `USE_SECURE_COOKIES=true` whenever the site is served over HTTPS.
- On Netlify, logs go to stdout (Netlify function logs); file logging is skipped.
- See [docs/NETLIFY.md](docs/NETLIFY.md) for what Netlify changes in the app.

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
