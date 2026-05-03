#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT_DIR"

if [ -x "$ROOT_DIR/venv/bin/python" ]; then
  exec "$ROOT_DIR/venv/bin/python" -m backend.memory_bot
fi

if ! command -v poetry >/dev/null 2>&1; then
  echo "No project Python found. Expected ./venv/bin/python or poetry."
  exit 1
fi

exec poetry run python -m backend.memory_bot
