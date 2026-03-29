#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
echo "[Product 1] installing dependencies..."
npm install --no-fund --no-audit
echo "[Product 1] ready"
echo "Run: npm start"
echo "Open: http://localhost:4311"
