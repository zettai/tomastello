# SonarQube — Full Project Scan

Run a full SonarQube scan (identical to CI) and report all open issues.

## Steps

1. Run `npm run sonar` and capture full output.

2. Report quality gate status and all issues grouped by severity:
```
Quality Gate: ✅ PASSED

Issues (new code):
  [BLOCKER] src/components/Foo.tsx:12 — ...
  [MAJOR]   src/lib/bar.ts:45 — ...

Total: 2 issues
```

3. If BLOCKER or HIGH issues exist, ask if you should fix them now.

## Notes

- `npm run sonar` reads `SONAR_TOKEN` and `SONAR_HOST_URL` from `.env.local`. If the server can't be reached, say so; never report the gate as passed.
- Uses the same `sonar-scanner` + `sonar-project.properties` as CI — results are identical to the pipeline quality gate.
- Dashboard: `$SONAR_HOST_URL/dashboard?id=next-tt-fe`
