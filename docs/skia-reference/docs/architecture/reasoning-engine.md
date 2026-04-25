# Reasoning engine (`REASONING_ENGINE_MODE`)

**Env:** `REASONING_ENGINE_MODE=off|minimal|full` (default `off`; see `.env.example`)

## When the engine is invoked

- In `POST /api/skia/chat` after the system prompt, memory, and RAG assembly **and before** the response is output-filtered.
- **Off:** single `llmService.generate` call; no `MoERouterService` or `TreeOfThoughtService` adjustments.
- **On (`minimal` / `full`):** `MoERouterService` adjusts `temperature` and `maxTokens`. `AdaptiveThinkingEngine` always runs a **self-critique** pass. **`full`** also runs `TreeOfThoughtService` to pick a candidate framing, and may apply an extra refinement if the critique flags material issues.

## Passes / branches per mode

| Mode | MoE (heuristic route) | ToT branch | Adaptive passes (model calls) |
|------|------------------------|------------|---------------------------------|
| `off` | No | No | 1 |
| `minimal` | Yes | Heuristic (no extra LLM line list) | 2+ (first answer + self-critique; optional refine in `full` only) |
| `full` | Yes | Yes (may use one small LLM call) | 2+ with optional refine |

## Failure behavior

- If the adaptive / ToT path throws, the handler **falls back** to a single `llmService.generate` (same as legacy path) and logs a warning.
- No unhandled rejection to the client beyond existing chat error contract (`500` with `Chat failed` for unexpected exceptions).

## Latency budget (guidance)

- **`minimal`:** up to **~+2s** p95 over baseline chat (extra short critique pass, bounded tokens).
- **`full`:** up to **~+8s** p95 (ToT list + critique + possible refinement). Tighten in production with timeouts on individual provider calls (existing `LLM_TIMEOUT_MS` and provider code paths).

---

**Skia production alignment (2026).** Same-origin `/api/...` from the app → **login service** in production. Routing: `docs/architecture/skia-routing-invariants.md`. Map of docs: `docs/DOCUMENTATION_MAP.md`. Infra (private): `northflank-services.md`. Feature wiring: `exports/PRE_PUSH_FEATURE_AUDIT.md`. Env names: `.env.example`.

<!-- skia-doc-stamp:v1 -->
