# Model strategy and composition (Phase 0.1)

Forward-looking design for SKIA’s intelligence layer. Runtime selection remains governed by `src/lib/providerRegistry.ts` and environment. This is **not** a promise of any single hosted model or vendor at all times on Northflank.

## Primary model stack (representative)

| Model / role | Provider (typical) | Context (order-of-magnitude) | Strengths | Weaknesses |
|--------------|-------------------|---------------------------------|-----------|------------|
| **Frontier reasoning / default chat** (e.g. Gemini Flash / Pro) | Google AI (Gemini) or self-hosted (Ollama) when `LLM_PROVIDER=ollama` | ~1M+ tokens (Gemini family) | General reasoning, long context, multimodal via API | Quotas, rate limits, cloud dependency when not self-hosted |
| **Code / edits** (same or dedicated smaller model) | As selected in registry; may share primary | Same order as primary | Code completion style answers when system prompts are code-biased | Heavier than needed for trivial Q&A if not MoE-routed |
| **Long context / RAG** | Primary LLM with assembled prompt + RAG from `KnowledgeBaseService` | Bounded by API + prompt windows | In-repo docs + user uploads | Not a second “infinite” context — still bounded |
| **Embeddings** (when enabled) | As configured in registry / `EMBEDDING_*` | Model-dependent | Retrieval quality | Optional infra; not on every request |

## Orchestration strategy

- **Chosen for v1:** a **single primary text model** per request path, with a **heuristic “Mixture of Models” (MoE) router** (`MoERouterService`) that adjusts **temperature** and **max tokens** by task class (code, math, long, general) — *not* multiple different foundation models in parallel on every call.
- **Rationale:** Lower operational cost and simpler failure modes. True multi-expert or multi-foundation MoM can be revisited with eval evidence (`exports/EVAL_STATUS.md`).

## Claude-supersession targets (not claims — measurement goals)

| Dimension | Target (internal) | Rationale |
|----------|-------------------|------------|
| **Tool-use reliability** | **≥ 85%** on the internal `evals/tool-use` suite (pass rate) | Autonomous and agentic flows need repeatable tool success before marketing claims. |
| **Long-context stability** | **≥ 32k** tokens of coherent, instruction-following behavior on a fixed harness | Aligns with doc-heavy and repo-context workflows. |
| **Domain specialization** | **Primary:** product engineering + Skia’s operator flows (orchestrators, health, credentialed APIs) | Public models are generalists; we optimize where we can measure. |

**Non-targets (defer to best-in-class cloud assistants):** unconstrained “general knowledge of everything” without retrieval; consumer-grade creative writing as a first-class product metric. SKIA can still be strong, but we do not optimize those dimensions for the supersession program v1.

---

**Skia production alignment (2026).** Same-origin `/api/...` from the app → **login service** in production. Routing: `docs/architecture/skia-routing-invariants.md`. Map of docs: `docs/DOCUMENTATION_MAP.md`. Infra (private): `northflank-services.md`. Feature wiring: `exports/PRE_PUSH_FEATURE_AUDIT.md`. Env names: `.env.example`.

<!-- skia-doc-stamp:v1 -->
