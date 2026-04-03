#!/bin/bash
# Product 1 - Dev launcher
# Electron handles the backend automatically

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP="$SCRIPT_DIR/product-1-desktop"

export DISPLAY=:0

echo "Launching Product 1..."
cd "$DESKTOP"
npm run dev
