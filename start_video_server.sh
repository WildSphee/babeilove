#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Starting memory video export server on http://127.0.0.1:5050"
echo ""
echo "Add this to your nginx config so the frontend button works:"
echo ""
echo "  location /api/ {"
echo "      proxy_pass http://127.0.0.1:5050/api/;"
echo "      proxy_read_timeout 600;"
echo "  }"
echo ""

poetry run python -m backend.video_server
