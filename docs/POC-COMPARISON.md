# POC comparison

Written 2026-10-03 after an overnight run. Everything below was built and tested locally (a
production build against a moto S3 stub, Docker 29 for the image and deploy script). Nothing
touched the live site, the real bucket or real accounts. Branch heads are listed at the end.

## The options

| | **A. Today** (`main`) | **B. GitHub-only** (`poc/github-only`) | **C. Netlify** (`poc/netlify`) |
|---|---|---|---|
| Code & CI | Gitea + self-hosted runner | GitHub + GitHub-hosted runners | GitHub + GitHub-hosted runners |
| Image / build | Docker image → LAN registry | Docker image → GHCR (manual workflow) | Netlify builds from GitHub |
| Hosting | Docker on the home server | Docker on the home server (unchanged) | Netlify functions + edge + CDN |
| Deploy | Runner SSHes in, `deploy.sh` (push) | Server polls GHCR, `pull-deploy.sh` (pull) | Automatic per push to the chosen branch |
| Uploads | Relay through the API | Relay or presigned (`poc/presigned-uploads`) | Presigned (required) |

Both POCs are built on `poc/presigned-uploads`, so the upload work is shared.

## A prerequisite for both: `poc/presigned-uploads`

**What changed:** `UPLOAD_MODE=relay|presigned` (default `relay`). In presigned mode the browser
uploads photos and audio parts straight to the bucket through 5-minute signed URLs; the API only
signs and registers. The server picks keys, signs size and type, and reads real sizes from the
bucket afterwards. The chunk-size env mismatch is fixed. CORS rules are in `docs/UPLOADS.md`.

**Done vs stubbed:** code complete, 559 tests. The sanity check found and fixed one real bug: the
SDK put an empty-body checksum in the signed URLs, which a strict bucket would reject. Not
verified: that Scaleway enforces the signed `Content-Length` (moto doesn't check signatures).

**Should it go to production regardless? Yes.** With `UPLOAD_MODE` unset it behaves as today
(relay), so it can ship to the current host first. Flip to `presigned` after adding the bucket
CORS rules; flip back if anything misbehaves. It also tightens key handling on the existing
relay routes (`part`, `abort` and `complete` used to accept any key) and records real object
sizes.

## `fix/audit-minors` (independent, from `main`)

Health endpoint tells the truth, keyboard access to the about text, API docs hidden in
production, README claims corrected. It also fixes something more serious than a minor:
**registration was open unless `ALLOW_NEW_REGISTRATIONS` was exactly `"false"`** (compose
defaulted it to `true`), and every account is a full admin.

**Should it go to production regardless? Yes, first.** Before deploying, check that the
production env file either sets `ALLOW_NEW_REGISTRATIONS=false` or leaves it out (both now
mean closed). It merges into the other branches with only small conflicts (adjacent lines in
`docker-compose.yml`, the per-branch `docs/PROGRESS.md`, and on `poc/netlify` the register
route).

## B. GitHub-only

**What changed:** a manual workflow builds and pushes the image to GHCR; the server runs
`deploy/pull-deploy.sh` from a systemd timer (pull, health check, rollback, skip known-bad
images, `flock`). Gitea workflow and `deploy.sh` removed on this branch.

**Done vs stubbed:** code complete. The deploy script passed an end-to-end test with a local
registry (update, rollback, skip, overlap, adopting an old-style container), and the real app
image deployed through it. Testing found two bugs, both fixed: untagged images are
garbage-collected (rollback failed), and a broken image caused an outage every 5 minutes. Not
done: GHCR package visibility, systemd install on the server, SonarQube in CI.

**Measured locally:**
- Image build 168 s; image 394 MB unpacked (`node:20-alpine` + standalone output).
- Deploy through the script 2.7 s end to end; container cold start ≈ 0.9 s.
- Downtime per deploy: a few seconds (container replaced, same as today).

**Needs real-world measuring:** none in particular; page speed stays what it is today.

**Ops burden left with you:** the server itself (OS updates, Docker, disk, power, home
connection and TLS in front of it), the systemd timer, keeping SonarQube local (or SonarCloud).
Less than today: no Gitea, no LAN registry, no runner, no CI-held SSH key.

**Rollback:** the timer adopts the running container, and every deploy keeps `next-tt:rollback`.
Undoing the whole move means pushing to Gitea again; nothing on the server prevents running
`deploy.sh` by hand.

## C. Netlify

**What changed:** `netlify.toml` (Next.js runtime, Node 22, legacy peer deps), standalone only
outside Netlify, presigned uploads by default. Two things serverless needs that the current app
lacked:
- **Concurrent saves:** JSON documents are written with `If-Match` on the ETag that was read,
  retried with jittered backoff, then 409. Test: 25 simultaneous link saves → **25 stored**. The
  same test on the current code: **25 acknowledged, 1 stored**. (This race exists on today's
  single container too, under concurrent requests.)
- **Shared rate limits:** upload counters moved from per-instance memory to the bucket. File
  logging is skipped on Netlify.

**Done vs stubbed:** code complete, 610 tests. `NETLIFY=true next build` succeeds and Netlify's
offline build bundles the server function (25 MB zipped). Not verified here: the edge-function
bundle (needs a Deno download this sandbox blocks), whether Scaleway supports conditional
writes (it falls back safely if it answers `NotImplemented`), and a real deploy. `PUT /api/site`
still replaces the whole document: two admins editing at once means the last save wins.

**Measured locally:** standalone server cold start 0.57–0.64 s (5 runs); a 55 MB audio upload to
the stub took 1.1–1.8 s presigned vs 1.4 s relayed (same machine, so this only shows that both
paths work).

**Needs real-world measuring:**
- TTFB and LCP of `/` from where your visitors are, Netlify vs the current host. The public page
  is client-rendered (it fetches `/api/site` after load), so LCP depends on a function call
  either way. Server rendering plus CDN caching (as in rowennkalman) would be the follow-up that
  makes Netlify clearly faster; it isn't part of this POC.
- Function cold starts on Netlify (seconds at worst, on the first request after idle).
- Cost: Netlify's plan limits (bandwidth, function invocations and run time, build minutes) for
  your traffic. Audio and images are served from the bucket, not Netlify, so bandwidth through
  Netlify is pages and scripts only. Check the current pricing page; plans changed recently.

**Ops burden left with you:** Netlify site settings and env vars, bucket CORS, DNS. No server,
no Docker, no TLS. Logs are Netlify function logs (retention depends on the plan).

**Rollback:** one click to any previous Netlify deploy; DNS back to the home server if you leave
Netlify. The self-hosted pipeline keeps working from `main` until you switch.

## Recommendation

1. **Ship `fix/audit-minors` to production now** (after the `ALLOW_NEW_REGISTRATIONS` check),
   then **`poc/presigned-uploads` in relay mode** (no behaviour change). Add the bucket CORS
   rules, switch to `presigned` and try a big upload; switch back if needed.
2. **Port `jsonStore` (optimistic concurrency) to production too**, whichever hosting you pick:
   the lost-update race is real on the current container. It needs Scaleway to support
   conditional writes, so check that first (checklist item).
3. **Then trial Netlify** on a preview with a test bucket and measure TTFB/LCP against the live
   site. It removes the most ops work, and the code is ready. If the numbers or the cost aren't
   convincing, **GitHub-only** is the low-risk middle step: same hosting, Gitea and the LAN
   registry gone, safer pull-based deploys.

## Branch heads at time of writing

| Branch | Head | Tests |
|---|---|---|
| `poc/presigned-uploads` | `9d90e96` | 559 passed; statements 95.1%, branches 86.0% |
| `fix/audit-minors` | `9dae638` | 462 passed; statements 94.7%, branches 83.2% |
| `poc/github-only` | `76359eb` | 559 passed (app code as presigned) |
| `poc/netlify` | see `git log` (this file is on it) | 610 passed; statements 95.7%, branches 87.8% |
