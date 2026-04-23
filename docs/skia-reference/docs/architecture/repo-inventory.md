# SKIA Repository Inventory

## Active runtime surfaces
- `src/`: primary Express API runtime (`src/server.ts`).
- `frontend/`: Next.js web client and proxy API routes.
- `mobile/`: Expo mobile client with shared backend contracts.
- `desktop/`: Electron shell targeting hosted SKIA web runtime.
- `services/tts/`: FastAPI XTTS service used by backend voice flows.

## Active platform modules
- `skia-orchestrator/`, `skia-products/`, `skia-sec/`, `skia-bench/`, `skia-sim/`, `skia-audit/`, `skia-guard/`, `skia-api/` are mounted through backend routing.

## Partial or scaffolded surfaces
- `os/scripting` and `os/workspaces` are scaffold-level.
- `services/crossDomainSynthesis`, `services/emotionCalibration`, and `services/engagement` are scaffold-level.

## Documentation policy
- Treat architecture docs as source-of-truth only when they match mounted runtime paths.
- Mark every major system as `active`, `partial`, or `stub` to avoid drift.
