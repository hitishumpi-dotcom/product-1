# MEMORY.md — Global Stable Facts

## Lane Architecture
- WorkLab: builds systems, apps, automations
- FinanceManager: handles personal finance and financial decisions
- BusinessOps: manages rental operations and business processes
- SocialHub: shared assistant for general interaction and communication

## User Preferences
- Short, direct replies. No filler, no recap of completed steps.

## Workspace
- Root: /home/user/OpenClaw
- Shared policies: /home/user/OpenClaw/shared/policies/
- Lane memory: /home/user/OpenClaw/lanes/<lane>/memory/

## Screenshot Capability
- Playwright + headless Chromium installed at /tmp/pw-shot
- System libs installed via sudo apt-get
- Allowed media dir: /home/user/.openclaw/media/
- OpenClaw gateway runs at http://127.0.0.1:18789/
- User's Mission Control (Next.js) runs at http://localhost:3000

## Discord (SocialHub)
- Bot name: "Johnny's gaylord bot"
- Bot token stored in channels.discord.token in openclaw.json
- Server: UrekMazino's server (id: 1084829267340316692)
- General channel id: 1084829267935895615
- Friends: diobrando64 (576423042507341826), urekmazino8118, arhsmeta, sendoshibaku, lordespasa, shino04996
- Friends have chat-only access (no system access)
- Owner (Shinzo) has full control via Telegram

## L2 Reborn Auto-Vote ✅ WORKING
- Site: https://l2reborn.org/signin/
- Gmail login: marios.kouranis5@gmail.com / hakuhaku121
- Gmail App Password (IMAP): cmlmybaxymfhisgb
- Server: Essence Aden (server_id=3)
- Account: up_shinogr94
- Character: UrekMazino (obj_id=273370023)
- Script: /home/user/OpenClaw/scripts/l2reborn-vote.js
- Cron job id: dd57a1a0-51f2-4b0a-b0fe-a6fe8c29cc96 (every 12h)
- Flow: login → get VIP token → wait 65s → submit exp_rune service → ticket delivered
- Captcha: Cloudflare Turnstile, sitekey: 0x4AAAAAAAPFfPxwacy3GCxf
- Captcha solver: 2captcha, key: 130fbaa6b1eef7667c5b2c06a140040c
- Cookies cached at: /tmp/pw-shot/l2reborn-cookies.json
- node_modules at: /tmp/pw-shot/node_modules (playwright, imapflow)
