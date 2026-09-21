#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "$ROOT_DIR"

if [ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != '--setup' ]; }; then
  echo "Usage: $0 [--setup]"
  exit 1
fi

BOT_VENV="$ROOT_DIR/backend/venv"
BOT_PYTHON="$BOT_VENV/bin/python"

if [ ! -x "$BOT_PYTHON" ] && [ -x "$ROOT_DIR/venv/bin/python" ]; then
  BOT_PYTHON="$ROOT_DIR/venv/bin/python"
fi

if [ ! -x "$BOT_PYTHON" ]; then
  if command -v poetry >/dev/null 2>&1; then
    if [ "${1:-}" = '--setup' ]; then
      exec poetry install --no-root
    fi
    exec poetry run python -m backend.memory_bot
  fi

  if ! command -v python3 >/dev/null 2>&1 || ! python3 -c 'import sys; sys.exit(sys.version_info < (3, 12))'; then
    echo "Python 3.12 or newer is required. Install it with its matching venv package, then retry."
    exit 1
  fi

  echo "Creating the bot's Python environment in ./backend/venv..."
  if ! python3 -m venv "$BOT_VENV"; then
    echo "Could not create ./backend/venv. Install the venv package matching your Python (e.g. python3-venv), then retry."
    exit 1
  fi
fi

if [ "${1:-}" = '--setup' ] || ! "$BOT_PYTHON" -c 'import telegram, dotenv, PIL' >/dev/null 2>&1; then
  echo "Installing bot dependencies from pyproject.toml..."
  "$BOT_PYTHON" - <<'PY' | "$BOT_PYTHON" -m pip install -r /dev/stdin
import tomllib
from pathlib import Path

project = tomllib.loads(Path('pyproject.toml').read_text())['project']
print('\n'.join(project['dependencies']))
PY
fi

if [ "${1:-}" = '--setup' ]; then
  echo "Bot environment ready. No bot was started."
  exit 0
fi

exec "$BOT_PYTHON" -m backend.memory_bot
