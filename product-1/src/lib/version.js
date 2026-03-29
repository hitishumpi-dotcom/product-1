const fs = require('fs');
const path = require('path');

function readLocalVersion() {
  const p = path.join(__dirname, '..', '..', 'version.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

module.exports = { readLocalVersion };
