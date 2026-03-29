# Product 1 Desktop

Electron desktop wrapper for the existing `product-1` local web app.

It keeps the current `product-1` code as the backend, launches that backend automatically on app start, opens a desktop window on first launch, and includes packaging scaffolding for one-click installers.

## What this app does

- starts the bundled Product 1 backend automatically
- waits for the local server to become ready
- opens the app window automatically
- shows a local loading screen while the backend boots
- stores writable runtime data in the desktop app user-data folder when packaged
- packages the backend into `extraResources/backend` for installer builds

## Project layout

```text
product-1/
  existing backend / local web app
product-1-desktop/
  Electron wrapper, loading UI, and packaging config
```

## Development run

From `product-1` first:

```bash
cd /home/user/OpenClaw/product-1
npm install
```

Then run the desktop app:

```bash
cd /home/user/OpenClaw/product-1-desktop
npm install
npm run dev
```

The Electron wrapper will launch the backend from `../product-1` and open the desktop window.

## Installer / package builds

### Windows NSIS installer

```bash
cd /home/user/OpenClaw/product-1-desktop
npm install
npm run dist:win
```

### Linux packages

```bash
cd /home/user/OpenClaw/product-1-desktop
npm install
npm run dist:linux
```

### Unpacked build

```bash
npm run pack
```

Build output goes to:

```text
product-1-desktop/release/
```

## Important packaging note

The desktop build copies `../product-1` into the packaged app as `extraResources/backend`.
That means `product-1` must already have its dependencies installed before you package:

```bash
cd /home/user/OpenClaw/product-1
npm install
```

## Runtime data location

### Development

When running the backend directly, Product 1 still uses its normal local folders:

- `product-1/data`
- `product-1/backups`
- `product-1/tmp`
- `product-1/dist`

### Packaged desktop app

When launched from the packaged Electron app, Product 1 uses the Electron user-data directory instead, so installed builds can write safely without modifying read-only bundled files.

## Remaining installer blockers

This repo now has packaging scaffolding, but actual production-ready installer generation may still need:

- app icons (`.ico`, `.icns`, `.png`) for branded installers
- platform-specific code signing / notarization if distributing publicly
- building on the target OS for best artifact compatibility
- verifying that Playwright browser/runtime requirements are satisfied on the target machine

## Backend preserved

The Product 1 backend remains the source of truth. The desktop app is only a wrapper around it.
