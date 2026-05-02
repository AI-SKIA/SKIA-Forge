# SKIA-Forge User Guide

## What this guide covers

Using the Forge **control-plane HTTP service**: orchestration APIs, governance flows, health checks, and how that differs from the **SKIA Forge IDE** (desktop) and **Skia-FULL** product runtime.

## Runtime roles

| Surface | Role |
|---------|------|
| **Forge server** (`npm run dev` / production Node process) | Express control plane: `/api/forge/*`, `/integration/skia-full/*`, governance, context engine, downloads metadata. Listens on `SKIA_PORT` (default **4173**). |
| **SKIA Forge IDE** (`skia-ide/`, Electron) | Desktop editor; sign-in and registration happen **in the app**, not on static Forge marketing pages. Uses `/api/auth/*` via the same origin when pointed at Forge. |
| **Forge web IDE** | `GET /forge/app` serves the built IDE bundle with a browser shim (folder picker, limited “desktop” actions). Build `skia-ide` first. |
| **Skia-FULL** | Primary customer product runtime and Next.js surfaces — not this repo. |

## Quick validation (operator)

1. Install dependencies: `npm install`
2. Start Forge: `npm run dev`
3. Check **Forge-local** endpoints (not upstream `/api/health`):
   - `GET /health`
   - `GET /live` and `GET /ready`
   - `GET /integration/skia-full` and `GET /integration/skia-full/probe`
4. Optional quality gates: `npm run typecheck`, `npm run test`, `npm run build`

## Typical orchestration workflow

1. Submit context and goals to Forge POST endpoints (see `API_REFERENCE.md`).
2. Review stage decisions and governance output in responses.
3. If blocked, follow remediation hints from the control plane or policy response.
4. Re-run until posture is healthy.

## Daily usage patterns

- Review control-plane summaries (`GET /api/forge/control-plane`) before major changes.
- Use orchestration preview (`POST /api/forge/orchestrate/preview`) before high-risk runs when applicable.
- Run architecture and security diagnostics on changed areas (`POST /api/forge/skia-review`, architecture routes).

## Best practices

- Align governance mode (`strict` / `adaptive` / `autonomous`) with environment risk.
- Treat blocked actions as policy feedback; responses often include remediation paths.
- Run build/test after applying orchestration-driven code changes.

## Getting the desktop IDE

- Download installers via `/api/app/download/:platform`, or open the canonical page **`https://skia.ca/platform-downloads`** (`Skia-FULL` `frontend/pages/platform-downloads.tsx`) in the browser.
- Installer filenames follow `Skia-Forge-*` (see `Skia-FULL` `frontend/lib/downloadUi.ts`).
