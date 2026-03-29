const { buildShareBundle } = require('./share');

function buildBundle() {
  return buildShareBundle('0.1.0');
}

module.exports = { buildBundle };
