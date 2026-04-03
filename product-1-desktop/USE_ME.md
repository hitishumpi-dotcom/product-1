# Product 1 Desktop - Use Me

## Goal
This is the installer-style desktop wrapper for Product 1.

## For local testing
```bash
cd /home/user/OpenClaw/product-1
npm install

cd /home/user/OpenClaw/product-1-desktop
npm install
npm run prepare:icons
npm run dev
```

## Expected behavior
- desktop window opens automatically
- backend launches automatically
- first-run welcome screen appears
- clicking continue opens the Product 1 setup wizard
- user only needs to enter credentials and test once

## Packaging
### Linux
```bash
npm run dist:linux
```

This machine successfully produced:
- AppImage
- DEB

### Windows
Windows packaging is configured, but building the actual `.exe` from this Linux machine requires Wine.
See:
- `WINDOWS_BUILD.md`

Build output:
- `product-1-desktop/release/`
