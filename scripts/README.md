# Scripts

| Script | Run with | What it does |
|---|---|---|
| `sonarqube-scan.sh` | `npm run sonar` | Tests with coverage, SonarQube scan, waits for the analysis, prints open issues by severity |
| `check-coverage.sh` | `npm run test:check-coverage` | Tests with coverage; fails if branch coverage is below 80% |
| `secret-scan.sh` | `.husky/pre-commit` | Blocks a commit whose staged changes contain credential-shaped strings (see `SECURITY.md`) |

## sonarqube-scan.sh

```bash
npm run sonar   # reads SONAR_TOKEN and SONAR_HOST_URL from .env.local when they aren't set

SONAR_HOST_URL=http://localhost:9000 SONAR_TOKEN=your_token ./scripts/sonarqube-scan.sh
```

Needs a reachable SonarQube server. With `sonar-scanner` on the `PATH`
(`brew install sonar-scanner` on macOS) it scans the working tree, committed or not, so you
can fix issues before committing; without it, it skips the scan and reports the last
analysis's issues.

Exit code `1` when BLOCKER, CRITICAL or MAJOR issues are found, or on a script error; `0`
otherwise. The project dashboard is at `$SONAR_HOST_URL/dashboard?id=next-tt-fe`.

## check-coverage.sh

Runs `npm run test:coverage`, reads the branch percentage from the summary and compares it
with 80% (the SonarQube gate). Needs `bc`.
