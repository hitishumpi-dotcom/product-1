function validateConfig(config) {
  const errors = [];
  if (!config.l2reborn.email) errors.push('Email is required');
  if (!config.l2reborn.password) errors.push('Password is required');
  if (!config.l2reborn.gmailAppPass) errors.push('Gmail App Password is required');
  if (!config.l2reborn.account) errors.push('Game account is required');
  if (!config.l2reborn.characterId) errors.push('Character ID is required');
  if (!config.l2reborn.twoCaptchaKey) errors.push('2Captcha key is required');
  return {
    ok: errors.length === 0,
    errors,
  };
}

module.exports = { validateConfig };
