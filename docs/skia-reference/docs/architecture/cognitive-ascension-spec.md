# Cognitive Ascension (Phase II) — target reasoning architecture

⚠️ **STUB — Phase II — Not yet implemented.**

> **Target stack:** multi-depth reasoning, self-evaluation, Tree-of-Thought and verification loops against eval harnesses. A **Phase 0 minimal** `AdaptiveThinkingEngine` and `TreeOfThoughtService` exist for `REASONING_ENGINE_MODE`; they are **not** a replacement for the full Phase II program below.  
> Nothing here is a production guarantee until Phase II ablation studies are complete.  
> Production behavior remains defined by the live `src/server.ts` and provider paths.  
> This file is planning only.

- **Adaptive Thinking Engine** — multi-pass reasoning control (roadmap) — stub: `AdaptiveThinkingEngine`.
- **Tree-of-Thought / branching** — `TreeOfThoughtService` (stub).
- **MCTS / self-verification** — to be specified against evaluation harnesses (not active).
- **4-stage pre-training pipeline** — roadmap; no claim of active training in this repository.

---

**Skia production alignment (2026).** Same-origin `/api/...` from the app → **login service** in production. Routing: `docs/architecture/skia-routing-invariants.md`. Map of docs: `docs/DOCUMENTATION_MAP.md`. Infra (private): `northflank-services.md`. Feature wiring: `exports/PRE_PUSH_FEATURE_AUDIT.md`. Env names: `.env.example`.

<!-- skia-doc-stamp:v1 -->
