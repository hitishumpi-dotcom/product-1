const fs = require('fs');
const path = require('path');

function buildReleaseManifest() {
  return {
    name: 'Product 1',
    version: '0.1.0',
    generatedAt: new Date().toISOString(),
    install: 'bash install.sh',
    start: 'npm start'
  };
}

function writeReleaseManifest() {
  const manifest = buildReleaseManifest();
  const out = path.join(__dirname, '..', '..', 'release.json');
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
  return manifest;
}

module.exports = { buildReleaseManifest, writeReleaseManifest };
