const { chromium } = require('playwright');
const { ImapFlow } = require('imapflow');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { COOKIE_PATH } = require('./config');

// ── Debug logger ─────────────────────────────────────────────────────────────
const LOG_PATH = path.join(__dirname, '..', '..', 'data', 'discover-debug.log');

function dlog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
    fs.appendFileSync(LOG_PATH, line + '\n');
  } catch {}
}

function dlogObj(label, obj) {
  dlog(`${label}: ${JSON.stringify(obj)}`);
}

// ── Fallback server list ──────────────────────────────────────────────────────
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
  dlog(`[CAPTCHA] Submitting Turnstile to 2captcha... sitekey=${turnstileSitekey.substring(0, 10)}...`);
  const t0 = Date.now();

  const subRaw = await httpGet(
    `https://2captcha.com/in.php?key=${twoCaptchaKey}&method=turnstile&sitekey=${turnstileSitekey}&pageurl=${encodeURIComponent(signinUrl)}&json=1`
  );
  dlog(`[CAPTCHA] 2captcha submission response: ${subRaw}`);
  const sub = JSON.parse(subRaw);
  if (sub.status !== 1) throw new Error('2captcha submission failed: ' + JSON.stringify(sub));

  dlog(`[CAPTCHA] Task ID: ${sub.request} — polling every 2s...`);
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRaw = await httpGet(
      `https://2captcha.com/res.php?key=${twoCaptchaKey}&action=get&id=${sub.request}&json=1`
    );
    const poll = JSON.parse(pollRaw);
    dlog(`[CAPTCHA] Poll #${i + 1} (${Math.round((Date.now() - t0) / 1000)}s elapsed): ${pollRaw.substring(0, 120)}`);
    if (poll.status === 1) {
      dlog(`[CAPTCHA] Solved in ${Math.round((Date.now() - t0) / 1000)}s`);
      return poll.request;
    }
    if (poll.request !== 'CAPCHA_NOT_READY') throw new Error('2captcha error: ' + JSON.stringify(poll));
  }
  throw new Error('2captcha timeout after 120s — check your balance or key');
}

async function doLogin(page, config, wflsToken = '') {
  dlog(`[LOGIN] Navigating to signin page: ${config.signinUrl}`);
  await page.goto(config.signinUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  dlog('[LOGIN] Page loaded, waiting 2s...');
  await page.waitForTimeout(2000);

  dlog('[LOGIN] Starting captcha solve...');
  const t0 = Date.now();
  const token = await solveTurnstile(config.twoCaptchaKey, config.turnstileSitekey, config.signinUrl);
  dlog(`[LOGIN] Captcha token received in ${Math.round((Date.now() - t0) / 1000)}s. Submitting login form...`);
  dlog(`[LOGIN] wflsToken present: ${!!wflsToken}`);

  const result = await page.evaluate(async ({ cfg, token, wflsToken }) => {
    // Step 1: get nonce
    const nr = await fetch('/wp-admin/admin-ajax.php', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ action: 'l2mgm_nonce', nonce_name: 'l2mgm_login' }).toString()
    });
    const nd = await nr.json();
    if (!nd.success) return { error: 'nonce failed', nonceResponse: nd };

    // Step 2: login
    const lr = await fetch('/wp-admin/admin-ajax.php', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action: 'l2mgm_login', email: cfg.email, password: cfg.password,
        remember: '1', 'wfls-remember-device': '1',
        'cf-turnstile-response': token, 'wfls-email-verification': wflsToken,
        redirect_to: '/account', nonce: nd.data.nonce,
      }).toString()
    });
    const raw = await lr.text();
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { parseError: true, raw }; }
    return parsed;
  }, {
    cfg: { email: config.email, password: config.password },
    token,
    wflsToken
  });

  dlogObj('[LOGIN] Server response', result);
  return result;
}

async function getVerificationLink(email, gmailAppPass, afterDate) {
  dlog(`[IMAP] Connecting to Gmail for ${email}...`);
  let client;
  try {
    client = new ImapFlow({
      host: 'imap.gmail.com', port: 993, secure: true,
      auth: { user: email, pass: gmailAppPass }, logger: false,
    });
    await client.connect();
    dlog('[IMAP] Connected successfully');
  } catch (err) {
    dlog(`[IMAP] Connection FAILED: ${err.message}`);
    const msg = err.message || '';
    if (msg.includes('Invalid credentials') || msg.includes('AUTHENTICATIONFAILED')) {
      throw new Error('Gmail IMAP login failed — check your Gmail App Password.');
    }
    throw new Error(`Gmail IMAP connection failed: ${msg}`);
  }

  const TIMEOUT_MS = 15 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;
  dlog(`[IMAP] Watching for verification email. afterDate=${afterDate.toISOString()} timeout=15min`);

  async function scanForUrl() {
    for (const mailbox of ['INBOX', '[Gmail]/All Mail']) {
      try {
        await client.mailboxOpen(mailbox);
        dlog(`[IMAP] Scanning mailbox: ${mailbox}`);
      } catch (e) {
        dlog(`[IMAP] Could not open ${mailbox}: ${e.message}`);
        continue;
      }
      const found = [];
      let scanned = 0;
      for await (const msg of client.fetch('1:*', { envelope: true })) {
        scanned++;
        const from = msg.envelope.from?.[0]?.address?.toLowerCase() || '';
        const subject = msg.envelope.subject?.toLowerCase() || '';
        const date = new Date(msg.envelope.date);
        const isNew = date > afterDate;
        const isFromReborn = from.includes('l2reborn') || from.includes('reborn');
        const isVerification = subject.includes('verif') || subject.includes('login') || subject.includes('confirm');
        if (isNew) {
          dlog(`[IMAP] New email: from=${from} subject="${msg.envelope.subject}" date=${date.toISOString()} fromReborn=${isFromReborn} isVerif=${isVerification}`);
        }
        if (isFromReborn && isVerification && isNew) {
          found.push(msg.seq);
        }
      }
      dlog(`[IMAP] Scanned ${scanned} emails in ${mailbox}, ${found.length} match(es)`);
      for (const seq of found) {
        const md = await client.fetchOne(seq, { source: true });
        const body = md.source.toString();
        const urls = body.match(/https?:\/\/l2reborn\.org\/[^\s"<>\\]+/g) || [];
        dlog(`[IMAP] URLs found in email body: ${urls.length}`);
        urls.forEach(u => dlog(`[IMAP]   URL: ${u.substring(0, 100)}`));
        const verifyUrl = urls.find(u => u.includes('wfls-email-verification'));
        if (verifyUrl) {
          dlog(`[IMAP] Verification URL found! Length=${verifyUrl.length}`);
          await client.logout();
          return verifyUrl;
        }
        dlog('[IMAP] No wfls-email-verification URL in this email');
      }
    }
    return null;
  }

  // Immediate scan — email might already be there from captcha solving time
  dlog('[IMAP] Running immediate scan...');
  const immediate = await scanForUrl();
  if (immediate) return immediate;

  // IDLE mode — Gmail pushes notification the instant new mail arrives
  dlog('[IMAP] No email yet — entering IDLE mode (waiting for Gmail push)...');
  await client.mailboxOpen('INBOX');
  while (Date.now() < deadline) {
    const remaining = Math.round((deadline - Date.now()) / 1000);
    dlog(`[IMAP] IDLE wait... ${remaining}s remaining`);
    try {
      await Promise.race([
        client.idle(),
        new Promise(r => setTimeout(r, Math.min(deadline - Date.now(), 5 * 60 * 1000))),
      ]);
      dlog('[IMAP] IDLE interrupted — new mail signal or timeout, scanning...');
    } catch (e) {
      dlog(`[IMAP] IDLE error: ${e.message} — scanning anyway`);
    }
    const found = await scanForUrl();
    if (found) return found;
  }

  dlog('[IMAP] 15 minute timeout reached — no verification email found');
  try { await client.logout(); } catch {}
  return null;
}

async function isLoggedIn(page) {
  try {
    const r = await page.evaluate(async () => {
      const res = await fetch('/wp-admin/admin-ajax.php?action=l2mgm_logged');
      return await res.json();
    });
    dlog(`[SESSION] isLoggedIn check: ${JSON.stringify(r)}`);
    return r && r.success === true;
  } catch (e) {
    dlog(`[SESSION] isLoggedIn check failed: ${e.message}`);
    return false;
  }
}

async function discoverSetup(creds) {
  // Clear previous log
  try { fs.writeFileSync(LOG_PATH, ''); } catch {}
  dlog('════════════════════════════════════════');
  dlog('DISCOVERY STARTED');
  dlog('════════════════════════════════════════');
  dlog(`email: ${creds.email}`);
  dlog(`password set: ${!!creds.password}`);
  dlog(`gmailAppPass set: ${!!creds.gmailAppPass}`);
  dlog(`twoCaptchaKey set: ${!!creds.twoCaptchaKey}`);
  dlog(`signinUrl: ${creds.signinUrl || 'https://l2reborn.org/signin/'}`);
  dlog(`cookiePath: ${COOKIE_PATH}`);
  dlog(`cookieExists: ${fs.existsSync(COOKIE_PATH)}`);

  const {
    email, password, gmailAppPass, twoCaptchaKey,
    signinUrl = 'https://l2reborn.org/signin/',
    shopUrl = 'https://l2reborn.org/shop/',
    turnstileSitekey = '0x4AAAAAAAPFfPxwacy3GCxf',
  } = creds;

  if (!email || !password) throw new Error('Email and password are required for discovery.');

  dlog('[BROWSER] Launching Playwright Chromium...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  dlog('[BROWSER] Browser launched');

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1400, height: 900 },
    });
    await context.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));

    // Try saved session first
    let loggedIn = false;
    if (fs.existsSync(COOKIE_PATH)) {
      dlog('[SESSION] Cookie file found — trying saved session...');
      try {
        const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, 'utf8'));
        dlog(`[SESSION] Loaded ${cookies.length} cookies`);
        await context.addCookies(cookies);
        const cp = await context.newPage();
        dlog('[SESSION] Navigating to l2reborn.org to check session...');
        await cp.goto('https://l2reborn.org/', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await cp.waitForTimeout(1500);
        loggedIn = await isLoggedIn(cp);
        dlog(`[SESSION] Session valid: ${loggedIn}`);
        await cp.close();
      } catch (e) {
        dlog(`[SESSION] Cookie restore failed: ${e.message}`);
      }
    } else {
      dlog('[SESSION] No cookie file — fresh login required');
    }

    if (!loggedIn) {
      if (!twoCaptchaKey) throw new Error('Not logged in. Enter your 2Captcha key so Discovery can log in for you.');

      const lp = await context.newPage();
      const beforeLogin = new Date();
      dlog(`[FLOW] beforeLogin timestamp: ${beforeLogin.toISOString()}`);

      // Start IMAP watcher BEFORE login (runs in parallel with captcha)
      dlog('[FLOW] Starting IMAP watcher in parallel with login...');
      const emailWatchPromise = gmailAppPass
        ? getVerificationLink(email, gmailAppPass, beforeLogin)
        : Promise.resolve(null);

      dlog('[FLOW] Starting login (captcha + form submit)...');
      let result = await doLogin(lp, { email, password, signinUrl, turnstileSitekey, twoCaptchaKey });
      dlog(`[FLOW] Login result: success=${result.success} error=${result.error || 'none'}`);

      if (!result.success && result.error && result.error.includes('verification')) {
        dlog('[FLOW] Email verification required — waiting for IMAP to deliver URL...');
        if (!gmailAppPass) throw new Error('Login requires email verification but no Gmail App Password is set.');
        const verifyUrl = await emailWatchPromise;
        if (!verifyUrl) throw new Error('No verification email found in Gmail after 15 minutes.');
        dlog(`[FLOW] Got verify URL — visiting it now...`);
        const vp = await context.newPage();
        await vp.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        dlog('[FLOW] Verification URL visited, waiting 2s...');
        await vp.waitForTimeout(2000);
        await vp.close();
        const wflsToken = new URL(verifyUrl).searchParams.get('wfls-email-verification') || '';
        dlog(`[FLOW] wflsToken extracted (length=${wflsToken.length}), re-submitting login...`);
        result = await doLogin(lp, { email, password, signinUrl, turnstileSitekey, twoCaptchaKey }, wflsToken);
        dlog(`[FLOW] Second login result: success=${result.success} error=${result.error || 'none'}`);
      }

      if (!result.success) throw new Error('Login failed: ' + JSON.stringify(result));
      const savedCookies = await context.cookies();
      fs.writeFileSync(COOKIE_PATH, JSON.stringify(savedCookies, null, 2));
      dlog(`[FLOW] Login successful — saved ${savedCookies.length} cookies to ${COOKIE_PATH}`);
      await lp.close();
    } else {
      dlog('[FLOW] Using existing session — skipping login');
    }

    // Discover servers
    dlog('[DISCOVER] Loading shop page to discover servers...');
    const shopPage = await context.newPage();
    await shopPage.goto(shopUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await shopPage.waitForTimeout(2000);

    const servers = await shopPage.evaluate(async () => {
      try {
        const r = await fetch('/wp-admin/admin-ajax.php?action=l2mgm_get_servers');
        const d = await r.json();
        if (d.success && Array.isArray(d.data) && d.data.length) {
          return d.data.map(s => ({ id: String(s.id ?? s.server_id ?? s), name: s.name || s.server_name || `Server ${s.id ?? s}` }));
        }
      } catch {}
      const results = [];
      document.querySelectorAll('select').forEach(sel => {
        const name = (sel.name || sel.id || '').toLowerCase();
        if (!name.includes('server')) return;
        sel.querySelectorAll('option').forEach(opt => {
          if (opt.value) results.push({ id: opt.value, name: opt.textContent.trim() || `Server ${opt.value}` });
        });
      });
      if (results.length) return results;
      document.querySelectorAll('[data-server-id], [data-server]').forEach(el => {
        const id = el.dataset.serverId || el.dataset.server;
        if (id && !results.find(r => r.id === id)) {
          results.push({ id, name: el.textContent.trim() || `Server ${id}` });
        }
      });
      return results;
    });

    dlog(`[DISCOVER] Servers found: ${servers.length} — ${JSON.stringify(servers)}`);
    await shopPage.close();

    // Discover characters
    dlog('[DISCOVER] Loading account page to discover characters...');
    const accountPage = await context.newPage();
    await accountPage.goto('https://l2reborn.org/account/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await accountPage.waitForTimeout(2000);

    const accountData = await accountPage.evaluate(async () => {
      const result = { account: '', characters: [] };
      try {
        const r = await fetch('/wp-admin/admin-ajax.php?action=l2mgm_get_characters');
        const d = await r.json();
        result._rawCharacters = JSON.stringify(d).substring(0, 2000);
        if (d.success && Array.isArray(d.data)) {
          d.data.forEach(c => {
            result.characters.push({
              id: String(c.id || c.char_id || c.character_id || ''),
              name: c.name || c.char_name || c.character_name || c.nickname || c.char_nickname || '',
              account: c.account || c.login || '',
              serverId: String(c.server_id || c.serverId || ''),
            });
          });
        }
      } catch {}
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
      const accountInput = document.querySelector('input[name="account"], input[name="login"], [data-account]');
      if (accountInput) result.account = accountInput.value || accountInput.dataset.account || '';
      if (!result.account) {
        document.querySelectorAll('label, th, dt').forEach(el => {
          const text = el.textContent.toLowerCase();
          if (text.includes('account') || text.includes('login')) {
            const sibling = el.nextElementSibling;
            if (sibling) result.account = result.account || sibling.textContent.trim();
          }
        });
      }
      if (!result.characters.length) {
        document.querySelectorAll('tr[data-char-id], tr[data-character-id], [data-char-id], [data-character-id]').forEach(el => {
          const id = el.dataset.charId || el.dataset.characterId;
          if (!id) return;
          result._domSample = result._domSample || el.innerHTML.substring(0, 500);
          const name = el.dataset.charName || el.querySelector('.char-name, .character-name')?.textContent.trim() || '';
          const acc = el.dataset.account || el.dataset.login || '';
          const sid = String(el.dataset.serverId || el.dataset.server || el.dataset.serverid || '');
          result.characters.push({ id, name, account: acc, serverId: sid });
        });
      }
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

    // Deduplicate by ID, preferring entries with a real name
    const INVALID_NAMES = new Set(['unstuck', 'unknown', '']);
    const charMap = new Map();
    for (const c of accountData.characters) {
      const existing = charMap.get(c.id);
      const nameClean = (c.name || '').trim();
      const nameIsValid = nameClean && !INVALID_NAMES.has(nameClean.toLowerCase());
      if (!existing || (nameIsValid && !charMap.get(c.id)?._nameValid)) {
        charMap.set(c.id, { ...c, name: nameClean, _nameValid: nameIsValid });
      }
    }
    const deduped = Array.from(charMap.values()).map(({ _nameValid, ...c }) => c);
    accountData.characters = deduped;

    dlog(`[DISCOVER] Raw API response: ${accountData._rawCharacters || 'none'}`);
    dlog(`[DISCOVER] DOM sample: ${accountData._domSample || 'none'}`);
    dlog(`[DISCOVER] Characters found: ${accountData.characters.length}`);
    dlog(`[DISCOVER] Account: "${accountData.account}"`);
    accountData.characters.forEach((c, i) => dlog(`[DISCOVER] Character ${i + 1}: id=${c.id} name=${c.name} account=${c.account} server=${c.serverId}`));
    await accountPage.close();

    dlog('════════════════════════════════════════');
    dlog('DISCOVERY COMPLETE');
    dlog('════════════════════════════════════════');

    return {
      ok: true,
      servers: servers.length ? servers : null,
      characters: accountData.characters,
      account: accountData.account,
      serversDiscovered: servers.length > 0,
      charactersDiscovered: accountData.characters.length > 0,
    };
  } catch (err) {
    dlog(`════════════════════════════════════════`);
    dlog(`DISCOVERY FAILED: ${err.message}`);
    dlog(`Stack: ${err.stack}`);
    dlog(`════════════════════════════════════════`);
    throw err;
  } finally {
    await browser.close();
    dlog('[BROWSER] Browser closed');
    dlog(`Log saved to: ${LOG_PATH}`);
  }
}

module.exports = { discoverSetup, FALLBACK_SERVERS };
