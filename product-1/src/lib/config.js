const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const STATUS_PATH = path.join(DATA_DIR, 'status.json');
const COOKIE_PATH = path.join(DATA_DIR, 'l2reborn-cookies.json');
const PID_PATH = path.join(DATA_DIR, 'scheduler.pid');

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultConfig() {
  return {
    appName: 'Product 1',
    version: '0.1.0',
    update: {
      currentVersion: '0.1.0',
      latestVersion: '0.1.0',
      updateAvailable: false,
      channel: 'manual',
      remoteManifestPath: ''
    },
    schedule: {
      enabled: false,
      intervalHours: 12,
      autoStartScheduler: false
    },
    l2reborn: {
      email: '',
      password: '',
      gmailAppPass: '',
      serverId: '3',
      account: '',
      characterId: '',
      characterName: '',
      signinUrl: 'https://l2reborn.org/signin/',
      shopUrl: 'https://l2reborn.org/shop/',
      twoCaptchaKey: '',
      turnstileSitekey: '0x4AAAAAAAPFfPxwacy3GCxf'
    },
    notifications: {
      enabled: false,
      channel: 'log',
      target: ''
    }
  };
}

function loadConfig() {
  ensureDataDir();
  if (!fs.existsSync(CONFIG_PATH)) {
    const initial = defaultConfig();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function saveConfig(config) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function loadStatus() {
  ensureDataDir();
  if (!fs.existsSync(STATUS_PATH)) {
    return {
      app: 'Product 1',
      lastRunAt: null,
      lastResult: null,
      lastSummary: 'Not run yet',
      consecutiveFailures: 0,
      schedulerRunning: false,
      schedulerPid: null,
      update: {
        currentVersion: '0.1.0',
        latestVersion: '0.1.0',
        updateAvailable: false,
        lastCheckedAt: null
      }
    };
  }
  return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
}

function saveStatus(status) {
  ensureDataDir();
  fs.writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2));
}

module.exports = {
  ROOT,
  DATA_DIR,
  CONFIG_PATH,
  STATUS_PATH,
  COOKIE_PATH,
  PID_PATH,
  defaultConfig,
  loadConfig,
  saveConfig,
  loadStatus,
  saveStatus,
};
