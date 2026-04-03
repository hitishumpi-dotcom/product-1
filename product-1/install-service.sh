#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
node -e "const {writeServiceFile}=require('./src/lib/service'); console.log(writeServiceFile())"
echo
echo "Generated product-1.service.example"
echo "To install system-wide:"
echo "  sudo cp product-1.service.example /etc/systemd/system/product-1.service"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable --now product-1.service"
