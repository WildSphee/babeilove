#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to start the frontend dev server"
  exit 1
fi

cd "$ROOT_DIR/frontend"
npm run dev -- --port 5234
