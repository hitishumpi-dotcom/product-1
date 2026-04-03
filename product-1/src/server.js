const express = require('express');
const { loadConfig, saveConfig, loadStatus, saveStatus, COOKIE_PATH } = require('./lib/config');
const { checkForUpdates } = require('./lib/update');
const { runVoteOnce } = require('./lib/vote');
const { discoverSetup, FALLBACK_SERVERS } = require('./lib/discover');
const { startScheduler, stopScheduler, schedulerStatus } = require('./lib/scheduler');
const { validateConfig } = require('./lib/validate');
const { writeReleaseManifest } = require('./lib/release');
const { writeServiceFile } = require('./lib/service');
const { buildBundle } = require('./lib/bundle');
const { LOG_PATH } = require('./lib/notify');
const { applyUpdateFromManifestUrl, rollbackFromBackup } = require('./lib/update-apply');
const { FIELD_HELP } = require('./lib/help');
const { wizardState } = require('./lib/wizard');
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
  const backups = listBackups();
  const serverOptions = FALLBACK_SERVERS.map(s =>
    `<option value="${esc(s.id)}" ${config.l2reborn.serverId === s.id ? 'selected' : ''}>${esc(s.name)} (ID: ${esc(s.id)})</option>`
  ).join('');

  const stepDots = wizard.steps.map(s => `
    <div class="step-dot ${s.done ? 'done' : (wizard.next && wizard.next.id === s.id ? 'active' : '')}">
      <div class="dot">${s.done ? '✓' : s.id}</div>
      <div class="step-label">${esc(s.title)}</div>
    </div>
  `).join('<div class="step-line"></div>');

  const lastResultClass = status.lastResult === 'SUCCESS' ? 'badge-ok'
    : status.lastResult === 'COOLDOWN' ? 'badge-warn'
    : status.lastResult === 'ERROR' || status.lastResult === 'FAILED' ? 'badge-err'
    : 'badge-muted';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Product 1 — L2 Reborn Auto-Vote</title>
  <style>
    :root {
      --bg:        #090c16;
      --surface:   #0e1525;
      --surface2:  #131d30;
      --border:    #1e2d47;
      --gold:      #c9a227;
      --gold-lt:   #e8c547;
      --gold-dim:  #7a5f10;
      --text:      #d8e0f0;
      --text-muted:#6b7fa6;
      --text-dim:  #3d5075;
      --ok:        #22c55e;
      --warn:      #f59e0b;
      --err:       #ef4444;
      --input-bg:  #0b1423;
      --radius:    10px;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 15px; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px 20px 60px;
      line-height: 1.55;
    }

    /* ── HEADER ── */
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 20px 0 18px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 28px;
    }
    .header-icon {
      width: 44px; height: 44px;
      background: linear-gradient(135deg, #1a2540, #0e1525);
      border: 1px solid var(--gold-dim);
      border-radius: 10px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
      box-shadow: 0 0 12px rgba(201,162,39,.15);
    }
    .header-text h1 {
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--gold-lt);
      letter-spacing: .5px;
    }
    .header-text p { font-size: .82rem; color: var(--text-muted); margin-top: 2px; }
    .header-badge {
      margin-left: auto;
      font-size: .72rem;
      background: var(--surface2);
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 3px 9px;
      border-radius: 20px;
    }

    /* ── CARDS ── */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px 22px;
      margin-bottom: 18px;
    }
    .card-title {
      font-size: .7rem;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: var(--gold);
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(to right, var(--gold-dim), transparent);
    }

    /* ── WIZARD STEPPER ── */
    .stepper {
      display: flex;
      align-items: flex-start;
      gap: 0;
      margin-bottom: 6px;
      overflow-x: auto;
      padding-bottom: 4px;
    }
    .step-dot {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 80px;
      flex: 1;
    }
    .dot {
      width: 30px; height: 30px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: .75rem;
      font-weight: 700;
      border: 2px solid var(--text-dim);
      color: var(--text-dim);
      background: var(--surface2);
      transition: all .2s;
    }
    .step-dot.done .dot {
      background: var(--gold-dim);
      border-color: var(--gold);
      color: var(--gold-lt);
    }
    .step-dot.active .dot {
      border-color: var(--gold);
      color: var(--gold);
      box-shadow: 0 0 10px rgba(201,162,39,.35);
    }
    .step-label {
      font-size: .65rem;
      color: var(--text-muted);
      text-align: center;
      margin-top: 5px;
      max-width: 90px;
      line-height: 1.3;
    }
    .step-dot.done .step-label { color: var(--gold); }
    .step-dot.active .step-label { color: var(--text); }
    .step-line {
      flex: 1;
      height: 2px;
      background: var(--border);
      margin-top: 14px;
      min-width: 12px;
    }
    .wizard-status {
      margin-top: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: .85rem;
    }
    .wizard-status.ready { background: rgba(34,197,94,.08); border: 1px solid rgba(34,197,94,.25); color: var(--ok); }
    .wizard-status.pending { background: rgba(245,158,11,.07); border: 1px solid rgba(245,158,11,.2); color: var(--warn); }
    .wizard-status ul { padding-left: 18px; margin-top: 4px; color: var(--text-muted); }

    /* ── FORM ELEMENTS ── */
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    label.field-label {
      display: block;
      font-size: .75rem;
      font-weight: 600;
      letter-spacing: .4px;
      color: var(--text-muted);
      text-transform: uppercase;
      margin-bottom: 5px;
      margin-top: 14px;
    }
    input[type=text], input[type=password], input[type=email], input[type=number], select {
      width: 100%;
      background: var(--input-bg);
      border: 1px solid var(--border);
      border-radius: 7px;
      color: var(--text);
      padding: 9px 12px;
      font-size: .9rem;
      outline: none;
      transition: border-color .15s, box-shadow .15s;
    }
    input:focus, select:focus {
      border-color: var(--gold-dim);
      box-shadow: 0 0 0 3px rgba(201,162,39,.1);
    }
    select option { background: #0e1525; }
    .field-hint {
      font-size: .75rem;
      color: var(--text-dim);
      margin-top: 4px;
      line-height: 1.4;
    }

    /* ── BUTTONS ── */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 9px 18px;
      border-radius: 7px;
      font-size: .88rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all .15s;
      text-decoration: none;
    }
    .btn-gold {
      background: linear-gradient(135deg, #c9a227, #a07a14);
      color: #0a0c16;
      box-shadow: 0 2px 14px rgba(201,162,39,.3);
    }
    .btn-gold:hover:not(:disabled) {
      background: linear-gradient(135deg, #e8c547, #c9a227);
      box-shadow: 0 2px 22px rgba(201,162,39,.5);
      transform: translateY(-1px);
    }
    .btn-gold:disabled { opacity: .5; cursor: not-allowed; transform: none; }
    .btn-secondary { background: var(--surface2); color: var(--text-muted); border: 1px solid var(--border); }
    .btn-secondary:hover:not(:disabled) { border-color: var(--text-muted); color: var(--text); }
    .btn-primary {
      background: linear-gradient(135deg, #1a56db, #1241a8);
      color: #fff;
    }
    .btn-primary:hover { background: linear-gradient(135deg, #1e63ff, #1a56db); transform: translateY(-1px); }
    .btn-ghost {
      background: var(--surface2);
      border: 1px solid var(--border);
      color: var(--text-muted);
    }
    .btn-ghost:hover { border-color: var(--gold-dim); color: var(--text); }
    .btn-danger {
      background: rgba(239,68,68,.12);
      border: 1px solid rgba(239,68,68,.3);
      color: var(--err);
    }
    .btn-danger:hover { background: rgba(239,68,68,.22); }
    .btn-sm { padding: 6px 13px; font-size: .8rem; }
    .btn-group { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }

    /* ── DISCOVER STATUS ── */
    #discover-status {
      display: none;
      margin-top: 12px;
      padding: 11px 15px;
      border-radius: 8px;
      font-size: .875rem;
      line-height: 1.5;
    }
    #discover-status.loading {
      background: rgba(201,162,39,.07);
      border: 1px solid rgba(201,162,39,.3);
      color: var(--gold-lt);
    }
    #discover-status.success {
      background: rgba(34,197,94,.07);
      border: 1px solid rgba(34,197,94,.25);
      color: var(--ok);
    }
    #discover-status.error {
      background: rgba(239,68,68,.08);
      border: 1px solid rgba(239,68,68,.3);
      color: var(--err);
    }

    /* ── CHARACTER PICKER ── */
    #char-picker { display: none; margin-top: 14px; }
    .char-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 14px;
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      background: var(--surface2);
      transition: border-color .15s, background .15s;
    }
    .char-card:hover { border-color: var(--gold-dim); background: #131d30; }
    .char-card.selected { border-color: var(--gold); background: rgba(201,162,39,.06); }
    .char-card input[type=radio] { accent-color: var(--gold); width: 16px; height: 16px; flex-shrink: 0; }
    .char-name { font-weight: 700; font-size: 1rem; color: var(--text); }
    .char-meta { font-size: .78rem; color: var(--text-muted); margin-top: 3px; }
    .char-id { font-size: .75rem; color: var(--text-muted); margin-top: 2px; letter-spacing: .02em; }

    /* ── STATUS GRID ── */
    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }
    .stat-item { }
    .stat-label { font-size: .7rem; text-transform: uppercase; letter-spacing: .8px; color: var(--text-dim); margin-bottom: 4px; }
    .stat-value { font-size: .9rem; color: var(--text); word-break: break-all; }
    .badge {
      display: inline-block;
      padding: 2px 9px;
      border-radius: 20px;
      font-size: .78rem;
      font-weight: 600;
    }
    .badge-ok  { background: rgba(34,197,94,.12); color: var(--ok); border: 1px solid rgba(34,197,94,.25); }
    .badge-warn{ background: rgba(245,158,11,.1);  color: var(--warn); border: 1px solid rgba(245,158,11,.25); }
    .badge-err { background: rgba(239,68,68,.1);   color: var(--err); border: 1px solid rgba(239,68,68,.25); }
    .badge-muted{ background: var(--surface2); color: var(--text-muted); border: 1px solid var(--border); }
    .inlinecode {
      font-family: 'Cascadia Code', 'Fira Code', monospace;
      font-size: .8em;
      background: var(--surface2);
      border: 1px solid var(--border);
      padding: 1px 6px;
      border-radius: 4px;
      color: var(--text-muted);
      word-break: break-all;
    }

    /* ── DIVIDER ── */
    .divider {
      border: none;
      border-top: 1px solid var(--border);
      margin: 18px 0;
    }

    /* ── DETAILS/SUMMARY ── */
    details > summary {
      cursor: pointer;
      list-style: none;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-muted);
      font-size: .85rem;
      font-weight: 600;
      padding: 4px 0;
      user-select: none;
    }
    details > summary::before { content: '›'; font-size: 1.1rem; transition: transform .2s; }
    details[open] > summary::before { transform: rotate(90deg); }
    details > summary::-webkit-details-marker { display: none; }

    /* ── SPINNER ── */
    .spinner {
      display: inline-block;
      width: 13px; height: 13px;
      border: 2px solid rgba(201,162,39,.3);
      border-top-color: var(--gold);
      border-radius: 50%;
      animation: spin .75s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
      flex-shrink: 0;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── SECTION SPACING ── */
    .section-gap { margin-top: 22px; }

    @media (max-width: 720px) {
      .grid2 { grid-template-columns: 1fr; }
      .stepper { gap: 2px; }
      .step-label { display: none; }
    }
  </style>
</head>
<body>

<!-- HEADER -->
<header class="header">
  <div class="header-icon">⚔</div>
  <div class="header-text">
    <h1>Product 1</h1>
    <p>L2 Reborn Auto-Vote &mdash; local &amp; friend-usable</p>
  </div>
  <span class="header-badge">v${esc(u.currentVersion || '0.1.0')}</span>
</header>

<!-- WIZARD PROGRESS -->
<div class="card">
  <div class="card-title">Setup Progress</div>
  <div class="stepper">${stepDots}</div>
  <div class="wizard-status ${wizard.ready ? 'ready' : 'pending'}">
    ${wizard.ready
      ? '✓ &nbsp;All set — ready to vote. Start the scheduler or run a test vote below.'
      : `<b>Next:</b> ${esc(wizard.next ? wizard.next.title : '')}
         <ul>${wizard.validation.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>`}
  </div>
</div>

<!-- SETUP FORM -->
<div class="card">
  <div class="card-title">Account Setup</div>

  <form id="setup-form" method="post" action="/save">
    <div class="grid2">
      <div>
        <label class="field-label">L2 Reborn email</label>
        <input type="email" name="email" value="${esc(config.l2reborn.email)}" placeholder="you@example.com" autocomplete="username" />

        <label class="field-label">L2 Reborn password</label>
        <input type="password" name="password" placeholder="${config.l2reborn.password ? 'saved — leave blank to keep' : 'your password'}" value="" autocomplete="current-password" />

        <label class="field-label">Gmail App Password</label>
        <input type="password" name="gmailAppPass" placeholder="${config.l2reborn.gmailAppPass ? masked(config.l2reborn.gmailAppPass) : '16-char app password'}" value="" />
        <div class="field-hint">${esc(helpText('gmailAppPass'))}</div>
      </div>

      <div>
        <label class="field-label">2Captcha API key</label>
        <input type="password" name="twoCaptchaKey" placeholder="${config.l2reborn.twoCaptchaKey ? masked(config.l2reborn.twoCaptchaKey) : 'paste your 2captcha key'}" value="" />
        <div class="field-hint">${esc(helpText('twoCaptchaKey'))}</div>

        <label class="field-label">Game account (login name)</label>
        <input type="text" id="account-input" name="account" value="${esc(config.l2reborn.account)}" placeholder="your game login" />
        <div class="field-hint">${esc(helpText('account'))}</div>
      </div>
    </div>

    <hr class="divider" />

    <!-- DISCOVER -->
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <button type="button" id="discover-btn" class="btn btn-gold" onclick="runDiscover()">
        ⚔&nbsp; Login &amp; Discover my server &amp; characters
      </button>
      <button type="button" class="btn btn-secondary" onclick="resetSession()" style="font-size:.82rem;padding:7px 14px;">
        ↺&nbsp; Reset Session
      </button>
    </div>
    <div class="field-hint" style="margin-top:6px;">Automatically logs in, solves the captcha, and finds your characters. Takes 1–3 minutes.</div>
    <div id="discover-status"></div>

    <!-- SERVER -->
    <label class="field-label" style="margin-top:18px;">Server</label>
    <select id="server-select" name="serverId">${serverOptions}</select>

    <!-- CHARACTER PICKER -->
    <div id="char-picker">
      <label class="field-label" style="margin-top:18px;">Pick your character</label>
      <div id="char-list"></div>
    </div>

    <input type="hidden" id="characterId-input" name="characterId" value="${esc(config.l2reborn.characterId)}" />
    <input type="hidden" id="characterName-input" name="characterName" value="${esc(config.l2reborn.characterName)}" />

    <details style="margin-top:14px;">
      <summary>Enter character ID manually</summary>
      <div style="margin-top:12px;" class="grid2">
        <div>
          <label class="field-label">Character ID</label>
          <input type="text" id="manual-charId" value="${esc(config.l2reborn.characterId)}" placeholder="numeric ID" oninput="document.getElementById('characterId-input').value=this.value" />
        </div>
        <div>
          <label class="field-label">Character name (label only)</label>
          <input type="text" id="manual-charName" value="${esc(config.l2reborn.characterName)}" placeholder="optional" oninput="document.getElementById('characterName-input').value=this.value" />
        </div>
      </div>
    </details>

    <hr class="divider" />

    <!-- SCHEDULE -->
    <div class="grid2">
      <div>
        <label class="field-label">Auto-vote interval (hours)</label>
        <input type="number" name="intervalHours" value="${esc(config.schedule.intervalHours || 12)}" min="1" max="168" />
      </div>
      <div>
        <label class="field-label">Enable auto-vote schedule</label>
        <select name="enabled">
          <option value="true" ${config.schedule.enabled ? 'selected' : ''}>Yes — run automatically</option>
          <option value="false" ${!config.schedule.enabled ? 'selected' : ''}>No — manual only</option>
        </select>
      </div>
    </div>

    <div style="margin-top:18px;">
      <button type="submit" class="btn btn-primary">Save setup</button>
    </div>
  </form>
</div>

<!-- STATUS + ACTIONS side by side -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;" class="status-actions-row">
  <div class="card">
    <div class="card-title">Vote Status</div>
    <div class="status-grid">
      <div class="stat-item">
        <div class="stat-label">Last run</div>
        <div class="stat-value">${esc(status.lastRunAt ? new Date(status.lastRunAt).toLocaleString() : 'Never')}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Result</div>
        <div class="stat-value"><span class="badge ${lastResultClass}">${esc(status.lastResult || 'None')}</span></div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Summary</div>
        <div class="stat-value">${esc(status.lastSummary || '—')}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Failures in a row</div>
        <div class="stat-value">${esc(status.consecutiveFailures || 0)}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Scheduler</div>
        <div class="stat-value">
          ${scheduler.running
            ? `<span class="badge badge-ok">Running &middot; PID ${scheduler.pid}</span>`
            : '<span class="badge badge-muted">Stopped</span>'}
        </div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Update</div>
        <div class="stat-value">
          ${u.updateAvailable
            ? '<span class="badge badge-warn">Available</span>'
            : '<span class="badge badge-ok">Up to date</span>'}
        </div>
      </div>
    </div>
    <div style="margin-top:12px;">
      <div class="stat-label">Notifications log</div>
      <div class="stat-value" style="margin-top:4px;"><span class="inlinecode">${esc(LOG_PATH)}</span></div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Actions</div>
    <div class="btn-group">
      <form method="post" action="/run"><button type="submit" class="btn btn-gold">▶&nbsp; Vote now</button></form>
      <form method="post" action="/scheduler/start"><button type="submit" class="btn btn-primary">⏱&nbsp; Start scheduler</button></form>
      <form method="post" action="/scheduler/stop"><button type="submit" class="btn btn-ghost">⏹&nbsp; Stop scheduler</button></form>
      <form method="post" action="/check-updates"><button type="submit" class="btn btn-ghost btn-sm">↻&nbsp; Check updates</button></form>
    </div>
  </div>
</div>

<!-- ADVANCED -->
<div class="card" style="margin-top:18px;">
  <details>
    <summary>Advanced — Updates, service &amp; rollback</summary>
    <div style="margin-top:16px;">
      <form method="post" action="/save-update">
        <div class="grid2">
          <div>
            <label class="field-label">Current version</label>
            <input type="text" name="currentVersion" value="${esc(config.update.currentVersion || '0.1.0')}" />
          </div>
          <div>
            <label class="field-label">Latest version</label>
            <input type="text" name="latestVersion" value="${esc(config.update.latestVersion || '0.1.0')}" />
          </div>
        </div>
        <label class="field-label" style="margin-top:12px;">Remote manifest URL</label>
        <input type="text" name="remoteManifestPath" value="${esc(config.update.remoteManifestPath || '')}" placeholder="https://..." />
        <div class="field-hint">${esc(helpText('remoteManifestPath'))}</div>
        <div style="margin-top:12px;">
          <button type="submit" class="btn btn-ghost btn-sm">Save update settings</button>
        </div>
      </form>

      <hr class="divider" />
      <div class="btn-group">
        <form method="post" action="/update-now"><button type="submit" class="btn btn-ghost btn-sm">Apply update</button></form>
        <form method="post" action="/build-release"><button type="submit" class="btn btn-ghost btn-sm">Build release manifest</button></form>
        <form method="post" action="/build-service"><button type="submit" class="btn btn-ghost btn-sm">Generate service file</button></form>
        <form method="post" action="/build-bundle"><button type="submit" class="btn btn-ghost btn-sm">Build bundle</button></form>
      </div>

      ${backups.length > 0 ? `
      <hr class="divider" />
      <div class="card-title" style="margin-top:4px;">Rollback</div>
      <form method="post" action="/rollback" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">
          <label class="field-label">Select backup</label>
          <select name="backupFile">${backups.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('')}</select>
        </div>
        <button type="submit" class="btn btn-danger btn-sm" style="margin-bottom:0;">Rollback</button>
      </form>` : '<p style="color:var(--text-dim);font-size:.83rem;margin-top:8px;">No backups yet.</p>'}

      <p style="color:var(--text-dim);font-size:.8rem;margin-top:14px;">For auto-start on Linux, generate the service file and follow <span class="inlinecode">install-service.sh</span>.</p>
    </div>
  </details>
</div>

<script>
const hasSavedPassword = ${config.l2reborn.password ? 'true' : 'false'};
const hasSavedCaptcha  = ${config.l2reborn.twoCaptchaKey ? 'true' : 'false'};

async function runDiscover() {
  const form = document.getElementById('setup-form');
  const statusEl = document.getElementById('discover-status');
  const btn = document.getElementById('discover-btn');

  const email        = form.email.value.trim();
  const password     = form.password.value.trim();
  const gmailAppPass = form.gmailAppPass.value.trim();
  const twoCaptchaKey= form.twoCaptchaKey.value.trim();

  if (!email) { showMsg('error', 'Please enter your L2 Reborn email first.'); return; }
  if (!password && !hasSavedPassword) { showMsg('error', 'Please enter your password first.'); return; }
  if (!twoCaptchaKey && !hasSavedCaptcha) { showMsg('error', 'Please enter your 2Captcha key first.'); return; }

  btn.disabled = true;
  showMsg('loading', '<span class="spinner"></span> Logging in and discovering your setup&hellip; Solving the captcha takes <b>1&ndash;3 minutes</b>. Please wait.');

  try {
    const res = await fetch('/api/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: password || null,
        gmailAppPass: gmailAppPass || null,
        twoCaptchaKey: twoCaptchaKey || null,
      }),
    });
    const data = await res.json();

    if (!data.ok) {
      showMsg('error', '<b>Discovery failed:</b> ' + escHtml(data.error || 'Unknown error'));
      btn.disabled = false;
      return;
    }

    let msg = '✓ &nbsp;<b>Discovery complete!</b>';
    msg += data.serversDiscovered
      ? ' Found ' + data.servers.length + ' server(s).'
      : ' Using default server list.';
    msg += data.charactersDiscovered
      ? ' Found ' + data.characters.length + ' character(s).'
      : ' No characters found — enter ID manually below.';
    showMsg('success', msg);

    if (data.servers && data.servers.length) {
      const sel = document.getElementById('server-select');
      const cur = sel.value;
      sel.innerHTML = data.servers.map(s =>
        '<option value="' + escHtml(s.id) + '"' + (s.id === cur ? ' selected' : '') + '>' +
        escHtml(s.name) + ' (ID: ' + escHtml(s.id) + ')</option>'
      ).join('');
    }

    if (data.account) document.getElementById('account-input').value = data.account;

    if (data.characters && data.characters.length) {
      const list = document.getElementById('char-list');
      list.innerHTML = data.characters.map((c, i) =>
        '<label class="char-card" id="cc' + i + '" onclick="markSelected(' + i + ')">' +
        '<input type="radio" name="_char_pick" value="' + i + '" onchange="selectChar(' + JSON.stringify(c) + ')"' + (i === 0 ? ' checked' : '') + '>' +
        '<div><div class="char-name">' + escHtml(c.name || 'Unknown') + '</div>' +
        '<div class="char-id">' + (c.id ? 'ID: ' + escHtml(c.id) : '') + '</div>' +
        '<div class="char-meta">' +
        (c.account ? 'Account: ' + escHtml(c.account) : '') +
        (c.serverId ? (c.account ? ' &nbsp;·&nbsp; ' : '') + 'Server ' + escHtml(c.serverId) : '') +
        '</div></div></label>'
      ).join('');
      document.getElementById('char-picker').style.display = 'block';
      if (data.characters[0]) { selectChar(data.characters[0]); markSelected(0); }
    }

    btn.disabled = false;
  } catch (err) {
    showMsg('error', '<b>Discovery error:</b> ' + escHtml(err.message || 'Request failed or timed out'));
    btn.disabled = false;
  }
}

async function resetSession() {
  try {
    await fetch('/api/reset-session', { method: 'POST' });
    showMsg('success', 'Session cleared — next Discovery will do a fresh login.');
  } catch (e) {
    showMsg('error', 'Failed to reset session: ' + e.message);
  }
}

function showMsg(type, html) {
  const el = document.getElementById('discover-status');
  el.className = type;
  el.style.display = 'block';
  el.innerHTML = html;
}

function markSelected(idx) {
  document.querySelectorAll('.char-card').forEach((el, i) =>
    el.classList.toggle('selected', i === idx)
  );
}

function selectChar(c) {
  document.getElementById('characterId-input').value  = c.id   || '';
  document.getElementById('characterName-input').value= c.name || '';
  document.getElementById('manual-charId').value      = c.id   || '';
  document.getElementById('manual-charName').value    = c.name || '';
  if (c.serverId) {
    const sel = document.getElementById('server-select');
    const opt = Array.from(sel.options).find(o => o.value === c.serverId);
    if (opt) sel.value = c.serverId;
  }
  if (c.account) document.getElementById('account-input').value = c.account;
}

function escHtml(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
</script>
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
  if (req.body.twoCaptchaKey) config.l2reborn.twoCaptchaKey = req.body.twoCaptchaKey;
  config.l2reborn.serverId = req.body.serverId || '3';
  config.l2reborn.account = req.body.account || '';
  config.l2reborn.characterId = req.body.characterId || '';
  config.l2reborn.characterName = req.body.characterName || '';
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
  if (!name) {
    const status = loadStatus();
    status.lastSummary = 'Rollback failed: no backup file selected';
    saveStatus(status);
    return res.redirect('/');
  }
  const full = path.join(BACKUP_DIR, path.basename(name));
  try {
    rollbackFromBackup(full);
    const status = loadStatus();
    status.update = {
      ...(status.update || {}),
      lastAction: `Rolled back from ${path.basename(name)}`,
      lastCheckedAt: new Date().toISOString(),
    };
    status.lastSummary = `Rolled back from ${path.basename(name)}`;
    saveStatus(status);
  } catch (err) {
    const status = loadStatus();
    status.lastSummary = `Rollback failed: ${err.message}`;
    saveStatus(status);
  }
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
  try {
    buildBundle();
  } catch (err) {
    const status = loadStatus();
    status.lastSummary = `Bundle build failed: ${err.message}`;
    saveStatus(status);
  }
  res.redirect('/');
});

// Discovery endpoint — may take 1-3 minutes (captcha solving)
app.post('/api/reset-session', (req, res) => {
  try {
    if (fs.existsSync(COOKIE_PATH)) fs.unlinkSync(COOKIE_PATH);
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/api/discover', async (req, res) => {
  const config = loadConfig();
  const body = req.body || {};

  // Merge posted credentials with saved config (posted values take priority)
  const creds = {
    email: body.email || config.l2reborn.email,
    password: body.password || config.l2reborn.password,
    gmailAppPass: body.gmailAppPass || config.l2reborn.gmailAppPass,
    twoCaptchaKey: body.twoCaptchaKey || config.l2reborn.twoCaptchaKey,
    signinUrl: config.l2reborn.signinUrl,
    shopUrl: config.l2reborn.shopUrl,
    turnstileSitekey: config.l2reborn.turnstileSitekey,
  };

  // Persist any newly-provided credentials to config immediately
  if (body.email) config.l2reborn.email = body.email;
  if (body.password) config.l2reborn.password = body.password;
  if (body.gmailAppPass) config.l2reborn.gmailAppPass = body.gmailAppPass;
  if (body.twoCaptchaKey) config.l2reborn.twoCaptchaKey = body.twoCaptchaKey;
  saveConfig(config);

  try {
    const result = await discoverSetup(creds);
    res.json(result);
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    ...loadStatus(),
    scheduler: schedulerStatus(),
    validation: validateConfig(loadConfig()),
    backups: listBackups(),
    wizard: wizardState(loadConfig()),
  });
});

app.listen(PORT, () => {
  console.log(`Product 1 running at http://localhost:${PORT}`);
});
