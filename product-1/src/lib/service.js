const fs = require('fs');
const path = require('path');

function systemdServiceText() {
  const root = path.join(__dirname, '..', '..');
  return `[Unit]\nDescription=Product 1 Scheduler\nAfter=network.target\n\n[Service]\nType=simple\nWorkingDirectory=${root}\nExecStart=/usr/bin/node ${path.join(root, 'src', 'runner.js')} scheduler\nRestart=always\nRestartSec=5\n\n[Install]\nWantedBy=multi-user.target\n`;
}

function writeServiceFile() {
  const out = path.join(__dirname, '..', '..', 'product-1.service.example');
  fs.writeFileSync(out, systemdServiceText());
  return out;
}

module.exports = { systemdServiceText, writeServiceFile };
