const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { loadStatus, saveStatus, PID_PATH } = require('./config');

function isRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getSchedulerPid() {
  if (!fs.existsSync(PID_PATH)) return null;
  const pid = Number(fs.readFileSync(PID_PATH, 'utf8'));
  return Number.isFinite(pid) ? pid : null;
}

function startScheduler() {
  const current = getSchedulerPid();
  if (isRunning(current)) {
    return { ok: true, alreadyRunning: true, pid: current };
  }

  const child = execFile(process.execPath, [path.join(__dirname, '..', 'runner.js'), 'scheduler'], {
    detached: true,
    stdio: 'ignore',
    cwd: path.join(__dirname, '..', '..'),
  });
  child.unref();
  fs.writeFileSync(PID_PATH, String(child.pid));

  const status = loadStatus();
  status.schedulerRunning = true;
  status.schedulerPid = child.pid;
  saveStatus(status);
  return { ok: true, pid: child.pid };
}

function stopScheduler() {
  const pid = getSchedulerPid();
  if (pid && isRunning(pid)) {
    try { process.kill(pid, 'SIGTERM'); } catch {}
  }
  if (fs.existsSync(PID_PATH)) fs.unlinkSync(PID_PATH);

  const status = loadStatus();
  status.schedulerRunning = false;
  status.schedulerPid = null;
  saveStatus(status);
  return { ok: true, pid };
}

function schedulerStatus() {
  const pid = getSchedulerPid();
  const running = isRunning(pid);
  const status = loadStatus();
  status.schedulerRunning = running;
  status.schedulerPid = running ? pid : null;
  saveStatus(status);
  return { running, pid: running ? pid : null };
}

module.exports = { startScheduler, stopScheduler, schedulerStatus };
