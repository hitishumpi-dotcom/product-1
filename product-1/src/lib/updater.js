const fs = require('fs');
const path = require('path');

function readRemoteManifest(manifestPath) {
  const p = manifestPath || path.join(__dirname, '..', '..', 'remote-version.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

module.exports = { readRemoteManifest };
