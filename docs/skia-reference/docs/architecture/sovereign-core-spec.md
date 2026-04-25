# Sovereign Core (Phase I) — target architecture

⚠️ **STUB — Phase I — Not yet implemented.** This document describes planned architecture only.

> **Note:** A **minimal** heuristic `MoERouterService` (Phase 0) exists for `REASONING_ENGINE_MODE` in chat; the **128-expert** vision below is **not** in production.  
> Production truth: `src/server.ts` (login), same image on Northflank as `backend` when `PORT=4000`.  
> This document is **planning** for the larger Sovereign Core program.

| Component | Description | Maturity (label) | Target phase | Dependencies |
|------------|-------------|-------------------|--------------|--------------|
| MoE router (full) | Multi-expert routing, scale | `stub` | I | eval + infra / registry |
| Parameter / context targets | 2M context, large-scale param targets | `stub` | I | pre-training, infra not in repo |
| SSM / hybrid | State-space and hybrid attention blocks | `stub` | I+ | research stack |
| Current login API | `src/server.ts` chat + feature routes | `active` | — | DB, `LLMService` |

| Area | Target (roadmap) | Notes |
|------|------------------|--------|
| MoE router (scale target) | 128 experts, mixture-of-experts routing | v1 in repo: heuristic `MoERouterService` for routing hints only; not 128 experts in prod |
| Parameter scale | ~2T (target) | Not deployed |
| Context window | Up to 2M tokens (target) | Current stack uses provider limits (e.g. Gemini) |
| Experts | 128 (target) | — |
| Attention | Multi-head + specialized patterns (target) | — |
| SSM / hybrid layers | State-space / hybrid blocks in stack (target) | — |
| Pre-training / infastructure | 4+ stage pipeline (target) | — |

---

**Skia production alignment (2026).** Same-origin `/api/...` from the app → **login service** in production. Routing: `docs/architecture/skia-routing-invariants.md`. Map of docs: `docs/DOCUMENTATION_MAP.md`. Infra (private): `northflank-services.md`. Feature wiring: `exports/PRE_PUSH_FEATURE_AUDIT.md`. Env names: `.env.example`.

<!-- skia-doc-stamp:v1 -->
