# AGENTS.md

Guidance for AI coding agents working in this repo. Human-facing overview: `README.md`.

## Project

Official website of **Tomás Tello** (musician/DJ), live at `tomas-tello.stream`. Next.js 15
(App Router, `src/app`), React 18, TypeScript strict, Tailwind, retro/terminal look
(`retro-window`, `retro-title-bar`, `admin-window` CSS classes). A public page and a
protected `/admin` panel.

## Commands

```bash
npm run dev                     # dev server (Turbopack)
npm run build                   # production build
npm run lint                    # ESLint
npm run typecheck               # tsc --noEmit (tests included)
npm test                        # all tests + coverage
npx jest src/lib/auth.test.ts   # one test file
npm run a11y                    # pa11y-ci WCAG 2.1 AA scan (dev server must be running)
npm run sonar                   # SonarQube scan + quality gate (same as CI)
```

## Architecture

- **No database.** All persistent data is JSON in a Scaleway (S3-compatible) bucket. The S3
  client is in `src/lib/api.ts`. Bucket layout: `auth/users.json`,
  `metadata/{site,images,audios}.json`, `metadata/{security-events,system-lock}.json`,
  `images/`, `audio/`.
- **Auth:** a custom JWT cookie (`auth-token`), checked by `middleware.ts` and by each route
  via `verifyToken()` in `src/lib/auth.ts`. `JWT_SECRET` is required (no fallback: without
  it, sign-in fails and every token is rejected). Registration is gated by
  `ALLOW_NEW_REGISTRATIONS`.
- **API routes** (`src/app/api/`) read and write bucket JSON through the lib helpers and
  return `NextResponse.json()`. Groups: `auth`, `images`, `audio` (including multipart
  upload), `site`, `links`, `admin/security`, `health`, `swagger` (OpenAPI from JSDoc).
- **Pages:** `/` (public, client-rendered from `/api/site`), `/admin` (auth checked
  client-side via `/api/auth/profile`), `/login` (magic link), `/swagger`.
- **Libs** (`src/lib/`): `api` (S3), `auth`, `metadata`, `audioMetadata`
  (track `order`), `site`, `links`, `rateLimiter` + `securityEvents` + `notifier` (upload
  limits, lock, Resend alerts), `logger`, `swagger`.
- **Layout:** components in `src/components/`, types in `src/types/`, tests co-located as
  `*.test.ts[x]`.

## Direction: Netlify migration (planned)

Hosting will move from a self-hosted Docker container to Netlify serverless functions. Don't
make that move harder:

- Netlify functions reject request bodies over **6 MB**. New upload code must send files
  straight from the browser to the bucket with presigned URLs, never through an API route.
- Don't add new state held in module-level variables; serverless instances don't share or
  keep it.
- Middleware runs in the edge runtime: use `jose` there, not Node-only libraries.

## Environment

The names of all settings are in `.env.production.example`. Local values go in
`.env.local` (gitignored). When you add a variable: add its name and a comment to
`.env.production.example`, and to `docker-compose.yml` with a sensible default.
`NEXT_PUBLIC_*` variables are inlined at build time. **Never commit secret values.**

## Testing and quality gates

- **Branch coverage ≥ 80%** is the real gate (SonarQube quality gate). Jest's 60% threshold
  in `jest.config.js` is only a floor. Aim for 80%+ branch coverage on every change,
  especially in auth and API code.
- Setup: `jest.setup.ts` (jest-dom, `jest-axe`'s `toHaveNoViolations`, `next/server`
  mock) and `src/test/setup.ts`. Key page tests assert no axe violations.
- Test names: `should <behavior> when <condition>`, grouped with `describe`. Mock external
  services (S3, Resend).
- `npm run sonar` (`scripts/sonarqube-scan.sh`) reads `SONAR_TOKEN` and `SONAR_HOST_URL`
  from `.env.local`. The quality gate must be OK; fix BLOCKER/HIGH issues (and MEDIUM where
  possible) before committing.
- **ESLint mirrors Sonar:** rules that Sonar enforces but `next/core-web-vitals` doesn't
  live in the "SonarQube alignment" block of `eslint.config.mjs`. When Sonar flags something
  ESLint missed, add the equivalent rule there as `"error"` and confirm `npm run lint`
  catches it.

## Code style

TypeScript strict; explicit types, no `any` outside tests. Small focused functions, JSDoc on
exported APIs, and a `@swagger` JSDoc block on API routes. React: function components and
hooks; `useMemo`/`useCallback` where they matter.

## Workflow

Feature lifecycle: **describe → plan → code → manual test → `/proceed` → smoke test →
`/ship`.**

- `/proceed`: lint, test and Sonar the change, fix issues, and bring coverage up to the gate.
  Never commits.
- `/ship`: final checks, commit (the user confirms the message), push.
- Bugs: write a failing test first → fix → verify → Sonar → user validation → `fix` commit.
- Other commands (`.claude/commands/`): `/sonar-check` (changed files), `/sonar-full`,
  `/a11y`.

**Commit messages:** `<type>(<scope>): <subject>`, plus a body explaining what and why.
Types: `feat fix docs style refactor test chore perf`. Scope is the area changed (`auth`,
`api`, `ui`, `admin`, `audio`, `images`, `config`, `deps`). Imperative mood, capitalized
subject of 50 characters or fewer, no trailing period.

## Hard rules

- **Commit freely; gate on push.** Commit progress without asking. Don't `git push` without
  the user's explicit approval: a push triggers CI. `.husky/pre-push` enforces this; it
  passes only with `ALLOW_PUSH=1` (set only in an approved flow such as `/ship`) or an
  interactive confirmation.
- **No secret values in git.** `.husky/pre-commit` runs `scripts/secret-scan.sh` and then
  the tests. See `SECURITY.md`.
- Keep the coverage and quality gates green. Follow existing patterns; ask when unsure.
- The repo is the source of truth: anything an agent learns that matters goes into this
  file or `docs`, not only into an agent's memory.

## Deployment

Currently a Docker image built by a manually triggered CI workflow and deployed to a
self-hosted server: see `DEPLOYMENT.md`.
