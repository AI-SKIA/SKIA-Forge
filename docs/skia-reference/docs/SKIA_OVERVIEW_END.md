# SKIA Overview (Current-State)

## Platform snapshot
- One primary backend runtime.
- Three primary clients: web, mobile, desktop.
- Mounted operator/security ecosystems under `skia-*` modules.
- Dedicated voice/TTS service integration.

## Six evolution pillars (Sovereign Evolution Roadmap)
- **Sovereign Core** — target MoE / scale / context (planning docs only; not production-claimed).
- **Cognitive Ascension** — reasoning, verification, and training architecture (stubs and specs).
- **Sensory Expansion** — TTS and multimodal I/O (TTS integration **active**; other modalities per feature flags).
- **Agentic Dominion** — audit trail and future agent execution hooks (`AuditService` **active**; tools evolution ongoing).
- **Mythic Interface** — dark luxury design system and chat UX (tokens + chat controls **in progress** / `partial` where noted).
- **Operational Supremacy** — health aggregation and admin ops (`/ops` foundation **in progress**).

## Roadmap status
| Phase | Theme | Status |
|-------|--------|--------|
| 0 | Frontier Capability Program (model, reasoning, multimodal, eval) | In progress |
| I | Sovereign Core | Foundation (planned) |
| II | Cognitive Ascension | In progress (minimal reasoning hooks; ablations planned) |
| III | Sensory Expansion | In progress (TTS active; native vision and others partial/stub) |
| IV | Agentic Dominion | In progress (audit active) |
| V | Mythic Interface | In progress (design + chat UX) |
| VI | Operational Supremacy | In progress (ops dashboard foundation) |

## What is real now
- Auth, session, billing, credit tiers, and moderation are active in runtime flows.
- Backend routes and service orchestration are the source of functional truth.

## What remains evolving
- Some OS and specialized service modules are scaffolded or partial.
- Future-state docs should reference current baseline and clearly label deltas.


---

**Skia production alignment (2026).** Same-origin `/api/...` from the app → **login service** in production. Routing: `docs/architecture/skia-routing-invariants.md`. Map of docs: `docs/DOCUMENTATION_MAP.md`. Infra (private): `northflank-services.md`. Feature wiring: `exports/PRE_PUSH_FEATURE_AUDIT.md`. Env names: `.env.example`.

<!-- skia-doc-stamp:v1 -->
