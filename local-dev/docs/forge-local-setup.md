# Forge local development

Run SKIA Forge against a **local SKIA backend** (Skia-FULL `local-dev/` stack) without changing production Northflank configuration.

## Production vs local (do not mix)

| Layer | Production | Local only |
|---|---|---|
| Forge server URLs | `https://api.skia.ca` (hosting env) | `local-dev/.env.forge.local` must set **`LOCAL_SKIA_BACKEND_URL`** |
| Default `npm run dev` | Production backends | **Does not** read gitignored local config unless env is loaded |
| IDE `skia-ide/` source | Ship as built from repo (`npm run build`) | Optional overlay via `apply-forge-ide-local-patch.ps1` |
| IDE overlay tree | — | `local-dev/ide-overrides/` (blocked in CI; `prebuild` fails if patch marker exists) |

- **Never** run `apply-forge-ide-local-patch.ps1` before a production IDE build or release (`skia-ide` runs `assert-no-local-ide-patch` on build).
- After local work, restore canonical IDE sources: `. .\local-dev\scripts\revert-forge-ide-local-patch.ps1` (runs `git checkout -- skia-ide/`).
- **`npm run dev` without loading local env** always uses production backends — local mode requires `LOCAL_SKIA_BACKEND_URL` in the **process environment** (via `load-forge-local-env.ps1` or `start-forge-local.*`).
- **`NODE_ENV=production`** ignores `LOCAL_SKIA_BACKEND_URL` even if set (Northflank safety).

## Prerequisites

1. SKIA local stack running — see `Skia-FULL/local-dev/docs/local-setup.md`
2. Node.js 20+
3. `npm install` at Forge repo root and in `skia-ide/`

See also **`run-forge-locally.md`** in this directory for the full Forge + SKIA stack walkthrough.

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
| `local-dev/.env.forge.local.example` | Template — copy to `.env.forge.local` (gitignored) |
| `local-dev/forge.local.config.example.json` | Optional LOCAL_* defaults — copy to `forge.local.config.json` (gitignored) |
| `src/config/localBackend.ts` | Local mode only when **`LOCAL_SKIA_BACKEND_URL` is in env**; never from committed JSON alone |

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

When `LOCAL_SKIA_BACKEND_URL` is **unset in the process environment**, Forge keeps production URLs (`https://api.skia.ca`) — including plain `npm run dev` at repo root.

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
