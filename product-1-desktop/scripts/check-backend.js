const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..', '..', 'product-1');
const backendPackage = path.join(backendRoot, 'package.json');
const backendNodeModules = path.join(backendRoot, 'node_modules');

if (!fs.existsSync(backendPackage)) {
  console.warn('[product-1-desktop] Warning: ../product-1/package.json was not found. Installer builds will fail until the backend exists.');
  process.exit(0);
}

if (!fs.existsSync(backendNodeModules)) {
  console.warn('[product-1-desktop] Warning: ../product-1/node_modules is missing. Run `cd ../product-1 && npm install` before packaging.');
  process.exit(0);
}

console.log('[product-1-desktop] Backend detected.');
