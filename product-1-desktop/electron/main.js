const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { fork, execFile, execSync } = require('child_process');
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

// Playwright bundles the npm package but NOT the browser binaries.
// This installs chromium before first use so votes don't immediately crash.
function ensurePlaywrightBrowsers() {
  return new Promise((resolve) => {
    const backendRoot = resolveBackendRoot();
    const playwrightBin = path.join(backendRoot, 'node_modules', '.bin',
      process.platform === 'win32' ? 'playwright.cmd' : 'playwright');

    if (!fs.existsSync(playwrightBin)) {
      log.warn('Playwright bin not found — skipping browser install check');
      return resolve();
    }

    updateLoadingState({ phase: 'starting', detail: 'Checking browser dependencies…' });
    log.info('Running playwright install chromium...');

    const child = execFile(playwrightBin, ['install', 'chromium'], {
      cwd: backendRoot,
      env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' },
    }, (err, stdout, stderr) => {
      if (err) {
        log.warn('playwright install chromium warning:', stderr || err.message);
      } else {
        log.info('Playwright chromium ready');
      }
      resolve();
    });

    child.stdout?.on('data', chunk => log.info('[playwright-install]', chunk.toString().trim()));
    child.stderr?.on('data', chunk => log.info('[playwright-install]', chunk.toString().trim()));
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
  const env = {
    ...process.env,
    PORT: String(BACKEND_PORT),
    PRODUCT1_DESKTOP_WRAPPER: '1',
    PRODUCT1_USER_DATA: userDataRoot,
  };

  await ensurePlaywrightBrowsers();

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

// Kills and relaunches the backend before reloading the window.
// Previously just reloaded the URL which did nothing if the process had died.
ipcMain.handle('app:reload-product', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };
  await mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'loading.html'));
  try {
    if (backendProcess && !backendProcess.killed) {
      backendProcess.kill('SIGTERM');
      backendProcess = null;
      backendReady = false;
    }
    await launchBackend();
    await mainWindow.loadURL(SERVER_URL);
    return { ok: true };
  } catch (error) {
    log.error('Reload failed', error);
    updateLoadingState({ phase: 'error', detail: error.message, serverUrl: SERVER_URL });
    return { ok: false, error: error.message };
  }
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
