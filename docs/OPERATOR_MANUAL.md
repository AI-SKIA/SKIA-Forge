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
| `SKIA_ADMIN_SECRET` | Guards Forge mutation/admin endpoints when enabled in your deployment. |
| `JWT_SECRET` | Session validation when Forge verifies tokens locally (must match login service in integrated deployments). |

See **`docs/ENV_REFERENCE.md`** for the full hosting-environment variable list.

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

## Upgrade, rollback, and backup

### State Forge keeps

Forge has no database. All runtime state is files under **`<project root>/.skia/`**; the project root is `SKIA_PROJECT_ROOT` or the working directory (`/app` in the container image, so `/app/.skia`).

| File / folder | Contents | Rebuildable? |
|---------------|----------|--------------|
| `runtime-state.json` | Provider routing, telemetry, governance mode and lockdown | No |
| `agent-log.json` | Audit trail (agent runs, terminal commands, production and architecture actions) | No |
| `architecture-baseline-v1.json` | Architecture drift baseline | No (re-created by `POST /api/forge/architecture/analyze`, losing drift history) |
| `checkpoints/`, `work-items/`, `sdlc-events/`, `auto/` | Planner checkpoints, work items, SDLC events, self-improvement memory | No |
| `index.json` | Code index | Yes: `POST /index/rebuild` |
| `embeddings-v1.json` or `lance-embeddings/` | Embedding store | Yes: `POST /api/forge/context/embed/index` |

The container filesystem is ephemeral: without a persistent volume mounted at `/app/.skia`, every redeploy starts from empty state.

### Back up

1. Copy the whole `.skia/` directory, for example `tar czf forge-state-YYYY-MM-DD.tgz .skia`.
2. Do this before every upgrade, and at least daily if you rely on the audit trail.
3. Check the archive opens and contains `runtime-state.json` and `agent-log.json`.

### Upgrade

1. Back up `.skia/`.
2. Record the running version: `GET /version`.
3. Deploy the new release:
   - from source: `npm ci`, `npm run build`, then `npm install` and `npm run build` in the IDE package, then `npm start`;
   - or build the container image from the repository `Dockerfile`, which runs both builds and health-checks `GET /health`.
4. Validate:
   - `GET /health` returns 200, `GET /ready` returns 200 (Bearer JWT), and `GET /version` shows the new version;
   - `GET /api/forge/control-plane` shows the same mode and lockdown as before;
   - `/forge/app` loads (a `503` means the IDE bundle was not built).

### Roll back

1. Redeploy the previous release (the previous git tag or container image).
2. If the new version changed files in `.skia/`, restore the pre-upgrade backup (see Restore).
3. Run the same validation as for an upgrade, and confirm `GET /version` shows the previous version.

### Restore

1. Stop Forge.
2. Replace `.skia/` with the backup.
3. Start Forge and check that `GET /api/forge/control-plane` shows the expected mode and lockdown and `GET /agent/audit-log` returns the expected row count.

If Forge fails at startup with a JSON parse error, `runtime-state.json` is damaged: restore it from backup, or move it aside to start with default routing, mode and telemetry.

### Desktop IDE releases

- Installers are published as GitHub releases (`SKIA_FORGE_RELEASE_REPO`, `SKIA_FORGE_RELEASE_TAG`).
- `GET /api/app/version-check` drives the IDE update prompt; set `SKIA_FORGE_LATEST_VERSION` to control the advertised version.
- To roll back a desktop release, point `SKIA_FORGE_RELEASE_TAG` and `SKIA_FORGE_LATEST_VERSION` at the previous tag.

## Desktop distribution

- Installers are reached via **`GET /api/app/download`** and **`GET /api/app/download/:platform`** (Windows, macOS Intel/Apple Silicon, Linux AppImage — see the SKIA Forge IDE package build configuration).
- Confirm release assets exist for published installers or configure environment overrides as provided in your onboarding package.
- Marketing pages do not surface web sign-in; users authenticate via the **Forge IDE** or direct API clients.
