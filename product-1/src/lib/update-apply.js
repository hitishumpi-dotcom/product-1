const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadConfig, loadStatus, saveStatus } = require('./config');
const { fetchText, downloadFile } = require('./http');

const ROOT = path.join(__dirname, '..', '..');
const TMP_DIR = path.join(ROOT, 'tmp');
const BACKUP_DIR = path.join(ROOT, 'backups');

function compareVersions(a, b) {
  const pa = String(a).split('.').map(n => Number(n));
  const pb = String(b).split('.').map(n => Number(n));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const av = pa[i] || 0;
    const bv = pb[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

async function fetchManifest(manifestUrl) {
  const raw = await fetchText(manifestUrl);
  return JSON.parse(raw);
}

function backupCurrent() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(BACKUP_DIR, `product-1-${stamp}.tar.gz`);
  execFileSync('tar', ['-czf', out, '--exclude=node_modules', '--exclude=dist', '--exclude=tmp', '-C', ROOT, '.']);
  return out;
}

async function applyUpdateFromManifestUrl(manifestUrl) {
  const status = loadStatus();
  const config = loadConfig();
  const manifest = await fetchManifest(manifestUrl);
  if (!manifest.version || !manifest.bundleUrl) {
    throw new Error('Manifest missing version or bundleUrl');
  }

  const currentVersion = config.update.currentVersion || '0.1.0';
  if (compareVersions(manifest.version, currentVersion) <= 0) {
    return { ok: true, updated: false, summary: 'Already up to date', manifest };
  }

  fs.mkdirSync(TMP_DIR, { recursive: true });
  const backupPath = backupCurrent();
  const bundlePath = path.join(TMP_DIR, 'update.tar.gz');
  await downloadFile(manifest.bundleUrl, bundlePath);
  execFileSync('tar', ['-xzf', bundlePath, '-C', ROOT, '--strip-components=0']);

  config.update.currentVersion = manifest.version;
  if (manifest.manifestUrl) config.update.remoteManifestPath = manifest.manifestUrl;
  status.update = {
    currentVersion: manifest.version,
    latestVersion: manifest.version,
    updateAvailable: false,
    lastCheckedAt: new Date().toISOString(),
  };
  saveStatus(status);

  return {
    ok: true,
    updated: true,
    version: manifest.version,
    backupPath,
    bundlePath,
    summary: `Updated to ${manifest.version}`,
  };
}

module.exports = { compareVersions, fetchManifest, backupCurrent, applyUpdateFromManifestUrl };
