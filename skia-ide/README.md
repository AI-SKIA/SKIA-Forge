# SKIA FORGE

Standalone Electron + Monaco desktop IDE shell for SKIA-Forge integration.

**Package version:** `1.0.0` (see `skia-ide/package.json`).

## Scope

This IDE shell targets Forge control-plane workflows. Product runtime features continue to execute in `Skia-FULL`; public status publication remains in `Skia-Status`. The IDE talks to **`Skia-FULL`**-hosted APIs (not a replacement runtime).

## Authentication

Sign-in and account creation run **inside this application** against the configured backend (**`SKIA_BACKEND_URL`**, default **`https://api.skia.ca`**). Static Forge marketing pages intentionally do **not** duplicate web login buttons.

## Commands

- `npm install`
- `npm run build` — required for `/forge/app` web shell on the Forge server to load assets from `skia-ide/dist/renderer`
- `npm start` — launch Electron desktop IDE
- `npm run dist:win` / `dist:mac` / `dist:linux` / `dist:all` — local packaging (Windows NSIS, macOS DMG x64+arm64, Linux AppImage per `package.json` `build`)

## Configuration

See `src/renderer/skia/skiaConfig.ts` for backend URL (**default `https://api.skia.ca`**), chat pipeline (**default `https://skia.ca/api/skia/chat`**), timeout, and related defaults.

## Distribution

Published installers are consumed via Forge **`GET /api/app/download`** and **`GET /api/app/download/:platform`**, and via the canonical web page **`https://forge.skia.ca/platform-downloads`**.
