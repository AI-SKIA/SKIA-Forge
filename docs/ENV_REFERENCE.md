# SKIA Forge environment reference

<!-- last-reviewed: 2026-10-03 -->

Operator-facing variables for **`skia-forge`** (production host `forge.skia.ca`, port **4173**). Values are set in your hosting provider's secret injection — never commit secrets.

## HTTP service

| Variable | Default / example | Purpose |
|----------|-------------------|---------|
| `SKIA_PORT` | `4173` | Listen port |
| `NODE_ENV` | `production` | Runtime mode |
| `SKIA_PROJECT_ROOT` | `/app` | Project root override |

## Upstream SKIA API

| Variable | Default / example | Purpose |
|----------|-------------------|---------|
| `SKIA_FULL_API_URL` | `https://api.skia.ca` | SkiaFullAdapter base URL (chat, routing, health — not embeddings) |
| `SKIA_FULL_TIMEOUT_MS` | `15000` | Upstream timeout |
| `SKIA_FULL_ENABLED` | `true` | Disable adapter when `false` |
| `SKIA_FULL_AUTH_BEARER` | (secret) | Bearer for upstream |
| `SKIA_FULL_API_KEY` | (secret) | API key for upstream |

### Auth proxy target (Forge HTTP server)

The Forge HTTP server resolves the auth-proxy base with `resolveSkiaBackendUrl()` in `src/config/localBackend.ts`:

- If **`LOCAL_SKIA_BACKEND_URL`** is set in the process environment and `NODE_ENV` is not `production`, use that URL.
- Otherwise use the hardcoded production default **`https://api.skia.ca`**.

The Forge **server does not read** `process.env.SKIA_BACKEND_URL`. That variable is consumed by the **desktop IDE** main process (`skia-ide`). Do not document `SKIA_BACKEND_URL` as the Forge HTTP auth-proxy knob.

## Sovereign inference (primary)

Forge routes LLM traffic through the SKIA API and Skia-Serve when healthy (`providerRouter` prefers **`skia-serve`**). Production: sovereign brain on **`skia-serve:11500`**.

| Variable | Default / example | Purpose |
|----------|-------------------|---------|
| `LOCAL_SKIA_SERVE_URL` | `http://localhost:11500` | Local Skia-Serve probe (see `local-dev/docs/forge-local-setup.md`) |

Skia-Serve is the **primary** LLM runtime. Forge reaches it through the SKIA API; it holds no model-provider keys of its own.

## Embeddings (embedding-engine — not Skia-Serve)

Vector indexing uses the **embedding-engine** service, not `api.skia.ca`.

| Variable | Default / example | Purpose |
|----------|-------------------|---------|
| `EMBEDDING_ENGINE_URL` | `http://embedding-engine:5003` | Production embedding-engine base URL |
| `LOCAL_EMBEDDING_ENGINE_URL` | `http://localhost:5003` | Local embedding-engine |
| `SKIA_FULL_EMBEDDING_PATH` | `/embed` | HTTP path on embedding-engine (default `/embed`; not a filesystem storage path) |

## Security / admin

| Variable | Purpose |
|----------|---------|
| `SKIA_ADMIN_SECRET` | Guards sensitive Forge mutation routes when enabled |
| `JWT_SECRET` | Must be ≥32 characters and match login service when validating sessions |

## Releases

| Variable | Purpose |
|----------|---------|
| `SKIA_FORGE_RELEASE_REPO` | GitHub repo for installers |
| `SKIA_FORGE_RELEASE_TAG` | Release tag |
| `SKIA_IDE_RELEASE_BASE_URL` | Download link base |

## Local development only

| Variable | Purpose |
|----------|---------|
| `LOCAL_SKIA_BACKEND_URL` | Point Forge auth proxy / adapter at local login — **must be set in process env** (via `local-dev/scripts/load-forge-local-env.ps1` or `.env.forge.local`). Ignored when `NODE_ENV=production`. |
| `SKIA_FULL_ALLOW_LOCAL_FALLBACK` | When `true`, RPC methods that fail upstream (`skia/explain`, `skia/generate`, `skia/architect`, `skia/review`, `skia/search`) may return local stub responses instead of erroring. Default `false`. Intended for local/dev when the SKIA API is unavailable — do not enable in production customer deployments. |

See `local-dev/docs/forge-local-setup.md`. Optional defaults: copy `local-dev/forge.local.config.example.json` → `local-dev/forge.local.config.json` (gitignored).

See also `docs/OPERATOR_MANUAL.md`. Private operator topology notes live outside this repository.
