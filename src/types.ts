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

export type FileManifestEntry = {
  path: string;
  language: string;
  size: number;
  modifiedAt: string;
};

export type ProjectIndex = {
  generatedAt: string;
  rootPath: string;
  files: FileManifestEntry[];
  chunks: IndexChunk[];
};

export type SearchResult = {
  chunk: IndexChunk;
  score: number;
};

export type ForgeAuditV1 = {
  v: 1;
  source: string;
};

export type AgentAuditLogRecord = {
  timestamp: string;
  action: string;
  parameters: Record<string, unknown>;
  result: "success" | "failure";
  details?: string;
};

export type ProviderHealth = {
  name: string;
  healthy: boolean;
  latencyMs: number;
  checkedAt: string;
  failures: number;
};

export type SkiaStatus = "Sovereign" | "Adaptive" | "Autonomous" | "Indexing";

export type InlineCompletionMessage =
  | { type: "status"; status: SkiaStatus }
  | { type: "completion"; text: string; provider: string }
  | { type: "error"; message: string };
