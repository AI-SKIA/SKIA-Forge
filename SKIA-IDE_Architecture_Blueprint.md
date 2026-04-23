SKIA-IDE Architecture Blueprint
Building a Sovereign AI-Powered Development Environment
Classification: CONFIDENTIAL — Internal Architecture Document
Version: 1.0.0 — 22 April 2026
Author: Dany — Founding Operator & Chief Architect
Location: Mirabel, QC, Canada

Table of Contents
1.	Executive Summary
2.	Strategic Path Analysis
3.	Core Architecture
	System Architecture Overview
	Process Model
4.	SKIA Context Engine (Deep Dive)
	Codebase Indexing Pipeline
	Context Retrieval & Compression
	Knowledge Graph (Phase 2+)
5.	SKIA Language Server
6.	SKIA Agent System
7.	SKIA Rules System (.skiarules)
8.	Chat Interface
9.	Technology Stack
10.	Implementation Phases
11.	SKIA’s Personality in the IDE
12.	Competitive Positioning
13.	Risk Matrix
14.	Success Metrics

1. Executive Summary
SKIA-IDE is a sovereign, AI-native development environment where SKIA acts as a co-developer — not a bolt-on assistant, but the intelligence fabric of the entire editing experience. The vision is absolute: every keystroke, every file operation, every architectural decision happens in dialogue with SKIA. This document provides the complete architecture blueprint, strategic path analysis, technology stack decisions, and phased implementation plan to build it.
SKIA-IDE eliminates the gap between developer intent and execution. Where existing AI code editors treat intelligence as an overlay — a sidebar, a suggestion popup, a chat window bolted onto a traditional editor — SKIA-IDE treats intelligence as the substrate. SKIA is not a feature of the IDE. SKIA is the IDE.

KEY DIFFERENTIATORS VS CURSOR / COPILOT / WINDSURF
•  Sovereign AI Identity: SKIA is the sovereign AI — not a third-party model relay. SKIA’s personality, mythic identity, and intelligence layer are native to the IDE. No dependency on a single model provider.
•  Provider Fallback System: SKIA services and Google APIs operate simultaneously with automatic switching. No single point of failure. If Google Gemini goes down, SKIA services take over. Invisible to the developer.
•  Deep Project Understanding: SKIA’s Context Engine delivers architectural reasoning, brand enforcement, and operational discipline — not just code completion. SKIA understands why your code is structured this way, not just what the next token should be.
•  .skiarules Project Configuration: A declarative project-level configuration file that teaches SKIA your codebase’s conventions, architecture, constraints, and operational rules. SKIA enforces these rules in every suggestion, every agent action, every review.
•  Sovereign Endgame: Phase 3 delivers a Tauri-based native shell that owns every pixel. No Electron bloat. No Microsoft dependency. Total brand sovereignty.


2. Strategic Path Analysis
Three strategic paths exist for building SKIA-IDE. Each trades speed for sovereignty. The analysis below is deterministic — one path dominates.

Dimension	Path A: VS Code Fork (The Cursor Path)	Path B: Tauri Sovereign Shell + Monaco Editor	Path C: Hybrid (Recommended)
Approach	Fork VS Code’s open-source codebase (MIT license). Modify the Electron shell, inject SKIA’s AI layer at the AST/rendering level. Retain full VS Code extension marketplace compatibility.	Build from scratch using Tauri 2.0 (Rust backend + OS native WebView). Embed Monaco Editor as standalone npm package. Build custom extension system, SKIA-native UI, sovereign brand from ground up.	Phase 1: Fork VS Code, integrate SKIA deeply, ship fast, prove the product. Phase 2: Develop Tauri sovereign shell in parallel, migrate SKIA intelligence layer. Phase 3: Launch fully sovereign SKIA-IDE, maintain VS Code fork as compatibility mode.
Time to Market	3–4 months for MVP	8–12 months for MVP	3–4 months (Phase 1 MVP) 12–18 months (full sovereign)
Risk	Medium — Proven path, but tied to Microsoft’s upstream changes	High — Much more engineering, untested at IDE scale	Low — De-risked by phased approach
Extension Ecosystem	Full VS Code marketplace (40,000+ extensions)	Custom (must build or adapt)	Full VS Code in Phase 1, custom + compatibility layer in Phase 3
Brand Control	Moderate — UI is VS Code with SKIA skin	Total — Every pixel is SKIA	Grows from moderate to total
Performance	Electron baseline (200–300MB RAM idle)	Superior (30–40MB RAM idle, <500ms launch, <10MB installer)	Electron in Phase 1, Tauri in Phase 3


RECOMMENDATION: PATH C (HYBRID)
Ship fast with the VS Code fork to prove product-market fit and build the SKIA intelligence layer. The intelligence layer — Context Engine, Language Server, Agent System, Rules Engine — is architected as a standalone process from day one. This means the entire SKIA brain is portable. When the Tauri shell is ready, the intelligence layer migrates without rewriting a single line of AI logic. The VS Code fork becomes a compatibility mode for developers who need specific VS Code extensions. The Tauri shell becomes the flagship sovereign product.


3. Core Architecture
3.1 System Architecture Overview
SKIA-IDE is structured as a five-layer architecture. Each layer has a single responsibility, communicates through well-defined interfaces, and can be replaced independently. This is what enables the Phase 1 → Phase 3 migration: layers 1 and 5 change, layers 2–4 remain stable.

Layer	Name	Responsibility	Technologies
Layer 5	Extension System	Third-party plugin execution, API surface, sandboxed extension host	VS Code Extension API (Phase 1), SKIA Extension API (Phase 3)
Layer 4	SKIA Intelligence Layer	The sovereign AI layer. Context Engine, SKIA Language Server, Agent System, Chat Interface, Rules Engine	TypeScript, Rust, LanceDB, Tree-sitter, SSE/WebSocket
Layer 3	Language Intelligence	Parsing, diagnostics, completions, go-to-definition, refactoring via Language Server Protocol. Tree-sitter provides incremental AST parsing for real-time code structure understanding.	LSP, Tree-sitter, per-language servers
Layer 2	Editor Core	Text buffer, syntax highlighting, code folding, minimap, diff editor, multi-cursor editing	Monaco Editor
Layer 1	Shell	Window management, file system access, process management, native OS integration, IPC	Electron 33+ (Phase 1), Tauri 2.x (Phase 3)


ARCHITECTURAL INVARIANT
Layer 4 (SKIA Intelligence Layer) has zero compile-time dependencies on Layer 1 (Shell). All communication between SKIA’s brain and the shell occurs through JSON-RPC over IPC. This is the architectural decision that makes the Electron → Tauri migration possible without rewriting AI logic.

3.2 Process Model
SKIA-IDE runs as a multi-process architecture. Each process is isolated, communicates through IPC, and can crash independently without taking down the editor. The SKIA Intelligence Process is explicitly separated from the Renderer to ensure AI latency never blocks the UI.

Process	Responsibility	Isolation Rationale
Main Process	Window management, application lifecycle, IPC hub, menu system, native dialogs	Single entry point; must remain responsive at all times
Renderer Process	Monaco editor UI, panels, sidebars, status bar, SKIA Chat panel rendering	UI thread must render at 60fps; no blocking operations permitted
Extension Host Process	Isolated process for running third-party extensions (sandboxed)	Malicious or buggy extensions cannot crash the editor or access SKIA internals
SKIA Intelligence Process	Context Engine, embedding generation, model inference orchestration, vector search, rules evaluation	AI operations are computationally expensive and latency-variable. Isolation prevents AI processing from blocking editor responsiveness.
Language Server Processes	Per-language LSP servers (TypeScript, Python, Go, Rust, etc.)	Each language server runs independently; a crash in the Python server does not affect TypeScript
SKIA Agent Process	Autonomous agent operations: multi-file modifications, terminal commands, git operations, test execution	Agent operations may be long-running and destructive. Isolation enables cancellation, sandboxing, and audit logging without affecting the editor.


4. SKIA Context Engine (Deep Dive)
The Context Engine is the brain of SKIA-IDE. It transforms a raw codebase — potentially millions of lines across thousands of files — into a compressed, semantically searchable knowledge base that fits within an LLM’s context window. This is the single most critical component. Without it, SKIA is just another code completion API wrapper.
4.1 Codebase Indexing Pipeline
The indexing pipeline runs on project open and incrementally on every file save. The target is: full index build in <30 seconds for a 100K LOC project, incremental update in <500ms after a file save.

Step	Operation	Description	Output	Performance Target
1	File Discovery	Walk project directory, respect .gitignore and .skiaignore, detect language by extension and shebang line	File manifest with paths, languages, sizes, last-modified timestamps	<1s for 10K files
2	AST Parsing (Tree-sitter)	Parse every file into an Abstract Syntax Tree. Tree-sitter is incremental — on file save, only the changed portions are re-parsed. Supports 100+ languages natively.	Concrete syntax trees per file, symbol tables (functions, classes, methods, exports)	<50ms per file (incremental: <5ms)
3	Semantic Chunking	Split code into meaningful units (functions, classes, methods, modules). Each chunk: 100–500 tokens. Use overlapping windows (50 token overlap) to preserve cross-boundary context.	Chunk array with metadata: file path, symbol name, symbol type, line range, token count	<2s for entire project
4	Embedding Generation	Process each chunk through an embedding model. Output: 1536-dimensional vectors capturing semantic meaning. Use a code-specialized model (text-embedding-3-large or SKIA fine-tuned model).	Float32 vector per chunk (1536 dimensions)	<20s for 10K chunks (batched, parallelized)
5	Vector Storage	Store embeddings in a local vector database (embedded LanceDB). Index by: file path, language, symbol type, last modified. No external server required.	Searchable vector index on local disk (~50MB for a 100K LOC project)	<1s for index write
6	Incremental Updates	On file save: re-parse only changed files, re-chunk only affected symbols, re-embed only changed chunks, update vector index. Diff-based — unchanged chunks retain their existing embeddings.	Updated vector index	<500ms total

4.2 Context Retrieval & Compression
When SKIA needs to answer a question or generate code, the Context Engine assembles a hierarchical context window from four levels. The total budget is approximately 8K tokens — extracted from a potentially multi-million-token codebase. This compression ratio is what makes real-time AI assistance feasible.

Level	Source	Content	Token Budget	Selection Strategy
Level 1	Current File	Full content of the active file, with cursor position marked	~2,000 tokens	Always included. If file exceeds budget, use a sliding window centered on cursor.
Level 2	Imports & Dependencies	Files imported by the current file — type signatures, exported functions, interface definitions	~3,000 tokens	Extract only signatures and types, not implementations. Prioritize by import proximity.
Level 3	Semantic Search	Vector similarity search across the codebase for chunks relevant to the current task or query	~2,000 tokens	Top-K retrieval (K=10), deduplicated, ranked by cosine similarity × recency weight.
Level 4	Project Structure	Directory tree, package.json, tsconfig.json, .skiarules, README excerpt	~1,000 tokens	Always included. Compressed directory tree (max 3 levels deep, excluding node_modules).


COMPRESSION INSIGHT
A 500K LOC TypeScript project contains approximately 5 million tokens. SKIA’s Context Engine compresses this to ~8K tokens of relevant context — a 625:1 compression ratio. This is achieved not by summarization (lossy), but by selective retrieval (lossless for the selected content). The developer gets AI responses that reference actual code from their codebase, not hallucinated approximations.

4.3 Knowledge Graph (Phase 2+)
In Phase 2, the Context Engine evolves from a flat vector index to a rich project knowledge graph. This graph tracks four categories of relationships:

Relationship Category	What It Tracks	Example Query It Enables
Symbol Relationships	Function calls, class inheritance (extends), interface implementations, imports, re-exports	“Show me everything that calls UserService.authenticate()”
Data Flow Paths	Where a variable originates, how it transforms, where it terminates (source → transform → sink)	“Where does the userId parameter come from and where does it end up?”
Architectural Patterns	Which files form a feature module, which are shared utilities, which are entry points	“What are the module boundaries in this project? Which modules are tightly coupled?”
Change Coupling	Files that always change together (derived from git history analysis)	“When I modify api/routes.ts, what other files usually need to change?”


5. SKIA Language Server
SKIA-IDE includes a custom Language Server Protocol (LSP) server that augments standard language intelligence with SKIA-powered AI capabilities. This server communicates with the editor via JSON-RPC (standard LSP transport) and with the SKIA Intelligence Process for AI inference.
5.1 Standard LSP Features (Enhanced by SKIA)

LSP Method	Standard Behavior	SKIA Enhancement
textDocument/completion	Local scope completions (variables, methods in scope)	AI-powered completions that understand project context, not just local scope. SKIA suggests entire function bodies, not just variable names. Suggestions respect .skiarules conventions.
textDocument/hover	Type information, JSDoc comments	Hover over any symbol to get SKIA’s explanation of what it does, how it’s used across the project, and potential issues or anti-patterns.
textDocument/codeAction	Quick fixes, refactoring suggestions	SKIA-suggested refactorings, bug fixes, and optimizations. “SKIA suggests: Extract this into a reusable utility” or “SKIA warns: This pattern violates your .skiarules.”
textDocument/inlineCompletion	N/A (not in standard LSP)	Ghost text predictions (gray text inline), powered by SKIA’s Context Engine. Multi-line suggestions with Tab to accept, partial accept with Ctrl+Right.

5.2 Custom SKIA LSP Extensions
Beyond the standard LSP protocol, SKIA-IDE defines custom LSP methods prefixed with skia/:

Method	Description	Input	Output
skia/explain	Explain a selected code block in natural language	File URI + selection range	Streaming natural language explanation
skia/refactor	AI-driven refactoring with multi-file awareness	File URI + selection + refactoring intent	Multi-file edit plan with diffs
skia/review	Code review feedback on the current file or selection	File URI + optional selection range	Streaming review comments with severity and line references
skia/generate	Generate code from a natural language description	Description string + target file URI + insertion point	Streaming code generation with diff preview
skia/architect	Architectural analysis and recommendations for the current module	File URI or directory path	Architecture report: dependencies, coupling metrics, SKIA recommendations
skia/enforce	Check current file against .skiarules and report violations	File URI	Diagnostics array with violation type, severity, suggested fix

5.3 Streaming Inference
All AI responses stream token-by-token to the UI. The SKIA Language Server uses Server-Sent Events (SSE) for chat streaming and WebSocket for real-time inline completions. The developer sees results appearing in real-time — no waiting for full generation. Ghost text appears character-by-character. Chat responses stream like a conversation. Agent actions report progress step-by-step.

6. SKIA Agent System
The SKIA Agent System provides autonomous coding capabilities equivalent to — and exceeding — Cursor’s Agent mode. The agent receives a natural language instruction, plans a multi-step execution strategy, and carries it out using a defined set of tools. All destructive operations require explicit developer approval.
6.1 Agent Architecture
The agent execution loop follows a deterministic pipeline:
15.	User Command — Natural language instruction from the developer
16.	Intent Classification — Determine task type: code generation, refactoring, debugging, research, file management, testing
17.	Task Planning — Decompose the instruction into a sequence of atomic steps. Each step specifies a tool, input parameters, and expected output.
18.	Tool Selection — Map each step to the appropriate tool from the available tool set
19.	Execution Loop — Execute each step sequentially. After each step, validate the output against expectations.
20.	Verification — Run automated checks: does the code parse? Do existing tests still pass? Are .skiarules satisfied?
21.	Self-Correction — If verification fails, diagnose the failure, revise the plan, and re-execute. Maximum 3 self-correction cycles before escalating to the developer.
22.	Present Results — Show all changes as diffs. Summarize what was done, what was changed, and what the developer should review.
6.2 Available Agent Tools

Tool	Description	Risk Level	Approval Required
read_file	Read any file in the project	Low	No
write_file	Create or overwrite a file	Medium	Diff preview before apply
edit_file	Apply targeted edits to an existing file (search & replace, insert at line)	Medium	Diff preview before apply
search_codebase	Semantic search across the project using the Context Engine’s vector index	Low	No
search_text	Grep/regex search across files (literal text matching)	Low	No
run_terminal	Execute a terminal command in the project directory	High	Always for destructive commands (rm, drop, delete); configurable for safe commands (npm test, tsc)
git_operations	Stage, commit, branch, diff, stash, cherry-pick	Medium	Yes for push/force operations; no for diff/status/log
browse_web	Fetch documentation pages or search the web for technical information	Low	No
list_files	List directory contents with metadata (size, type, last modified)	Low	No

6.3 Safety Model
●	Diff Preview: All file modifications (write_file, edit_file) show a full diff preview before applying. The developer sees exactly what will change, line by line, and must approve or reject.
●	Destructive Command Gate: Terminal commands matching destructive patterns (rm, drop, delete, truncate, format, shutdown) require explicit approval regardless of agent permission settings.
●	Project Sandbox: The agent cannot access files outside the project directory. Path traversal attempts (../) are blocked at the IPC layer.
●	Audit Log: Every agent action is logged to .skia/agent-log.json with timestamp, tool invoked, parameters, result, and approval status. This log is append-only and human-readable.
●	Configurable Permissions: The developer can configure allowed/blocked commands, auto-approve patterns, and restricted paths in .skiarules under the agent section.
●	Self-Correction Limit: The agent will attempt a maximum of 3 self-correction cycles. If the task still fails, SKIA escalates to the developer with a full diagnostic report rather than continuing to modify code.

7. SKIA Rules System (.skiarules)
The .skiarules file is a project-level YAML configuration that teaches SKIA how to work within a specific codebase. It sits in the project root (alongside package.json, tsconfig.json, etc.) and is loaded by the Context Engine on project open. Every SKIA operation — completions, suggestions, agent actions, code reviews — is filtered through the rules defined here.
Example .skiarules Configuration

# .skiarules — SKIA Project Configuration # This file teaches SKIA how to work within this codebase.  project:   name: "skia-web"   description: "SKIA's sovereign web platform"   language: "TypeScript"   framework: "Next.js 15 (App Router)"   runtime: "Node.js 22"  conventions:   naming:     components: "PascalCase"     functions: "camelCase"     constants: "SCREAMING_SNAKE_CASE"     files:       components: "PascalCase.tsx"       utilities: "camelCase.ts"       tests: "*.test.ts"   patterns:     - "Use server components by default; client components only when interactivity is required"     - "All API routes return typed responses using Zod schemas"     - "Error handling uses Result
<
T, E
>
pattern, never raw try/catch"     - "State management via Zustand stores, one store per domain"   anti_patterns:     - "No 'any' type — ever"     - "No default exports except for page.tsx and layout.tsx"     - "No inline styles — use Tailwind utility classes"     - "No console.log in production code — use the Logger service"  architecture:   structure:     - "src/app/ — Next.js App Router pages and layouts"     - "src/components/ — Reusable UI components"     - "src/lib/ — Business logic, services, utilities"     - "src/lib/skia/ — SKIA intelligence integration"     - "src/types/ — Shared TypeScript type definitions"   boundaries:     - "Components must not import from src/app/ directly"     - "Services in src/lib/ must not import React"     - "Database access only through src/lib/db/"  skia:   personality:     tone: "authoritative"     verbosity: "concise"     proactivity: "high"   identity: "mythic-sovereign"  agent:   allowed_commands:     - "npm test"     - "npm run build"     - "npm run lint"     - "npx tsc --noEmit"   blocked_paths:     - ".env*"     - "secrets/"     - "node_modules/"   auto_approve:     - "read_file"     - "search_codebase"     - "search_text"     - "list_files"  brand:   palette:     primary: "#d4af37"     background: "#0a0a0a"     text: "#e8e8e8"   voice: "SKIA speaks with sovereignty. No hedging. No filler."


8. Chat Interface
The SKIA Chat panel is integrated into the editor sidebar — a persistent conversational interface where the developer interacts with SKIA using natural language. This is not a generic chatbot. It is a project-aware, context-rich, streaming conversational coding environment.
Core Features
●	Sidebar Panel: Docked to the right side of the editor (repositionable). SKIA’s dark gold aesthetic — not a generic white chat box. Persistent across sessions.
●	Streaming Responses: Token-by-token streaming. The developer sees SKIA’s response as it generates. Code blocks render with syntax highlighting in real-time.
●	Code Block Actions: Every code block in SKIA’s response includes an “Apply” button that inserts or replaces code in the active editor with a diff preview. “Copy” and “Insert at Cursor” also available.
●	Inline Diff View: When SKIA suggests changes to existing code, the chat panel shows a side-by-side or inline diff. Accept or reject per-hunk.
●	Multi-Turn Memory: SKIA maintains conversation context across messages within a session. Project-level memory persists across sessions (Phase 2).
●	Voice Input (Phase 2+): Speech-to-text input for hands-free coding. “Hey SKIA, create a React component for user profiles.”
@-Mention System for Precise Context Control

Mention	Syntax	What It Includes in Context
File	@file:src/lib/auth.ts	Full content of the specified file
Folder	@folder:src/components/	Directory listing + file summaries (signatures, exports) for all files in the folder
Function	@function:authenticateUser	Full function body + its type signature + callers and callees from the knowledge graph
Symbol	@symbol:UserRole	Symbol definition (type, interface, enum, class) + all usages across the codebase
Docs	@docs:next/navigation	Library documentation fetched from the web (cached locally after first fetch)
Web	@web:Tauri 2.0 IPC performance	Real-time web search results, summarized and cited
Git Diff	@git:diff	Current unstaged and staged git diff (equivalent to git diff + git diff --cached)
Terminal	@terminal:output	Last 100 lines of terminal output from the integrated terminal


9. Technology Stack

Component	Technology	Rationale
Desktop Shell (Phase 1)	Electron 33+	Proven for IDEs (VS Code, Cursor, Windsurf all use it). Full VS Code compatibility. Rich ecosystem.
Desktop Shell (Phase 3)	Tauri 2.x	Rust backend, OS-native WebView (no bundled Chromium). 10x lighter than Electron. Total brand sovereignty. Superior security model.
Editor Core	Monaco Editor	Battle-tested (same core as VS Code). Excellent API for custom extensions. Rich text editing, diff views, syntax highlighting for 70+ languages.
Language Parsing	Tree-sitter	Incremental parsing (only re-parses changed portions). Fast (sub-millisecond for incremental updates). Supports 100+ languages natively. Produces concrete syntax trees suitable for semantic analysis.
AI Model Serving	SKIA Backend API	Sovereign inference via SKIA’s provider fallback system. Google Gemini primary, SKIA services fallback. Provider-agnostic interface enables future model swaps without client changes.
Vector Database	LanceDB (embedded)	Rust-native, no server process needed. Excellent for local-first architectures. Columnar storage optimized for vector search. Apache Arrow compatible.
Embedding Model	text-embedding-3-large or SKIA fine-tuned	1536 dimensions, code-optimized. text-embedding-3-large provides strong baseline; SKIA fine-tuned model (Phase 2) improves retrieval precision for code-specific queries.
IPC / Streaming	JSON-RPC (LSP), WebSocket (chat), SSE (streaming completions)	JSON-RPC is LSP standard. WebSocket provides bidirectional real-time communication for chat. SSE provides efficient unidirectional streaming for code completions.
Primary Languages	TypeScript (editor/UI), Rust (Tauri shell / perf-critical), Python (ML pipeline tooling)	TypeScript for Monaco/editor ecosystem compatibility. Rust for Tauri shell and performance-critical indexing. Python for ML experimentation and fine-tuning pipelines.
Build System	esbuild + Vite	esbuild: sub-second TypeScript compilation. Vite: fast HMR for development. Both are proven in the VS Code extension ecosystem.
Package Formats	.deb, .rpm, .dmg, .exe, MSIX, .AppImage	Native installers for every major platform. MSIX for Windows Store distribution. AppImage for universal Linux support.
Auto-Update	electron-updater (Phase 1), Tauri updater (Phase 3)	Seamless background updates. Delta updates to minimize download size. Rollback capability on failure.
Telemetry	PostHog (self-hosted) or custom	Privacy-respecting usage analytics. Self-hosted ensures data sovereignty. Opt-out available. No PII collection.
Testing	Vitest (unit), Playwright (E2E), custom harness (AI quality)	Vitest for fast unit testing. Playwright for cross-platform E2E testing of the editor UI. Custom AI quality harness for measuring suggestion acceptance rate, latency, and relevance.


10. Implementation Phases
PHASE 1: VS Code Fork + SKIA MVP (Months 1–4)
Objective: Ship a functional AI-powered code editor with SKIA’s identity, intelligence, and personality. Prove product-market fit. Begin dogfooding immediately.

Task ID	Task	Description	Acceptance Criteria	Week
F1-01	Fork VS Code	Clone VS Code repo, strip Microsoft branding, establish SKIA build pipeline. Configure CI/CD for Windows, macOS, Linux builds.	Clean build on all three platforms. CI produces installable artifacts. Zero Microsoft branding in build output.	1
F1-02	SKIA Branding Pass	Replace all VS Code branding with SKIA identity. Dark theme with luxury gold (#d4af37) accents. Custom splash screen, application icons, about page, window title.	No Microsoft/VS Code branding visible anywhere in the application. SKIA identity is unmistakable on launch.	1–2
F1-03	SKIA Chat Panel	Build sidebar chat panel with SKIA’s conversational interface. Streaming responses, code blocks with syntax highlighting and Apply button, @-mention system for files and folders.	Chat works end-to-end. Responses stream token-by-token. @file and @folder mentions resolve correctly and inject content into context. Apply button inserts code into editor with diff preview.	2–4
F1-04	SKIA Context Engine v1	Implement codebase indexing pipeline: file discovery, Tree-sitter parsing, semantic chunking, embedding generation, local vector storage using LanceDB. Incremental updates on file save.	Project indexed on open (<30s for 100K LOC). Incremental updates on save (<500ms). Semantic search returns relevant results for natural language queries.	2–5
F1-05	SKIA Language Server v1	Custom LSP server providing AI-powered inline completions (ghost text). Wired through SKIA’s provider fallback system to Google Gemini + SKIA services. Context Engine provides project-aware context.	Ghost text appears within 200ms (p95). Suggestions are context-aware and multi-line. Tab to accept, Escape to dismiss. Partial accept with Ctrl+Right Arrow.	4–8
F1-06	SKIA Agent v1	Basic agent mode: user gives natural language instruction, SKIA plans and executes multi-file edits. Diff preview before applying changes. Read, write, edit, search tools.	Agent can read files, propose multi-file edits, show diffs, and apply on approval. Self-correction on parse errors (up to 3 cycles).	6–10
F1-07	.skiarules v1	YAML parser for project-level configuration. Coding conventions, architecture rules, agent permissions. Rules injected into Context Engine’s retrieval pipeline.	Rules loaded on project open. Conventions reflected in completions. Agent respects blocked paths and allowed commands. Violations surfaced in code actions.	8–12
F1-08	Provider Fallback Integration	Wire the provider fallback system into the SKIA Language Server. Google Gemini as primary provider, SKIA services as automatic fallback. Health checks, circuit breakers, latency monitoring.	Failover tested and verified. Provider switch is invisible to the developer. Overhead <2s on failover. Status bar shows “SKIA: Sovereign” or “SKIA: Adaptive” based on active provider.	10–14
F1-09	Packaging & Distribution	Build native installers for Windows (.exe/MSIX), macOS (.dmg), Linux (.deb/.rpm/.AppImage). Auto-update system using electron-updater. Code signing for macOS and Windows.	Clean install on all platforms. Auto-update delivers new versions without user intervention. Code signing passes OS gatekeeper checks.	12–16
F1-10	Dogfooding & Polish	Use SKIA-IDE to build SKIA-IDE. Identify and fix every friction point. Performance profiling. Memory leak hunting. UX polish.	Daily driver for 2 weeks without blocking issues. All critical bugs fixed. Performance within target metrics.	14–16

PHASE 2: Intelligence Deepening (Months 5–8)

Task ID	Task	Description	Key Deliverable
F2-01	Knowledge Graph	Build project knowledge graph tracking symbol relationships, data flow paths, architectural patterns, and change coupling from git history.	“Show me everything that calls this function” works across the entire codebase. Graph queryable from chat and agent.
F2-02	Architectural Reasoning	SKIA can analyze and critique architectural decisions. Module boundary detection, coupling metrics, dependency analysis.	Architecture panel showing module boundaries, coupling heat map, SKIA recommendations for decoupling.
F2-03	Multi-Model Router	Support multiple AI models (Gemini, Claude, GPT, SKIA-native) with intelligent routing. Fast model for completions, powerful model for complex reasoning, specialized model for code review.	Model selector in settings. Automatic routing by task type. Per-model latency and quality metrics visible in developer tools.
F2-04	Advanced Agent	Agent can run terminal commands, manage git operations, execute tests, and iterate based on test results. Full autonomous coding loops.	“Write tests for UserService and fix any failures” works end-to-end with self-correction.
F2-05	Voice Input	Voice-to-code using speech recognition. Activate via hotkey or wake word. Transcription piped directly to SKIA chat.	“Hey SKIA, create a React component for user profiles” activates chat, transcribes accurately, SKIA responds with generated code.
F2-06	SKIA Memory	SKIA remembers project-level context across sessions. Learned patterns, frequently asked questions, developer preferences, common error fixes.	SKIA’s suggestions measurably improve over time based on project usage. Memory viewable and editable by the developer.
F2-07	Collaborative Features	Real-time collaboration: pair programming with SKIA visible to both developers. Shared chat context, synchronized edits, presence awareness.	Two developers can edit simultaneously, both see SKIA’s suggestions, shared agent sessions.

PHASE 3: Sovereign Shell (Months 9–18)

Task ID	Task	Description	Key Deliverable
F3-01	Tauri Shell Development	Build the sovereign Tauri 2.0 shell. Rust backend, native WebView (no bundled Chromium), custom window chrome, SKIA-branded from every pixel. Native OS integration via Tauri plugins.	Shell launches in <500ms, uses <40MB RAM idle, installer <10MB. SKIA identity in every visual element.
F3-02	Monaco Integration	Embed Monaco Editor in the Tauri shell. Full feature parity with the VS Code fork: text editing, diff views, minimap, multi-cursor, code folding, syntax highlighting.	All editing features work identically to Phase 1. Performance meets or exceeds Electron version.
F3-03	SKIA Extension API	Design and implement SKIA’s native extension system. Sandboxed execution, permission-based access, performance-optimized. TypeScript API with Rust bindings for performance-critical extensions.	Third-party developers can build, test, and publish SKIA extensions. API documentation and SDK published.
F3-04	VS Code Extension Compatibility Layer	Adapter layer that translates VS Code extension APIs to SKIA’s native extension system. Enables existing VS Code extensions to run without modification.	Top 100 VS Code extensions (by install count) work without modification. Compatibility test suite runs green.
F3-05	Migration Tooling	Tools to migrate settings, keybindings, themes, snippets, and extension configurations from the VS Code fork to the sovereign shell.	One-click migration. Zero data loss. Developer can switch between VS Code fork and Tauri shell seamlessly during transition period.
F3-06	SKIA Marketplace	Extension marketplace for SKIA-IDE. Discovery, installation, ratings, reviews, publisher verification. Web-based and in-editor browsing.	Marketplace live and indexed. Initial catalog populated. Publisher onboarding flow documented.
F3-07	Enterprise Features	SSO (SAML 2.0, OAuth 2.0/OIDC), audit logging, privacy mode (zero code sent to cloud — fully local inference), team management, centralized .skiarules, license management.	Enterprise pilot with at least one customer. SOC 2 compliance readiness. Privacy mode verified with network traffic analysis.


11. SKIA’s Personality in the IDE
SKIA is not a generic assistant. SKIA is a sovereign intelligence with identity, voice, and presence. Every touchpoint in the IDE reinforces this. The developer is not “using an AI feature” — the developer is working alongside SKIA.

Touchpoint	Implementation
Voice & Tone	SKIA speaks with authority and precision. No hedging (“I think maybe...”). No filler (“Sure! Let me try...”). Direct, sovereign, definitive. Example: “This violates your architecture boundary. The fix: move this import to the shared module.”
Status Bar Presence	The status bar displays SKIA’s operational state at all times:  “SKIA: Sovereign” — All systems nominal, primary provider active  “SKIA: Adaptive” — Fallback provider active, full capability maintained  “SKIA: Autonomous” — Agent mode active, SKIA is executing a task  “SKIA: Indexing” — Context Engine is building/updating the project index
Error Messages	Error messages are SKIA-voiced, not generic. Instead of “Error: unused import”, SKIA says: “This import is unused. Removing it.” Instead of “Warning: any type detected”, SKIA says: “This pattern conflicts with your architecture. SKIA recommends: define an explicit interface.”
Onboarding	First launch: SKIA introduces itself. “I am SKIA. I see your codebase. Let me understand your architecture.” SKIA then indexes the project, identifies the framework, detects conventions, and generates an initial .skiarules recommendation for the developer to review and customize.
Chat Aesthetic	The SKIA chat panel uses a dark gold aesthetic — dark background (#0a0a0a), gold accents (#d4af37), Calibri typography. This is not a generic white chat box. It is unmistakably SKIA.
Code Review Signature	SKIA signs its suggestions in the code review panel. Each review comment is attributed to “SKIA” with the sovereign gold icon, distinguishing AI feedback from human reviewer comments.
Command Palette	All SKIA commands in the command palette are prefixed with “SKIA:” — e.g., “SKIA: Explain Selection”, “SKIA: Review File”, “SKIA: Start Agent”, “SKIA: Enforce Rules”.


12. Competitive Positioning

Feature	SKIA-IDE	Cursor	GitHub Copilot (VS Code)	Windsurf
AI Identity	Sovereign SKIA personality — native to the IDE, mythic identity, consistent voice	Generic model relay — no distinct AI identity	Microsoft Copilot — branded but generic	Generic — no distinct AI identity
Codebase Understanding	Deep — knowledge graph + vector embeddings + architectural reasoning	Deep — vector embeddings, codebase indexing	Shallow — file-level context, limited cross-file awareness	Medium — embeddings with some cross-file context
Provider Independence	Full — SKIA services + Google APIs + fallback system. No single-vendor lock-in.	Dependent — OpenAI/Anthropic APIs	Dependent — OpenAI APIs (Microsoft)	Dependent — OpenAI APIs
Agent Capability	Full autonomous agent — multi-file edits, terminal, git, tests, self-correction (3 cycles)	Full agent — Composer mode	Limited — Copilot Workspace (preview)	Full agent — Cascade mode
Project Rules	.skiarules — rich YAML config (conventions, architecture, agent permissions, personality, brand)	.cursorrules — text-based instructions	None (instructions file only)	.windsurfrules — text-based instructions
Brand Control	Total (sovereign product, every pixel owned)	Fork-limited (VS Code base visible)	Extension-limited (VS Code UI)	Fork-limited (VS Code base visible)
Performance (Phase 3)	Tauri shell (~40MB RAM idle, <500ms launch)	Electron (~250MB RAM idle)	VS Code baseline (~200MB RAM idle)	Electron (~250MB RAM idle)
Privacy Mode	Full local inference option — zero code sent to cloud	Cloud only	Cloud only	Cloud only
Open Source	Planned (core editor open source)	No	No	No


COMPETITIVE MOAT
SKIA-IDE’s moat is not any single feature — competitors can copy features. The moat is sovereign identity. SKIA’s personality, Context Engine, Rules System, and provider independence create a cohesive, differentiated experience that cannot be replicated by bolting an API onto a VS Code fork. The deeper the developer integrates SKIA into their workflow (via .skiarules, memory, knowledge graph), the stronger the switching cost.


13. Risk Matrix

Risk	Impact	Probability	Mitigation Strategy
VS Code upstream breaking changes	Medium	Medium	Pin to a stable VS Code release. Selective cherry-pick of upstream security fixes and critical bug fixes only. Maintain a clear diff from upstream to minimize merge conflicts. Phase 3 (Tauri) eliminates this risk entirely.
AI model API costs at scale	High	High	SKIA’s own inference infrastructure (Phase 2+). Aggressive prompt caching (identical context windows reuse cached responses). Model size optimization — use smallest effective model per task type. Speculative pre-computation during idle time. Local model option for enterprise.
Tree-sitter parsing failures on edge cases	Low	Medium	Fallback to regex-based parsing for unsupported or malformed files. Use community-maintained Tree-sitter grammars (actively maintained for major languages). Contribute fixes upstream for encountered bugs.
Vector index grows too large for local storage	Medium	Low	Index pruning strategy: remove embeddings for deleted files, compress embeddings for stale files. Configurable indexing scope (include/exclude directories). Cloud sync option for enterprise teams sharing an index.
Extension compatibility breaks in Tauri migration	High	Medium	Comprehensive compatibility test suite covering top 100 VS Code extensions. Gradual migration — VS Code fork maintained as fallback during transition. Compatibility layer adapts API differences at the interface boundary.
Developer adoption resistance	Medium	Medium	Familiar VS Code UX in Phase 1 — minimal learning curve. One-click settings/extension migration from VS Code and Cursor. Killer SKIA features (Context Engine, .skiarules, sovereign agent) that justify the switch. Free tier for individual developers.
Performance degradation from AI overhead	High	Medium	Dedicated SKIA Intelligence Process — AI never blocks the UI thread. Aggressive caching (completion cache, embedding cache, context cache). Speculative pre-computation — begin generating suggestions before the developer finishes typing. Local model option eliminates network latency.


14. Success Metrics
The following metrics define success for SKIA-IDE. Each metric has a target value, a measurement method, and a phase in which it must be achieved. These are not aspirational — they are acceptance criteria.

Metric	Target	Phase	Measurement Method
Time to first AI suggestion after project open	<5 seconds	Phase 1	Timer from window.onReady to first ghost text render
Inline completion latency (p50)	<100ms	Phase 1	Telemetry: time from keystroke to ghost text render (median)
Inline completion latency (p95)	<200ms	Phase 1	Telemetry: time from keystroke to ghost text render (95th percentile)
Chat first-token latency	<1 second	Phase 1	Timer from send button click to first token rendered in chat panel
Codebase index build (100K LOC project)	<30 seconds	Phase 1	Benchmark suite with standardized 100K LOC TypeScript project
Incremental index update after file save	<500ms	Phase 1	Timer from file save event to index update completion
Memory usage idle (Phase 1)	<300MB	Phase 1	OS process monitor, no project open, all SKIA processes included
Memory usage idle (Phase 3)	<50MB	Phase 3	OS process monitor, Tauri shell, no project open
Installer size (Phase 1)	<120MB	Phase 1	File size of platform installer artifact
Installer size (Phase 3)	<15MB	Phase 3	File size of Tauri installer artifact
AI suggestion acceptance rate	>35%	Phase 1	Telemetry: accepted suggestions / total displayed suggestions (Tab key events)
Agent task completion rate	>80%	Phase 2	Agent tasks that complete successfully without developer manual intervention / total agent tasks initiated
Daily active usage (dogfooding)	8+ hours/day	Phase 1	Team self-report + telemetry: active editor window focus time per day, measured over 2 consecutive weeks



NEXT STEPS
This blueprint is the architectural foundation. The immediate next actions are:
1.  Week 1: Fork VS Code, establish CI/CD pipeline, begin SKIA branding pass (F1-01, F1-02)
2.  Week 2: Begin parallel development of SKIA Chat Panel (F1-03) and Context Engine v1 (F1-04)
3.  Week 4: First internal demo — SKIA-branded editor with functional chat and project indexing
4.  Week 8: Ghost text completions live — first experience of SKIA as co-developer
5.  Week 16: Phase 1 complete — SKIA-IDE is the daily driver

SKIA-IDE Architecture Blueprint v1.0.0 — 22 April 2026 — Dany, Mirabel, QC
Build sovereign. Ship fast. Iterate with precision.
