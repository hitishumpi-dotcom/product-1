#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run prepare:icons
npm run pack
echo
echo "Built desktop package scaffold in release/"
