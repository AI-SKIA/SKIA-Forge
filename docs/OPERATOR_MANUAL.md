# SKIA Forge Operator Manual

## Runtime Role

SKIA Forge operates as an orchestration and governance **HTTP service** that augments development workflows with policy-aware controls.

## Deployment baseline

- **Release:** Forge **`1.0.0`** (root `package.json`); desktop **SKIA Forge IDE** **`1.0.0`**.
- **Production hostname:** `forge.skia.ca`
- Build: `npm run build`
- Start: `npm run dev` (development) or `node dist/server.js` after build (production shape)
- Listen address: **`SKIA_PORT`** (default **4173**)
- After startup, validate:
  - `GET /health`, `GET /live`, `GET /ready`, `GET /version`

## Environment variables (primary)

Values below are **representative** — see the Forge server for the full set.

| Variable | Purpose |
|----------|---------|
| `SKIA_PORT` | HTTP port (default `4173`). |
| `SKIA_PROJECT_ROOT` | Override project root (defaults `cwd`). |
| `SKIA_FULL_ENABLED` | Set `false` to disable SKIA adapter integration. |
| `SKIA_FULL_API_URL` | Upstream API base (default `https://api.skia.ca`). |
| `SKIA_FULL_TIMEOUT_MS` | Request timeout (default `15000`). |
| `SKIA_FULL_ALLOW_LOCAL_FALLBACK` | Allow local fallback paths when upstream unavailable. |
| `SKIA_FULL_AUTH_BEARER` | Bearer token for upstream calls. |
| `SKIA_FULL_API_KEY` | API key for upstream calls. |
| `SKIA_FULL_EMBEDDING_PATH` | Embedding storage path override. |
| `SKIA_FULL_EMBED_MODEL` | Embedding model hint. |
| `SKIA_BACKEND_URL` | Auth proxy target (default `https://api.skia.ca`). |
| `EMBED_INCREMENTAL_ON_SAVE` | Enable incremental embed indexing on save. |
| `EMBED_VECTOR_STORE` | Vector store backend hint (e.g. `file`). |
| `PRODUCTION_API_URL` | Production module adapter URL. |
| `SKIA_FORGE_RELEASE_REPO` | GitHub repo for installers (default `AI-SKIA/SKIA-Forge`). |
| `SKIA_FORGE_RELEASE_TAG` | Release tag for asset resolution (default `v1.0.0`). |
| `SKIA_FORGE_LATEST_VERSION` | Override “latest” version for `/api/app/version-check`. |
| `SKIA_IDE_RELEASE_BASE_URL` | Base URL for chat UI download links. |
| `SKIA_ENABLE_WATCHER` | File watcher behavior (`1` enables). |

Additional environment variables for signing and GitHub integration are documented in your onboarding package.

## Operational checks

- Health endpoints pass
- Control-plane snapshot (`GET /api/forge/control-plane`) shows expected mode and lockdown
- Governance telemetry and audit logs are produced for sensitive actions
- Integration probes reflect your environment’s SKIA connectivity

## Incident handling

1. Capture failing endpoint, method, timestamp, and request ID if logged.
2. Review control-plane recommendations.
3. Apply remediation and re-run.
4. Escalate with logs and payload shapes if unresolved.

## Desktop distribution

- Installers are reached via **`GET /api/app/download`** and **`GET /api/app/download/:platform`** (Windows, macOS Intel/Apple Silicon, Linux AppImage — see the SKIA Forge IDE package build configuration).
- Confirm release assets exist for published installers or configure environment overrides as provided in your onboarding package.
- Marketing pages do not surface web sign-in; users authenticate via the **Forge IDE** or direct API clients.
