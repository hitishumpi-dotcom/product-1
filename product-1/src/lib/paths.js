const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const STORAGE_ROOT = process.env.PRODUCT1_USER_DATA
  ? path.resolve(process.env.PRODUCT1_USER_DATA)
  : ROOT;
const DIST_DIR = path.join(STORAGE_ROOT, 'dist');
const DATA_DIR = path.join(STORAGE_ROOT, 'data');
const TMP_DIR = path.join(STORAGE_ROOT, 'tmp');
const BACKUP_DIR = path.join(STORAGE_ROOT, 'backups');
const TEST_RELEASES_DIR = path.join(STORAGE_ROOT, 'test-releases');

module.exports = {
  ROOT,
  STORAGE_ROOT,
  DIST_DIR,
  DATA_DIR,
  TMP_DIR,
  BACKUP_DIR,
  TEST_RELEASES_DIR,
};
