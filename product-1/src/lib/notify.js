const fs = require('fs');
const path = require('path');

const LOG_PATH = path.join(__dirname, '..', '..', 'data', 'notifications.log');

function logNotification(message) {
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${message}\n`);
}

function notify(result) {
  const text = `${result.code}: ${result.summary}`;
  logNotification(text);
  return { ok: true, logged: true, text };
}

module.exports = { notify, logNotification, LOG_PATH };
