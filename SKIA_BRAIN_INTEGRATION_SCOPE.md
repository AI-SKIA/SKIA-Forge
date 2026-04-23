# SKIA Brain Integration Scope

## Goal
Integrate SKIA's evolved intelligence brain into this system, without importing unrelated product surfaces.

## Included
- `Skia-FULL` upstream intelligence contracts:
  - `/api/skia/chat` (primary)
  - `/api/meta/route` (reasoning/meta-routing)
  - `/api/routing/estimate` (cost-aware routing intelligence)
  - `/api/skia/search`
  - `/api/sovereign-core`
  - `/api/tracing/traces/:id/explain` (explainability/introspection)
- Brain-level orchestration in this service (`/rpc`, `/sovereign-core`).
- Forge platform API surface wired to SKIA brain:
  - `/api/forge/context`
  - `/api/forge/agent`
  - `/api/forge/sdlc`
  - `/api/forge/production`
  - `/api/forge/healing`
  - `/api/forge/architecture`
  - `/api/forge/orchestrate`
- Forge platform shell route:
  - `/forge/platform` (SKIA-branded operational surface)

## Excluded
- `Skia-FULL/mobile`
- `Skia-FULL/desktop`
- `Skia-FULL/frontend` runtime/UI
- `Skia-FULL/claw-code-main` tooling

## Enforcement in This Repo
- `.skiaignore` excludes non-brain surfaces from context indexing.
- `SkiaFullAdapter` is configured with `brainOnly: true`.
- `SKIA_FULL_ALLOW_LOCAL_FALLBACK` defaults to `false` so upstream SKIA brain is authoritative.
- Integration status endpoint (`/integration/skia-full`) exposes active brain contracts.
- Contract probe endpoint (`/integration/skia-full/probe`) verifies live reachability of brain routes.
- Probe report endpoint (`/integration/skia-full/probe/report`) classifies failures (`auth`, `contract`, `unreachable`, `unknown`) with hints.
