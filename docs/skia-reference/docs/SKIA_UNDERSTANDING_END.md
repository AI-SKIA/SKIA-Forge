# SKIA Understanding Baseline

## Architecture truth
- The backend is the system of record for feature behavior.
- Frontend API handlers primarily adapt/proxy to backend contracts.
- Mobile and desktop are clients, not independent backend authorities.

## Intelligence and autonomy posture
- Real orchestration and policy paths exist in active backend modules.
- Claims of full autonomy should be constrained to code-backed behaviors.
- Scaffold modules should remain explicitly marked as non-production.

## Guidance
- Roadmap-phase capabilities in this doc are labeled `stub` in feature lists and in `docs/architecture/*-spec.md` where noted. **No** architecture “complete” claim should be made for those programs until **Phase I** (or the relevant phase) ablation and validation are complete. The **backend** (orchestration + data paths in this monorepo) is the system of record for all **currently active** features. Forward-looking claims stay in clearly marked roadmap sections and `exports/ROADMAP_PHASE_STATUS.md`.
- Keep day-to-day architecture claims evidence-based and tied to runnable entrypoints in `src/` and `frontend/`.


---

**Skia production alignment (2026).** Same-origin `/api/...` from the app → **login service** in production. Routing: `docs/architecture/skia-routing-invariants.md`. Map of docs: `docs/DOCUMENTATION_MAP.md`. Infra (private): `northflank-services.md`. Feature wiring: `exports/PRE_PUSH_FEATURE_AUDIT.md`. Env names: `.env.example`.

<!-- skia-doc-stamp:v1 -->
