const express = require('express');
const { loadConfig, saveConfig, loadStatus } = require('./lib/config');
const { checkForUpdates } = require('./lib/update');
const { runVoteOnce } = require('./lib/vote');

const app = express();
const PORT = process.env.PORT || 4311;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function page(config, status) {
  const u = status.update || {};
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Product 1</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 30px auto; padding: 0 16px; }
    input { width: 100%; padding: 8px; margin: 4px 0 12px; }
    label { font-weight: bold; display: block; margin-top: 10px; }
    button { padding: 10px 14px; margin-right: 10px; }
    .card { border: 1px solid #ddd; border-radius: 10px; padding: 16px; margin: 16px 0; }
    .mono { font-family: monospace; white-space: pre-wrap; }
  </style>
</head>
<body>
  <h1>Product 1</h1>
  <div class="card">
    <h2>Status</h2>
    <div><b>Last run:</b> ${status.lastRunAt || 'Never'}</div>
    <div><b>Last result:</b> ${status.lastResult || 'None'}</div>
    <div><b>Summary:</b> ${status.lastSummary || 'None'}</div>
    <div><b>Version:</b> ${u.currentVersion || '0.1.0'}</div>
    <div><b>Latest:</b> ${u.latestVersion || '0.1.0'}</div>
    <div><b>Update available:</b> ${u.updateAvailable ? 'Yes' : 'No'}</div>
  </div>

  <div class="card">
    <h2>Controls</h2>
    <form method="post" action="/run"><button type="submit">Run vote now</button></form>
    <form method="post" action="/check-updates" style="margin-top:10px;"><button type="submit">Check updates</button></form>
  </div>

  <div class="card">
    <h2>Configuration</h2>
    <form method="post" action="/save">
      <label>Email</label><input name="email" value="${config.l2reborn.email || ''}" />
      <label>Password</label><input name="password" value="${config.l2reborn.password || ''}" />
      <label>Gmail App Password</label><input name="gmailAppPass" value="${config.l2reborn.gmailAppPass || ''}" />
      <label>Server ID</label><input name="serverId" value="${config.l2reborn.serverId || '3'}" />
      <label>Game Account</label><input name="account" value="${config.l2reborn.account || ''}" />
      <label>Character ID</label><input name="characterId" value="${config.l2reborn.characterId || ''}" />
      <label>Character Name</label><input name="characterName" value="${config.l2reborn.characterName || ''}" />
      <label>2Captcha Key</label><input name="twoCaptchaKey" value="${config.l2reborn.twoCaptchaKey || ''}" />
      <label>Interval Hours</label><input name="intervalHours" value="${config.schedule.intervalHours || 12}" />
      <label>Enable Schedule (true/false)</label><input name="enabled" value="${config.schedule.enabled ? 'true' : 'false'}" />
      <label>Current Version</label><input name="currentVersion" value="${config.update.currentVersion || '0.1.0'}" />
      <label>Latest Version</label><input name="latestVersion" value="${config.update.latestVersion || '0.1.0'}" />
      <button type="submit">Save config</button>
    </form>
  </div>
</body>
</html>`;
}

app.get('/', (req, res) => {
  const config = loadConfig();
  const status = loadStatus();
  res.send(page(config, status));
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

app.get('/api/status', (req, res) => {
  res.json(loadStatus());
});

app.listen(PORT, () => {
  console.log(`Product 1 running at http://localhost:${PORT}`);
});
