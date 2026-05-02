# SKIA-Forge Operator Manual

## Runtime Role

SKIA-Forge operates as an orchestration/governance **HTTP service** that augments development workflows with policy-aware controls.

## Ownership boundaries

- Operate Forge as a control-plane service.
- Do not treat Forge endpoints as replacements for `Skia-FULL` product runtime APIs.
- Use `Skia-Status` for external/public incident communication.

## Deployment baseline

- Build: `npm run build`
- Start: `npm run dev` (development) or `node dist/server.js` after build (production shape)
- Listen address: **`SKIA_PORT`** (default **4173**)
- After startup, validate:
  - `GET /health`, `GET /live`, `GET /ready`, `GET /version`
  - `GET /integration/skia-full` / `probe`

## Environment variables (primary)

Values below are **representative** — see `src/server.ts` for the full set.

| Variable | Purpose |
|----------|---------|
| `SKIA_PORT` | HTTP port (default `4173`). |
| `SKIA_PROJECT_ROOT` | Override project root (defaults `cwd`). |
| `SKIA_FULL_ENABLED` | Set `false` to disable SKIA-full adapter. |
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
| `SKIA_INTENT_SIGNING_KEY` | Primary HMAC key for sensitive intents. |
| `SKIA_INTENT_SIGNING_PREVIOUS_KEY` | Secondary key for rotation. |
| `SKIA_INTENT_SIGNING_PREVIOUS_GRACE_UNTIL_MS` | Grace window for previous key. |
| `SKIA_FORGE_RELEASE_REPO` | GitHub repo for installers (default `AI-SKIA/SKIA-Forge`). |
| `SKIA_FORGE_RELEASE_TAG` | Release tag for asset resolution (default `v1.0.0`). |
| `SKIA_FORGE_LATEST_VERSION` | Override “latest” version for `/api/app/version-check`. |
| `GITHUB_TOKEN` / `SKIA_GITHUB_TOKEN` | Token for GitHub API when fetching release assets. |
| `SKIA_IDE_RELEASE_BASE_URL` | Base URL for chat UI download links. |
| `SKIA_ENABLE_WATCHER` | File watcher behavior (`1` enables). |

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

- Confirm release assets exist for `Skia-Forge-*` installers or configure env overrides above.
- Marketing pages do not surface web sign-in; users authenticate via the **Forge IDE** or direct API clients.
