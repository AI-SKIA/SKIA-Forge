# SKIA Forge API Reference

## Scope

This reference maps the HTTP API **as implemented in the Forge server**. Product-facing web APIs for the main SKIA product live in SKIA.

The canonical route list is the Forge server implementation; this document is the operator-friendly index. A test fails the build when a registered route is missing here.

**Package version:** `1.0.0` (root `package.json`).

**Authentication:**

- Every route under **`/api/forge/*`** requires a Bearer JWT; model and embedding calls also require a paid Forge plan.
- **`/index`**, **`/search`**, **`/agent/*`**, **`/rpc`**, **`/sovereign-core`**, **`/integration/skia-full/*`**, **`/providers/*`**, **`/telemetry/*`**, **`/state/runtime`**, **`/rules`**, **`/live`**, **`/ready`** and **`/diff/preview`** require a Bearer JWT.
- **`POST /providers/health`**, **`POST /providers/force`** and **`POST /telemetry/record`** additionally require the deployment admin secret.
- **`/api/local/*`** is open to same-machine (loopback) callers only; anyone else needs a Bearer JWT.
- Auth proxy routes **`/api/auth/*`** forward to the configured SKIA backend (default `https://api.skia.ca`).
- Public: `/health`, `/version`, `/api/app/*`, `/api/public/status-metrics` and the browser pages below.

---

## Browser / static surfaces

These routes serve HTML, redirects, or static assets for the Forge site and IDE shell.

| Method | Path | Notes |
|--------|------|--------|
| GET | `/` | Redirects to **`/platform-downloads`** (canonical download UI on the Forge site). |
| GET | `/forge` | Same redirect (legacy path). |
| GET | `/download` | Same redirect. |
| GET | `/platform-downloads` | Download page (`public/platform-downloads.html`). |
| GET | `/forge/platform` | Forge platform overview. |
| GET | `/forge/sign-in` | Browser sign-in page for the Forge platform console. |
| GET | `/chat` | Lightweight chat console; calls `/providers/status`, `/rpc` and `/diff/preview` with the stored session token. |
| GET | `/forge/app`, `/forge/app/` | SKIA Forge IDE web shell (renderer bundle + browser shim). Returns `503` if IDE assets are not built. |
| GET | `/resources`, `/security`, `/contact` | Static pages from `public/*.html`. |
| GET | `/docs/*` | Branded HTML under `public/docs/` first, then the customer guides under `docs/`. Internal folders (`/docs/contracts`, `/docs/architecture`) return `404`. |
| GET | `/favicon.png`, `/favicon.ico`, `/og/skia-forge-preview.svg`, `/sidebar-logo.png` | Icons / OG image. |
| GET | `/forge-*.css`, `/forge-*.js` | Hub stylesheets and locale/SSO scripts used by the static pages. |

---

## Health, version, and app distribution

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Simple JSON ok + project metadata. |
| GET | `/live` | Liveness (runtime + provider snapshot). |
| GET | `/ready` | Readiness; `503` when not ready. |
| GET | `/version` | Service version (`npm_package_version` or dev fallback). |
| GET | `/api/app/version-check` | Desktop update signal (`SKIA_FORGE_LATEST_VERSION` or GitHub release tag). |
| GET | `/api/app/release-assets` | Published installer filenames + asset URLs for the download UI. |
| GET | `/api/app/release-verification` | Installers with their published verification data (no-store). |
| GET | `/api/app/download` | User-agent pick, then redirect to `/api/app/download/:platform`. |
| GET | `/api/app/download/:platform` | Redirect to GitHub release asset (`windows`, `mac-intel`, `mac-arm`, `linux-appimage`). |
| GET | `/api/public/status-metrics` | Public operational metrics proxied from the SKIA API; returns an "unavailable" message when sampling is off. |
| GET | `/state/runtime` | Provider router and telemetry snapshot. |

Platform installer filenames expected by the download UI are defined in the SKIA platform (`Skia-Forge-*`).

---

## Auth proxy (IDE and API clients)

Forge forwards auth to the configured SKIA backend (`SKIA_BACKEND_URL`, default `https://api.skia.ca`). Marketing HTML pages do **not** expose sign-in or register links; the **SKIA Forge IDE** performs sign-in / registration against these routes when needed.

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/login` | |
| POST | `/api/auth/register` | |
| POST | `/api/auth/contact` | Contact form submission. |
| GET | `/api/auth/session` | |
| GET | `/api/auth/handoff` | Exchanges the SKIA session for a Forge web session, then redirects to a safe `returnTo` path. |

---

## SKIA API integration (`/integration/skia-full`)

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

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/forge/modules/status` | |
| GET | `/api/forge/architecture/health` | |
| POST | `/api/forge/skia-review` | |
| POST | `/api/forge/security/full-audit` | Local project security audit. Requires signed intent headers (`x-skia-intent-signature`, `x-skia-intent-ts`, `x-skia-intent-nonce`) for intent `forge.security.full_audit`. |

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

## Production, healing, and architecture modules

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/forge/production/status` | Deployment status from the production adapter (audited). |
| GET | `/api/forge/production/health` | Runtime health (audited). |
| GET | `/api/forge/production/telemetry` | Service telemetry (audited). |
| POST | `/api/forge/healing/scan` | Detect anomalies in service telemetry; optional threshold overrides in the body. |
| POST | `/api/forge/healing/remediate` | Remediate the first (or `service`-named) anomaly, subject to mode and lockdown. |
| GET | `/api/forge/healing/history` | Remediation history. |
| GET | `/api/forge/architecture/graph` | Module dependency graph of the project. |
| POST | `/api/forge/architecture/analyze` | Detect drift against the saved baseline, then save a new baseline (audited). |
| GET | `/api/forge/architecture/advice` | Architecture advice from the graph, drift and diagnostics. |

---

## Primary Forge execution POST endpoints

| Method | Path | Role |
|--------|------|------|
| POST | `/api/forge/context` | Context-style reasoning passthrough. |
| POST | `/api/forge/agent` | Agent intelligence passthrough. |
| POST | `/api/forge/agent/plan` | Structured plan (schemas in `contracts.ts`). |
| POST | `/api/forge/agent/decompose` | Turn a plan into executor tool steps. |
| POST | `/api/forge/agent/execute` | Plan execution with tooling / governance. |
| POST | `/api/forge/sdlc` | SDLC mode intelligence. |
| POST | `/api/forge/production` | Production routing estimate passthrough. |
| POST | `/api/forge/healing` | Healing reasoning passthrough. |
| POST | `/api/forge/architecture` | Architecture reasoning passthrough. |
| POST | `/api/forge/module/:module` | Named module execution (`ForgeModuleName`). |
| POST | `/api/forge/module/:module/preview` | Module decision preview. |
| POST | `/api/forge/orchestrate` | Multi-stage orchestration pipeline. |
| POST | `/api/forge/orchestrate/preview` | Preview orchestration decisions without executing. |

---

## Code intelligence and multi-agent

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/forge/code/analyze` | Repository analysis via the SKIA API. |
| POST | `/api/forge/code/propose-edit` | Proposed edit for a file. |
| POST | `/api/forge/code/propose-refactor` | Proposed refactor. |
| POST | `/api/forge/code/diff` | Server-computed diff. |
| POST | `/api/forge/self/improve` | Run one self-improvement loop on the project (agent access required). |
| GET | `/api/forge/agents/status` | Multi-agent coordinator status. |
| POST | `/api/forge/agents/spawn` | Spawn an agent: `{ role: coder|reviewer|tester|documenter|security-scanner, task: { id, title } }`. |
| POST | `/api/forge/agents/coordinate` | Coordinate agents over a task graph: `{ agents, graph: { tasks } }`. |

---

## Index, search, rules, and agent audit

| Method | Path | Description |
|--------|------|-------------|
| GET | `/index` | Current project index. |
| POST | `/index/rebuild` | Rebuild the index. Requires signed intent headers for intent `forge.index.rebuild`. |
| GET | `/search` | `?q=` query, `?k=` result count. |
| GET | `/rules` | Project `.skiarules` as loaded. |
| GET | `/agent/audit-log` | Rows from `.skia/agent-log.json`. |
| POST | `/agent/log` | Append an audit record: `{ action, parameters?, result?, details? }`. |
| POST | `/agent/validate-command` | Evaluate a command against the agent safety policy. |

---

## Providers and telemetry

| Method | Path | Description |
|--------|------|-------------|
| GET | `/providers/status` | Provider routing status snapshot. |
| POST | `/providers/health` | Set a provider's health and latency (admin secret). |
| POST | `/providers/force` | Force a named provider as active, or clear the override (admin secret). |
| POST | `/telemetry/record` | Record a metric value (admin secret). |
| GET | `/telemetry/summary` | Metric summary. |

---

## Other surfaces

| Method | Path | Description |
|--------|------|-------------|
| POST | `/rpc` | Internal JSON-RPC bridge (rate limited). |
| POST | `/sovereign-core` | Sovereign core passthrough to the SKIA API. |
| POST | `/diff/preview` | Line diff preview of `{ oldText, newText }`. |
| GET | `/api/local/health` | Local-mode health (proxies the local SKIA backend when local mode is on). |
| GET | `/api/local/services` | Local-mode service probes. |
| GET | `/api/local/engines` | Local-mode engine configuration. |

---

## Error model

- JSON schema validation failures return `400` with structured errors.
- Missing or invalid Bearer JWT returns `401`.
- Upstream SKIA API failures typically return `502` with an error message.
- Governance blocks return mode/policy context (`403`, `423` lockdown, etc.).
- Readiness failures use `503` on `/ready`.
