const { loadConfig, saveConfig, loadStatus, saveStatus } = require('./config');
const { readLocalVersion } = require('./version');
const { readRemoteManifest } = require('./updater');

function checkForUpdates() {
  const config = loadConfig();
  const status = loadStatus();
  const local = readLocalVersion();
  const remote = readRemoteManifest(config.update.remoteManifestPath);
  const latestVersion = (remote && remote.version) || config.update.latestVersion || local.version || '0.1.0';
  const currentVersion = config.update.currentVersion || local.version || '0.1.0';
  const updateAvailable = latestVersion !== currentVersion;

  config.update.currentVersion = currentVersion;
  config.update.latestVersion = latestVersion;
  config.update.updateAvailable = updateAvailable;
  saveConfig(config);

  status.update = {
    currentVersion,
    latestVersion,
    updateAvailable,
    lastCheckedAt: new Date().toISOString(),
  };
  saveStatus(status);
  return status.update;
}

module.exports = { checkForUpdates };
