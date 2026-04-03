# Windows Build

Windows packaging is configured, but building the actual Windows installer from this Linux machine requires Wine.

## What is already done
- Electron desktop wrapper exists
- Windows NSIS packaging config exists
- backend bundling works
- first-run desktop flow exists

## Current blocker
This environment does not have Wine, so `electron-builder --win` cannot finish here.

## Fastest way to get the Windows installer
Run this on a Windows machine:

```bash
cd product-1
npm install

cd ../product-1-desktop
npm install
npm run dist:win
```

Expected output:
- `product-1-desktop/release/*.exe`

Then upload that `.exe` to the existing GitHub release.
