const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function buildBundle() {
  const root = path.join(__dirname, '..', '..');
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const out = path.join(dist, 'product-1.tar.gz');
  execFileSync('tar', ['-czf', out, '--exclude=node_modules', '--exclude=data', '-C', root, '.']);
  return out;
}

module.exports = { buildBundle };
