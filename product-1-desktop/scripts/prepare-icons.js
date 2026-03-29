#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(assetsDir, { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="40" fill="#111827"/><circle cx="128" cy="128" r="72" fill="#22c55e"/><text x="128" y="145" font-size="72" text-anchor="middle" fill="#052e16" font-family="Arial">P1</text></svg>`;
fs.writeFileSync(path.join(assetsDir, 'icon.svg'), svg);
console.log(path.join(assetsDir, 'icon.svg'));
