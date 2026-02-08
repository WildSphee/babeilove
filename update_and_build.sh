#!/bin/bash
git add --all
git commit -m "Auto-update memories"
git push origin

cd "$(dirname "$0")/frontend"
npm run build
