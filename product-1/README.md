# Product 1

Local self-hosted L2 Reborn auto-vote app.

## Features
- friend-usable local web UI
- persistent config/data separate from code
- manual run + background scheduler
- update checks from local path or remote manifest URL
- safe update apply with backup creation
- release bundle export
- Linux service template generation
- validation and onboarding

## Quick start

```bash
cd product-1
bash install.sh
npm start
```

Open:
- http://localhost:4311

## Update flow
1. Set `Remote Manifest Path / URL`
2. Click `Check updates`
3. If update is available, click `Update now`
4. App downloads bundle, creates backup, applies update

## Service install
```bash
cd product-1
bash install-service.sh
```

## Data
Stored in:
- `product-1/data/config.json`
- `product-1/data/status.json`
- `product-1/data/l2reborn-cookies.json`
- `product-1/data/notifications.log`

## Generated artifacts
Not meant for git:
- `product-1/backups/`
- `product-1/tmp/`
- `product-1/dist/`
