# SKIA-Forge Product Manual

**Versions:** Forge server **`1.0.0`** · SKIA Forge IDE (`skia-ide`) **`1.0.0`**.

## What SKIA-Forge Is

SKIA-Forge is the governance and orchestration control plane for AI-native software development in the SKIA ecosystem. It coordinates planning, execution safety, architecture checks, and remediation guidance around AI-assisted workflows. Intelligence execution for many flows is delegated to **`SkiaFullAdapter`** calls against **`Skia-FULL`** HTTP APIs (default **`https://api.skia.ca`**) — Forge **does not** replace the product runtime.

## What SKIA-Forge Is Not

SKIA-Forge is not the full end-user product runtime. Product APIs, web/mobile/desktop delivery, and customer-facing feature execution live in `Skia-FULL`.

Public operational communication lives in `Skia-Status`, not in Forge runtime endpoints.

## Who It Is For

- AI-first engineering teams
- Platform and developer productivity teams
- Security/governance stakeholders who need policy-aware automation

## Core Product Capabilities

- Structured orchestration flows across live-wired modules (`context-engine`, `agent-planner`, `agent-executor`, `production`, `healing`, `architecture`, `skiarules`, `security`, `sdlc`, `tools` — see root `README.md`)
- Additional module families exist in-repo with **scaffold** status [CONFIRM] until mounted on `src/server.ts`
- Governance mode controls (`strict`, `adaptive`, `autonomous`)
- Runtime control-plane posture, alerts, and recommendations
- Safety and architecture diagnostics
- SKIA runtime contract integration via `/integration/skia-full/*` and adapter-backed `/api/forge/*` surfaces

## Value Proposition

- Faster delivery with guardrails
- Reduced unsafe operations reaching production
- Better traceability for enterprise governance and audits

## Product Boundaries

SKIA-Forge is a control and orchestration layer. It is not a replacement for your full application runtime; it integrates with upstream SKIA intelligence contracts and your existing deployment topology.

## Delivery surfaces (current)

- **Forge HTTP server** (`src/server.ts`): Express app exposing orchestration APIs, integration probes, governance, context/embedding routes, and static/marketing pages. Default port **`SKIA_PORT`** = **4173**. Production edge hostname **`forge.skia.ca`** [CONFIRM].
- **Public web**: Download / positioning lives on **`https://forge.skia.ca/platform-downloads`** (`Skia-FULL` `frontend/pages/platform-downloads.tsx`). This Forge server redirects `/`, `/forge`, and `/download` there. Other static routes: `/resources`, `/security`, `/contact`, `/docs/*` (branded HTML + markdown fallback). Account **sign-in and registration are not promoted on marketing HTML** — users authenticate in the **SKIA Forge IDE** or other clients against `/api/auth/*` (proxied to **`SKIA_BACKEND_URL`**, default **`https://api.skia.ca`**).
- **Web IDE shell**: `/forge/app` serves the built `skia-ide` renderer with a browser compatibility shim (optional full desktop features require Electron).
- **Desktop IDE**: `skia-ide/` Electron app — primary interactive surface for developers; default API **`https://api.skia.ca`**, chat pipeline **`https://skia.ca/api/skia/chat`** (see `skia-ide/src/renderer/skia/skiaConfig.ts`).
- **Installers**: **`GET /api/app/download`** and **`GET /api/app/download/:platform`** redirect to GitHub release assets (default **`AI-SKIA/SKIA-Forge`**). Artifact names follow `skia-ide` electron-builder configuration (e.g. `SKIA-FORGE-Setup-*`, `SKIA-FORGE-*-mac-*.dmg`, `SKIA-FORGE-*-linux-x64.AppImage`).
