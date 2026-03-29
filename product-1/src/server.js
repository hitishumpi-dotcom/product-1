const express = require('express');
const { loadConfig, saveConfig, loadStatus, saveStatus } = require('./lib/config');
const { checkForUpdates } = require('./lib/update');
const { runVoteOnce } = require('./lib/vote');
const { startScheduler, stopScheduler, schedulerStatus } = require('./lib/scheduler');
const { validateConfig } = require('./lib/validate');
const { writeReleaseManifest } = require('./lib/release');
const { writeServiceFile } = require('./lib/service');
const { buildBundle } = require('./lib/bundle');
const { LOG_PATH } = require('./lib/notify');
const { applyUpdateFromManifestUrl, rollbackFromBackup } = require('./lib/update-apply');
const { FIELD_HELP } = require('./lib/help');
const { wizardState } = require('./lib/wizard');
const { discoveryHints } = require('./lib/discovery');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4311;
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function masked(v) {
  const s = String(v || '');
  if (!s) return '';
  if (s.length <= 4) return '••••';
  return '•'.repeat(Math.max(4, s.length - 4)) + s.slice(-4);
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(name => name.endsWith('.tar.gz'))
    .sort()
    .reverse();
}

function helpText(key) {
  return FIELD_HELP[key] || '';
}

function page(config, status, scheduler) {
  const u = status.update || {};
  const validation = validateConfig(config);
  const wizard = wizardState(config);
  const hints = discoveryHints(config);
  const backups = listBackups();
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Product 1</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1120px; margin: 30px auto; padding: 0 16px; background: #fafafa; color: #111; }
    input, select { width: 100%; padding: 10px; margin: 4px 0 12px; box-sizing: border-box; }
    label { font-weight: bold; display: block; margin-top: 10px; }
    button { padding: 10px 14px; margin-right: 10px; margin-bottom: 10px; cursor: pointer; }
    .card { background: white; border: 1px solid #ddd; border-radius: 12px; padding: 16px; margin: 16px 0; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .muted { color: #555; }
    .ok { color: #0a7f2e; font-weight: bold; }
    .warn { color: #a15c00; font-weight: bold; }
    .err { color: #b00020; font-weight: bold; }
    ul { margin-top: 8px; }
    .inlinecode { font-family: monospace; background: #f2f2f2; padding: 2px 5px; border-radius: 4px; }
    .help { color: #666; font-size: 0.95em; margin-top: -6px; margin-bottom: 8px; }
    .step { padding: 8px 10px; border-radius: 8px; margin-bottom: 8px; background: #f7f7f7; }
    @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>Product 1</h1>
  <div class="muted">Friend-usable local L2 Reborn auto-vote app</div>

  <div class="card">
    <h2>Setup wizard</h2>
    <div><b>Status:</b> ${wizard.ready ? '<span class="ok">Ready</span>' : '<span class="warn">Needs setup</span>'}</div>
    ${wizard.next ? `<div><b>Next step:</b> ${esc(wizard.next.title)}</div>` : '<div><b>Next step:</b> None</div>'}
    <div style="margin-top:10px;">
      ${wizard.steps.map(s => `<div class="step"><b>${s.id}. ${esc(s.title)}</b> — ${s.done ? '<span class="ok">done</span>' : '<span class="warn">pending</span>'}</div>`).join('')}
    </div>
    ${wizard.ready ? '<div class="muted">You can run a test vote now, then enable the scheduler.</div>' : `<div class="err">Missing required fields:</div><ul>${wizard.validation.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`}
  </div>

  <div class="card">
    <h2>Status</h2>
    <div><b>Last run:</b> ${esc(status.lastRunAt || 'Never')}</div>
    <div><b>Last result:</b> ${esc(status.lastResult || 'None')}</div>
    <div><b>Summary:</b> ${esc(status.lastSummary || 'None')}</div>
    <div><b>Failures in a row:</b> ${esc(status.consecutiveFailures || 0)}</div>
    <div><b>Scheduler:</b> ${scheduler.running ? `<span class="ok">Running (PID ${scheduler.pid})</span>` : '<span class="warn">Stopped</span>'}</div>
    <div><b>Version:</b> ${esc(u.currentVersion || '0.1.0')}</div>
    <div><b>Latest:</b> ${esc(u.latestVersion || '0.1.0')}</div>
    <div><b>Update available:</b> ${u.updateAvailable ? '<span class="warn">Yes</span>' : '<span class="ok">No</span>'}</div>
    <div><b>Last update check:</b> ${esc(u.lastCheckedAt || 'Never')}</div>
    <div><b>Last updater action:</b> ${esc(u.lastAction || 'None')}</div>
    <div><b>Notifications log:</b> <span class="inlinecode">${esc(LOG_PATH)}</span></div>
  </div>

  <div class="card">
    <h2>Quick actions</h2>
    <form method="post" action="/run"><button type="submit">1. Run test vote now</button></form>
    <form method="post" action="/scheduler/start"><button type="submit">2. Start scheduler</button></form>
    <form method="post" action="/scheduler/stop"><button type="submit">Stop scheduler</button></form>
    <form method="post" action="/check-updates"><button type="submit">Check updates</button></form>
    <form method="post" action="/update-now"><button type="submit">Update now</button></form>
    <form method="post" action="/build-release"><button type="submit">Build release manifest</button></form>
    <form method="post" action="/build-service"><button type="submit">Generate service file</button></form>
    <form method="post" action="/build-bundle"><button type="submit">Build shareable bundle</button></form>
  </div>

  <div class="grid">
    <div class="card">
      <h2>Guided setup</h2>
      <form method="post" action="/save">
        <label>Email</label><input name="email" value="${esc(config.l2reborn.email)}" />
        <div class="help">${esc(helpText('email'))}</div>

        <label>Password</label><input name="password" type="password" placeholder="${esc(masked(config.l2reborn.password))}" value="" />
        <div class="help">${esc(helpText('password'))}</div>

        <label>Gmail App Password</label><input name="gmailAppPass" type="password" placeholder="${esc(masked(config.l2reborn.gmailAppPass))}" value="" />
        <div class="help">${esc(helpText('gmailAppPass'))}</div>

        <label>Server ID</label><input name="serverId" value="${esc(config.l2reborn.serverId || hints.serverIdSuggestion)}" />
        <div class="help">${esc(helpText('serverId'))}</div>

        <label>Game Account</label><input name="account" value="${esc(config.l2reborn.account)}" />
        <div class="help">${esc(helpText('account'))} ${esc(hints.accountHelp)}</div>

        <label>Character ID</label><input name="characterId" value="${esc(config.l2reborn.characterId)}" />
        <div class="help">${esc(helpText('characterId'))} ${esc(hints.characterIdHelp)}</div>

        <label>Character Name</label><input name="characterName" value="${esc(config.l2reborn.characterName)}" />
        <div class="help">${esc(helpText('characterName'))}</div>

        <label>2Captcha Key</label><input name="twoCaptchaKey" type="password" placeholder="${esc(masked(config.l2reborn.twoCaptchaKey))}" value="" />
        <div class="help">${esc(helpText('twoCaptchaKey'))}</div>

        <label>Interval Hours</label><input name="intervalHours" value="${esc(config.schedule.intervalHours || 12)}" />
        <div class="help">${esc(helpText('intervalHours'))}</div>

        <label>Enable Schedule</label><input name="enabled" value="${config.schedule.enabled ? 'true' : 'false'}" />
        <div class="help">${esc(helpText('enabled'))}</div>

        <label>Enable Notifications</label><input name="notificationsEnabled" value="${config.notifications.enabled ? 'true' : 'false'}" />
        <div class="help">${esc(helpText('notificationsEnabled'))}</div>

        <button type="submit">Save setup</button>
      </form>
    </div>

    <div class="card">
      <h2>Updates, service, rollback</h2>
      <form method="post" action="/save-update">
        <label>Current Version</label><input name="currentVersion" value="${esc(config.update.currentVersion || '0.1.0')}" />
        <label>Latest Version</label><input name="latestVersion" value="${esc(config.update.latestVersion || '0.1.0')}" />
        <label>Remote Manifest Path / URL</label><input name="remoteManifestPath" value="${esc(config.update.remoteManifestPath || '')}" />
        <div class="help">${esc(helpText('remoteManifestPath'))}</div>
        <button type="submit">Save update settings</button>
      </form>

      <label>Available backups</label>
      <form method="post" action="/rollback">
        <select name="backupFile">${backups.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('')}</select>
        <button type="submit">Rollback from selected backup</button>
      </form>

      <p class="muted">If your friend wants auto-start after reboot, generate the service file and follow the commands from <span class="inlinecode">install-service.sh</span>.</p>
    </div>
  </div>
</body>
</html>`;
}

app.get('/', (req, res) => {
  const config = loadConfig();
  const status = loadStatus();
  const scheduler = schedulerStatus();
  res.send(page(config, status, scheduler));
});

app.post('/save', (req, res) => {
  const config = loadConfig();
  config.l2reborn.email = req.body.email || '';
  if (req.body.password) config.l2reborn.password = req.body.password;
  if (req.body.gmailAppPass) config.l2reborn.gmailAppPass = req.body.gmailAppPass;
  config.l2reborn.serverId = req.body.serverId || '3';
  config.l2reborn.account = req.body.account || '';
  config.l2reborn.characterId = req.body.characterId || '';
  config.l2reborn.characterName = req.body.characterName || '';
  if (req.body.twoCaptchaKey) config.l2reborn.twoCaptchaKey = req.body.twoCaptchaKey;
  config.schedule.intervalHours = Number(req.body.intervalHours || 12);
  config.schedule.enabled = String(req.body.enabled).toLowerCase() === 'true';
  config.notifications.enabled = String(req.body.notificationsEnabled).toLowerCase() === 'true';
  saveConfig(config);
  res.redirect('/');
});

app.post('/save-update', (req, res) => {
  const config = loadConfig();
  config.update.currentVersion = req.body.currentVersion || '0.1.0';
  config.update.latestVersion = req.body.latestVersion || '0.1.0';
  config.update.remoteManifestPath = req.body.remoteManifestPath || '';
  saveConfig(config);
  res.redirect('/');
});

app.post('/run', async (req, res) => {
  await runVoteOnce();
  res.redirect('/');
});

app.post('/check-updates', async (req, res) => {
  await checkForUpdates();
  res.redirect('/');
});

app.post('/update-now', (req, res) => {
  const config = loadConfig();
  if (config.update.remoteManifestPath) {
    applyUpdateFromManifestUrl(config.update.remoteManifestPath).catch(err => {
      const status = loadStatus();
      status.update = {
        ...(status.update || {}),
        lastAction: `Update failed: ${err.message}`,
        lastCheckedAt: new Date().toISOString(),
      };
      status.lastSummary = `Update failed: ${err.message}`;
      saveStatus(status);
    });
  }
  res.redirect('/');
});

app.post('/rollback', (req, res) => {
  const name = req.body.backupFile || '';
  const full = path.join(BACKUP_DIR, path.basename(name));
  rollbackFromBackup(full);
  const status = loadStatus();
  status.update = {
    ...(status.update || {}),
    lastAction: `Rolled back from ${path.basename(name)}`,
    lastCheckedAt: new Date().toISOString(),
  };
  status.lastSummary = `Rolled back from ${path.basename(name)}`;
  saveStatus(status);
  res.redirect('/');
});

app.post('/scheduler/start', (req, res) => {
  startScheduler();
  res.redirect('/');
});

app.post('/scheduler/stop', (req, res) => {
  stopScheduler();
  res.redirect('/');
});

app.post('/build-release', (req, res) => {
  writeReleaseManifest();
  res.redirect('/');
});

app.post('/build-service', (req, res) => {
  writeServiceFile();
  res.redirect('/');
});

app.post('/build-bundle', (req, res) => {
  buildBundle();
  res.redirect('/');
});

app.get('/api/status', (req, res) => {
  res.json({ ...loadStatus(), scheduler: schedulerStatus(), validation: validateConfig(loadConfig()), backups: listBackups(), wizard: wizardState(loadConfig()) });
});

app.listen(PORT, () => {
  console.log(`Product 1 running at http://localhost:${PORT}`);
});
