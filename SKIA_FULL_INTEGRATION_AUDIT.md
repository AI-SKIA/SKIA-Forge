# SKIA-FULL Integration Audit

## Findings
- `Skia-FULL` is a multi-surface platform (backend, `frontend` Next.js, `desktop`, `mobile`, gateway), not a single model package.
- Existing SKIA intelligence already exists behind upstream API contracts; the frontend routes are proxy wrappers, not local model implementations.
- Confirmed SKIA intelligence entrypoints in `Skia-FULL` frontend:
  - `frontend/pages/api/skia/intelligence.ts` -> `POST {base}/api/skia/intelligence`
  - `frontend/pages/api/skia/search.ts` -> `POST {base}/api/skia/search`
  - `frontend/pages/api/sovereign-core.ts` -> `{base}/api/sovereign-core`
- Current local `SKIA-Forge` service had been implementing local intelligence fallback behavior. This is useful for resilience, but should not be primary when integrating evolved SKIA.

## Integration Decision
- Keep the current `SKIA-Forge` service as orchestration shell.
- Route SKIA intelligence methods to `Skia-FULL` upstream first.
- Preserve local context-engine fallback only when upstream is unavailable or integration is disabled.

## Implemented Integration
- Added `SkiaFullAdapter` in `src/skiaFullAdapter.ts`.
- Wired adapter into JSON-RPC handling in `src/rpc.ts` for:
  - `skia/explain`
  - `skia/review`
  - `skia/search`
  - `skia/generate`
  - `skia/architect`
- Added direct bridge endpoint:
  - `POST /sovereign-core`
- Added integration diagnostics endpoint:
  - `GET /integration/skia-full`
 - Added reasoning/routing bridge endpoints:
   - `POST /integration/skia-full/route`
   - `POST /integration/skia-full/routing-estimate`

## Runtime Controls
- `SKIA_FULL_ENABLED` (default: `true`)
- `SKIA_FULL_API_URL` (default: `https://api.skia.ca`)
- `SKIA_FULL_TIMEOUT_MS` (default: `15000`)
- `SKIA_FULL_ALLOW_LOCAL_FALLBACK` (default: `false`)
- `SKIA_FULL_AUTH_BEARER` (optional bearer token for upstream auth)
- `SKIA_FULL_API_KEY` (optional `x-api-key` for upstream auth)

## Auth/Contract Hardening
- Bridge endpoints now forward inbound auth context (`authorization`, `cookie`, `x-api-key`) to SKIA-FULL.
- Probe endpoint reports per-contract detail snippets to diagnose auth/shape mismatches quickly.

## Result
- System now integrates with existing evolved SKIA instead of building a separate AI path.
- Local implementations remain as deterministic fallback for continuity and offline robustness.
