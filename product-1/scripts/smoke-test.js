#!/usr/bin/env node
const { execFileSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..');

function run(cmd, args) {
  return execFileSync(cmd, args, { cwd: root, stdio: 'pipe' }).toString();
}

console.log(run('node', ['src/runner.js', 'check-updates']));
console.log(run('node', ['scripts/prepare-share.js']));
console.log('smoke-test-ok');
