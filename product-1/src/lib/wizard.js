const { validateConfig } = require('./validate');

function wizardState(config) {
  const validation = validateConfig(config);
  const steps = [
    { id: 1, key: 'credentials', title: 'Website credentials', done: !!(config.l2reborn.email && config.l2reborn.password) },
    { id: 2, key: 'verification', title: 'Verification email access (Gmail App Password)', done: !!config.l2reborn.gmailAppPass },
    { id: 3, key: 'captcha', title: 'Captcha solver (2Captcha key)', done: !!config.l2reborn.twoCaptchaKey },
    { id: 4, key: 'game', title: 'Server & character (use Login & Discover)', done: !!(config.l2reborn.account && config.l2reborn.characterId) },
    { id: 5, key: 'automation', title: 'Schedule & run', done: validation.ok },
  ];
  const next = steps.find(s => !s.done) || null;
  return {
    ready: validation.ok,
    steps,
    next,
    validation,
  };
}

module.exports = { wizardState };
