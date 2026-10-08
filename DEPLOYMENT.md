# Deployment

The site currently runs self-hosted as a single Docker container. This setup will be
replaced by Netlify (see the roadmap in the [README](README.md)).

## Pipeline

A manually triggered workflow (`.gitea/workflows/deploy-dev.yml`, run by a self-hosted
Gitea Actions runner):

1. **Test and analyze:** `npm ci`, `npm test -- --coverage`, SonarQube scan, then the
   SonarQube quality gate. A failing gate stops the deploy.
2. **Build and deploy:** build the image from the `Dockerfile` (Next.js `standalone`
   output, non-root user, read-only files), push it to a private container registry, then
   run `deploy.sh` on the production host over SSH. `deploy.sh` pulls the image and replaces
   the running container.

## Runtime

- The container listens on port 3000; HTTPS is terminated in front of it.
- Settings come from an env file on the host (`.env.production`, read by `deploy.sh`). The names are listed in
  [`.env.production.example`](.env.production.example); `docker-compose.yml` shows the same
  set with defaults.
- Set `USE_SECURE_COOKIES=true` whenever the site is served over HTTPS.
- Logs are written to `LOG_DIR` (a Docker volume in `docker-compose.yml`) as well as stdout.

## GitHub Actions

`.github/workflows/ci.yml` runs lint, typecheck and tests on pull requests and pushes to `main` on
GitHub. It is separate from the deploy pipeline: Gitea Actions only reads
`.github/workflows/` when `.gitea/workflows/` doesn't exist.

## CI secrets

Stored in the CI system, never in the repo: `SONAR_TOKEN`, `SONAR_HOST_URL`,
`SSH_PRIVATE_KEY`, `REGISTRY_USERNAME`, `REGISTRY_TOKEN`.

## Troubleshooting

```bash
docker logs -f next-tt            # follow the app's logs on the host
./deploy.sh                       # re-run the deploy by hand on the host
curl -s localhost:3000/api/health # health check
```
