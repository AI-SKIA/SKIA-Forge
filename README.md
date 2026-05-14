# SKIA-Forge

**Package version:** `1.0.0`

SKIA Forge is the governance and orchestration control plane for AI-native software development. It coordinates planning, execution safety, architecture checks, and policy enforcement across AI-assisted workflows.

It provides:

- architecture/context analysis modules,
- governance and safety enforcement,
- orchestration and module execution surfaces,
- operational telemetry and posture APIs.

## Project structure

- `src/server.ts` -> runtime entrypoint (listens on **`SKIA_PORT`**, default **4173**)
- `src/forge/modules/` -> domain modules (auto, governance, context-engine, safety, work, etc.)
- `skia-ide/` -> **SKIA Forge IDE** (Electron); build with `npm run build` inside this folder for `/forge/app` web shell
- `public/` -> static marketing pages (`platform-downloads`, `resources`, `security`, `contact`) and `public/docs/` branded HTML at `/docs/*`
- `docs/` -> Markdown documentation source (also served at `/docs/*.md` when no HTML override exists)
- `.skia/` -> runtime state and baseline artifacts (local/generated)

## Public HTTP routes (summary)

- **Production web surface:** `forge.skia.ca` serves this service.
- `/`, `/forge`, and `/download` redirect to **`/platform-downloads`** (canonical downloads hub: `public/platform-downloads.html`).
- **Desktop installers:** `GET /api/app/download` and `GET /api/app/download/:platform` (`windows`, `mac-intel`, `mac-arm`, `linux-appimage`) redirect to published GitHub release assets (repo default `AI-SKIA/SKIA-Forge`).
- `/forge/app` serves the IDE renderer when `skia-ide/dist/renderer` is built.
- `/resources`, `/security`, `/contact` serve `public/*.html`
- `/docs/*` serves `public/docs/` first, then repo `docs/`
- Full API index: **`docs/API_REFERENCE.md`**

## Local development

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Run

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Typecheck and tests

```bash
npm run typecheck
npm test
```

## Module system

Forge modules in `src/forge/modules/` are organized by capability. **Wired in `src/server.ts` (live execution path):** `context-engine`, `agent-planner`, `agent-executor`, `production`, `healing`, `architecture`, `skiarules`, `security`, `sdlc`, `tools`.

This layout enables targeted evolution and operational isolation by domain.

## Desktop IDE (`skia-ide`)

- **Version:** `1.0.0` (see `skia-ide/package.json`).
- Packaged targets: Windows NSIS, macOS DMG (x64 / arm64), Linux AppImage (see `skia-ide/package.json` `build` section).

## Key docs

- `docs/README.md`
- `docs/QUICKSTART.md`
- `docs/PRODUCT_MANUAL.md`
- `docs/DEVELOPER_GUIDE.md`
- `docs/API_REFERENCE.md`
- `docs/SECURITY_GUIDE.md`
