import { z } from "zod";
import { agentTaskPlanV1Schema } from "./forge/modules/agent-planner/agentPlannerRequest.js";

export const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional()
});

export const telemetryRecordSchema = z.object({
  metric: z.enum([
    "chat_first_token_latency_ms",
    "inline_completion_latency_ms",
    "index_build_duration_ms"
  ]),
  value: z.number().finite()
});

export const validateCommandSchema = z.object({
  command: z.string().min(1)
});

export const providerHealthSchema = z.object({
  name: z.enum(["gemini", "skia"]).default("gemini"),
  healthy: z.boolean(),
  latencyMs: z.number().finite().min(0).default(150)
});

export const providerForceSchema = z.object({
  name: z.enum(["gemini", "skia"]).nullable().optional()
});

export const sovereignModeSchema = z.object({
  mode: z.enum(["strict", "adaptive", "autonomous"])
});

export const controlPlaneRemediationSchema = z.object({
  action: z.enum([
    "align_mode",
    "reduce_block_pressure",
    "healthy_posture",
    "rotate_intent_key_cleanup"
  ]),
  approved: z.boolean().optional(),
  approvalToken: z.string().min(1).optional()
});

/** D1-01: `GET /api/forge/context/structure` — success body (200). */
export const structuralKindSchema = z.enum([
  "function",
  "class",
  "method",
  "interface",
  "import",
  "export",
  "variable",
  "namespace",
  "enum",
  "type"
]);
export const structureEngineSuccessSchema = z.enum([
  "empty",
  "tree_sitter_javascript",
  "typescript"
]);
export const structuralSymbolSchema = z.object({
  name: z.string(),
  kind: structuralKindSchema,
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
  parentName: z.string().optional(),
  filePath: z.string()
});
export const forgeContextStructureOkBodySchema = z.object({
  path: z.string(),
  engine: structureEngineSuccessSchema,
  count: z.number().int().min(0),
  symbols: z.array(structuralSymbolSchema)
});

/** D1-01: `GET /api/forge/context/structure` — 422 (extension not in v1). */
export const forgeContextStructureUnsupportedBodySchema = z.object({
  error: z.string(),
  path: z.string(),
  engine: z.literal("unsupported")
});

/** D1-02: `GET /api/forge/context/semantic-chunks` — success body (200). */
export const semanticCodeChunkSchema = z.object({
  id: z.string(),
  filePath: z.string(),
  name: z.string(),
  kind: structuralKindSchema,
  parentName: z.string().optional(),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
  content: z.string(),
  tokenEstimate: z.number().int().min(0),
  overlapFromPreviousChars: z.number().int().min(0).optional()
});
export const forgeSemanticChunksBodySchema = z.object({
  path: z.string(),
  engine: structureEngineSuccessSchema,
  symbolCount: z.number().int().min(0),
  chunkCount: z.number().int().min(0),
  chunks: z.array(semanticCodeChunkSchema),
  embed: z.unknown().nullable()
});

export const embedIndexRequestSchema = z
  .object({
    path: z.string().min(1).optional(),
    paths: z.array(z.string().min(1)).min(1).max(5_000).optional(),
    minDelayMs: z.number().int().min(0).max(10_000).optional(),
    async: z.boolean().optional()
  })
  .refine(
    (d) =>
      (d.path != null && d.path.length > 0) ||
      (d.paths != null && d.paths.length > 0),
    { message: "path or paths required" }
  );
export const embedSearchRequestSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().min(1).max(50).optional(),
  /** D1-03 Lance IVF: partition probe count (optional; env default may apply) */
  nprobes: z.number().int().min(1).max(2_000).optional(),
  /** D1-03 Lance: re-fetch full vectors for re-ranking after ANN (optional) */
  refineFactor: z.number().int().min(1).max(50).optional(),
  /** SQL filter on table columns (hybrid retrieval) */
  where: z.string().min(1).max(4_000).optional(),
  /** Force flat vector scan; omit to use ANN index when available */
  bypassVectorIndex: z.boolean().optional()
});

/** D1-07: `POST /api/forge/context/retrieve` — layered context + compression. */
export const forgeContextRetrievalRequestSchema = z.object({
  path: z.string().min(1),
  query: z.string().min(1).max(8_000).optional(),
  maxTokens: z.number().int().min(256).max(32_000).optional(),
  topK: z.number().int().min(1).max(24).optional(),
  nprobes: z.number().int().min(1).max(2_000).optional(),
  refineFactor: z.number().int().min(1).max(50).optional(),
  where: z.string().min(1).max(4_000).optional(),
  bypassVectorIndex: z.boolean().optional(),
  /** D1-15: tolerate missing file / L3 errors for downstream planner (optional; default false for this route). */
  resilientRetrieval: z.boolean().optional()
});

/** D1-08: `POST /api/forge/agent/plan` — goal + D1-07 context → structured plan via SKIA chat. */
export const forgeAgentPlanRequestSchema = forgeContextRetrievalRequestSchema
  .omit({ query: true })
  .extend({
    goal: z.string().min(1).max(16_000),
    /** If set, used for D1-07 L3 / retrieval; otherwise `goal` is used. */
    contextQuery: z.string().min(1).max(8_000).optional()
  });

/** D1-10: `POST /api/forge/agent/execute` — v1 plan + tool steps; preview vs apply; gating + audit. */
export const forgeAgentExecuteRequestSchema = z.object({
  path: z.string().min(1),
  plan: agentTaskPlanV1Schema,
  steps: z
    .array(
      z.object({
        stepId: z.string().min(1),
        tool: z.string().min(1),
        input: z.unknown()
      })
    )
    .min(1),
  mode: z.enum(["preview", "apply"]),
  fileMutationApprovals: z.record(z.string(), z.literal(true)).optional().default({}),
  highRiskCommandApprovals: z.record(z.string(), z.literal(true)).optional().default({}),
  /** D1-11: after `apply`, run test/lint/typecheck and up to 3 SKIA replan+re-execute cycles. */
  selfCorrect: z.boolean().optional()
});
