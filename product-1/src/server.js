const express = require('express');
const { loadConfig, saveConfig, loadStatus } = require('./lib/config');
const { checkForUpdates } = require('./lib/update');
const { runVoteOnce } = require('./lib/vote');
const { startScheduler, stopScheduler, schedulerStatus } = require('./lib/scheduler');

const app = express();
const PORT = process.env.PORT || 4311;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function page(config, status, scheduler) {
  const u = status.update || {};
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Product 1</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 980px; margin: 30px auto; padding: 0 16px; background: #fafafa; color: #111; }
    input { width: 100%; padding: 10px; margin: 4px 0 12px; box-sizing: border-box; }
    label { font-weight: bold; display: block; margin-top: 10px; }
    button { padding: 10px 14px; margin-right: 10px; margin-bottom: 10px; cursor: pointer; }
    .card { background: white; border: 1px solid #ddd; border-radius: 12px; padding: 16px; margin: 16px 0; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .muted { color: #555; }
    .ok { color: #0a7f2e; font-weight: bold; }
    .warn { color: #a15c00; font-weight: bold; }
    .err { color: #b00020; font-weight: bold; }
    @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>Product 1</h1>
  <div class="muted">Friend-usable local L2 Reborn auto-vote app</div>

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
  </div>

  <div class="card">
    <h2>Controls</h2>
    <form method="post" action="/run"><button type="submit">Run vote now</button></form>
    <form method="post" action="/scheduler/start"><button type="submit">Start scheduler</button></form>
    <form method="post" action="/scheduler/stop"><button type="submit">Stop scheduler</button></form>
    <form method="post" action="/check-updates"><button type="submit">Check updates</button></form>
  </div>

  <div class="grid">
    <div class="card">
      <h2>Setup</h2>
      <form method="post" action="/save">
        <label>Email</label><input name="email" value="${esc(config.l2reborn.email)}" />
        <label>Password</label><input name="password" type="password" value="${esc(config.l2reborn.password)}" />
        <label>Gmail App Password</label><input name="gmailAppPass" type="password" value="${esc(config.l2reborn.gmailAppPass)}" />
        <label>Server ID</label><input name="serverId" value="${esc(config.l2reborn.serverId || '3')}" />
        <label>Game Account</label><input name="account" value="${esc(config.l2reborn.account)}" />
        <label>Character ID</label><input name="characterId" value="${esc(config.l2reborn.characterId)}" />
        <label>Character Name</label><input name="characterName" value="${esc(config.l2reborn.characterName)}" />
        <label>2Captcha Key</label><input name="twoCaptchaKey" type="password" value="${esc(config.l2reborn.twoCaptchaKey)}" />
        <label>Interval Hours</label><input name="intervalHours" value="${esc(config.schedule.intervalHours || 12)}" />
        <label>Enable Schedule</label><input name="enabled" value="${config.schedule.enabled ? 'true' : 'false'}" />
        <button type="submit">Save config</button>
      </form>
    </div>

    <div class="card">
      <h2>Updates</h2>
      <form method="post" action="/save-update">
        <label>Current Version</label><input name="currentVersion" value="${esc(config.update.currentVersion || '0.1.0')}" />
        <label>Latest Version</label><input name="latestVersion" value="${esc(config.update.latestVersion || '0.1.0')}" />
        <button type="submit">Save update settings</button>
      </form>
      <p class="muted">For now this is manual. Later we can wire it to GitHub releases so friends get prompted automatically.</p>
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
  config.l2reborn.password = req.body.password || '';
  config.l2reborn.gmailAppPass = req.body.gmailAppPass || '';
  config.l2reborn.serverId = req.body.serverId || '3';
  config.l2reborn.account = req.body.account || '';
  config.l2reborn.characterId = req.body.characterId || '';
  config.l2reborn.characterName = req.body.characterName || '';
  config.l2reborn.twoCaptchaKey = req.body.twoCaptchaKey || '';
  config.schedule.intervalHours = Number(req.body.intervalHours || 12);
  config.schedule.enabled = String(req.body.enabled).toLowerCase() === 'true';
  saveConfig(config);
  res.redirect('/');
});

app.post('/save-update', (req, res) => {
  const config = loadConfig();
  config.update.currentVersion = req.body.currentVersion || '0.1.0';
  config.update.latestVersion = req.body.latestVersion || '0.1.0';
  saveConfig(config);
  res.redirect('/');
});

app.post('/run', async (req, res) => {
  await runVoteOnce();
  res.redirect('/');
});

app.post('/check-updates', (req, res) => {
  checkForUpdates();
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

app.get('/api/status', (req, res) => {
  res.json({ ...loadStatus(), scheduler: schedulerStatus() });
});

app.listen(PORT, () => {
  console.log(`Product 1 running at http://localhost:${PORT}`);
});
