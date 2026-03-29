const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DIST_DIR = path.join(ROOT, 'dist');
const DATA_DIR = path.join(ROOT, 'data');
const TMP_DIR = path.join(ROOT, 'tmp');
const BACKUP_DIR = path.join(ROOT, 'backups');
const TEST_RELEASES_DIR = path.join(ROOT, 'test-releases');

module.exports = {
  ROOT,
  DIST_DIR,
  DATA_DIR,
  TMP_DIR,
  BACKUP_DIR,
  TEST_RELEASES_DIR,
};
