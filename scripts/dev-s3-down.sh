#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if command -v podman >/dev/null 2>&1; then
  podman compose -f docker-compose.dev.yml down
elif command -v docker >/dev/null 2>&1; then
  docker compose -f docker-compose.dev.yml down
else
  echo "Need podman or docker" >&2
  exit 1
fi
