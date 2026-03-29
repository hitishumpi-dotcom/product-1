#!/usr/bin/env node
/**
 * L2 Reborn - Fully Automated VIP Ticket Vote (12h Exp Rune)
 *
 * Flow:
 * 1. Login (cookie cache, falls back to Turnstile + email verification)
 * 2. Get VIP token from l2reborn shop
 * 3. Wait 65 seconds (server-side timer tied to token iat)
 * 4. Submit exp_rune form → ticket delivered to UrekMazino
 */

const { chromium } = require('/tmp/pw-shot/node_modules/playwright');
const { ImapFlow } = require('/tmp/pw-shot/node_modules/imapflow');
const fs = require('fs');
const https = require('https');

const CONFIG = {
  email: 'marios.kouranis5@gmail.com',
  password: 'hakuhaku121',
  gmailAppPass: 'cmlmybaxymfhisgb',
  serverId: '3',
  account: 'up_shinogr94',
  characterId: '273370023', // UrekMazino
  signinUrl: 'https://l2reborn.org/signin/',
  shopUrl: 'https://l2reborn.org/shop/',
  cookiePath: '/tmp/pw-shot/l2reborn-cookies.json',
  twoCaptchaKey: '130fbaa6b1eef7667c5b2c06a140040c',
  turnstileSitekey: '0x4AAAAAAAPFfPxwacy3GCxf',
};

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

async function solveTurnstile() {
  console.log('[captcha] solving...');
  const sub = JSON.parse(await httpGet(
    `https://2captcha.com/in.php?key=${CONFIG.twoCaptchaKey}&method=turnstile&sitekey=${CONFIG.turnstileSitekey}&pageurl=${encodeURIComponent(CONFIG.signinUrl)}&json=1`
  ));
  if (sub.status !== 1) throw new Error('2captcha failed: ' + JSON.stringify(sub));
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const poll = JSON.parse(await httpGet(
      `https://2captcha.com/res.php?key=${CONFIG.twoCaptchaKey}&action=get&id=${sub.request}&json=1`
    ));
    if (poll.status === 1) { console.log('[captcha] solved!'); return poll.request; }
    if (poll.request !== 'CAPCHA_NOT_READY') throw new Error('2captcha error: ' + JSON.stringify(poll));
  }
  throw new Error('2captcha timeout');
}

async function doLogin(page, wflsToken = '') {
  await page.goto(CONFIG.signinUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  const token = await solveTurnstile();
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
  }, { cfg: CONFIG, token, wflsToken });
}

async function getVerificationLink(afterDate) {
  const client = new ImapFlow({
    host: 'imap.gmail.com', port: 993, secure: true,
    auth: { user: CONFIG.email, pass: CONFIG.gmailAppPass }, logger: false,
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
    console.log('[imap] waiting... (' + (i + 1) + '/12)');
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
  } catch { return false; }
}

(async () => {
  console.log('[l2vote] start', new Date().toISOString());

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1400, height: 900 },
  });
  await context.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));

  // Load saved cookies
  let loggedIn = false;
  if (fs.existsSync(CONFIG.cookiePath)) {
    try {
      await context.addCookies(JSON.parse(fs.readFileSync(CONFIG.cookiePath)));
      const cp = await context.newPage();
      await cp.goto('https://l2reborn.org/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await cp.waitForTimeout(1500);
      loggedIn = await isLoggedIn(cp);
      await cp.close();
      console.log('[login] cookie auth:', loggedIn);
    } catch {}
  }

  if (!loggedIn) {
    const lp = await context.newPage();
    const beforeLogin = new Date();
    let result = await doLogin(lp);
    console.log('[login] attempt 1:', result.success ? 'ok' : (result.error || JSON.stringify(result).substring(0, 80)));

    if (!result.success && result.error && result.error.includes('verification')) {
      const verifyUrl = await getVerificationLink(beforeLogin);
      if (!verifyUrl) throw new Error('No verification email');
      const vp = await context.newPage();
      await vp.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await vp.waitForTimeout(2000);
      await vp.close();
      const wflsToken = new URL(verifyUrl).searchParams.get('wfls-email-verification') || '';
      result = await doLogin(lp, wflsToken);
      console.log('[login] attempt 2:', result.success ? 'ok' : JSON.stringify(result));
    }

    if (!result.success) throw new Error('Login failed: ' + JSON.stringify(result));
    loggedIn = true;
    fs.writeFileSync(CONFIG.cookiePath, JSON.stringify(await context.cookies(), null, 2));
    console.log('[login] success, cookies saved');
    await lp.close();
  }

  // Open shop, get token, wait 65s, submit
  const page = await context.newPage();
  await page.goto(CONFIG.shopUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Get VIP token
  const tokenRes = await page.evaluate(async (sid) => {
    const r = await fetch('/wp-admin/admin-ajax.php?action=l2mgm_get_vip_token&server_id=' + sid);
    return await r.json();
  }, CONFIG.serverId);

  if (!tokenRes.success) throw new Error('Token failed: ' + JSON.stringify(tokenRes));
  const vipToken = tokenRes.data.token;
  const tokenTime = new Date();
  console.log('[vote] token obtained at', tokenTime.toISOString(), '— waiting 65s...');

  // Wait 65s (server validates token age >= 60s)
  await page.waitForTimeout(65000);

  // Submit shop form
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
  }, { serverId: CONFIG.serverId, account: CONFIG.account, characterId: CONFIG.characterId, vipToken });

  console.log('[shop] result:', JSON.stringify(shopResult));
  await page.close();
  await browser.close();

  if (shopResult && shopResult.success) {
    console.log('[l2vote] SUCCESS - VIP ticket delivered to UrekMazino');
    process.exit(0);
  } else {
    const code = shopResult && shopResult.data && shopResult.data.error_code;
    if (code === 3) {
      console.log('[l2vote] Already claimed recently (cooldown). Next run in 12h.');
      process.exit(0); // not a real error
    }
    console.error('[l2vote] FAILED:', JSON.stringify(shopResult));
    process.exit(1);
  }
})().catch(err => {
  console.error('[l2vote] ERROR:', err.message);
  process.exit(1);
});
