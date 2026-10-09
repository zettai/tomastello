#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p .data-dev

started=0
if command -v podman >/dev/null 2>&1; then
  podman compose -f docker-compose.dev.yml up -d && started=1
elif command -v docker >/dev/null 2>&1; then
  docker compose -f docker-compose.dev.yml up -d && started=1
fi
if [ "$started" -eq 0 ]; then
  if command -v moto_server >/dev/null 2>&1; then
    if ! curl -sf "http://127.0.0.1:19000/" >/dev/null 2>&1; then
      nohup moto_server -H 127.0.0.1 -p 19000 >"${ROOT}/.data-dev/moto.log" 2>&1 &
      echo $! >"${ROOT}/.data-dev/moto.pid"
    fi
  else
    echo "Need podman/docker compose or pip install 'moto[server]'" >&2
    exit 1
  fi
fi

# moto listens before seeding; brief wait avoids flaky CreateBucket on cold start
sleep 2
node scripts/dev-s3-seed.mjs
