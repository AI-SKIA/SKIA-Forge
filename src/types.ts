/**
 * SKIA-Forge — src/types.ts
 * Drop this in at: C:\SKIA-Forge\src\types.ts
 */

// ─── Audit ────────────────────────────────────────────────────────────────────

/** A single entry written to `.skia/agent-log.json`. */
export type AgentAuditLogRecord = {
    timestamp: string;
    action: string;
    parameters?: Record<string, unknown>;
    result: "success" | "failure" | "blocked" | "pending";
    details?: string;
};

/** Forge audit v1 metadata block embedded inside `parameters`. */
export type ForgeAuditV1 = {
    v: 1;
    source: string;
};

// ─── Provider / routing ───────────────────────────────────────────────────────

/** Health state of a single AI provider (matches `ProviderRouter` + `/providers/*` payloads). */
export type ProviderHealth = {
    name: "google" | "skia-serve";
    healthy: boolean;
    latencyMs: number;
    checkedAt: string;
    failures: number;
};

// ─── Server / status ──────────────────────────────────────────────────────────

/**
 * Routing / readiness posture for SKIA-Forge — returned by `ProviderRouter.getStatus()`,
 * `/ready`, `/providers/status`, and inline-completion `type: "status"` messages.
 */
export type SkiaStatus = "Sovereign" | "Adaptive" | "Indexing";

// ─── Inline completion WebSocket ──────────────────────────────────────────────

/** Union of all messages sent over the /inline-completion WebSocket. */
export type InlineCompletionMessage =
    | { type: "status"; status: SkiaStatus }
    | { type: "completion"; text: string; provider: string }
    | { type: "error"; message: string };

// ─── Context / search engine ──────────────────────────────────────────────────

/** A single file entry in the project manifest. */
export type FileManifestEntry = {
    path: string;
    language: string;
    size: number;
    modifiedAt: string;
};

/** A windowed chunk of file content stored in the project index. */
export type IndexChunk = {
    id: string;
    filePath: string;
    language: string;
    symbolName: string;
    symbolType: "function" | "class" | "module" | "unknown";
    startLine: number;
    endLine: number;
    tokenCount: number;
    content: string;
    checksum: string;
    updatedAt: string;
};

/**
 * A single dependency vulnerability record (Phase A2).
 * Mirrors the SecurityFinding field shape (severity/message/file/line) plus
 * dependency-specific fields. Produced by the security DependencyAuditTool and
 * persisted into the project index under `dependencyVulnerabilities`.
 */
export type DependencyVulnerabilityRecord = {
    type: "vulnerable-dependency";
    severity: "low" | "medium" | "high";
    message: string;
    file?: string;
    line?: number;
    package: string;
    advisoryId: string;
    cveIds: string[];
    fixAvailable: boolean;
};

/** The full persisted project index (written to .skia/index.json). */
export type ProjectIndex = {
    generatedAt: string;
    rootPath: string;
    files: FileManifestEntry[];
    chunks: IndexChunk[];
    /**
     * A2: dependency-audit findings merged in after the index is built.
     * Optional so previously-persisted indexes (and all existing consumers)
     * remain valid without it.
     */
    dependencyVulnerabilities?: DependencyVulnerabilityRecord[];
};

/** A ranked search result from ContextEngine.search(). */
export type SearchResult = {
    chunk: IndexChunk;
    score: number;
};