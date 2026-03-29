#!/bin/bash
/home/user/.openclaw/bin/openclaw gateway &
sleep 3
cd /home/user/openclaw-mission-control && npm run start -- -H 127.0.0.1 -p 3000 &
sleep 8
cmd.exe /c start http://127.0.0.1:18789
cmd.exe /c start http://127.0.0.1:3000
wait
