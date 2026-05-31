# SKIA Forge environment reference

<!-- last-reviewed: 2026-05-31 -->

Operator-facing variables for **`skia-forge`** (production host `forge.skia.ca`, port **4173**). Values are set in Northflank — never commit secrets.

## HTTP service

| Variable | Default / example | Purpose |
|----------|-------------------|---------|
| `SKIA_PORT` | `4173` | Listen port |
| `NODE_ENV` | `production` | Runtime mode |
| `SKIA_PROJECT_ROOT` | `/app` | Project root override |

## Upstream SKIA API

| Variable | Default / example | Purpose |
|----------|-------------------|---------|
| `SKIA_BACKEND_URL` | `https://api.skia.ca` | Auth proxy target |
| `SKIA_FULL_API_URL` | `https://api.skia.ca` | SkiaFullAdapter base URL (chat, routing, health — not embeddings) |
| `SKIA_FULL_TIMEOUT_MS` | `15000` | Upstream timeout |
| `SKIA_FULL_ENABLED` | `true` | Disable adapter when `false` |
| `SKIA_FULL_AUTH_BEARER` | (secret) | Bearer for upstream |
| `SKIA_FULL_API_KEY` | (secret) | API key for upstream |

## Sovereign inference (primary)

Forge routes LLM traffic through Skia-FULL / Skia-Serve when healthy (`providerRouter` prefers **`skia-serve`**). Production Northflank: sovereign brain on **`skia-serve:11500`**.

| Variable | Default / example | Purpose |
|----------|-------------------|---------|
| `LOCAL_SKIA_SERVE_URL` | `http://localhost:11500` | Local Skia-Serve probe (see `local-dev/docs/forge-local-setup.md`) |

Skia-Serve is the **primary** LLM runtime. Do not document Google Gemini as the default provider.

## Embeddings (embedding-engine — not Skia-Serve)

Vector indexing uses the **embedding-engine** service, not `api.skia.ca`.

| Variable | Default / example | Purpose |
|----------|-------------------|---------|
| `EMBEDDING_ENGINE_URL` | `http://embedding-engine:5003` | Production embedding-engine base URL |
| `LOCAL_EMBEDDING_ENGINE_URL` | `http://localhost:5003` | Local embedding-engine |
| `SKIA_FULL_EMBEDDING_PATH` | `/embed` | HTTP path on embedding-engine (not Skia-FULL API) |

## Google fallback (continuity only)

| Variable | Purpose |
|----------|---------|
| `GOOGLE_AI_API_KEY` | Gemini API when Skia-Serve/sovereign engines unavailable — **continuity fallback only** |
| `GOOGLE_API_KEY` | Optional alias on login; Forge may mirror for local parity |

Do **not** use Agent Platform `AQ.` tokens as `GOOGLE_AI_API_KEY`.

## Security / admin

| Variable | Purpose |
|----------|---------|
| `SKIA_ADMIN_SECRET` | Guards sensitive Forge mutation routes when enabled |
| `JWT_SECRET` | Must match login service when validating sessions |

## Releases

| Variable | Purpose |
|----------|---------|
| `SKIA_FORGE_RELEASE_REPO` | GitHub repo for installers |
| `SKIA_FORGE_RELEASE_TAG` | Release tag |
| `SKIA_IDE_RELEASE_BASE_URL` | Download link base |

## Local development only

| Variable | Purpose |
|----------|---------|
| `LOCAL_SKIA_BACKEND_URL` | Point Forge at local login (see `local-dev/docs/run-forge-locally.md`) |

See also `docs/OPERATOR_MANUAL.md` and Skia-FULL `northflank-services.md` (private operator copy).
