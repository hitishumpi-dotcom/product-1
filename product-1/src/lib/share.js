const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, DIST_DIR, TEST_RELEASES_DIR } = require('./paths');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function buildShareBundle(version = '0.1.0') {
  ensureDir(DIST_DIR);
  const out = path.join(DIST_DIR, `product-1-${version}.tar.gz`);
  execFileSync('tar', [
    '-czf', out,
    '--exclude=node_modules',
    '--exclude=data',
    '--exclude=tmp',
    '--exclude=backups',
    '--exclude=dist',
    '--exclude=test-releases',
    '-C', ROOT,
    '.'
  ]);
  return out;
}

function buildTestRelease(version = '0.2.0') {
  ensureDir(TEST_RELEASES_DIR);
  const out = path.join(TEST_RELEASES_DIR, `product-1-${version}.tar.gz`);
  execFileSync('tar', [
    '-czf', out,
    '--exclude=node_modules',
    '--exclude=data',
    '--exclude=tmp',
    '--exclude=backups',
    '--exclude=dist',
    '--exclude=test-releases',
    '-C', ROOT,
    '.'
  ]);
  return out;
}

module.exports = { buildShareBundle, buildTestRelease };
