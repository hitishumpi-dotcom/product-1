#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const HOME = process.env.HOME || '/home/user';
const CONFIG_PATH = path.join(HOME, '.openclaw', 'openclaw.json');
const RUNS_PATH = path.join(HOME, '.openclaw', 'cron', 'runs', 'dd57a1a0-51f2-4b0a-b0fe-a6fe8c29cc96.jsonl');
const TELEGRAM_CHAT_ID = '1381699107';
const DISCORD_CHANNEL_ID = '1486653715405602927';

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

function buildReport() {
  const lines = fs.readFileSync(RUNS_PATH, 'utf8').trim().split('\n').filter(Boolean);
  const last = JSON.parse(lines[lines.length - 1]);
  const status = last.status || 'unknown';
  const summary = last.summary || '';
  const err = last.error || '';
  const when = last.ts ? new Date(last.ts).toISOString() : '';
  return [
    'L2 Reborn VIP Vote report',
    `status: ${status}`,
    when ? `time: ${when}` : '',
    summary ? `summary: ${summary}` : '',
    err ? `error: ${err}` : '',
  ].filter(Boolean).join('\n');
}

async function sendTelegram(botToken, text) {
  await fetchJson(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
  });
}

async function sendDiscord(token, text) {
  await fetchJson(`https://discord.com/api/v10/channels/${DISCORD_CHANNEL_ID}/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bot ${token}`,
    },
    body: JSON.stringify({ content: text }),
  });
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const telegramToken = cfg?.channels?.telegram?.botToken;
  const discordToken = cfg?.channels?.discord?.token;
  if (!telegramToken) throw new Error('Missing Telegram bot token');
  if (!discordToken) throw new Error('Missing Discord bot token');
  const report = buildReport();
  await sendTelegram(telegramToken, report);
  await sendDiscord(discordToken, report);
  console.log(report);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
