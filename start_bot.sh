#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v poetry >/dev/null 2>&1; then
  echo "poetry is required to start the Telegram bot"
  exit 1
fi

cd "$ROOT_DIR"
poetry run python -m backend.memory_bot
