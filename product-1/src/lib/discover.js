const { chromium } = require('playwright');
const { ImapFlow } = require('imapflow');
const fs = require('fs');
const https = require('https');
const { COOKIE_PATH } = require('./config');

// Fallback server list — real names/IDs will be overridden by live discovery
const FALLBACK_SERVERS = [
  { id: '1', name: 'Server 1' },
  { id: '2', name: 'Server 2' },
  { id: '3', name: 'Server 3' },
  { id: '4', name: 'Server 4' },
  { id: '5', name: 'Server 5' },
];

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

async function solveTurnstile(twoCaptchaKey, turnstileSitekey, signinUrl) {
  const sub = JSON.parse(await httpGet(
    `https://2captcha.com/in.php?key=${twoCaptchaKey}&method=turnstile&sitekey=${turnstileSitekey}&pageurl=${encodeURIComponent(signinUrl)}&json=1`
  ));
  if (sub.status !== 1) throw new Error('2captcha submission failed: ' + JSON.stringify(sub));
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const poll = JSON.parse(await httpGet(
      `https://2captcha.com/res.php?key=${twoCaptchaKey}&action=get&id=${sub.request}&json=1`
    ));
    if (poll.status === 1) return poll.request;
    if (poll.request !== 'CAPCHA_NOT_READY') throw new Error('2captcha error: ' + JSON.stringify(poll));
  }
  throw new Error('2captcha timeout after 150s — check your balance or key');
}

async function doLogin(page, config, wflsToken = '') {
  await page.goto(config.signinUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  const token = await solveTurnstile(config.twoCaptchaKey, config.turnstileSitekey, config.signinUrl);
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
    cfg: { email: config.email, password: config.password },
    token,
    wflsToken
  });
}

async function getVerificationLink(email, gmailAppPass, afterDate) {
  let client;
  try {
    client = new ImapFlow({
      host: 'imap.gmail.com', port: 993, secure: true,
      auth: { user: email, pass: gmailAppPass }, logger: false,
    });
    await client.connect();
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('Invalid credentials') || msg.includes('AUTHENTICATIONFAILED')) {
      throw new Error('Gmail IMAP login failed — check your Gmail App Password. Regular Gmail passwords do not work; you need a 16-character App Password from myaccount.google.com/apppasswords.');
    }
    throw new Error(`Gmail IMAP connection failed: ${msg}`);
  }

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

/**
 * discoverSetup — logs in (reusing saved cookies if valid) and scrapes
 * available servers and characters from the L2Reborn site.
 *
 * @param {object} creds - { email, password, gmailAppPass, twoCaptchaKey,
 *                           signinUrl, shopUrl, turnstileSitekey }
 * @returns {Promise<{ ok, servers, characters, account, serversDiscovered, charactersDiscovered }>}
 */
async function discoverSetup(creds) {
  const {
    email, password, gmailAppPass, twoCaptchaKey,
    signinUrl = 'https://l2reborn.org/signin/',
    shopUrl = 'https://l2reborn.org/shop/',
    turnstileSitekey = '0x4AAAAAAAPFfPxwacy3GCxf',
  } = creds;

  if (!email || !password) throw new Error('Email and password are required for discovery.');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1400, height: 900 },
    });
    await context.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));

    // Restore saved session
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
      if (!twoCaptchaKey) {
        throw new Error('Not logged in. Enter your 2Captcha key so Discovery can log in for you.');
      }
      const lp = await context.newPage();
      const beforeLogin = new Date();
      let result = await doLogin(lp, { email, password, signinUrl, turnstileSitekey, twoCaptchaKey });

      if (!result.success && result.error && result.error.includes('verification')) {
        if (!gmailAppPass) throw new Error('Login requires email verification but no Gmail App Password is set.');
        const verifyUrl = await getVerificationLink(email, gmailAppPass, beforeLogin);
        if (!verifyUrl) throw new Error('No verification email found in Gmail after 60s.');
        const vp = await context.newPage();
        await vp.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await vp.waitForTimeout(2000);
        await vp.close();
        const wflsToken = new URL(verifyUrl).searchParams.get('wfls-email-verification') || '';
        result = await doLogin(lp, { email, password, signinUrl, turnstileSitekey, twoCaptchaKey }, wflsToken);
      }

      if (!result.success) throw new Error('Login failed: ' + JSON.stringify(result));
      fs.writeFileSync(COOKIE_PATH, JSON.stringify(await context.cookies(), null, 2));
      await lp.close();
    }

    // --- Discover servers from the shop page ---
    const shopPage = await context.newPage();
    await shopPage.goto(shopUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await shopPage.waitForTimeout(2000);

    const servers = await shopPage.evaluate(async () => {
      // Try dedicated AJAX endpoint first
      try {
        const r = await fetch('/wp-admin/admin-ajax.php?action=l2mgm_get_servers');
        const d = await r.json();
        if (d.success && Array.isArray(d.data) && d.data.length) {
          return d.data.map(s => ({ id: String(s.id ?? s.server_id ?? s), name: s.name || s.server_name || `Server ${s.id ?? s}` }));
        }
      } catch {}

      // Scrape select elements
      const results = [];
      document.querySelectorAll('select').forEach(sel => {
        const name = (sel.name || sel.id || '').toLowerCase();
        if (!name.includes('server')) return;
        sel.querySelectorAll('option').forEach(opt => {
          if (opt.value) results.push({ id: opt.value, name: opt.textContent.trim() || `Server ${opt.value}` });
        });
      });
      if (results.length) return results;

      // Scrape data-server-id buttons/divs
      document.querySelectorAll('[data-server-id], [data-server]').forEach(el => {
        const id = el.dataset.serverId || el.dataset.server;
        if (id && !results.find(r => r.id === id)) {
          results.push({ id, name: el.textContent.trim() || `Server ${id}` });
        }
      });
      return results;
    });

    await shopPage.close();

    // --- Discover account + characters from account page ---
    const accountPage = await context.newPage();
    await accountPage.goto('https://l2reborn.org/account/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await accountPage.waitForTimeout(2000);

    const accountData = await accountPage.evaluate(async () => {
      const result = { account: '', characters: [] };

      // Try AJAX for character list
      try {
        const r = await fetch('/wp-admin/admin-ajax.php?action=l2mgm_get_characters');
        const d = await r.json();
        if (d.success && Array.isArray(d.data)) {
          d.data.forEach(c => {
            result.characters.push({
              id: String(c.id || c.char_id || c.character_id || ''),
              name: c.name || c.char_name || c.character_name || '',
              account: c.account || c.login || '',
              serverId: String(c.server_id || c.serverId || ''),
            });
          });
        }
      } catch {}

      // Try AJAX with account parameter
      if (!result.characters.length) {
        try {
          const r = await fetch('/wp-admin/admin-ajax.php?action=l2mgm_get_account_characters');
          const d = await r.json();
          if (d.success && Array.isArray(d.data)) {
            d.data.forEach(c => {
              result.characters.push({
                id: String(c.id || c.char_id || ''),
                name: c.name || c.char_name || '',
                account: c.account || '',
                serverId: String(c.server_id || ''),
              });
            });
          }
        } catch {}
      }

      // Scrape account name from page
      const accountInput = document.querySelector('input[name="account"], input[name="login"], [data-account]');
      if (accountInput) result.account = accountInput.value || accountInput.dataset.account || '';

      // Look for account/login text near labels
      if (!result.account) {
        document.querySelectorAll('label, th, dt').forEach(el => {
          const text = el.textContent.toLowerCase();
          if (text.includes('account') || text.includes('login')) {
            const sibling = el.nextElementSibling;
            if (sibling) result.account = result.account || sibling.textContent.trim();
          }
        });
      }

      // Scrape character rows from table/list
      if (!result.characters.length) {
        document.querySelectorAll('tr[data-char-id], tr[data-character-id], [data-char-id], [data-character-id]').forEach(el => {
          const id = el.dataset.charId || el.dataset.characterId;
          if (!id) return;
          const name = el.querySelector('.char-name, .character-name, td:first-child, [data-char-name]')?.textContent.trim() || '';
          const acc = el.dataset.account || el.dataset.login || '';
          const sid = String(el.dataset.serverId || el.dataset.server || '');
          result.characters.push({ id, name, account: acc, serverId: sid });
        });
      }

      // Scrape from table rows — look for numeric IDs in cells
      if (!result.characters.length) {
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
          const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.toLowerCase().trim());
          const idIdx = headers.findIndex(h => h.includes('id') || h.includes('char'));
          const nameIdx = headers.findIndex(h => h.includes('name'));
          const accIdx = headers.findIndex(h => h.includes('account') || h.includes('login'));
          if (idIdx === -1 && nameIdx === -1) return;
          table.querySelectorAll('tbody tr').forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            const id = idIdx >= 0 ? cells[idIdx]?.textContent.trim() : '';
            const name = nameIdx >= 0 ? cells[nameIdx]?.textContent.trim() : cells[0]?.textContent.trim();
            const acc = accIdx >= 0 ? cells[accIdx]?.textContent.trim() : '';
            if ((id && /^\d+$/.test(id)) || name) {
              result.characters.push({ id: id || '', name: name || '', account: acc, serverId: '' });
            }
          });
        });
      }

      return result;
    });

    await accountPage.close();

    return {
      ok: true,
      servers: servers.length ? servers : null,
      characters: accountData.characters,
      account: accountData.account,
      serversDiscovered: servers.length > 0,
      charactersDiscovered: accountData.characters.length > 0,
    };
  } finally {
    await browser.close();
  }
}

module.exports = { discoverSetup, FALLBACK_SERVERS };
