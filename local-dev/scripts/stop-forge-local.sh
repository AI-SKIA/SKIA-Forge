#!/usr/bin/env bash
set -euo pipefail

echo "[stop-forge-local] Stopping Forge dev processes (tsx + electron)…"
pkill -f "tsx src/server.ts" 2>/dev/null || true
pkill -f "electron dist/main/main.js" 2>/dev/null || true
pkill -f "SKIA-Forge/skia-ide" 2>/dev/null || true
echo "[stop-forge-local] Done."
