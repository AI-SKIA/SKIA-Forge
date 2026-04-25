# SKIA-Forge Runtime Architecture (Source of Truth)

## Runtime Core

- Server entry: `src/server.ts`
- Runtime model: control-plane orchestration with governance + upstream intelligence integration.

## Major Module Domains

- `forge/modules/context-engine`
- `forge/modules/agent-executor`
- `forge/modules/work`
- `forge/modules/skiarules`
- `forge/modules/tools`
- `forge/modules/security`

## Persistence and Runtime State

- `.skia/runtime-state.json`
- `.skia/architecture-baseline-v1.json`
- `.skia/agent-log.json`

## Principle

- Keep Forge docs tied to concrete code paths and active endpoints.
