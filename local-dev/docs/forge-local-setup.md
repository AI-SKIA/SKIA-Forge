# Forge local development

Run SKIA Forge against a **local SKIA backend** (Skia-FULL `local-dev/` stack) without changing production Northflank configuration.

## Prerequisites

1. SKIA local stack running — see `Skia-FULL/local-dev/docs/local-setup.md`
2. Node.js 20+
3. `npm install` at Forge repo root and in `skia-ide/`

## Quick start

```bash
cp local-dev/.env.forge.local.example local-dev/.env.forge.local
# Adjust LOCAL_SKIA_BACKEND_URL if needed (default http://localhost:3000)

./local-dev/scripts/start-forge-local.sh
```

In the IDE, open the **LOCAL** sidebar view for the health panel.

## Configuration files

| File | Purpose |
|---|---|
| `local-dev/forge.local.config.json` | Default local service URLs |
| `local-dev/.env.forge.local` | Runtime env (gitignored — copy from example) |
| `src/config/localBackend.ts` | Resolves backend URL when `LOCAL_SKIA_BACKEND_URL` is set |

## Local env vars

| Variable | Default | Purpose |
|---|---|---|
| `LOCAL_SKIA_BACKEND_URL` | `http://localhost:3000` | SKIA API / SkiaFullAdapter upstream |
| `LOCAL_SKIA_SERVE_URL` | `http://localhost:11500` | LLM health probe |
| `LOCAL_EMBEDDING_ENGINE_URL` | `http://localhost:5003` | Embeddings |
| `LOCAL_VECTOR_DB_URL` | `http://localhost:5004` | Vector store |
| `LOCAL_VIDEO_SERVICE_URL` | `http://localhost:5007` | Video adapter |
| `LOCAL_COMFYUI_URL` | (optional) | ComfyUI probe |
| `LOCAL_SD_WEBUI_URL` | (optional) | SD WebUI probe |

When `LOCAL_SKIA_BACKEND_URL` is **unset**, Forge keeps production URLs (`https://api.skia.ca`).

## Founder Override (local)

| Layer | Behavior |
|---|---|
| **SKIA backend** | Log in as `SKIA_OWNER_EMAIL` → unlimited credits, moderation/safety/rate-limit bypass (`founderOverride` in entitlements) |
| **Forge server** | `LOCAL_FOUNDER_OVERRIDE=true` → sovereign mode `autonomous`, governance lockdown off |
| **Forge IDE** | Use same founder email/password as SKIA (seed via Skia-FULL `seed-local-founder.sh`) |

Set matching email in both repos:

```env
SKIA_OWNER_EMAIL=dany.francis@consultant.com
LOCAL_FOUNDER_OVERRIDE=true
LOCAL_FORGE_SOVEREIGN_MODE=autonomous
```

## Health endpoints

| URL | Description |
|---|---|
| `GET http://localhost:4173/api/local/health` | Forge proxy to SKIA `/api/local/health` |
| `GET http://localhost:4173/api/local/services` | Service probe list |
| IDE **LOCAL** panel | Same data + direct probes |

## API auth note

If auth fails against `:3000`, point `LOCAL_SKIA_BACKEND_URL` at the login edge:

```env
LOCAL_SKIA_BACKEND_URL=http://localhost:3001
LOCAL_CHAT_PIPELINE_URL=http://localhost:3000/api/skia/chat
```

See also: [docs/run-forge-locally.md](../docs/run-forge-locally.md).
