SKIA Forge — Updated Master Build Plan
Post-Cursor Foundation — Remaining Implementation Scope
Classification: Internal — Technical Architecture
Author: Dany — Founding Operator / Technical Architect
Date: 22 April 2026
Version: 3.0 — Deep Implementation Phase
Estimated Duration: 4 Phases · ~12 Months

1. Executive Summary
SKIA Forge's foundation is built. Cursor has delivered the orchestration skeleton, API surface, SKIA adapter, branded platform shell, and build pipeline. The scaffolding is standing.
What remains is the substance — the deep implementations inside each of the 6 Forge modules that transform SKIA from a conversational AI platform into a Software Intelligence Platform governing the full lifecycle of software from intent to production evolution.
This document defines only the remaining work. Every completed component is acknowledged and excluded. Every remaining task specifies exactly what existing SKIA service or Cursor-built component it connects to.

Scope Constraint
4 phases. Approximately 10–12 months of implementation. Zero new AI infrastructure — every module calls SKIA's existing Chat AI Service through the already-built SkiaFullAdapter and provider fallback system. No duplicate AI plumbing. No rebuilding what exists.

The 6 module interiors to be built:
1.	Context Engine — Deep codebase intelligence via AST parsing, semantic chunking, vector embeddings, and retrieval.
2.	Agent Runtime — Autonomous task planning, tool execution, safety layer, and self-correction.
3.	SDLC Pipeline — Intent-to-ship pipeline: architecture, TDD, deployment artifacts, documentation.
4.	Production Connector — Live observability integration, error-to-code mapping, regression detection.
5.	Healing Engine — Autonomous detect → diagnose → patch → deploy → rollback.
6.	Architecture Analyzer — Debt radar, drift detection, impact prediction, evolution recommendations.
2. Completed Foundation (Built by Cursor — EXCLUDED from Active Tasks)
This section exists for reference only. None of this work appears in the active task phases.

Component	What Was Built	Status	Artifacts
Express Server & API Surface	Full /api/forge/* route groups including /api/forge/orchestrate as the unified lifecycle endpoint. All routes wired to SKIA backend via SkiaFullAdapter.	COMPLETED	src/server.ts + route files
Forge Orchestrator Engine	Stage-by-stage execution engine running ordered stages: context → architecture → sdlc → production → healing. Each stage returns status + output or error.	COMPLETED	src/forgeOrchestrator.ts
Partial-Success Orchestration	Isolated error capture per stage. HTTP 200 for full success, HTTP 207 for partial success, HTTP 502 for full failure. Summary includes total, successCount, failedCount.	COMPLETED	src/forgeOrchestrator.ts
SkiaFullAdapter	Integration adapter routing all AI calls to SKIA's existing services (chat, image, video). No new AI plumbing — uses SKIA's production brain.	COMPLETED	SkiaFullAdapter module
SKIA-Branded Platform Shell	GET /forge/platform serving the Forge UI. Left module rail, central workspace, right orchestration/probe panel. SKIA dark theme with #d4af37 gold palette. No bold font. No glowing/pulsing animations.	COMPLETED	src/forgePlatformUi.ts
Classified Probe Reporting	GET /integration/skia-full/probe/report returning structured health probe data.	COMPLETED	Probe module
Build Pipeline	29 passing tests, lint, typecheck, and build all green. Full CI gate established.	COMPLETED	Test suite + build config
Phase Q: Unified Forge Orchestration Endpoint	Single endpoint orchestrating all 5 stages sequentially.	COMPLETED	—
Phase R: Partial-Success Orchestration	Multi-status HTTP response with per-stage error isolation.	COMPLETED	—
Phase S: SKIA-Branded Platform Shell	Full branded UI shell with module navigation.	COMPLETED	—

3. Remaining Architecture — What Gets Built Now
The orchestrator skeleton calls 5 stages: context, architecture, sdlc, production, healing. The stages currently connect to SKIA's services through SkiaFullAdapter, but the deep processing engines behind each stage need full implementation. Additionally, the Architecture Analyzer module (6th module) and the Forge Client (VS Code extension / web deepening) need to be built.
System Architecture — Dependency Map

Forge Orchestrator (BUILT) ──calls──▸ Stage: context      ──▸ Context Engine     (NEEDS DEEP IMPL)                          ──calls──▸ Stage: architecture  ──▸ Arch Analyzer      (NEEDS FULL BUILD)                          ──calls──▸ Stage: sdlc          ──▸ SDLC Pipeline      (NEEDS DEEP IMPL)                          ──calls──▸ Stage: production    ──▸ Prod Connector     (NEEDS DEEP IMPL)                          ──calls──▸ Stage: healing       ──▸ Healing Engine     (NEEDS DEEP IMPL)  All modules call ──▸ SkiaFullAdapter (BUILT) ──▸ SKIA Chat AI (EXISTING)

Each module implementation below replaces what is currently a thin passthrough with a full processing engine. The orchestrator's stage-calling interface remains unchanged — only the engines behind the stages are new.

Integration Principle
Every task in this plan specifies a "Wires Into" column identifying the exact existing SKIA service or Cursor-built component it connects to. If a task does not wire into something that already exists, it is not approved for implementation.

4. Phase 1 — Deep Intelligence Engines (Months 1–3)
Goal: Implement the Context Engine and Agent Runtime at full depth. These are the foundation — every other module depends on them.
4.1 Context Engine — Full Implementation

**D1-01 / D1-02 sequencing (v1):** D1-01 must be **frozen** (language set, API/symbol/safePath contracts) before D1-02+; see **§12**. D1-02+ assume stable structural boundaries; shifting D1-01 after the vector layer exists forces re-chunk, re-embed, and re-index churn.

Task ID	Task	Wires Into	Description	Acceptance Criteria	Week
D1-01	Tree-sitter AST Parser Integration	Context Engine stage (Cursor-built orchestrator)	Install Tree-sitter with grammar packages for TypeScript, JavaScript, Python, Rust, Go, Java, and C#. Build incremental parsing pipeline: on file open → parse full AST; on file save → re-parse only changed regions. Extract structural elements (functions, classes, methods, interfaces, imports, exports) with metadata (start line, end line, symbol name, parent scope).	Parse a 100K LOC TypeScript project in under 30 seconds. Incremental re-parse on file save under 200ms. Structural elements extracted with full metadata.	1–3
D1-02	Semantic Chunker	D1-01 output (ASTs)	Split AST-extracted elements into semantic chunks of 100–500 tokens each. Use overlapping windows (50-token overlap) to preserve cross-boundary context. Each chunk tagged with: file path, language, symbol type, symbol name, parent scope, line range.	Chunking produces consistent, meaningful units. Functions stay intact. Classes split by method. Overlap prevents boundary artifacts.	2–4
D1-03	Embedding Pipeline	SKIA Chat AI via SkiaFullAdapter (Cursor-built)	Process each semantic chunk through SKIA's AI service to generate 1536-dimensional vector embeddings. Batch processing with rate limiting to respect SKIA's provider fallback thresholds. Queue system for large codebases (>50K chunks).	All chunks embedded. Calls go through SkiaFullAdapter and SKIA's provider fallback. Batch processing handles 50K+ chunks without timeout or throttle failure.	3–5
D1-04	LanceDB Vector Store	New dependency (LanceDB embedded)	Integrate LanceDB as embedded vector database. Store embeddings indexed by: file path, language, symbol type, symbol name, last modified timestamp. Support CRUD operations for incremental updates.	Vectors stored and retrievable. Query by similarity returns ranked results. Delete/re-insert on file change works correctly. Storage footprint under 500MB for 100K LOC project.	4–6
D1-05	Semantic Search Engine	D1-04 (LanceDB store) + Context Engine API route (Cursor-built)	Implement similarity search over the vector store. Accept natural language query or code snippet; return top-k relevant chunks with similarity scores. Wire into existing /api/forge/context POST /search endpoint.	Search returns relevant results for both natural language and code queries. Query latency under 100ms for 100K chunk index. Results include file path, line range, symbol name, similarity score.	5–7
D1-06	Incremental Index Updater	D1-01 through D1-04 (full Context Engine pipeline)	On file save: detect changed files → re-parse with Tree-sitter (incremental) → re-chunk changed elements → re-embed changed chunks → update LanceDB index. Delete removed chunks.	Full update cycle under 500ms for a single file save. Index stays consistent after rapid successive saves. Deleted files have their chunks removed.	6–8
D1-07	Context Retrieval & Compression Engine	D1-05 (search) + SKIA Chat AI via SkiaFullAdapter	Implement the 4-level context retrieval hierarchy: L1 current file (≤2K tokens) → L2 imports/dependencies (≤3K tokens) → L3 semantic search results (≤2K tokens) → L4 project structure + .skiarules (≤1K tokens). Compress total context to ~8K tokens from a potentially multi-million-token codebase. Wire as the context preparation step for all downstream modules.	Context retrieval produces relevant, compressed context. Total output within token budget. Context quality validated by downstream module accuracy.	7–9

4.2 Agent Runtime — Full Implementation

Task ID	Task	Wires Into	Description	Acceptance Criteria	Week
D1-08	Agent Planner	SKIA Chat AI via SkiaFullAdapter + D1-07 (context retrieval)	Takes natural language instruction + context from Context Engine. Calls SKIA's chat AI to generate a structured task plan with: ordered steps, dependencies between steps, tool selection per step, estimated risk per step. Wire into existing /api/forge/agent POST /plan endpoint.	Plans are well-structured with clear dependencies. Tool selection is appropriate. Planning completes under 5 seconds. Plans for complex tasks (multi-file refactor) include 5–15 meaningful steps.	7–10
D1-09	Agent Tool System	File system + terminal + git (local execution)	Implement the pluggable tool registry with 8 tools: read_file (risk: low), write_file (risk: medium), edit_file (risk: medium), search_codebase (risk: low — uses Context Engine), search_text (risk: low — grep/regex), run_terminal (risk: high), git_operations (risk: medium), list_files (risk: low). Each tool has execute(), validate(), and rollback() methods.	All 8 tools functional. Risk levels enforced. Rollback works for write_file and edit_file. Terminal commands execute in sandboxed context.	8–11
D1-10	Agent Executor with Safety Layer	D1-08 (planner) + D1-09 (tools) + Agent API route (Cursor-built)	Executes plans step-by-step using tools. Safety layer: diff preview for all file modifications; approval gate for high-risk operations (destructive terminal commands, force push, database operations); full audit logging to .skia/agent-log.json. Wire into existing /api/forge/agent POST /execute endpoint.	Plans execute correctly. No file modification without diff preview. High-risk operations blocked without approval. All actions logged with timestamp, tool, input, output, risk level.	9–12
D1-11	Agent Self-Correction Loop	D1-10 (executor) + SKIA Chat AI via SkiaFullAdapter	After execution: run validation (tests, lint, type-check). If validation fails: call SKIA's chat AI to analyze the failure → re-plan → retry. Maximum 3 retry cycles.	Agent catches its own errors (test failures, type errors, lint violations). Self-correction succeeds on ≥60% of correctable failures. Retry limit enforced. Each retry logged.	10–13

4.3 .skiarules — Deep Parser & Enforcer

Task ID	Task	Wires Into	Description	Acceptance Criteria	Week
D1-12	.skiarules Deep Parser & Enforcer	Context Engine + Agent Runtime	Full .skiarules schema implementation: project metadata; architecture boundaries (canImportFrom, cannotImportFrom); coding conventions; agent permissions (autonomy level, auto-approve threshold, blocked commands, blocked paths); healing config; production config; SKIA personality settings. Parser validates on project open. Enforcer checks rules before every agent action and every completion.	All .skiarules sections parsed. Invalid configs produce clear errors. Architecture boundary violations caught at write-time. Agent respects permission settings. Hot-reload on file change within 2 seconds.	8–13


Phase 1 Delivery Gate
Phase 1 ships as a complete product: full codebase intelligence + autonomous agent capable of reading, understanding, planning, executing, and self-correcting across any codebase. No Phase 2 work begins until Phase 1 passes all acceptance criteria and is production-stable.

5. Phase 2 — SDLC Intelligence (Months 4–6)
Goal: Intent-to-ship pipeline. SKIA decomposes feature requests into architecture, code, tests, deployment artifacts, and documentation. This is where SKIA surpasses every coding tool on the market.
5.1 SDLC Pipeline — Deep Implementation

Task ID	Task	Wires Into	Description	Acceptance Criteria	Week
D2-01	Intent Decomposition Engine	SKIA Chat AI via SkiaFullAdapter + Context Engine (D1-07)	User states a feature request in natural language. Engine calls SKIA's chat AI with codebase context to decompose into 8 dimensions: architecture plan (modules affected, patterns to use); component design (new/modified files, interfaces); data model changes (entities, schema, migrations); API contract (endpoints, request/response shapes); implementation task list (ordered, with dependencies); test strategy (coverage targets, edge cases); deployment plan (infrastructure/config/rollout); monitoring requirements (metrics, alerts, SLO impacts). Wire into existing /api/forge/sdlc POST /decompose.	Complex feature request (e.g., "build user auth with OAuth and MFA") produces structured plan with 10+ tasks covering all 8 dimensions. Plan accounts for existing codebase patterns. Decomposition completes under 15 seconds.	14–17
D2-02	Architecture Decision Record Generator	SKIA Chat AI via SkiaFullAdapter + Context Engine	Generates a formal ADR before any code is written. Includes: context (current state), decision (pattern/approach chosen), alternatives considered (with tradeoff analysis), consequences (changes introduced, risks), system fit evaluation (how this fits with existing architecture from Context Engine).	ADR generated for every feature-level task. Includes ≥2 alternatives with tradeoffs. System fit references actual existing codebase components.	16–19
D2-03	TDD Test Generation Engine	SKIA Chat AI via SkiaFullAdapter + Context Engine + Agent Runtime (D1-08–D1-11)	Generates test suites BEFORE implementation. Calls SKIA's chat AI with architecture plan + codebase patterns to produce: unit tests (per function/method), integration tests (per module interaction), edge case tests (boundary conditions, error paths, null handling), performance benchmarks. Tests are syntactically valid and runnable. Agent Runtime executes them to verify they compile and fail appropriately (red phase of TDD).	Tests generated from architecture plan — not reverse-engineered from code. Tests compile and are syntactically valid. Coverage targets >80%. ≥3 non-obvious edge cases per function. Tests fail correctly before implementation.	18–22
D2-04	Deployment Artifact Generator	SKIA Chat AI via SkiaFullAdapter + Context Engine	Detects project infrastructure from existing config files (package.json, Dockerfile, docker-compose.yml, terraform/*.tf, .github/workflows, Procfile, vercel.json, netlify.toml). Generates updated or new deployment artifacts matched to detected infrastructure: Dockerfiles, docker-compose, Kubernetes manifests, Terraform modules, CI/CD pipeline definitions (GitHub Actions, GitLab CI, Jenkins).	Infrastructure detection identifies existing patterns correctly. Generated artifacts are valid and deployable. Docker builds succeed. K8s manifests pass kubeval. Terraform plans succeed.	22–25
D2-05	Documentation Synthesizer	SKIA Chat AI via SkiaFullAdapter	Auto-generates documentation as a byproduct of implementation: API docs (OpenAPI/Swagger spec from new endpoints), architecture docs (component diagrams, module descriptions), changelog entries (conventional commits format), migration guides (for breaking changes).	Docs generated automatically after implementation completes. API spec is valid OpenAPI 3.x. Changelog follows conventional commits. Migration guide includes step-by-step instructions when breaking changes detected.	24–26
D2-06	Full SDLC Pipeline Orchestration	All D2 components + SDLC API routes (Cursor-built)	Wire the full pipeline through existing /api/forge/sdlc endpoints: POST /decompose → POST /architect → POST /test → implementation via Agent Runtime → POST /deploy → POST /docs. Support streaming progress updates for long-running pipelines.	Full pipeline executable end-to-end from a single feature request. Streaming progress shows current stage. Partial results available if interrupted. Total pipeline execution for medium feature under 10 minutes.	24–26

5.2 Forge Client — VS Code Extension v1 (Parallel Track)

Task ID	Task	Wires Into	Description	Acceptance Criteria	Week
D2-07	Forge Client — VS Code Extension v1	All Phase 1 & Phase 2 API endpoints via SkiaFullAdapter	Build VS Code extension with: SKIA chat panel (calls SKIA's existing chat endpoint through Forge API); agent panel (calls /api/forge/agent); SDLC panel (calls /api/forge/sdlc); @-mention context system (@file, @folder, @function, @symbol wired to /api/forge/context); inline completions via SKIA Language Server endpoint. All panels use SKIA dark theme with #d4af37 gold. Streaming responses render token-by-token.	Extension installs cleanly in VS Code and Cursor. All panels functional. Chat streams correctly. Agent panel shows plan + diff previews. SDLC panel shows decomposition results. @-mentions resolve to correct context. No bold font anywhere.	14–26


Phase 2 Delivery Gate
Phase 2 ships the complete intent-to-ship pipeline + developer-facing VS Code extension. A single natural language feature request produces architecture plans, test suites, implementation, deployment artifacts, and documentation — end-to-end, without human intervention beyond approval gates.

6. Phase 3 — Production Consciousness & Self-Healing (Months 7–10)
Goal: SKIA becomes aware of production AND can autonomously heal issues. These two capabilities are combined into a single phase because the Healing Engine depends directly on the Production Connector's telemetry. No coding tool on the market offers either capability. Together they represent the primary competitive moat.
6.1 Production Connector — Observability Integration

Task ID	Task	Wires Into	Description	Acceptance Criteria	Week
D3-01	Observability Adapter Framework	Production stage (Cursor-built orchestrator)	Plugin architecture for connecting observability platforms. Each adapter implements a standard interface: connect(), healthCheck(), fetchMetrics(), fetchLogs(), fetchTraces(), fetchAlerts(). Adapters are hot-loadable and configurable via .skiarules production section.	Framework supports pluggable adapters. Standard interface enforced by TypeScript generics. Hot-loading works without restart.	27–29
D3-02	Built-in Adapters — Datadog, Grafana, OpenTelemetry	D3-01 (adapter framework)	Three production adapters: Datadog API v2 adapter (metrics, logs, traces, monitors); Grafana/Prometheus adapter (PromQL queries, alert rules, dashboard data); OpenTelemetry Collector adapter (OTLP ingestion for metrics, logs, traces). Each normalizes platform-specific data into SKIA's internal telemetry format.	All three adapters connect to real test instances. Data normalized into consistent internal format. Health checks verify connectivity.	29–33
D3-03	Telemetry Ingestion Pipeline	D3-02 (adapters) + SKIA Database	Background service polling adapters at configurable intervals (default 30s). Stores normalized telemetry with sliding windows: 60s, 5m, 15m, 1h, 24h. Automatic pruning of data older than retention period (configurable, default 30 days).	Ingestion runs reliably on schedule. Data queryable by time range, service, metric type, severity. Sliding window aggregations precomputed. Storage grows predictably.	30–34
D3-04	Error-to-Code Mapper	Context Engine (D1-05, D1-07) + SKIA Chat AI via SkiaFullAdapter	Correlates production stack traces with codebase via Context Engine semantic search. Maps error to: exact file, function, line number, commit hash (from git blame), PR number (from git log). For ambiguous mappings, calls SKIA's chat AI for causal chain analysis. Produces structured error report with full trace from production error → code → deployment.	Mapping accuracy >85% on test dataset of 50+ real stack traces. Mapping latency under 30 seconds. Report includes commit hash and PR reference.	32–36
D3-05	Performance Regression Detector	D3-03 (telemetry pipeline)	Monitors p50, p95, p99 latencies + memory usage + CPU utilization + database query duration. Uses ARIMA for time-series forecasting and Prophet for seasonality-aware anomaly detection. Correlates detected regressions with recent deployments via git integration.	Detects injected performance regressions within 5 minutes of deployment. False positive rate under 15%. Correctly identifies the deployment that caused the regression.	34–38
D3-06	Deployment Confidence Scorer	Context Engine + D3-03 (telemetry) + SKIA Chat AI via SkiaFullAdapter	Pre-deployment risk assessment from 5 signals: test coverage of changed code (Context Engine + CI); historical stability of modified components (telemetry history); change complexity (AST diff analysis); dependency risk (dependency graph); production health of related services (current telemetry). Produces a 0–100 confidence score with explanation.	Confidence score calculated for every deployment request. Score explanation references specific risk factors. Score correlates with actual outcomes >80% accuracy after calibration period.	36–39
D3-07	User Impact Analyzer	D3-03 (telemetry) + SKIA Chat AI via SkiaFullAdapter	Correlates production incidents with user impact: affected user count (error rate × traffic volume), degraded functionality (affected endpoints), estimated revenue impact (endpoint business criticality weights defined in .skiarules). SKIA's chat AI generates human-readable impact summaries.	Impact report generated within 60 seconds of incident detection. User count estimation within 20% of actual. Impact summary readable by non-technical stakeholders.	37–40

6.2 Healing Engine — Autonomous Self-Repair

Task ID	Task	Wires Into	Description	Acceptance Criteria	Week
D3-08	Anomaly Detection Engine	D3-03 (telemetry pipeline)	Continuous monitoring of all ingested telemetry. Detects: error rate spikes (>baseline + 3σ), latency increases (p95 exceeds threshold), resource exhaustion (memory/CPU >85%), traffic anomalies (sudden drops indicating upstream failures). Uses configurable thresholds + ML classifiers trained on historical data. No human trigger required.	Anomalies detected within 60 seconds. False positive rate <10% after 2-week calibration. Classification includes severity (critical, warning, info) and type.	38–42
D3-09	Root Cause Analysis Agent	D3-08 (anomaly detection) + Context Engine + SKIA Chat AI via SkiaFullAdapter + Agent Runtime	Specialized agent triggered by anomaly detection. Correlates anomaly with: recent deployments (git log), code changes (Context Engine diff), infrastructure events (telemetry), dependency updates (package manager history), traffic patterns (telemetry). Calls SKIA's chat AI to generate root cause hypothesis with confidence score.	Root cause hypothesis generated within 3 minutes of anomaly detection. Confidence score attached. Accuracy >75% against post-incident reviews. Includes specific files, commits, deployment references.	40–44
D3-10	Autonomous Patch Generator	D3-09 (root cause) + Agent Runtime (D1-08–D1-11) + SKIA Chat AI via SkiaFullAdapter	Based on root cause analysis: calls SKIA's chat AI to generate a targeted patch. Uses Context Engine for codebase context. Uses Agent Runtime to: create staging branch → apply patch → run full test suite → validate no regressions. Produces patch report with: changes made, tests passed, risk assessment.	Patch generated within 10 minutes of root cause identification. Patch passes full test suite. Report includes diff, test results, risk score.	42–46
D3-11	Auto-Deploy Gate & Intelligent Rollback	D3-10 (patch generator) + deployment infrastructure	Auto-deploy gate: if patch confidence ≥ threshold (configurable in .skiarules, default 0.90), deploy automatically. Below threshold → create PR for human review. Intelligent rollback: if patch cannot be generated/validated quickly enough, identify minimum rollback scope — revert only problematic changes while preserving unrelated improvements from the same deployment.	Auto-deploy threshold configurable and enforced. Patches above threshold deploy without human intervention. Rollback scope minimized (not blind revert-all). Rollback completes within 5 minutes. All actions logged.	44–47
D3-12	CI/CD Healing Agent	Agent Runtime + SKIA Chat AI via SkiaFullAdapter	Monitors CI/CD pipeline status via GitHub Actions API, GitLab CI API, or Jenkins API. When builds break or tests flake: diagnoses failure using SKIA's chat AI → generates fix → validates. Auto-merges low-risk fixes (linter errors, dependency version bumps, type annotation fixes). Creates PR for higher-risk fixes with explanation.	Build failure diagnosed within 2 minutes. Low-risk fixes auto-merged >90% success rate. High-risk fixes produce PR with clear explanation. Flaky test detection distinguishes genuine flakes from real failures.	44–47
D3-13	CVE & Vulnerability Patcher	Agent Runtime + SKIA Chat AI via SkiaFullAdapter	Monitors CVE databases (NVD API, GitHub Advisory Database, npm audit, Snyk API) and dependency advisories via scheduled polling (every 6 hours). When vulnerability affects project dependencies: generates upgrade patch → runs test suite → opens PR with vulnerability details, severity, fix description.	CVE detected within 6 hours of publication. Patch PR opened within 30 minutes of detection. Test suite passes. PR description includes CVE ID, severity, affected versions, fix version.	46–48
D3-14	Healing Audit Trail	SKIA Database	Append-only log of every autonomous healing action: detection (timestamp, anomaly type, severity); analysis (root cause hypothesis, confidence); patch (diff, test results, risk score); deployment (method, scope, outcome); rollback (trigger, scope, result). Cryptographic signing for tamper-proofing. Searchable, filterable, exportable for compliance.	Every healing action logged with full context. Audit trail queryable by date range, severity, action type, outcome. Export to CSV/JSON. Cryptographic chain validates integrity.	46–48

6.3 Production & Healing Dashboards

Task ID	Task	Wires Into	Description	Acceptance Criteria	Week
D3-15	Production & Healing Dashboards	SKIA Frontend (existing Next.js) / Forge Platform Shell (Cursor-built)	Two web dashboards integrated into Forge platform shell: Production Dashboard showing real-time system health, active incidents, error-to-code mappings, regression alerts, deployment history with confidence scores. Healing Dashboard showing anomaly timeline, active healing operations, patch history, rollback events, audit trail viewer. Both use SKIA dark theme with #d4af37 gold palette.	Both dashboards live. Real-time updates (WebSocket/SSE). All data from Production Connector and Healing Engine displayed. Drill-down from incident to code to commit.	46–50


Phase 3 Safety Constraint
No autonomous healing action deploys to production without passing the full test suite on a staging branch first. The auto-deploy confidence threshold is operator-configurable and defaults to 0.90. Below threshold, all patches require human approval via pull request.

7. Phase 4 — Predictive Architecture Intelligence (Months 11–14)
Goal: SKIA reasons about the future health of the codebase. Proactively detects degradation, predicts impact of changes, and recommends architectural evolution. This is the highest layer — the capability that transforms SKIA from reactive intelligence into predictive intelligence.

Task ID	Task	Wires Into	Description	Acceptance Criteria	Week
D4-01	Technical Debt Radar	Context Engine (AST analysis) + git history + Production Connector (bug density) + CI reports (coverage)	Real-time debt map of the codebase. Every module scored on 6 dimensions: cyclomatic complexity (from Tree-sitter ASTs), coupling metrics (from import analysis), change frequency (from git log), bug density (from Production Connector error-to-code mappings), test coverage (from CI coverage reports), code age (from git blame). Dashboard with per-module health scores, trend lines, hotspot visualization.	Every module scored. Scores update on every commit. Trends visible over 7-day, 30-day, 90-day windows. Hotspot visualization highlights the 10 worst modules. Scores validated by developer assessment (>75% agreement).	50–54
D4-02	Architectural Drift Detector	Context Engine (import analysis) + .skiarules (boundary definitions)	Enforces architecture boundaries defined in .skiarules at write-time. Analyzes import statements, dependency injection patterns, and data flow to detect: module boundary violations (A imports from B when forbidden), circular dependencies, layer violations (UI importing directly from database layer), anti-pattern usage (patterns listed in .skiarules antiPatterns). Violations surfaced immediately — not deferred to code review.	Violations detected in real-time (<2 seconds after file save). All violation types detected. False positive rate <5%. Report includes offending import/pattern, the .skiarules rule violated, and suggested fix.	52–56
D4-03	Change Impact Predictor	Context Engine (dependency graph) + Production Connector (service topology) + SKIA Chat AI via SkiaFullAdapter	Before a change is implemented, predicts blast radius: directly affected modules (import/dependency analysis), transitively affected modules (call graph), potentially breaking tests (test-to-code mapping), impacted production services (service topology via Production Connector), overall risk score (composite). Wire into existing /api/forge/architecture POST /impact endpoint.	Impact prediction generated before agent executes changes. Prediction accuracy >80% against actual outcomes. Includes specific module names, test file names, service names. Risk score 0–100 with explanation.	54–58
D4-04	Evolution Recommender	Context Engine + D4-01 (debt radar) + Production Connector (usage trends) + SKIA Chat AI via SkiaFullAdapter	Proactive architectural evolution recommendations triggered when modules cross health thresholds or growth patterns indicate structural problems. SKIA's chat AI generates recommendations (e.g., "Module X has grown 300% in 6 months and handles 3 concerns — split into XAuth, XProfile, XNotification with shared XCore"). Each includes: rationale, proposed structure, migration plan, risk assessment, one-click execution plan (wired to Agent Runtime).	Recommendations generated when thresholds crossed. Each includes rationale referencing specific metrics. Proposed structure is architecturally sound. Migration plan executable via Agent Runtime. Acceptance rate >50% over time.	56–60
D4-05	Team Pattern Learner	Context Engine + SKIA Database + SKIA Chat AI via SkiaFullAdapter	Learns coding patterns, architectural preferences, and quality standards from: codebase analysis (naming conventions, structural patterns, common abstractions), developer interactions (accepted vs. rejected suggestions), PR history (reviewer requests). Stores learned patterns in SKIA's database. Applies patterns to all suggestions. New team members get team-consistent suggestions from day one.	Patterns detected within 2 weeks of active usage. Suggestions align with team patterns (validated by ≥20% acceptance rate increase vs. generic suggestions). Patterns update as team style evolves.	56–60
D4-06	Architecture Dashboard	SKIA Frontend / Forge Platform Shell (Cursor-built)	Web dashboard integrated into Forge platform shell: Technical Debt Radar (heatmap with drill-down), Drift Violations (real-time feed with severity), Impact Predictions (history with accuracy tracking), Evolution Recommendations (queue with accept/reject/defer actions), Pattern Library (learned patterns with examples). SKIA dark theme with #d4af37 gold.	Dashboard live. All Architecture Analyzer data visualized. Drill-down from module score to specific metrics. Recommendation actions (accept, reject, defer) functional.	58–60


Phase 4 Delivery Gate
Phase 4 ships the predictive intelligence layer. SKIA Forge now reasons about the future — proactively surfacing architectural decay, predicting the impact of changes before they're made, and recommending structural evolution with one-click execution plans.

8. The Complete Platform — Post-Build State
After all 4 phases, the complete SKIA Forge platform comprises 5 integrated capability layers:

Layer	Capability	Modules	Phase Delivered
Foundation	Codebase intelligence & autonomous coding	Context Engine + Agent Runtime + .skiarules	Phase 1 (Months 1–3)
SDLC Intelligence	Intent-to-ship pipeline with architecture, TDD, deployment, docs	SDLC Pipeline + VS Code Extension	Phase 2 (Months 4–6)
Production Consciousness	Live telemetry, error mapping, regression detection, confidence scoring	Production Connector	Phase 3 (Months 7–10)
Self-Healing	Autonomous detect → diagnose → patch → deploy → rollback	Healing Engine	Phase 3 (Months 7–10)
Predictive Architecture	Debt radar, drift detection, impact prediction, evolution, pattern learning	Architecture Analyzer	Phase 4 (Months 11–14)


Integration Invariant
All layers call SKIA's existing Chat AI via the Cursor-built SkiaFullAdapter. Zero new AI infrastructure. One brain with six new skills and a sovereign platform surface.

9. What SKIA Forge Does That Nothing Else Can

Capability	Cursor	GitHub Copilot	Windsurf	SKIA Forge
Writes code via agents	Yes	Limited	Yes	Yes (table stakes)
Parallel agent orchestration	Yes	No	Yes	Yes (table stakes)
Intent-to-ship full pipeline	No	No	No	Yes — architecture through deployment through docs
Live production awareness	No	No	No	Yes — real-time telemetry integration
Autonomous self-healing	No	No	No	Yes — detect → patch → deploy without human trigger
Predictive architecture intelligence	No	No	No	Yes — debt radar, drift, impact, evolution
Provider independence	No (locked)	No (locked)	No (locked)	Yes — SKIA services + Google APIs with automatic fallback
Project-specific learning	Minimal	No	Minimal	Yes — deep team pattern learning over time
Full local inference option	No	No	No	Planned — zero-cloud mode for enterprise

10. Success Metrics
Phase 1 — Foundation

Metric	Target
Codebase index build time (100K LOC)	< 30 seconds
Incremental index update	< 500ms per file save
Semantic search query latency	< 100ms
Agent task completion rate	≥ 80%
Agent self-correction success rate	≥ 60%

Phase 2 — SDLC Intelligence

Metric	Target
Intent-to-deployable-artifact time	Reduced by 60% vs. manual process
Auto-generated test coverage	> 80% on new features
Architecture plan approval rate	> 70% on first generation
VS Code extension install-to-functional	< 2 minutes

Phase 3 — Production Consciousness & Self-Healing

Metric	Target
Error-to-code mapping latency	< 30 seconds
Performance regression detection	Within 5 minutes of deployment
MTTD (mean time to detection)	< 60 seconds
MTTR for auto-healable issues	< 15 minutes
Auto-heal success rate	≥ 85%
False positive rate	< 10%
Deployment confidence score accuracy	> 80% correlation with outcomes

Phase 4 — Predictive Architecture

Metric	Target
Technical debt score accuracy	> 75% developer agreement
Change impact prediction accuracy	> 80% against actual outcomes
Evolution recommendation acceptance rate	> 50%
Team pattern suggestion acceptance rate	≥ 20% improvement over generic suggestions

11. Risk Matrix

Risk	Impact	Probability	Mitigation
Tree-sitter grammar gaps for niche languages	Low	Medium	Fallback to regex-based parsing for unsupported languages. Contribute grammars upstream.
LanceDB performance degrades at scale (>1M vectors)	Medium	Low	Shard by project. Prune stale embeddings. Benchmark at scale during Phase 1.
Observability platform API breaking changes	Medium	Medium	Adapter pattern with version pinning. OpenTelemetry as universal fallback. Integration tests per adapter.
Self-healing generates incorrect patch	Critical	Low	Mandatory staging validation. Test suite pass required. Auto-deploy confidence threshold. Human approval below threshold.
Thundering herd on production connector polling	Medium	Medium	Jittered polling intervals. Request coalescing. Circuit breaker on adapter calls.
Scope creep from platform breadth	High	High	Strict phase gating. Each phase ships as a complete product. No phase starts until previous is production-stable.
SKIA Chat AI rate limiting under heavy Forge load	High	Medium	Request queuing. Priority tiers (real-time completions > background indexing). Provider fallback absorbs spikes.


SKIA Forge — Updated Master Build Plan (Post-Cursor Foundation) · v3.0 · 22 April 2026
Prepared by Dany · Mirabel, QC, Canada · Internal distribution only.
All modules wire through SkiaFullAdapter → SKIA Chat AI. Zero new AI infrastructure. One brain. Six new skills. Sovereign platform.

## 12. Implementation status (repository)

**D1-01 (Phase 1 — Context Engine, structural parsing):** First slice implemented in `src/forge/modules/context-engine/`. JavaScript/JSX uses Tree-sitter (JavaScript grammar); TypeScript/TSX uses the TypeScript compiler API. Exposed as `GET /api/forge/context/structure?path=...` with **Zod** success and error bodies (`forgeContextStructureOkBodySchema`, `forgeContextStructureUnsupportedBodySchema` in `src/contracts.ts`) and **422** for extensions not in v1. Structural `kind` values include e.g. `type` (type aliases) and function-like `const`/class field initializers in addition to classes, methods, and `function` declarations. Remaining D1-01 items (optional C# if Skia-FULL is in v1 scope, 30s/200ms performance gates) and D1-02+ are tracked in `IMPLEMENTATION_PHASES.md` (Build v3 / Phase 1). No duplicate of the existing line-based `chunkFile` indexer until semantic chunking (D1-02) is wired.

### D1-01 freeze (v1) — prerequisite for D1-02

**D1-01 must be frozen before D1-02 begins.** D1-02 (semantic chunking, embeddings, LanceDB, vector search) assumes the **structural contract is slow-moving**. If boundaries, supported languages, or symbol shapes keep shifting, the whole vector layer becomes unstable: chunk definitions, embedding jobs, LanceDB rows, and retrieval wiring churn together — that is **wasted work** (re-chunk, re-embed, re-index, re-store, re-wire).

For **v1**, lock D1-01 explicitly as follows.

1. **Language set** — **TypeScript and JavaScript** for SKIA-Forge in-repo. Include **C#** only if **Skia-FULL** (or another named C# tree) is **officially** in v1 indexing scope. Do not add more grammars “just in case”; expand only when a language is in scope for v1.

2. **API and type shapes** — Freeze structure **response shape**, **symbol kinds**, **line ranges**, **safePath / path-safety rules**, and **error cases**. Public fields and contracts must not keep renaming or drifting once tagged frozen.

3. **Parser completeness for v1** — “Done enough” coverage so the team is not rewriting extractors for the same files every sprint. D1-01 table performance targets (e.g. large-project parse, incremental re-parse) apply to the **frozen** implementation, not as a moving target during the freeze window.

4. **Gate** — D1-02 is **not** scheduled until this checklist is met and **D1-01 is recorded as frozen for v1** in `IMPLEMENTATION_PHASES.md` (or equivalent). After the freeze, semantic chunking (D1-02) can layer on a **stable** substrate without weekly re-embedding driven by D1-01 changes.

**D1-01 (v1) is recorded frozen (2026-04-22)** in `IMPLEMENTATION_PHASES.md` under Build v3 / Phase 1.

**D1-02 — Stage 1 in repository:** `buildSemanticChunksFromStructure` in `src/forge/modules/context-engine/semanticChunking.ts`; `GET /api/forge/context/semantic-chunks?path=...` (optional `embed=1` first-chunk probe via `SkiaFullAdapter.tryEmbedding` to `POST` **`/api/skia/embedding`** on SKIA-FULL). 50-token overlap, class/method boundary rules, and Stage-2+ token-budget splits below.

**D1-02+ embed pipeline (Skia-FULL contract + Forge routes + v1 file store) — one place for operators**

| Item | Value |
|------|--------|
| **Upstream path (default)** | `POST /api/skia/embedding` (override with `SKIA_FULL_EMBEDDING_PATH` on the Forge process). Zod-locked request/response shapes in `src/skiaFullEmbeddingContract.ts` (`input` + duplicate `text`, optional `source` / `model`; response: `embedding` or `vector` or `data.embedding`). `SkiaFullAdapter.tryEmbedding` / `embedTextOrThrow` use this path. |
| **Model hint (optional)** | `SKIA_FULL_EMBED_MODEL` — passed through when the upstream supports a `model` field. |
| **Batch throttle** | `batchEmbedFileAndStore` in `src/forge/modules/context-engine/embeddingBatch.ts` uses a **default 75 ms** minimum delay between embed calls; request body on index may override with `minDelayMs`. |
| **Vector persistence (v1, file-backed)** | `<project root>/.skia/embeddings-v1.json` — `FileEmbeddingVectorStore` in `vectorStoreFile.ts` (D1-04 **LanceDB** remains the planned swap-in; v1 is JSON for portability and no native binding). |
| **Forge API (local)** | `GET /api/forge/context/embed/stats` · `POST /api/forge/context/embed/index` (JSON: `path`, optional `minDelayMs`) · `POST /api/forge/context/embed/search` (JSON: query + optional `k`). |

**D1-02 — Stage 2 (chunk budget):** `MAX_SEMANTIC_TOKENS` (500, matching §4.1’s upper band with the `estimateTokenCount` = ⌈`length`/4⌉ heuristic) — any symbol still over budget after the line/column split is **grouped or split** into multiple chunks named `name (1/N)…(N/N)`. The **50-token overlap** tail from the previous chunk is always **capped** to the overlap token budget (so a single long line cannot inflate overlap to hundreds of tokens).

LanceDB and a job queue for very large codebases (§4.1 D1-03 / D1-04) are **not** required to consider Stage-1+ embed/index/search *wired*; they are the next horizontal scaling slice after v1 file-store correctness.
