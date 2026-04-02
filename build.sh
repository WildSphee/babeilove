#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"
python3 -m backend.sync_memories_export

cd "$(dirname "$0")/frontend"
npm run build
