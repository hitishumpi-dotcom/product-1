const { loadConfig, loadStatus, saveStatus } = require('./lib/config');
const { checkForUpdates } = require('./lib/update');
const { runVoteOnce } = require('./lib/vote');

async function runOnce() {
  await checkForUpdates();
  const result = await runVoteOnce();
  console.log(JSON.stringify(result, null, 2));
}

async function runScheduler() {
  const config = loadConfig();
  const status = loadStatus();
  status.schedulerRunning = true;
  status.schedulerPid = process.pid;
  saveStatus(status);

  const loop = async () => {
    await checkForUpdates();
    const freshConfig = loadConfig();
    if (freshConfig.schedule.enabled) {
      await runVoteOnce();
    }
  };

  await loop();
  const ms = Math.max(1, Number(config.schedule.intervalHours || 12)) * 60 * 60 * 1000;
  setInterval(loop, ms);
}

const mode = process.argv[2];
if (mode === 'run-once') {
  runOnce();
} else if (mode === 'scheduler') {
  runScheduler();
} else if (mode === 'check-updates') {
  checkForUpdates().then(result => console.log(JSON.stringify(result, null, 2)));
} else {
  console.log('Usage: node src/runner.js [run-once|scheduler|check-updates]');
}
