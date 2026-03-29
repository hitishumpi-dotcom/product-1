const FIELD_HELP = {
  email: 'The email you use to log in to L2 Reborn.',
  password: 'Your L2 Reborn account password.',
  gmailAppPass: 'A Gmail App Password, not your regular Gmail password. Needed only for verification email retrieval.',
  serverId: 'Usually 3 for the current setup. Leave as-is unless you know your server ID.',
  account: 'Your game account/login name for the selected server.',
  characterId: 'Your in-game character numeric ID. This is required for now.',
  characterName: 'Optional display label to make status easier to read.',
  twoCaptchaKey: 'Your 2Captcha API key. Needed to solve the Turnstile challenge automatically.',
  intervalHours: 'How often the scheduler should run. Default: 12 hours.',
  enabled: 'true to let the scheduler run automatically, false to disable it.',
  notificationsEnabled: 'true to log notifications/events, false to disable them.',
  remoteManifestPath: 'Optional local path or URL used to check for Product 1 updates.',
};

module.exports = { FIELD_HELP };
