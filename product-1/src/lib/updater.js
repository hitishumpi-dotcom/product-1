const fs = require('fs');
const path = require('path');
const { fetchText } = require('./http');

function readRemoteManifest(manifestPath) {
  const p = manifestPath || path.join(__dirname, '..', '..', 'remote-version.json');
  if (p.startsWith('http://') || p.startsWith('https://')) return null;
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function readRemoteManifestAsync(manifestPath) {
  if (!manifestPath) {
    const localPath = path.join(__dirname, '..', '..', 'remote-version.json');
    if (!fs.existsSync(localPath)) return null;
    return JSON.parse(fs.readFileSync(localPath, 'utf8'));
  }
  if (manifestPath.startsWith('http://') || manifestPath.startsWith('https://') || manifestPath.startsWith('file://')) {
    try {
      const raw = await fetchText(manifestPath);
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!fs.existsSync(manifestPath)) return null;
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

module.exports = { readRemoteManifest, readRemoteManifestAsync };
