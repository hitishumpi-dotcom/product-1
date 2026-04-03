# Product 1 - Friend Setup

## What you need
- Node.js installed
- your L2 Reborn email + password
- your Gmail App Password
- your game account name
- your character ID
- your 2Captcha API key

## Install
```bash
cd product-1
bash install.sh
npm start
```

Open:
- http://localhost:4311

## In the app
Follow the setup wizard:
1. Account credentials
2. Verification email access
3. Game target info
4. Captcha solver
5. Schedule & run

Then:
- click `Run test vote now`
- if it succeeds, click `Start scheduler`

## Optional auto-start after reboot
```bash
bash install-service.sh
```
Then follow the printed systemd commands.
