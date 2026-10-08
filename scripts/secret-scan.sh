#!/usr/bin/env bash
# Dependency-free secret scan of STAGED changes. Run by the husky pre-commit hook
# before tests. Blocks the commit if staged content looks like it contains a secret.
#
# Rationale: this repo deploys via an UNENCRYPTED Gitea (public-grade). It legitimately
# uses secrets (Scaleway, JWT, Resend, Sonar) but only via env / .env.local — never
# committed. This guards against accidental leaks.
set -euo pipefail

staged=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$staged" ] && exit 0

patterns='(sk-ant-[A-Za-z0-9_-]{20,})|(AKIA[0-9A-Z]{16})|(-----BEGIN [A-Z ]*PRIVATE KEY-----)|(xox[baprs]-[A-Za-z0-9-]{10,})|(ghp_[A-Za-z0-9]{36})|(re_[A-Za-z0-9]{20,})|(eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.)|((SCW_SECRET_KEY|SCW_ACCESS_KEY|JWT_SECRET|RESEND_API_KEY|SONAR_TOKEN|secret|password|passwd|api[_-]?key|access[_-]?key|token)["'"'"' ]*[:=]["'"'"' ]*[A-Za-z0-9/+_-]{16,})'

# Files that legitimately mention secret-shaped words (docs/examples) — skip them.
skip_re='(\.env\.example|\.env\.production\.example|AGENTS\.md|SECURITY\.md|scripts/secret-scan\.sh|\.husky/)'

found=0
while IFS= read -r file; do
  echo "$file" | grep -Eq "$skip_re" && continue
  if git show ":$file" 2>/dev/null | grep -Iq . ; then
    matches=$(git show ":$file" 2>/dev/null | grep -nEi "$patterns" || true)
    if [ -n "$matches" ]; then
      echo "✖ potential secret in: $file"
      echo "$matches" | sed 's/^/    /' | cut -c1-120
      found=1
    fi
  fi
done <<< "$staged"

if [ "$found" -ne 0 ]; then
  cat <<'EOF'

Commit blocked: staged changes look like they contain a secret.
- Real secret: remove it; use an env var (.env.local, gitignored); reference the NAME only.
- False positive: review carefully, then `git commit --no-verify`.
EOF
  exit 1
fi
exit 0
