# SKIA Forge Phased Build Plan

## Phase A - Blueprint Audit (completed)
- Validate architectural invariants and identify implementation-ready scope.
- Split broad vision into thin vertical slices that can be shipped safely.
- Capture blockers: VS Code forking and Tauri shell are out of scope for this empty bootstrap repository.

## Phase B - Intelligence Layer Foundation (completed)
- Set up TypeScript runtime, linting, and build pipeline.
- Implement a runnable `skia-intelligence` HTTP service.
- Add Context Engine v1 primitives:
  - file discovery with `.gitignore` and `.skiaignore` support,
  - semantic chunk approximation with metadata,
  - local index persistence in `.skia/index.json`,
  - semantic-like keyword search endpoint.
- Add `.skiarules` loader with schema validation.
- Add append-only agent audit log in `.skia/agent-log.json`.

## Phase C - Hardening (completed)
- Add tests for chunking, ignore handling, and rules validation.
- Add incremental indexing on file-save watcher.
- Add JSON-RPC and streaming APIs for `skia/*` methods.

## Phase D - Product Surface (completed)
- Build chat UI panel and diff preview UX.
- Integrate model providers with primary/fallback routing and health checks.
- Add inline completion channel and status state machine.

## Phase E - Reliability & Safety (completed)
- Add telemetry collection and percentile summaries for key latency metrics.
- Add terminal command safety gate to block destructive patterns.
- Audit safety verdicts in the agent audit log.

## Phase F - Contract Validation (completed)
- Add strict Zod contracts for RPC and critical HTTP write endpoints.
- Enforce consistent bad-payload rejection for telemetry/provider/agent validation routes.
- Add contract and RPC envelope tests.

## Phase G - Operational Stability (completed)
- Add liveness/readiness/version endpoints for orchestration and diagnostics.
- Add startup readiness transition after initial indexing.
- Add graceful shutdown handling for SIGINT/SIGTERM with watcher/server cleanup.

## Phase H - State Persistence (completed)
- Persist provider health/forced-provider state and telemetry snapshots to local runtime state.
- Restore runtime state at service startup.
- Save runtime state on mutations and shutdown.

## Phase I - Observability Hardening (completed)
- Add request context middleware with propagated `x-request-id`.
- Add structured request-completion logs with duration and status.
- Add error correlation by including `requestId` in 500 responses and error logs.

## Phase J - API Guardrails (completed)
- Add rate-limiting middleware for high-traffic RPC and streaming endpoints.
- Add payload size defenses for RPC, stream query payloads, and diff preview text blobs.
- Return clear 413/429 responses for oversized or throttled requests.

## Phase K - SKIA-FULL Integration (completed)
- Audit `Skia-FULL` and identify authoritative SKIA intelligence upstream contracts.
- Integrate RPC intelligence/search methods with `Skia-FULL` adapter as primary path.
- Add `sovereign-core` bridge endpoint plus integration status endpoint.

## Phase L - Brain-Only Integration Scope (completed)
- Scope integration to SKIA evolved brain endpoints only.
- Default to upstream-authoritative behavior (`SKIA_FULL_ALLOW_LOCAL_FALLBACK=false`).
- Exclude mobile/desktop/frontend surfaces from local context indexing.

## Phase M - Full Intelligence Contract Integration (completed)
- Align adapter with SKIA-FULL runtime-proven intelligence routes (`/api/skia/chat`, `/api/meta/route`, `/api/routing/estimate`).
- Extend RPC to route architecture/generation reasoning through evolved SKIA brain.
- Add explicit bridge endpoints for reasoning and routing intelligence workflows.

## Phase N - Brain Contract Probing & Bridge Expansion (completed)
- Add SKIA brain contract probe endpoint to validate upstream reachability before runtime usage.
- Add direct bridge route for SKIA chat brain path.
- Add RPC `skia/route` for explicit reasoning route invocation via SKIA-FULL.

## Phase O - Upstream Auth & Contract Alignment (completed)
- Add optional upstream auth env controls (`SKIA_FULL_AUTH_BEARER`, `SKIA_FULL_API_KEY`).
- Forward inbound auth headers from bridge endpoints to SKIA-FULL.
- Expand probe diagnostics with per-endpoint detail snippets for faster contract debugging.

## Phase P - Probe Intelligence Report + Forge API Surface (completed)
- Add `/integration/skia-full/probe/report` with failure category classification and remediation hints.
- Add platform endpoints `/api/forge/*` wired to existing SKIA intelligence/routing services.
- Keep Forge as orchestration surface without introducing parallel AI infrastructure.

## Phase Q - Unified Forge Orchestration Endpoint (completed)
- Add `/api/forge/orchestrate` for lifecycle pipeline orchestration using SKIA brain routes.
- Sequence context, architecture, SDLC, production, and optional healing stages in one call.
- Keep orchestration logic as thin coordination layer over existing SKIA intelligence services.

## Phase R - Partial-Success Orchestration (completed)
- Change orchestration to stage-isolated execution with per-stage status and error capture.
- Return aggregated orchestration status (`success`, `partial_success`, `failed`) and summary counts.
- Map HTTP response status to orchestration outcomes (200 / 207 / 502).

## Phase S - SKIA-Branded Platform Shell (completed)
- Add `/forge/platform` route rendering a SKIA-branded platform shell layout.
- Wire shell actions to `/api/forge/orchestrate` and `/integration/skia-full/probe/report`.
- Keep style constrained to SKIA palette and brand treatment.

## Phase T - Forge Module Operations Status (completed)
- Add `/api/forge/modules/status` to expose per-module operational health.
- Classify module state from SKIA brain contract probe results.
- Surface module health in the platform shell UI.

## Phase U - Live Module Controls (completed)
- Add `/api/forge/module/:module` for single-module execution control.
- Add module run controls and state badges in the platform shell.
- Keep execution routed through SKIA brain adapter (no duplicate AI stack).

## Phase V - Sovereign Execution Modes (completed)
- Add governance policy layer for `strict`, `adaptive`, and `autonomous` execution.
- Add `/api/forge/mode` read/write endpoints for runtime control-plane mode.
- Enforce mode-aware gating for module execution and orchestration stages.
- Add shell controls for mode selection and explicit approval signaling.

## Phase W - Project-Aware Governance Profiles (completed)
- Extend `.skiarules` with optional governance profile (`default_mode`, `approval_required_modules`).
- Build effective runtime policy from rules with safe defaults and module validation.
- Add governance inspection/reload endpoints and apply policy to module + orchestration access checks.

## Phase X - Governance Decision Audit Trail (completed)
- Add structured governance audit record builder for sovereign control-plane actions.
- Persist allow/block/execute decisions for module and orchestration execution into `.skia/agent-log.json`.
- Persist explicit mode changes as auditable control-plane events.

## Phase Y - Sovereign Governance Telemetry (completed)
- Add governance telemetry store to count allowed/blocked decisions by mode and module.
- Expose governance telemetry endpoint at `/api/forge/governance/telemetry`.
- Record telemetry for module execution decisions and orchestration stage decisions.
- Surface governance telemetry in the Forge platform shell.

## Phase Z - Governance Preflight Preview (completed)
- Add module preview endpoint `/api/forge/module/:module/preview` for policy decision simulation.
- Add orchestration preview endpoint `/api/forge/orchestrate/preview` for stage-by-stage preflight checks.
- Surface governance preflight preview in the Forge platform shell.

## Phase AA - Unified Governance Enforcement (completed)
- Enforce sovereign policy on legacy Forge module routes (`/api/forge/context|agent|sdlc|production|healing|architecture`).
- Centralize mode/approval resolution in a shared governance resolver.
- Ensure blocked decisions are auditable and counted consistently across all module entry points.

## Phase AB - Sovereign Control Plane Snapshot (completed)
- Add `/api/forge/control-plane` to return unified governance mode, policy, telemetry, and recent governance audit records.
- Add control plane snapshot composer to filter and shape audit events for operational dashboards.
- Surface control plane snapshot in the Forge platform shell.

## Phase AC - Sovereign Drift Alerts (completed)
- Add control-plane alerting for governance mode drift from policy default.
- Add control-plane alerting for sustained governance block-pressure.
- Surface alert payload in the platform shell alongside the control-plane snapshot.

## Phase AD - Sovereign Remediation Guidance (completed)
- Add control-plane recommendations that map alerts to actionable operator steps.
- Include recommendation payload in `/api/forge/control-plane`.
- Surface recommendations in the platform shell control-plane panel.

## Phase AE - Executable Remediation Actions (completed)
- Add `/api/forge/control-plane/remediate` for applying approved remediation actions.
- Implement executable `align_mode` action to realign runtime mode with policy default.
- Persist remediation actions into governance audit trail and surface action in shell controls.

## Phase AF - Governance Runtime Persistence (completed)
- Persist sovereign mode and governance telemetry into `.skia/runtime-state.json`.
- Restore persisted governance runtime state at boot while preserving rules-based defaults as baseline.
- Persist governance runtime state on mode changes, remediation actions, governance decisions, and standard runtime mutations.

## Phase AG - Autonomous Recommendation Execution (completed)
- Add `/api/forge/control-plane/remediate/recommended` to execute current control-plane recommendations in sequence.
- Implement recommendation batch executor with deterministic final mode outcome.
- Surface one-click "Apply Recommended" action in the platform shell.

## Phase AH - Ephemeral Approval Tokens (completed)
- Add `/api/forge/approval-token` to issue short-lived single-use approval tokens.
- Extend governance approval resolution so sensitive operations can be approved via explicit flag or token.
- Surface approval token issuance and usage in the platform shell execution controls.

## Phase AI - Tokenized Orchestration Approval (completed)
- Extend orchestration approval resolution to accept one-time approval tokens.
- Enforce single-use token consumption during orchestration execution path.
- Keep governance audit and telemetry behavior unchanged while widening secure approval coverage.

## Phase AJ - Token-Gated Remediation Execution (completed)
- Require explicit approval or one-time approval token for control-plane remediation actions.
- Apply token gating to both single remediation and recommended remediation batch endpoints.
- Reuse existing shell approval controls to authorize remediation execution.

## Phase AK - Scoped Approval Tokens (completed)
- Add token purpose scoping (`module`, `orchestration`, `remediation`, `any`) at issuance time.
- Enforce scope-aware token consumption so tokens cannot authorize unintended control surfaces.
- Surface token purpose selector in shell token issuance controls.

## Phase AL - Approval Token Security Observability (completed)
- Add approval token lifecycle telemetry (issued, consumed, rejected, expired, active).
- Expose `/api/forge/approval-token/stats` for operational monitoring.
- Include token security stats in control-plane snapshot and shell observability panels.

## Phase AM - Emergency Governance Lockdown (completed)
- Add `/api/forge/lockdown` read/write endpoints with approval-gated toggle.
- Enforce lockdown hard-stop on module, orchestration, preview, and remediation execution surfaces.
- Persist lockdown state across restarts and surface lockdown status in shell integration state.

## Phase AN - Signed Governance Intents (completed)
- Add HMAC-based signed intent verification (`x-skia-intent-ts`, `x-skia-intent-nonce`, `x-skia-intent-signature`) with nonce replay protection.
- Enforce signed intent verification on sensitive governance endpoints (mode, lockdown, remediation, approval token issuance) when `SKIA_INTENT_SIGNING_KEY` is configured.
- Expose `/api/forge/governance/intents/status` and add shell controls for signed-intent observability and manual header injection.

## Phase AO - Intent Security Telemetry (completed)
- Extend signed-intent verifier with counters for verified, disabled, and blocked failure classes.
- Expose last failure timestamp and counters through intent status and control-plane snapshot.
- Add tests for telemetry counters across disabled, replay, and skew scenarios.

## Phase AP - Signed-Intent Key Rotation (completed)
- Add primary/secondary signed-intent verification keys with secondary grace-window support.
- Expose key rotation metadata in intent status (`secondaryConfigured`, grace state, grace-until timestamp).
- Track secondary-key verifications (`verified_secondary`) for safe cutover observability.

## Phase AQ - Key Rotation Operational Alerts (completed)
- Add control-plane alerts for signed-intent key rotation risk states (near grace expiry and stale previous key).
- Add control-plane remediation guidance for key rotation cleanup.
- Ensure intent rotation health is surfaced through existing control-plane alerts/recommendations panels.

## Phase AR - Sovereign Posture Snapshot (completed)
- Add single-call `/api/forge/sovereign-posture` endpoint for release-readiness visibility.
- Aggregate runtime readiness, governance mode/lockdown, integration status, and control-plane risk posture.
- Add shell panel for quick posture refresh in the Forge platform UI.

## Build v3 / Phase 1 (skia_update_build.md) — D1-01 + D1-02 (in progress)

### D1-01 frozen (v1) — 2026-04-22
- **Status:** **FROZEN** for in-repo v1: TypeScript + JavaScript structural parsing, `GET /api/forge/context/structure`, Zod contracts, in-memory per-file `StructureIndexCache` / `reparseStructureFile`, `npm run bench:structure`. C# and Tree-sitter **range** incremental re-parse are **out of v1** unless re-opened.
- **D1-02 (same phase, staged):** Stage 1: semantic chunk list from D1-01 symbol ranges, `GET /api/forge/context/semantic-chunks?path=`, optional `embed=1` via `SkiaFullAdapter.tryEmbedding` → `POST /api/skia/embedding`. 50-token overlap, class/method header split. **Stage 2 (2026-04-22):** chunks larger than the §4.1 **~500** approximated-token ceiling are **split** (line-aware, long-line windowed); overlap tails are **capped** to the overlap budget (fixes giant single-line bodies). v1 file-backed vectors + batch/routes: **`skia_update_build.md` §12**. LanceDB/queue: later D1-02+ / D1-04.

### D1-01 (v1) — completion tracker (pre-freeze reference)
Weights: contract 25% · TS 25% · JS 20% · performance gates 20% · incremental re-parse 10% · C# optional (excluded from % until in scope).

| Pillar | % | Notes |
|--------|---|--------|
| **Path + HTTP + Zod** (400/404/422/200) | 100% | `safeProjectPath`, `contextStructureRequest`, `forgeContextStructure*BodySchema` |
| **TypeScript (compiler API)** | 92% | Classes, methods, `function` decl, interfaces, enums, namespace, imports, type aliases, const/field function-like; not exhaustive (e.g. every `declare` form) |
| **JavaScript (Tree-sitter)** | 90% | `class` / `method` / `function` / import/export, `const`+arrow via `variable_declarator`, class field `=` + arrow via `field_definition` |
| **Performance (plan: ~100K LOC full parse; ~200ms incremental re-save)** | 75% | `npm run bench:structure` — ~20K-line synthetic TS ~206ms wall; **extrapolated ~1.03s / 100K LOC** (under 30s plan); per-file re-parse is fast but **200ms SLA is not a hard gate** in code yet |
| **Incremental re-parse on file save** | 55% | **In-memory** `StructureIndexCache`: chokidar `add`/`change` triggers **full re-parse of that file** (not Tree-sitter range edits); `ContextEngine.reparseStructureFile()`; `getStructureIndexSummary()` (max `parseDurationMs`); C# and region-level TBD |
| **C# (only if Skia-FULL in v1)** | — | Not started |

- **Overall D1-01 (v1) completion (weighted):** **~87%** (2026-04-22 — added per-file structural re-parse on watcher + API `reparseStructureFile`; not region-incremental AST).

### Workstream details
- **D1-01 → D1-02 gate:** **D1-01 must be frozen for v1 before D1-02 starts.** D1-02 depends on slow-moving structural boundaries; changing D1-01 after vectors exist forces re-chunking, re-embedding, re-indexing, and retrieval churn. **Full policy and v1 freeze checklist:** `skia_update_build.md` **§12** (subsection *D1-01 freeze (v1) — prerequisite for D1-02*). Record **“D1-01 frozen (v1)”** here when the language set, API/symbol/safePath contracts, and v1 parser completeness are locked.
- **Implemented:** Context Engine *structural* slice per `skia_update_build.md` D1-01 (first deliverable, not the full 100K-LOC performance contract yet).
- **Location:** `src/forge/modules/context-engine/` (maps to plan’s `forge/modules/context-engine`; source lives under `src/` to match `tsconfig` `rootDir`).
- **Stack:** `tree-sitter` + `tree-sitter-javascript` for `.js`/`.cjs`/`.mjs`/`.jsx`; `typescript` compiler API for `.ts`/`.tsx`/`.mts`/`.cts`. **Perf smoke:** `npm run bench:structure` (synthetic ~20K LOC; not CI).
- **API:** `GET /api/forge/context/structure?path=<relative>` — path-safe read under `SKIA_PROJECT_ROOT` / `cwd`, returns symbols + engine id. **HTTP contract (Zod):** 200 = `forgeContextStructureOkBodySchema`; 422 = `forgeContextStructureUnsupportedBodySchema` (`src/contracts.ts`). 400/404/500 use `{ error: string }`. **Symbol `kind` includes** `type` (type alias) and function-like `const`/`class` field arrows where applicable. Handler: `contextStructureRequest.ts` (tested without I/O). **In-process:** `ContextEngine.reparseStructureFile(rel)` + `getStructureIndexSummary()` (D1-01 incremental index, not a separate route).
- **v1 language scope (frozen 2026-04-22):** TS/JS; C# only if Skia-FULL (or a named C# tree) is re-opened as v1+ — see `skia_update_build.md` §12.
- **D1-02+ next (D1-01 is frozen):** Full embedding batching, LanceDB, vector search, incremental embed pipeline, 4-level retrieval (D1-03–D1-07) — see `skia_update_build.md` §4.1.

## Exit Criteria for Current Delivery
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm run build` produces `dist`.
- Service starts locally and can rebuild/search index.
