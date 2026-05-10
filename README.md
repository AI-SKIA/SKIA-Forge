# SKIA-Forge

**Package version:** `1.0.0`

SKIA-Forge is the sovereign control-plane and intelligence orchestration runtime for the SKIA ecosystem. It governs and orchestrates via the **`SkiaFullAdapter`**: Forge **calls** `Skia-FULL` HTTP APIs (for example `/api/skia/chat`, `/api/meta/route`, `/api/routing/estimate`) and does **not** replace the `Skia-FULL` product runtime.

It provides:

- architecture/context analysis modules,
- governance and safety enforcement,
- orchestration and module execution surfaces,
- operational telemetry and posture APIs.

## Relationship to `Skia-FULL`

- `Skia-FULL` is the main product/runtime monorepo.
- `SKIA-Forge` is the focused orchestration and governance plane that integrates with SKIA-FULL contracts through the adapter; it does not duplicate full application behavior.
- Default upstream base for adapter and auth proxy: **`https://api.skia.ca`** (`SKIA_FULL_API_URL` / `SKIA_BACKEND_URL`).
- Forge is designed to stay modular and diagnostics-first, with explicit governance controls.
- `Skia-Status` is the public status repository that reflects operational posture and incident communications for user-facing transparency.

## Project structure

- `src/server.ts` -> runtime entrypoint (listens on **`SKIA_PORT`**, default **4173**)
- `src/forge/modules/` -> domain modules (auto, governance, context-engine, safety, work, etc.)
- `skia-ide/` -> **SKIA Forge IDE** (Electron); build with `npm run build` inside this folder for `/forge/app` web shell
- `public/` -> static marketing pages (`platform-downloads`, `resources`, `security`, `contact`) and `public/docs/` branded HTML at `/docs/*`
- `docs/` -> Markdown documentation source (also served at `/docs/*.md` when no HTML override exists)
- `.skia/` -> runtime state and baseline artifacts (local/generated)

## Public HTTP routes (summary)

- **Production web surface:** `forge.skia.ca` maps to this service (Northflank) [CONFIRM] against your live Domains configuration.
- `/`, `/forge`, and `/download` redirect to **`/platform-downloads`** (canonical downloads hub: `public/platform-downloads.html`). **`skia.ca/platform-downloads`** permanently redirects to **`https://forge.skia.ca/platform-downloads`** (Skia-FULL Next.js config).
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

**Present in-repo but not directly mounted on the HTTP entrypoint [CONFIRM]:** `agent`, `auto`, `global`, `self`, `work`, `governance` (module folder), `safety`, `errors`. Treat these as scaffold until a future route audit proves otherwise.

This layout enables targeted evolution and operational isolation by domain.

## Desktop IDE (`skia-ide`)

- **Version:** `1.0.0` (see `skia-ide/package.json`).
- Default backend: **`https://api.skia.ca`**; chat pipeline default: **`https://skia.ca/api/skia/chat`** (see `skia-ide/src/renderer/skia/skiaConfig.ts`).
- Packaged targets: Windows NSIS, macOS DMG (x64 / arm64), Linux AppImage (see `skia-ide/package.json` `build` section).

## Key docs

- `docs/README.md`
- `docs/QUICKSTART.md`
- `docs/PRODUCT_MANUAL.md`
- `docs/DEVELOPER_GUIDE.md`
- `docs/API_REFERENCE.md`
- `docs/SECURITY_GUIDE.md`
