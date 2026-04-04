const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { fork } = require('child_process');
const log = require('electron-log/main');
const { loadFirstRunState, completeFirstRun } = require('./first-run');

log.initialize();
log.transports.file.level = 'info';

const APP_NAME = 'Product 1 Desktop';
const BACKEND_PORT = Number(process.env.PRODUCT1_PORT || 4311);
const SERVER_URL = `http://127.0.0.1:${BACKEND_PORT}`;

let mainWindow = null;
let backendProcess = null;
let isQuitting = false;
let backendReady = false;

function resolveBackendRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend');
  }
  return path.resolve(__dirname, '..', '..', 'product-1');
}

function getServerEntry() {
  return path.join(resolveBackendRoot(), 'src', 'server.js');
}

function resolveBundledPlaywrightExecutable() {
  const backendRoot = resolveBackendRoot();
  const browsersPath = path.join(backendRoot, 'node_modules', 'playwright-core', '.local-browsers');
  if (!fs.existsSync(browsersPath)) return undefined;
  const chromiumDirs = fs.readdirSync(browsersPath).filter(d => d.startsWith('chromium-')).sort().reverse();
  for (const dir of chromiumDirs) {
    const candidates = [
      path.join(browsersPath, dir, 'chrome-win', 'chrome.exe'),
      path.join(browsersPath, dir, 'chrome-linux64', 'chrome'),
      path.join(browsersPath, dir, 'chrome-linux', 'chrome'),
      path.join(browsersPath, dir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
    ];
    const found = candidates.find(c => fs.existsSync(c));
    if (found) return found;
  }
  return undefined;
}

function ensureBackendExists() {
  const serverEntry = getServerEntry();
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Backend entry not found: ${serverEntry}`);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 920,
    minWidth: 1100,
    minHeight: 760,
    autoHideMenuBar: true,
    show: false,
    title: APP_NAME,
    backgroundColor: '#0b1020',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'loading.html'));
}

function updateLoadingState(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('backend-status', {
    serverUrl: SERVER_URL,
    ...payload,
  });
}

function waitForServer(url, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();

    const attempt = () => {
      const req = http.get(`${url}/api/status`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve(true);
          return;
        }
        retry(new Error(`Unexpected status code ${res.statusCode}`));
      });

      req.on('error', retry);
      req.setTimeout(2500, () => req.destroy(new Error('Request timed out')));
    };

    const retry = (error) => {
      if (Date.now() - started >= timeoutMs) {
        reject(error);
        return;
      }
      setTimeout(attempt, 700);
    };

    attempt();
  });
}

async function launchBackend() {
  if (backendProcess && !backendProcess.killed) {
    return;
  }

  ensureBackendExists();
  const backendRoot = resolveBackendRoot();
  const serverEntry = getServerEntry();
  const userDataRoot = path.join(app.getPath('userData'), 'product-1-runtime');
  fs.mkdirSync(userDataRoot, { recursive: true });
  const bundledPlaywrightExecutable = resolveBundledPlaywrightExecutable();
  const env = {
    ...process.env,
    PORT: String(BACKEND_PORT),
    PRODUCT1_DESKTOP_WRAPPER: '1',
    PRODUCT1_USER_DATA: userDataRoot,
    ...(bundledPlaywrightExecutable ? { PRODUCT1_PLAYWRIGHT_EXECUTABLE_PATH: bundledPlaywrightExecutable } : {}),
  };

  log.info('Launching backend', { backendRoot, serverEntry, port: BACKEND_PORT, packaged: app.isPackaged });
  updateLoadingState({ phase: 'starting', detail: 'Launching local Product 1 server…' });

  backendProcess = fork(serverEntry, [], {
    cwd: backendRoot,
    env,
    stdio: 'pipe'
  });

  backendProcess.stdout?.on('data', (chunk) => {
    const line = chunk.toString().trim();
    if (line) log.info(`[backend] ${line}`);
  });

  backendProcess.stderr?.on('data', (chunk) => {
    const line = chunk.toString().trim();
    if (line) log.error(`[backend] ${line}`);
  });

  backendProcess.on('exit', (code, signal) => {
    const detail = `Backend stopped${code !== null ? ` (code ${code})` : ''}${signal ? ` signal ${signal}` : ''}`;
    log.warn(detail);
    backendProcess = null;
    backendReady = false;
    if (!isQuitting) {
      updateLoadingState({ phase: 'error', detail, serverUrl: SERVER_URL });
    }
  });

  await waitForServer(SERVER_URL);
  backendReady = true;
  updateLoadingState({ phase: 'ready', detail: 'Server is ready. Opening Product 1…' });
}

async function openMainExperience() {
  const firstRun = loadFirstRunState();
  if (!firstRun.completed) {
    await mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'welcome.html'));
    return;
  }
  await mainWindow.loadURL(SERVER_URL);
}

async function boot() {
  createWindow();
  try {
    await launchBackend();
    if (mainWindow && !mainWindow.isDestroyed()) {
      await openMainExperience();
    }
  } catch (error) {
    log.error('Boot failed', error);
    updateLoadingState({ phase: 'error', detail: error.message, serverUrl: SERVER_URL });
  }
}

ipcMain.handle('app:get-meta', () => ({
  appName: APP_NAME,
  backendPort: BACKEND_PORT,
  backendRoot: resolveBackendRoot(),
  serverUrl: SERVER_URL,
  isPackaged: app.isPackaged,
  backendReady,
  firstRun: loadFirstRunState(),
}));

ipcMain.handle('app:open-external', async (_event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('app:reload-product', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };
  await mainWindow.loadURL(SERVER_URL);
  return { ok: true };
});

ipcMain.handle('app:complete-first-run', async () => {
  completeFirstRun();
  return { ok: true };
});

app.whenReady().then(boot);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await boot();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill('SIGTERM');
  }
});
