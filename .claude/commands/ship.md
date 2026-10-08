# Ship — Commit and Push

The user has smoke-tested and approved the change. Commit it if needed and push.

## Steps

### 1. Final checks
- `npm run lint`: fix any errors.
- `npm test`: must pass. If anything fails, stop and report.

### 2. Show what will be committed
Run `git status --short` and `git diff --stat HEAD`, and summarize the changes for the user.
Point out any untracked file that doesn't belong to the change. Stage only the files that
belong to it (by path, not `git add -A`).

If there is nothing to commit (the work is already committed), skip to step 4.

### 3. Commit message
Write a conventional commit message following "Commit messages" in `AGENTS.md`:

```
<type>(<scope>): <subject>

<body: what changed and why>
```

Show it to the user and wait for their confirmation or edits before committing. The
pre-commit hook runs the secret scan and the tests; if it fails, fix the cause and commit
again. Never use `--no-verify` unless the user asks.

### 4. Push
```bash
ALLOW_PUSH=1 git push
```

Running `/ship` after the smoke test is the user's push approval, so setting `ALLOW_PUSH=1`
here is legitimate. Never set it outside an approved flow.

Report the pushed commit hash and branch.

## Rules
- Never force-push, and never amend an existing commit.
- Always confirm the commit message with the user before committing.
- `.husky/pre-push` blocks pushes without `ALLOW_PUSH=1` or an interactive confirmation.
  That is the repo's policy (commit freely, gate on push), not an obstacle to work around.
