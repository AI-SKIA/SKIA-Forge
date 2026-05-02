# SKIA FORGE

Standalone Electron + Monaco desktop IDE shell for SKIA-Forge integration.

## Scope

This IDE shell targets Forge control-plane workflows. Product runtime features continue to execute in `Skia-FULL`; public status publication remains in `Skia-Status`.

## Authentication

Sign-in and account creation run **inside this application** against the configured backend (`SKIA_BACKEND_URL` / `api.skia.ca` in production). Static Forge marketing pages intentionally do **not** duplicate web login buttons.

## Commands

- `npm install`
- `npm run build` — required for `/forge/app` web shell on the Forge server to load assets from `skia-ide/dist/renderer`
- `npm start` — launch Electron desktop IDE

## Configuration

See `src/renderer/skia/skiaConfig.ts` for backend URL, chat pipeline URL, and related defaults.
