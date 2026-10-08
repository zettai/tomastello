# Proceed — Formalize Feature

The user has approved the current code changes. Run the quality gates before their smoke
test. Work autonomously and only stop for a blocker you cannot resolve.

## Steps (in order, none skipped)

### 1. Find the changed files
`git diff --name-only HEAD` plus `git ls-files --others --exclude-standard` for new files.
Focus on `.ts`/`.tsx` under `src/`.

### 2. Lint
`npm run lint`. Fix every error. ESLint is the local stand-in for Sonar; see "ESLint mirrors
Sonar" in `AGENTS.md`.

### 3. Tests and coverage
`npm test`. Note any failures, and the branch coverage overall and for each changed file.

### 4. SonarQube
`npm run sonar` (reads `SONAR_TOKEN`/`SONAR_HOST_URL` from `.env.local`; same scan as CI).
Collect BLOCKER, HIGH and MEDIUM issues in the changed files and fix them. If Sonar flags a
rule ESLint missed, add the equivalent rule to the alignment block in `eslint.config.mjs`.

If `npm run sonar` can't reach the server, say so and continue with lint and tests only.
Don't report the Sonar gate as passed.

### 5. Tests up to the gate
Write or update co-located tests until the changed files reach **≥ 80% branch coverage**,
following the existing patterns and the naming in `AGENTS.md`.

### 6. Loop until clean
Re-run lint, `npm test` and `npm run sonar`. Repeat steps 2–5 until lint is clean, tests
pass, the changed files are at ≥ 80% branch coverage, and the gate shows no
BLOCKER/HIGH/MEDIUM issues in them.

### 7. Report
- Files changed (source and tests)
- Branch coverage: overall and for the changed files
- Sonar: gate status and what was fixed (or "not run" with the reason)
- End with: "Ready for smoke test. Run /ship after you verify."

## Rules
- Never commit or push.
- Don't ask for confirmation mid-way unless truly blocked.
