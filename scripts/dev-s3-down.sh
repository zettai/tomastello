#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if command -v podman >/dev/null 2>&1; then
  podman compose -f docker-compose.dev.yml down || true
elif command -v docker >/dev/null 2>&1; then
  docker compose -f docker-compose.dev.yml down || true
fi

if [[ -f .data-dev/moto.pid ]]; then
  kill "$(cat .data-dev/moto.pid)" 2>/dev/null || true
  rm -f .data-dev/moto.pid
fi
