# SonarQube — Check Changed Files

Run a full SonarQube scan (identical to CI) and report issues on changed files only.

## Steps

1. Run `git diff --name-only HEAD` and `git ls-files --others --exclude-standard` to list the changed and new source files.

2. Run `npm run sonar` and capture full output. This runs `sonar-scanner` against the SonarQube server in `SONAR_HOST_URL`, the same toolchain as CI.

3. From the scan output, filter and show only issues in the changed files:
```
✅ src/lib/auth.ts — no issues
❌ src/components/SongPlayer.tsx — 1 issue:
   [BLOCKER] Line 34: Media elements must have a <track> for captions
```

4. Also report the Quality Gate status (PASSED / FAILED).

5. If issues are found, ask if you should fix them now.

## Notes

- `npm run sonar` reads `SONAR_TOKEN` and `SONAR_HOST_URL` from `.env.local`, so no manual export is needed. If the server can't be reached, say so; never report the gate as passed.
- The scanner uploads results to SonarQube and polls until analysis is complete before reporting.
- To see all project issues (not just changed files), use `/sonar-full`.
