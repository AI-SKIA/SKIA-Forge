# SKIA-Forge API Reference

## Scope

This reference maps the HTTP API **as implemented in `src/server.ts`**. Product-facing web APIs for the main SKIA product live in `Skia-FULL`. Public status publication is `Skia-Status`.

The canonical route list is the server file; this document is the operator-friendly index.

**Default listen port:** `SKIA_PORT` (default `4173`).

---

## Browser / static surfaces

These routes serve HTML, redirects, or static assets for the Forge site and IDE shell.

| Method | Path | Notes |
|--------|------|--------|
| GET | `/` | Redirects to **`https://skia.ca/platform-downloads`** (canonical download UI: `Skia-FULL` `frontend/pages/platform-downloads.tsx`). |
| GET | `/forge` | Same redirect (legacy path; formerly served HTML from removed `src/downloadUi.ts`). |
| GET | `/download` | Same redirect. |
| GET | `/forge/platform` | Forge platform overview (`renderForgePlatformHtml`). |
| GET | `/chat` | Lightweight chat shell (`renderChatHtml`). |
| GET | `/forge/app`, `/forge/app/` | SKIA IDE web shell (`skia-ide/dist/renderer/index.html` + browser shim). Returns `503` if IDE assets are not built. |
| GET | `/resources`, `/security`, `/contact` | Static pages from `public/*.html`. |
| GET | `/docs/*` | Branded HTML under `public/docs/` first, then raw markdown under repo `docs/`. |
| GET | `/favicon.png`, `/favicon.ico`, `/og/skia-forge-preview.svg` | Icons / OG image. |

---

## Health, version, and app distribution

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Simple JSON ok + project root metadata. |
| GET | `/live` | Liveness (runtime + provider snapshot). |
| GET | `/ready` | Readiness; `503` when not ready. |
| GET | `/version` | Service version (`npm_package_version` or dev fallback). |
| GET | `/api/app/version-check` | Desktop update signal (`SKIA_FORGE_LATEST_VERSION` or GitHub release tag). |
| GET | `/api/app/release-assets` | Published installer filenames + asset URLs for the download UI. |
| GET | `/api/app/download` | User-agent pick → redirect to `/api/app/download/:platform`. |
| GET | `/api/app/download/:platform` | Redirect to GitHub release asset (`windows`, `mac-intel`, `mac-arm`, `linux-appimage`). |

Platform installer filenames expected by the download UI are defined in `Skia-FULL` `frontend/lib/downloadUi.ts` (`Skia-Forge-*`).

---

## Auth proxy (IDE and API clients)

Forge forwards auth to the configured SKIA backend (`SKIA_BACKEND_URL`, default `https://api.skia.ca`). Marketing HTML pages do **not** expose sign-in or register links; the **SKIA Forge IDE** performs sign-in / registration against these routes when needed.

| Method | Path |
|--------|------|
| POST | `/api/auth/login` |
| POST | `/api/auth/register` |
| GET | `/api/auth/session` |

---

## SKIA-full integration

| Method | Path |
|--------|------|
| GET | `/integration/skia-full` |
| GET | `/integration/skia-full/probe` |
| GET | `/integration/skia-full/probe/report` |
| POST | `/integration/skia-full/chat` |
| POST | `/integration/skia-full/route` |
| POST | `/integration/skia-full/routing-estimate` |

The adapter may probe upstream paths such as `/api/health` **on the SKIA API host**; that is not a Forge-local route.

---

## Forge module status and diagnostics

| Method | Path |
|--------|------|
| GET | `/api/forge/modules/status` |
| GET | `/api/forge/architecture/health` |
| POST | `/api/forge/skia-review` |

---

## Governance and control plane

| Method | Path |
|--------|------|
| GET | `/api/forge/mode` |
| POST | `/api/forge/mode` |
| GET | `/api/forge/governance` |
| GET | `/api/forge/lockdown` |
| POST | `/api/forge/lockdown` |
| POST | `/api/forge/approval-token` |
| GET | `/api/forge/approval-token/stats` |
| GET | `/api/forge/governance/intents/status` |
| GET | `/api/forge/governance/telemetry` |
| GET | `/api/forge/control-plane` |
| GET | `/api/forge/sovereign-posture` |
| POST | `/api/forge/control-plane/remediate` |
| POST | `/api/forge/control-plane/remediate/recommended` |
| POST | `/api/forge/governance/reload` |

---

## Context engine (structure, embeddings, retrieval)

| Method | Path |
|--------|------|
| GET | `/api/forge/context/structure` |
| GET | `/api/forge/context/semantic-chunks` |
| GET | `/api/forge/context/embed/stats` |
| POST | `/api/forge/context/embed/index` |
| GET | `/api/forge/context/embed/queue` |
| GET | `/api/forge/context/embed/jobs/:jobId` |
| POST | `/api/forge/context/embed/search` |
| POST | `/api/forge/context/retrieve` |

---

## Mounted routers

- `app.use("/api/forge/production", …)` — production module router.
- `app.use("/api/forge/healing", …)` — healing router.
- `app.use("/api/forge/architecture", …)` — architecture diagnostics router.

---

## Primary Forge execution POST endpoints

| Method | Path | Role |
|--------|------|------|
| POST | `/api/forge/context` | Context-style reasoning passthrough. |
| POST | `/api/forge/agent` | Agent intelligence passthrough. |
| POST | `/api/forge/agent/plan` | Structured plan (schemas in `contracts.ts`). |
| POST | `/api/forge/agent/execute` | Plan execution with tooling / governance. |
| POST | `/api/forge/sdlc` | SDLC mode intelligence. |
| POST | `/api/forge/production` | Production routing estimate passthrough. |
| POST | `/api/forge/healing` | Healing reasoning passthrough. |
| POST | `/api/forge/architecture` | Architecture reasoning passthrough. |
| POST | `/api/forge/module/:module` | Named module execution (`ForgeModuleName`). |
| POST | `/api/forge/orchestrate` | Multi-stage orchestration pipeline. |
| POST | `/api/forge/orchestrate/preview` | Preview orchestration decisions without executing. |
| POST | `/api/forge/module/:module/preview` | Module decision preview (see server for details). |

---

## Other notable surfaces

- `POST /rpc` — Internal RPC / streaming bridge (rate limited).
- `POST /sovereign-core` — Sovereign core passthrough to SKIA-full.
- `GET /stream/:method` — SSE streaming for SKIA methods (rate limited).
- `GET /state/runtime`, `GET /providers/status`, `POST /providers/health`, `POST /providers/force`.
- Index / search / rules / agent audit: `GET /index`, `GET /search`, `GET /rules`, `GET /agent/audit-log`, `POST /agent/log`, `POST /agent/validate-command`.
- `POST /telemetry/record`, `GET /telemetry/summary`.
- `POST /diff/preview` — Text diff preview.

---

## Error model

- JSON schema validation failures return `400` with structured errors.
- Upstream SKIA-full failures typically return `502` with an error message.
- Governance blocks return mode/policy context (`403`, `423` lockdown, etc.).
- Readiness failures use `503` on `/ready`.
