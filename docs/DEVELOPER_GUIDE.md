# SKIA Forge Developer Guide

## Ecosystem boundaries

- SKIA Forge is the control-plane codebase (**`1.0.0`**). Upstream intelligence calls use the configured SKIA API base (default **`https://api.skia.ca`**); Forge does not replace SKIA as the product runtime.
- SKIA remains the product runtime and customer feature surface.

## Local Setup

- Node.js 20+
- `npm install`
- `npm run build`
- `npm run test`

## Project Structure (Core)

- the Forge server — runtime entrypoint (binds **`SKIA_PORT`**, default **4173**)
- `src/forge/modules/` — module domains wired into the server execution path (for example context-engine, agent-planner, agent-executor, production, healing, architecture, skiarules, security, sdlc, tools)
- SKIA Forge IDE — Electron + renderer (**`1.0.0`**); run `npm run build` in that package before `/forge/app` can load in the browser
- `public/docs/` — branded HTML documentation served at `/docs/*.html` (takes precedence over `docs/*.md`)

## HTTP surfaces (quick)

- `/`, `/forge`, `/download` ? redirect **`https://forge.skia.ca/platform-downloads`** (download UI on the SKIA platform)
- `/api/app/download`, `/api/app/download/:platform` ? desktop installer redirects (GitHub releases; default repo `AI-SKIA/SKIA-Forge`)
- `/forge/app` - web IDE (requires built SKIA Forge IDE renderer bundle)
- `/api/forge/*` - control plane (**authenticated**; see `API_REFERENCE.md`)
- `/integration/skia-full/*` - adapter probes and passthroughs

## Development Workflow

1. Implement scoped changes in `src/forge/modules/*`.
2. Run `npm run lint`, `npm run typecheck`, `npm run test`.
3. Validate integration routes and control-plane behavior.

## Coding Conventions

- Use typed request/response schemas.
- Keep policy checks explicit and test-covered.
- Prefer additive changes over implicit behavior.

## Integration Notes

Forge can run with SKIA integration enabled or disabled; adapter paths should fail clearly when upstream contracts are unavailable.
