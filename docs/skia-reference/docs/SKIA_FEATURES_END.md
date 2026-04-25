# SKIA Features (Current Runtime)

## Core active features
- Conversational intelligence routed through backend orchestration.
- Multi-surface access: web, mobile, and desktop shell.
- Billing and credit controls integrated into protected workflows.
- Security policy and governance middleware across key routes.
- Voice output pipelines with backend + TTS service integration (`active` when authenticated; guests see inline fallback text).

## Roadmap features (planned) — `stub`
These are **not** production-guaranteed paths; they exist for alignment with the evolution roadmap and future wiring:
- MoE routing architecture (full) — `stub` (a **heuristic** `MoERouterService` exists when `REASONING_ENGINE_MODE` is on; not multi-foundation in prod)
- Adaptive Thinking Engine (full) — `stub` at Phase II target; **minimal 2-pass** in chat when `REASONING_ENGINE_MODE=minimal|full` (`src/services/AdaptiveThinkingEngine.ts`)
- Tree of Thought service (full) — `stub` at scale; **minimal** branch+score when `REASONING_ENGINE_MODE=full` (`src/services/TreeOfThoughtService.ts`)
- Native vision encoder — `stub` (per module and provider wiring)
- Persistent memory (working / episodic / semantic / procedural) as a single productized service — `stub` (`PersistentMemoryService`)
- EvalRunnerService (benchmark automation) — `partial` (see `src/services/EvalRunnerService.ts`, `evals/*`, `EVAL_RUNNER_ENABLED`)
- Frontier intelligence benchmark harness — `partial` (see `exports/EVAL_STATUS.md`)

## Stub / minimal services (roadmap)
- `src/services/MoERouterService.ts` — **Phase I** minimal (heuristics) when `REASONING_ENGINE_MODE` ≠ `off` in chat
- `src/services/AdaptiveThinkingEngine.ts` — **Phase I** minimal 2-pass when `REASONING_ENGINE_MODE=minimal|full`
- `src/services/TreeOfThoughtService.ts` — **Phase I** minimal (full mode uses an optional LLM list)
- `src/services/PersistentMemoryService.ts` — **stub** (Phase IV)
- `src/services/EvalRunnerService.ts` — `partial` (dev/staging eval; behind `EVAL_RUNNER_ENABLED`)

## Frontier Intelligence (roadmap + status)
- **Model stack (reference):** `docs/architecture/model-strategy.md` — primary provider mix and supersession *measurement* goals (not marketing claims).
- **Reasoning engine (runtime):** `REASONING_ENGINE_MODE` in `.env` — `off` default; `minimal` / `full` enable the adaptive and (when `full`) ToT path in `/api/skia/chat`. See `docs/architecture/reasoning-engine.md`.
- **Multimodal (v1):** `POST /api/multimodal/analyze` (PDF + `codeContext`); `docs/architecture/multimodal-spec.md`.
- **Eval harness (baseline):** `exports/EVAL_STATUS.md` and `src/services/EvalRunnerService.ts`.

## Conversational intelligence (chat)
- **Show Reasoning** toggle / panel — `partial` (UI + `reasoning: null` placeholder when enabled; self-critique is not yet surfaced in the main JSON in all modes)
- **Response depth** selector (Concise / Balanced / Detailed) — `partial` (request param accepted and logged; not yet the single driver of all model options)
- TTS **voice output** — `active` (authenticated; self-hosted TTS with resilience helpers)
- TTS **emotional modulation** field — `stub` (accepted + audit only; not passed to the engine)

## Feature maturity labels
- `active`: production path is wired and enforceable.
- `partial`: some flow exists but lacks full operational guarantees.
- `stub`: intentionally placeholder subsystem (or a documented forward-only subset).

## Documentation rule
- Feature docs must map each capability to concrete runtime entrypoints.

---

**Skia production alignment (2026).** Same-origin `/api/...` from the app → **login service** in production. Routing: `docs/architecture/skia-routing-invariants.md`. Map of docs: `docs/DOCUMENTATION_MAP.md`. Infra (private): `northflank-services.md`. Feature wiring: `exports/PRE_PUSH_FEATURE_AUDIT.md`. Env names: `.env.example`.

<!-- skia-doc-stamp:v1 -->
