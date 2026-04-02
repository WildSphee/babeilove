#!/bin/bash
set -euo pipefail

git add --all
git commit -m "Auto-update memories"
git push origin

cd "$(dirname "$0")"
python3 -m backend.sync_memories_export

cd frontend
npm run build
