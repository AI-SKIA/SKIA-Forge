# SKIA FORGE

Standalone Electron + Monaco desktop IDE shell for SKIA-Forge integration.

**Package version:** `1.0.0` (see `skia-ide/package.json`).

## Scope

This IDE shell targets Forge control-plane workflows. Product runtime features continue to execute in the SKIA product stack; public status publication remains in Skia-Status. The IDE talks to **`https://api.skia.ca`** (and related SKIA API routes) — not a replacement runtime.

## Authentication

Sign-in and account creation run **inside this application** against the configured backend (**`SKIA_BACKEND_URL`**, default **`https://api.skia.ca`**). Static Forge marketing pages intentionally do **not** duplicate web login buttons.

## Commands

- `npm install`
- `npm run build` — required for `/forge/app` web shell on the Forge server to load assets from `skia-ide/dist/renderer`
- `npm start` — launch Electron desktop IDE
- `npm run dist:win` / `dist:mac` / `dist:linux` / `dist:all` — local packaging (Windows NSIS, macOS DMG x64+arm64, Linux AppImage per `package.json` `build`)

## Configuration

See `src/renderer/skia/skiaConfig.ts` for backend URL (**default `https://api.skia.ca`**), chat pipeline (**default `https://skia.ca/api/skia/chat`**), timeout, and related defaults.

## Agent panel vs Chat panel

| Panel | API path | Purpose |
|-------|----------|---------|
| **Agent** (AGENT view) | `forgeUrl` ? `POST /api/forge/agent/plan`, `/decompose`, `/execute` | Structured plan, 8-tool executor, diff preview with APPLY/REJECT |
| **Chat** (side panel) | `https://skia.ca/api/skia/forge-agent` (SSE) | Conversational stream; edits parsed from model text — not the Forge tool registry |

Use **Agent** for repo changes with governance and explicit approvals. Use **Chat** for Q&A and narrative assistance.

Inline tab completion uses the Forge server WebSocket (`/inline-completion`) with SKIA code mode + repo context — not the chat stream.

## Distribution

Published installers are consumed via Forge **`GET /api/app/download`** and **`GET /api/app/download/:platform`**, and via the canonical web page **`https://forge.skia.ca/platform-downloads`**.

## Local development (SKIA-Forge repo)

Local Forge + IDE against a laptop SKIA stack lives under **`../local-dev/`** — not this package’s production defaults.

- Start: `../local-dev/scripts/start-forge-local.ps1` (loads `local-dev/.env.forge.local`, may apply IDE overrides).
- Overrides: `../local-dev/ide-overrides/` ? copied into `skia-ide/` only by the patch script; **do not** ship or build releases after patching without reverting.
- Revert IDE to repo source: `../local-dev/scripts/revert-forge-ide-local-patch.ps1`

Production builds use **`npm run build`** on unpatched `skia-ide/` with default `skiaConfig.ts` URLs (`api.skia.ca`, `forge.skia.ca`).
