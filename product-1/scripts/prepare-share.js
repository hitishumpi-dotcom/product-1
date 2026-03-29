#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildShareBundle } = require('../src/lib/share');
const { writeReleaseManifest } = require('../src/lib/release');
const { writeServiceFile } = require('../src/lib/service');

const version = process.argv[2] || '0.1.0';
const bundle = buildShareBundle(version);
const release = writeReleaseManifest();
const service = writeServiceFile();

const summary = {
  version,
  bundle,
  releaseManifest: path.join(__dirname, '..', 'release.json'),
  serviceTemplate: service,
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(path.join(__dirname, '..', 'dist', 'share-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
