#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

echo "Starting memory video export server on http://127.0.0.1:5050"
echo ""
echo "Add this to your nginx config so the frontend button works:"
echo ""
echo "  location /api/ {"
echo "      proxy_pass http://127.0.0.1:5050/api/;"
echo "      proxy_read_timeout 600;"
echo "  }"
echo ""

if [ -x "$ROOT_DIR/venv/bin/python" ]; then
  exec "$ROOT_DIR/venv/bin/python" -m backend.video_server
fi

exec poetry run python -m backend.video_server
