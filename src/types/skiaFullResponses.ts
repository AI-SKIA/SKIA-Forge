export type SkiaFullRiskBand = "low" | "medium" | "high" | "critical";
export type SkiaFullModelTier = "reflex" | "deliberative" | "specialist" | "mythic";
export type SkiaFullTaskComplexity = "trivial" | "simple" | "moderate" | "complex" | "extreme";
export type SkiaFullTaskDomain = "code" | "security" | "infrastructure" | "legacy" | "governance" | "general";

export interface SkiaFullAdapterStatus {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  allowLocalFallback: boolean;
  brainOnly: boolean;
  hasAuthBearer: boolean;
  hasApiKey: boolean;
  embeddingPath: string;
}

export interface SkiaFullToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface SkiaFullPendingInsightsMeta {
  count: number;
  highPriority: number;
  [key: string]: unknown;
}

export interface SkiaFullChatMeta {
  pendingInsights?: SkiaFullPendingInsightsMeta;
  [key: string]: unknown;
}

// Skia-FULL `POST /api/skia/chat`.
export interface SkiaFullChatResponse {
  response: string;
  toolsCalled?: SkiaFullToolCall[];
  filesProcessed?: number;
  riskLevel?: SkiaFullRiskBand | string;
  policyFlags?: string[];
  auditId?: string;
  governanceVersion?: string;
  riskBand?: SkiaFullRiskBand;
  governanceProfile?: SkiaFullRiskBand;
  reasoning?: unknown;
  reasoning_trace?: unknown;
  meta?: SkiaFullChatMeta;
  safetyRedirect?: boolean;
  category?: string;
  blocked?: boolean;
  [key: string]: unknown;
}

// Skia-FULL `POST /api/skia/search` compatibility path; shape is intentionally variable.
export interface SkiaFullSearchResponse {
  results?: unknown[];
  answer?: string;
  response?: string;
  [key: string]: unknown;
}

// Skia-FULL `POST /api/meta/route`.
export interface SkiaFullMetaRouteResponse {
  taskId: string;
  assignedTier: SkiaFullModelTier;
  domain: SkiaFullTaskDomain;
  complexity: SkiaFullTaskComplexity;
  requiresHumanCheckpoint: boolean;
  reasoning: string;
  confidenceScore: number;
  [key: string]: unknown;
}

// Skia-FULL `POST /api/routing/estimate`.
export interface SkiaFullRoutingEstimateResponse {
  taskId: string;
  assignedTier: SkiaFullModelTier;
  estimatedTokens: number;
  estimatedCostUsd: number;
  estimatedLatencyMs: number;
  withinBudget: boolean;
  degradedTier: SkiaFullModelTier | null;
  degradedCostUsd: number | null;
  [key: string]: unknown;
}

// Skia-FULL `POST /api/sovereign-core`; endpoint shape can vary by deployed module.
export interface SkiaFullSovereignCoreResponse {
  response?: unknown;
  result?: unknown;
  data?: unknown;
  [key: string]: unknown;
}

// Skia-FULL `GET /api/tracing/traces/:traceId/explain`.
export interface SkiaFullTraceExplanation {
  level: "high_level" | "technical" | "detailed" | "audit";
  audience: string;
  explanation: string;
  [key: string]: unknown;
}

export type SkiaFullTraceExplainResponse = SkiaFullTraceExplanation[];

export interface SkiaFullEmbeddingObjectResponse {
  embedding: number[];
  model?: string;
  dimensions?: number;
  [key: string]: unknown;
}

export interface SkiaFullEmbeddingVectorResponse {
  vector: number[];
  model?: string;
  dimensions?: number;
  [key: string]: unknown;
}

export interface SkiaFullNestedEmbeddingResponse {
  data: {
    embedding: number[];
    model?: string;
    dimensions?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// Skia-FULL `POST /api/skia/embedding`.
export type SkiaFullEmbeddingResponse =
  | SkiaFullEmbeddingObjectResponse
  | SkiaFullEmbeddingVectorResponse
  | SkiaFullNestedEmbeddingResponse;

export interface SkiaFullEmbeddingVectorResult {
  vector: number[];
  model?: string;
}
