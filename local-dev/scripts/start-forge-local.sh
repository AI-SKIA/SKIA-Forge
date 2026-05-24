#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(cd "$ROOT/.." && pwd)"
cd "$REPO"

ENV_FILE="${ENV_FILE:-$ROOT/.env.forge.local}"
EXAMPLE="$ROOT/.env.forge.local.example"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[start-forge-local] Missing $ENV_FILE — copying example."
  cp "$EXAMPLE" "$ENV_FILE"
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Map local URLs into Forge runtime env (production vars untouched unless local mode is on)
if [[ -n "${LOCAL_SKIA_BACKEND_URL:-}" ]]; then
  export SKIA_BACKEND_URL="$LOCAL_SKIA_BACKEND_URL"
  export SKIA_FULL_API_URL="${LOCAL_SKIA_BACKEND_URL}"
fi
if [[ -n "${LOCAL_FORGE_URL:-}" ]]; then
  export SKIA_FORGE_URL="$LOCAL_FORGE_URL"
fi
if [[ -n "${LOCAL_CHAT_PIPELINE_URL:-}" ]]; then
  export SKIA_CHAT_PIPELINE_URL="$LOCAL_CHAT_PIPELINE_URL"
fi
if [[ -n "${LOCAL_FORGE_AGENT_PIPELINE_URL:-}" ]]; then
  export SKIA_FORGE_AGENT_PIPELINE_URL="$LOCAL_FORGE_AGENT_PIPELINE_URL"
fi

export SKIA_PORT="${SKIA_PORT:-4173}"
export NODE_ENV=development

# Founder Override — Forge governance + SKIA backend owner email
export SKIA_OWNER_EMAIL="${SKIA_OWNER_EMAIL:-dany.francis@consultant.com}"
export LOCAL_FOUNDER_OVERRIDE="${LOCAL_FOUNDER_OVERRIDE:-true}"
export LOCAL_FORGE_SOVEREIGN_MODE="${LOCAL_FORGE_SOVEREIGN_MODE:-autonomous}"

echo "[start-forge-local] Starting Forge server on :$SKIA_PORT (local backend: ${LOCAL_SKIA_BACKEND_URL:-production}, founder override: ${LOCAL_FOUNDER_OVERRIDE:-off})"
echo "[start-forge-local] Sign in as SKIA_OWNER_EMAIL=${SKIA_OWNER_EMAIL} (password: LOCAL_FOUNDER_PASSWORD from Skia-FULL local-dev/.env.local)"
npm run dev &
SERVER_PID=$!

echo "[start-forge-local] Starting Forge IDE (Electron)…"
(cd skia-ide && npm run dev) &
IDE_PID=$!

echo "[start-forge-local] PIDs server=$SERVER_PID ide=$IDE_PID"
echo "  Forge:   http://localhost:$SKIA_PORT/health"
echo "  Local health API: http://localhost:$SKIA_PORT/api/local/health"
echo "  IDE → open LOCAL nav item for stack probes"

wait
