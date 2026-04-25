# EXECUTIVE SUMMARY

## Purpose
This document belongs to the docs\EXECUTIVE_SUMMARY.md domain and is maintained as part of the current SKIA documentation set.

## Current Runtime Alignment
SKIA uses `src/server.ts` as the primary API runtime, with frontend, mobile, and desktop as client surfaces and domain services integrated through backend routes and middleware.

## System Status
This surface is currently classified as **active**.

## Claude Supersession Program (measurement, not a marketing claim)
**Status:** in progress. Internal eval suites (`evals/`, `exports/EVAL_STATUS.md`, `src/services/EvalRunnerService.ts`) are the gating source for any performance comparison. **No** supersession claim is valid in product or investor materials until at least one benchmark in `exports/EVAL_STATUS.md` meets a stated target in `docs/architecture/model-strategy.md`.

| Dimension (target) | Indicative focus | Current baseline |
|--------------------|------------------|-------------------|
| **Tool-use reliability** | `evals/tool-use` pass rate (internal harness) | See `exports/EVAL_STATUS.md` (Last run) — **not a vs-Claude result until a controlled benchmark** |
| **Long-context stability** | In-repo long-context task suite (planned tightening) | TBD |
| **Domain specialization** | Product engineering, operator, and health surfaces | TBD |

**Timeline:** rolling from Phase 0 (Q2 2026) with quarterly internal reviews; this does **not** depend on a single public benchmark release. **Claude** remains the reference for general open-domain breadth; SKIA’s program is scoped to where we can measure in production-shaped harnesses.
## Sovereign Evolution Roadmap (forward-looking)
This is a **planning** horizon, not a delivery commitment. Compute scales with phases (inference, retrieval, TTS, and future MoE/SSM work are budgeted at increasing cluster footprint over time—exact nodes are a Northflank / infra decision).

| Phase | Name | Indicative timeline (24-month horizon) | Duration (order-of-magnitude) |
|-------|------|-----------------------------------------|------------------------------|
| I | Sovereign Core | Months 1–6 | ~6 months |
| II | Cognitive Ascension | Months 4–12 | ~8 months (overlap) |
| III | Sensory Expansion | Months 6–14 | ongoing capability |
| IV | Agentic Dominion | Months 8–18 | policy + tools hardening |
| V | Mythic Interface | Months 4–20 | continuous UX |
| VI | Operational Supremacy | Months 10–24 | observability and ops depth |

*Single implementation checklist used for engineering passes:* `SKIA_CURSOR_IMPLEMENTATION_MESSAGE.md` (root).

## Notes
Terminology is normalized to: Primary API runtime, Next API proxy layer, client applications, operator modules, and credit billing system.


---

**Skia production alignment (2026).** Same-origin `/api/...` from the app → **login service** in production. Routing: `docs/architecture/skia-routing-invariants.md`. Map of docs: `docs/DOCUMENTATION_MAP.md`. Infra (private): `northflank-services.md`. Feature wiring: `exports/PRE_PUSH_FEATURE_AUDIT.md`. Env names: `.env.example`.

<!-- skia-doc-stamp:v1 -->
