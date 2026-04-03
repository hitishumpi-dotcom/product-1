const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function firstRunFile() {
  return path.join(app.getPath('userData'), 'first-run.json');
}

function loadFirstRunState() {
  const p = firstRunFile();
  if (!fs.existsSync(p)) {
    return { completed: false, openedAt: null };
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function completeFirstRun() {
  const p = firstRunFile();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ completed: true, openedAt: new Date().toISOString() }, null, 2));
}

module.exports = { loadFirstRunState, completeFirstRun };
