# SKIA-Forge API Reference

## Health and Status

- `GET /health`
- `GET /api/health/*` (module and runtime checks)

## Integration

- `GET /integration/skia-full`
- `GET /integration/skia-full/probe`
- `GET /integration/skia-full/probe/report`
- `POST /integration/skia-full/chat`
- `POST /integration/skia-full/route`
- `POST /integration/skia-full/routing-estimate`

## Forge Module Surfaces (representative)

- `/api/forge/context/*`
- `/api/forge/agent/*`
- `/api/forge/sdlc/*`
- `/api/forge/production/*`
- `/api/forge/healing/*`
- `/api/forge/architecture/*`
- `/api/forge/orchestrate`

## RPC

- `POST /rpc`
  - Includes SKIA-full backed operations with local fallbacks for unavailable upstream paths.

## Error Model

- Schema validation errors return structured request feedback.
- Upstream unavailability returns explicit SKIA-full unavailable errors.
- Governance blocks return mode/policy-based decision context.
