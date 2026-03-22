#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v poetry >/dev/null 2>&1; then
  echo "poetry is required to start the Telegram bot"
  exit 1
fi

cleanup() {
  trap - EXIT INT TERM
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${BOT_PID:-}" ]]; then
    kill "$BOT_PID" 2>/dev/null || true
  fi
  wait "${FRONTEND_PID:-}" "${BOT_PID:-}" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

(
  cd "$ROOT_DIR/frontend"
  npm run dev
) &
FRONTEND_PID=$!

(
  cd "$ROOT_DIR"
  poetry run python -m backend.memory_bot
) &
BOT_PID=$!

wait -n "$FRONTEND_PID" "$BOT_PID"
