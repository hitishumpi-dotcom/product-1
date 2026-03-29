const { loadConfig, saveConfig, loadStatus, saveStatus } = require('./config');

function checkForUpdates() {
  const config = loadConfig();
  const status = loadStatus();
  const latestVersion = config.update.latestVersion || config.version || '0.1.0';
  const currentVersion = config.update.currentVersion || config.version || '0.1.0';
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
