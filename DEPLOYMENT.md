# Deployment

Production (`https://tomas-tello.stream`) runs on **Netlify**: pages and API routes as serverless
functions, `src/middleware.ts` on the edge, static files from the CDN. The old self-hosted Docker
container is gone; there is no CI deploy and no container registry any more.

## How a release ships

Deploys are done **from the command line**, not by a git push: the Netlify site is not linked to
the GitHub repo. After an approved push to `main`, the owner runs a script that wraps
`netlify deploy --prod` against this checkout (the Netlify CLI is a devDependency). Nothing in
`.github/workflows` deploys.

If the site is ever linked to GitHub, first set Netlify's environment-variable site policy to
"Require approval" or "Deploy without sensitive variables". This repo is public, and fork pull
requests would otherwise build with production secrets.

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
