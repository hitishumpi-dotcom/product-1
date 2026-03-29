#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo "[Product 1] test install"
npm install --no-fund --no-audit
echo "Run app: npm start"
echo "Prepare share bundle: npm run prepare:share"
echo "Start test update server: npm run test:update-server"
