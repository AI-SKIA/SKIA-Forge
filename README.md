# SKIA-Forge

SKIA-Forge is the sovereign control-plane and intelligence orchestration runtime for the SKIA ecosystem.

It provides:

- architecture/context analysis modules,
- governance and safety enforcement,
- orchestration and module execution surfaces,
- operational telemetry and posture APIs.

## Relationship to `Skia-FULL`

- `Skia-FULL` is the main product/runtime monorepo.
- `SKIA-Forge` is the focused orchestration and governance plane that can integrate with SKIA-FULL contracts rather than duplicating full application behavior.
- Forge is designed to stay modular and diagnostics-first, with explicit governance controls.
- `Skia-Status` is the public status repository that reflects operational posture and incident communications for user-facing transparency.

## Project structure

- `src/server.ts` -> runtime entrypoint (listens on **`SKIA_PORT`**, default **4173**)
- `src/forge/modules/` -> domain modules (auto, governance, context-engine, safety, work, etc.)
- `skia-ide/` -> **SKIA Forge IDE** (Electron); build with `npm run build` inside this folder for `/forge/app` web shell
- `public/` -> static marketing pages (`resources`, `security`, `contact`) and `public/docs/` branded HTML at `/docs/*`
- `docs/` -> Markdown documentation source (also served at `/docs/*.md` when no HTML override exists)
- `.skia/` -> runtime state and baseline artifacts (local/generated)

## Public HTTP routes (summary)

- `/`, `/forge`, and `/download` redirect to **`https://skia.ca/platform-downloads`** (`Skia-FULL` `frontend/pages/platform-downloads.tsx`)
- `/forge/app` serves the IDE renderer when `skia-ide/dist/renderer` is built
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

Forge modules in `src/forge/modules/` are organized by capability:

- `context-engine` -> indexing, structure extraction, semantic retrieval primitives
- `governance` / `safety` -> policy enforcement and controls
- `work` / `auto` -> planning, orchestration, and autonomous execution logic
- `architecture` -> diagnostics and architecture health surfaces
- `tools` -> standardized internal tool interfaces and registry behavior

This layout enables targeted evolution and operational isolation by domain.

## Key docs

- `docs/README.md`
- `docs/QUICKSTART.md`
- `docs/PRODUCT_MANUAL.md`
- `docs/DEVELOPER_GUIDE.md`
- `docs/API_REFERENCE.md`
- `docs/SECURITY_GUIDE.md`
