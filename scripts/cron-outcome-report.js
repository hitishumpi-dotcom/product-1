#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const JOB_ID = 'dd57a1a0-51f2-4b0a-b0fe-a6fe8c29cc96';
const runPath = path.join(process.env.HOME || '/home/user', '.openclaw/cron/runs', `${JOB_ID}.jsonl`);

try {
  const lines = fs.readFileSync(runPath, 'utf8').trim().split('\n').filter(Boolean);
  const last = JSON.parse(lines[lines.length - 1]);
  const status = last.status || 'unknown';
  const summary = last.summary || '';
  const err = last.error || '';
  const when = last.ts ? new Date(last.ts).toISOString() : '';
  const msg = [
    `L2 Reborn VIP Vote report`,
    `status: ${status}`,
    when ? `time: ${when}` : '',
    summary ? `summary: ${summary}` : '',
    err ? `error: ${err}` : ''
  ].filter(Boolean).join('\n');
  console.log(msg);
} catch (e) {
  console.log(`L2 Reborn VIP Vote report\nstatus: error\nerror: ${e.message}`);
}
