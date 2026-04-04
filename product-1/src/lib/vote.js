const { chromium } = require('playwright');
const { ImapFlow } = require('imapflow');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { loadConfig, loadStatus, saveStatus, COOKIE_PATH } = require('./config');
const { validateConfig } = require('./validate');
const { notify } = require('./notify');

function resolvePackagedChromiumExecutable() {
  const explicit = process.env.PRODUCT1_PLAYWRIGHT_EXECUTABLE_PATH;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const browsersPath = path.resolve(process.cwd(), 'node_modules', 'playwright-core', '.local-browsers');
  if (!fs.existsSync(browsersPath)) return undefined;
  const chromiumDirs = fs.readdirSync(browsersPath).filter(d => d.startsWith('chromium-')).sort().reverse();
  for (const dir of chromiumDirs) {
    const candidates = [
      path.join(browsersPath, dir, 'chrome-win', 'chrome.exe'),
      path.join(browsersPath, dir, 'chrome-linux64', 'chrome'),
      path.join(browsersPath, dir, 'chrome-linux', 'chrome'),
      path.join(browsersPath, dir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
    ];
    const found = candidates.find(c => fs.existsSync(c));
    if (found) return found;
  }
  return undefined;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    };
    const req = https.request(url, opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function solveTurnstile(config) {
  const sub = JSON.parse(await httpPost('https://api.2captcha.com/createTask', {
    clientKey: config.l2reborn.twoCaptchaKey,
    task: {
      type: 'TurnstileTaskProxyless',
      websiteURL: config.l2reborn.signinUrl,
      websiteKey: config.l2reborn.turnstileSitekey,
    },
  }));
  if (sub.errorId !== 0) throw new Error('2captcha failed: ' + JSON.stringify(sub));
  const taskId = sub.taskId;
  for (let i = 0; i < 100; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const poll = JSON.parse(await httpPost('https://api.2captcha.com/getTaskResult', {
      clientKey: config.l2reborn.twoCaptchaKey,
      taskId,
    }));
    if (poll.status === 'ready') return poll.solution.token;
    if (poll.errorId !== 0) throw new Error('2captcha error: ' + JSON.stringify(poll));
  }
  throw new Error('2captcha timeout');
}

async function doLogin(page, config, wflsToken = '') {
  await page.goto(config.l2reborn.signinUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  const token = await solveTurnstile(config);
  return await page.evaluate(async ({ cfg, token, wflsToken }) => {
    const nr = await fetch('/wp-admin/admin-ajax.php', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ action: 'l2mgm_nonce', nonce_name: 'l2mgm_login' }).toString()
    });
    const nd = await nr.json();
    if (!nd.success) return { error: 'nonce failed' };
    const lr = await fetch('/wp-admin/admin-ajax.php', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action: 'l2mgm_login', email: cfg.email, password: cfg.password,
        remember: '1', 'wfls-remember-device': '1',
        'cf-turnstile-response': token, 'wfls-email-verification': wflsToken,
        redirect_to: '/account', nonce: nd.data.nonce,
      }).toString()
    });
    return await lr.json();
  }, {
    cfg: {
      email: config.l2reborn.email,
      password: config.l2reborn.password,
    },
    token,
    wflsToken
  });
}

async function getVerificationLink(config, afterDate) {
  const client = new ImapFlow({
    host: 'imap.gmail.com', port: 993, secure: true,
    auth: { user: config.l2reborn.email, pass: config.l2reborn.gmailAppPass }, logger: false,
  });
  await client.connect();
  await client.mailboxOpen('INBOX');
  for (let i = 0; i < 12; i++) {
    const found = [];
    for await (const msg of client.fetch('1:*', { envelope: true })) {
      if (msg.envelope.from?.[0]?.address?.includes('l2reborn') &&
          msg.envelope.subject?.includes('Verification') &&
          new Date(msg.envelope.date) > afterDate) found.push(msg.seq);
    }
    if (found.length > 0) {
      const md = await client.fetchOne(found[found.length - 1], { source: true });
      const urls = md.source.toString().match(/https?:\/\/l2reborn\.org\/[^\s"<>]+/g) || [];
      await client.logout();
      return urls.find(u => u.includes('wfls-email-verification')) || null;
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  await client.logout();
  return null;
}

async function isLoggedIn(page) {
  try {
    const r = await page.evaluate(async () => {
      const res = await fetch('/wp-admin/admin-ajax.php?action=l2mgm_logged');
      return await res.json();
    });
    return r && r.success === true;
  } catch {
    return false;
  }
}

async function runVoteOnce() {
  const config = loadConfig();
  const status = loadStatus();
  const validation = validateConfig(config);
  if (!validation.ok) {
    const result = {
      ok: false,
      code: 'CONFIG_MISSING',
      summary: validation.errors.join('; '),
      at: new Date().toISOString(),
    };
    status.lastRunAt = result.at;
    status.lastResult = result.code;
    status.lastSummary = result.summary;
    status.consecutiveFailures = (status.consecutiveFailures || 0) + 1;
    saveStatus(status);
    return result;
  }

  fs.mkdirSync(path.dirname(COOKIE_PATH), { recursive: true });
  const executablePath = resolvePackagedChromiumExecutable();
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1400, height: 900 },
    });
    await context.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));

    let loggedIn = false;
    if (fs.existsSync(COOKIE_PATH)) {
      try {
        await context.addCookies(JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf8')));
        const cp = await context.newPage();
        await cp.goto('https://l2reborn.org/', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await cp.waitForTimeout(1500);
        loggedIn = await isLoggedIn(cp);
        await cp.close();
      } catch {}
    }

    if (!loggedIn) {
      const lp = await context.newPage();
      const beforeLogin = new Date();
      let result = await doLogin(lp, config);

      if (!result.success && result.error && result.error.includes('verification')) {
        const verifyUrl = await getVerificationLink(config, beforeLogin);
        if (!verifyUrl) throw new Error('No verification email');
        const vp = await context.newPage();
        await vp.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await vp.waitForTimeout(2000);
        await vp.close();
        const wflsToken = new URL(verifyUrl).searchParams.get('wfls-email-verification') || '';
        result = await doLogin(lp, config, wflsToken);
      }

      if (!result.success) throw new Error('Login failed: ' + JSON.stringify(result));
      fs.writeFileSync(COOKIE_PATH, JSON.stringify(await context.cookies(), null, 2));
      await lp.close();
    }

    const page = await context.newPage();
    await page.goto(config.l2reborn.shopUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    const tokenRes = await page.evaluate(async (sid) => {
      const r = await fetch('/wp-admin/admin-ajax.php?action=l2mgm_get_vip_token&server_id=' + sid);
      return await r.json();
    }, config.l2reborn.serverId);

    if (!tokenRes.success) throw new Error('Token failed: ' + JSON.stringify(tokenRes));
    const vipToken = tokenRes.data.token;
    await page.waitForTimeout(65000);

    const shopResult = await page.evaluate(async ({ serverId, account, characterId, vipToken }) => {
      const nr = await fetch('/wp-admin/admin-ajax.php', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'action=l2mgm_nonce&nonce_name=shop'
      });
      const nd = await nr.json();
      const sr = await fetch('/wp-admin/admin-ajax.php', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          action: 'l2mgm_donation_service_v2',
          _wpnonce: nd.data.nonce,
          service: 'exp_rune',
          server_id: serverId,
          account: account,
          character: characterId,
          vote_token: vipToken,
          vote_retries: '0',
        }).toString()
      });
      const raw = await sr.text();
      try { return JSON.parse(raw); } catch { return raw; }
    }, {
      serverId: config.l2reborn.serverId,
      account: config.l2reborn.account,
      characterId: config.l2reborn.characterId,
      vipToken
    });

    await page.close();

    const code = shopResult && shopResult.data && shopResult.data.error_code;
    const ok = !!(shopResult && shopResult.success) || code === 3;
    const summary = shopResult && shopResult.success
      ? `VIP ticket delivered to ${config.l2reborn.characterName || config.l2reborn.characterId}`
      : code === 3
        ? 'Already claimed recently (cooldown)'
        : JSON.stringify(shopResult);

    const result = {
      ok,
      code: ok ? (code === 3 ? 'COOLDOWN' : 'SUCCESS') : 'FAILED',
      summary,
      raw: shopResult,
      at: new Date().toISOString(),
    };

    status.lastRunAt = result.at;
    status.lastResult = result.code;
    status.lastSummary = result.summary;
    status.consecutiveFailures = ok ? 0 : (status.consecutiveFailures || 0) + 1;
    saveStatus(status);
    if (config.notifications && config.notifications.enabled) notify(result);
    return result;
  } catch (error) {
    const result = {
      ok: false,
      code: 'ERROR',
      summary: error.message,
      at: new Date().toISOString(),
    };
    status.lastRunAt = result.at;
    status.lastResult = result.code;
    status.lastSummary = result.summary;
    status.consecutiveFailures = (status.consecutiveFailures || 0) + 1;
    saveStatus(status);
    if (config.notifications && config.notifications.enabled) notify(result);
    return result;
  } finally {
    await browser.close();
  }
}

module.exports = { runVoteOnce };
