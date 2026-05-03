#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT_DIR"

cleanup() {
  echo ""
  echo "Stopping all services..."
  kill "$VIDEO_PID" "$BOT_PID" 2>/dev/null || true
  wait "$VIDEO_PID" "$BOT_PID" 2>/dev/null || true
  echo "All services stopped."
  exit 0
}

trap cleanup SIGTSTP SIGINT SIGTERM

echo "Starting memory video export server on http://127.0.0.1:5050"
(
  cd "$ROOT_DIR"
  if [ -x "$ROOT_DIR/venv/bin/python" ]; then
    exec "$ROOT_DIR/venv/bin/python" -m backend.video_server
  fi
  if command -v poetry >/dev/null 2>&1; then
    exec poetry run python -m backend.video_server
  fi
  echo "No project Python found. Expected ./venv/bin/python or poetry."
  exit 1
) &
VIDEO_PID=$!

echo "Starting Telegram bot..."
(
  cd "$ROOT_DIR"
  if [ -x "$ROOT_DIR/venv/bin/python" ]; then
    exec "$ROOT_DIR/venv/bin/python" -m backend.memory_bot
  fi
  if command -v poetry >/dev/null 2>&1; then
    exec poetry run python -m backend.memory_bot
  fi
  echo "No project Python found. Expected ./venv/bin/python or poetry."
  exit 1
) &
BOT_PID=$!

echo ""
echo "Both services running. Press Ctrl+Z (or Ctrl+C) to stop all."
echo "  Video server PID: $VIDEO_PID"
echo "  Bot PID:          $BOT_PID"
echo ""

wait "$VIDEO_PID" "$BOT_PID"
