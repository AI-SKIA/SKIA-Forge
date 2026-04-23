import fs from "node:fs/promises";
import path from "node:path";
import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { buildRulesContextSummary } from "../skiarules/skiarulesRulesContext.js";
import {
  buildLspSkiarulesDiagnosticsBundleV1,
  lspFileToSkiarulesDiagnostics,
  type LspSkiarulesDiagnosticsBundleV1
} from "../skiarules/lspDiagnosticsShape.js";
import { contextRetrievalFailure, semanticSearchFailure, type ForgeStructuredError } from "../errors/forgeStructuredErrors.js";
import { recordSdlcEvent } from "../sdlc/sdlcEventModel.js";
import { buildSdlcInsightsBundle, type SdlcInsightsBundleV1, type SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";
import { autoTagWorkItemsFromSdlc } from "../work/workItemModel.js";
import { queryWorkItems } from "../work/workItemModel.js";
import { buildWorkBreakdown } from "../work/workDecomposition.js";
import { prioritizeWork } from "../work/workPrioritization.js";
import { buildWorkGraph } from "../work/workGraph.js";
import { buildWorkSchedule } from "../work/workScheduler.js";
import { buildWorkDashboard } from "../work/workDashboard.js";
import { estimateTokenCount } from "../../../utils.js";
import { assertSafeRelativeProjectPath } from "./safeProjectPath.js";
import { extractStructuralSymbols } from "./extractStructuralSymbols.js";
import type { StructuralSymbol } from "./structuralTypes.js";
import { runHybridEmbedSearchWithRetry, type HybridHit } from "./hybridEmbedSearch.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";
import { countSkiarulesL4Stats, type SkiarulesFileDiagnostics } from "../skiarules/architectureDiagnostics.js";
import type { SkiarulesConfig } from "../skiarules/skiarulesTypes.js";

const DEFAULT_MAX_TOKENS = 8_000;
const REL_IMPORT_RE = /\bfrom\s+['"](\.\.?\/[^'"]+)['"]/g;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g;

export type ContextRetrievalStructureSource = {
  getStructureIndexSummary: () => {
    fileCount: number;
    maxParseDurationMs: number;
    paths: string[];
  };
};

export type ForgeContextSkiarulesContext = {
  getSkiarulesConfig: () => SkiarulesConfig | null;
  getDiagnosticsForPath: (relPathPosix: string) => Promise<SkiarulesFileDiagnostics>;
  /** When set, preferred for LSP-shaped audit/response; otherwise file diagnostics are mapped locally. */
  getLspSkiarulesBundleForPath?: (relPathPosix: string) => Promise<LspSkiarulesDiagnosticsBundleV1>;
};

export type ContextRetrievalBody = {
  path: string;
  /** User task / search query; when omitted, derived from path + file head. */
  query?: string;
  maxTokens?: number;
  topK?: number;
  nprobes?: number;
  refineFactor?: number;
  where?: string;
  bypassVectorIndex?: boolean;
  /**
   * When true, missing/ unreadable file yields 200 with degraded L1 and warnings (keeps planner online).
   * Direct HTTP default: omit / false. Planner passes true unless explicitly disabled.
   */
  resilientRetrieval?: boolean;
  /** D4-04 internal-only auto mode context (no HTTP schema change). */
  autoContext?: {
    autoMode?: boolean;
    autoSessionId?: string;
    autoSelection?: unknown;
  };
};

export type ContextRetrievalLayer = {
  id: "L1_currentFile" | "L2_imports" | "L3_semantic" | "L4_structure";
  label: string;
  tokenEstimate: number;
  text: string;
  meta?: Record<string, unknown>;
};

export type SdlcInsightsPayloadV1 = {
  recentFailures: Array<{ type: string; timestamp: string; path?: string; details?: string }>;
  hotspotFiles: Array<{ path: string; score: number; edits: number; failures: number }>;
  riskScore: number;
  stabilityScore: number;
  patterns?: SdlcInsightsBundleV1["patterns"];
  recommendations?: SdlcInsightsBundleV1["recommendations"];
  healthScore?: number;
  drift?: SdlcInsightsBundleV2["drift"];
  risk?: SdlcInsightsBundleV2["risk"];
  forecast?: SdlcInsightsBundleV2["forecast"];
};

function readMaxTokens(env: NodeJS.ProcessEnv, body: ContextRetrievalBody): number {
  const b = body.maxTokens;
  if (Number.isFinite(b) && (b as number) > 0) {
    return Math.min(32_000, Math.max(256, Math.floor(b as number)));
  }
  const n = parseInt(env.CONTEXT_RETRIEVAL_MAX_TOKENS ?? String(DEFAULT_MAX_TOKENS), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(32_000, Math.max(256, n)) : DEFAULT_MAX_TOKENS;
}

const TRUNCATE_SUFFIX = "\n… [truncated]";

/** Greedy char-level truncate to stay under approximate token cap (including suffix if added). */
export function truncateToMaxTokens(text: string, maxTokens: number): string {
  if (maxTokens <= 0) {
    return "";
  }
  if (estimateTokenCount(text) <= maxTokens) {
    return text;
  }
  const suffixTok = estimateTokenCount(TRUNCATE_SUFFIX);
  const contentBudget = maxTokens - suffixTok;
  if (contentBudget <= 0) {
    return TRUNCATE_SUFFIX.slice(0, Math.max(0, maxTokens * 4));
  }
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (estimateTokenCount(text.slice(0, mid)) <= contentBudget) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return text.slice(0, lo) + TRUNCATE_SUFFIX;
}

function shareBudget(
  maxTokens: number
): { l1: number; l2: number; l3: number; l4: number } {
  const l1 = Math.floor(maxTokens * 0.4);
  const l2 = Math.floor(maxTokens * 0.2);
  const l3 = Math.floor(maxTokens * 0.25);
  const l4 = maxTokens - l1 - l2 - l3;
  return { l1, l2, l3, l4: Math.max(0, l4) };
}

function importSymbolsBlock(
  content: string,
  symbols: StructuralSymbol[]
): string {
  const imp = symbols.filter((s) => s.kind === "import");
  if (imp.length === 0) {
    return "";
  }
  const lines = content.split(/\r?\n/);
  const start = Math.min(...imp.map((s) => s.startLine));
  const end = Math.max(...imp.map((s) => s.endLine));
  if (start < 1 || end < start) {
    return "";
  }
  return lines.slice(start - 1, end).join("\n");
}

function collectRelativeSpecifiers(
  relFilePosix: string,
  content: string
): string[] {
  const baseDir = path.posix.dirname(relFilePosix);
  const seen = new Set<string>();
  const add = (raw: string) => {
    const p = path.posix.normalize(path.posix.join(baseDir, raw));
    if (p && !p.startsWith("..") && !seen.has(p)) {
      seen.add(p);
    }
  };
  for (const re of [REL_IMPORT_RE, DYNAMIC_IMPORT_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) != null) {
      add(m[1]!);
    }
  }
  return [...seen];
}

const TEXT_EXT = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".css",
  ".html"
]);

async function snippetDependencyFiles(
  projectRoot: string,
  relFilePosix: string,
  content: string,
  maxFiles: number,
  maxTokensPerFile: number
): Promise<string> {
  const specs = collectRelativeSpecifiers(relFilePosix, content).slice(0, maxFiles);
  const parts: string[] = [];
  for (const spec of specs) {
    const ext = path.posix.extname(spec).toLowerCase();
    if (ext && !TEXT_EXT.has(ext)) {
      continue;
    }
    const tryPaths = ext
      ? [spec]
      : [spec + ".ts", spec + ".tsx", spec + ".js", spec + "/index.ts", spec + "/index.js"];
    let read: string | null = null;
    let usedPath: string | null = null;
    for (const cand of tryPaths) {
      const check = assertSafeRelativeProjectPath(projectRoot, cand);
      if (!check.ok) {
        continue;
      }
      try {
        const t = await fs.readFile(check.absPath, "utf8");
        read = t;
        usedPath = check.relPosix;
        break;
      } catch {
        /* try next */
      }
    }
    if (read != null && usedPath != null) {
      parts.push(
        `// --- ${usedPath} ---\n${truncateToMaxTokens(read, maxTokensPerFile)}`
      );
    }
  }
  return parts.join("\n\n");
}

function buildSemanticQuery(
  relPath: string,
  fileHead: string,
  explicit?: string
): string {
  const t = String(explicit ?? "").trim();
  if (t.length > 0) {
    return t;
  }
  const head = fileHead.replace(/\s+/g, " ").trim().slice(0, 400);
  return `Relevant code for ${relPath}. ${head}`;
}

function formatL3Hits(hits: HybridHit[], maxTokens: number): { text: string; meta: Record<string, unknown> } {
  if (hits.length === 0) {
    return { text: "", meta: { hitCount: 0 } };
  }
  const lines: string[] = [];
  for (const h of hits) {
    lines.push(
      `[${h.filePath} ${h.name} ${h.kind} L${h.startLine}-${h.endLine} score=${h.score.toFixed(4)}]`
    );
    lines.push(h.preview);
    lines.push("");
  }
  const text = truncateToMaxTokens(lines.join("\n"), maxTokens);
  return { text, meta: { hitCount: hits.length } };
}

function formatL4(
  summary: { fileCount: number; maxParseDurationMs: number; paths: string[] },
  maxTokens: number
): string {
  const header = `# Project structure (structural index: ${summary.fileCount} files, max parse ${summary.maxParseDurationMs} ms)\n`;
  const body = summary.paths.map((p) => `- ${p}`).join("\n");
  return truncateToMaxTokens(header + body, maxTokens);
}

/**
 * D1-07: L1 current file → L2 imports + local dependency snippets → L3 hybrid embed search → L4 structure list, compressed to a token budget.
 * Does not use the embed index queue; only `EmbeddingVectorStore` read path + structure summary.
 */
export async function runForgeContextRetrieval(
  projectRoot: string,
  body: ContextRetrievalBody,
  skia: SkiaFullAdapter,
  env: NodeJS.ProcessEnv,
  structure: ContextRetrievalStructureSource,
  skiarulesContext?: ForgeContextSkiarulesContext
): Promise<{ status: number; body: unknown }> {
  const rel = String(body.path ?? "").trim();
  if (!rel) {
    await recordSdlcEvent({
      projectRoot,
      type: "context_retrieval",
      status: "failure",
      details: "path is required"
    });
    return { status: 400, body: { error: "path is required (relative project file)." } };
  }
  const check = assertSafeRelativeProjectPath(projectRoot, rel);
  if (!check.ok) {
    await recordSdlcEvent({
      projectRoot,
      type: "context_retrieval",
      status: "failure",
      path: rel,
      details: check.error
    });
    return { status: 400, body: { error: check.error } };
  }
  const relPosix = check.relPosix;
  const resilient = body.resilientRetrieval === true;
  const retrievalWarnings: ForgeStructuredError[] = [];
  let fileContent: string;
  let degradedFileNote: string | undefined;
  try {
    const st = await fs.stat(check.absPath);
    if (!st.isFile()) {
      if (resilient) {
        fileContent = "";
        degradedFileNote = "Degraded: path is not a file; L1 empty.";
        retrievalWarnings.push(
          contextRetrievalFailure("Path is not a file; retrieval degraded for downstream planner.", "not_a_file")
        );
      } else {
        await recordSdlcEvent({
          projectRoot,
          type: "context_retrieval",
          status: "failure",
          path: relPosix,
          details: "Path is not a file."
        });
        return { status: 400, body: { error: "Path is not a file." } };
      }
    } else {
      fileContent = await fs.readFile(check.absPath, "utf8");
    }
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT" && resilient) {
      fileContent = "";
      degradedFileNote = "Degraded: file not found; L1 empty.";
      retrievalWarnings.push(
        contextRetrievalFailure("File not found; retrieval degraded for downstream planner.", "file_not_found")
      );
    } else if (code === "ENOENT") {
      await recordSdlcEvent({
        projectRoot,
        type: "context_retrieval",
        status: "failure",
        path: relPosix,
        details: "File not found."
      });
      return { status: 404, body: { error: "File not found." } };
    } else if (resilient) {
      fileContent = "";
      degradedFileNote = "Degraded: failed to read file; L1 empty.";
      const msg = e instanceof Error ? e.message : "read error";
      retrievalWarnings.push(
        contextRetrievalFailure("Failed to read file; retrieval degraded for downstream planner.", "read_error", msg)
      );
    } else {
      await recordSdlcEvent({
        projectRoot,
        type: "context_retrieval",
        status: "failure",
        path: relPosix,
        details: "Failed to read file."
      });
      return { status: 500, body: { error: "Failed to read file." } };
    }
  }

  const maxTokens = readMaxTokens(env, body);
  const { l1, l2, l3, l4 } = shareBudget(maxTokens);
  const topK = Number.isFinite(body.topK) ? Math.min(24, Math.max(1, body.topK as number)) : 6;

  const l1Text = truncateToMaxTokens(
    (degradedFileNote ? `${degradedFileNote}\n\n` : "") + fileContent,
    l1
  );

  const { symbols, engine } = extractStructuralSymbols(relPosix, fileContent);
  const importBlock = importSymbolsBlock(fileContent, symbols);
  const depExtra =
    engine !== "unsupported" && engine !== "empty"
      ? await snippetDependencyFiles(
          projectRoot,
          relPosix,
          fileContent,
          Math.max(1, parseInt(env.CONTEXT_RETRIEVAL_L2_MAX_DEPS ?? "5", 10) || 5),
          Math.max(64, Math.floor(l2 / 3))
        )
      : "";
  const l2Raw = [importBlock, depExtra].filter(Boolean).join("\n\n");
  const l2Text = truncateToMaxTokens(l2Raw, l2);

  const q = buildSemanticQuery(relPosix, fileContent, body.query);
  const tuning = {
    nprobes: body.nprobes,
    refineFactor: body.refineFactor,
    where: body.where,
    bypassVectorIndex: body.bypassVectorIndex
  };
  let l3Hits: HybridHit[] = [];
  let l3Text = "";
  let l3Note: string | undefined;
  let vectorSearchMeta: Record<string, unknown>;
  try {
    const r = await runHybridEmbedSearchWithRetry(projectRoot, q, topK, tuning, skia, env);
    if (r.kind === "ok") {
      l3Hits = r.hits;
      l3Text = formatL3Hits(r.hits, l3).text;
      vectorSearchMeta = {
        topK: r.topK,
        hitCount: r.hits.length,
        candidateK: r.candidateK,
        storePath: r.store.storePath,
        rowCount: r.store.rowCount,
        lanceIndex: r.store.lanceVectorIndex
      };
    } else if (r.kind === "empty_store") {
      l3Note = r.message;
      vectorSearchMeta = { hitCount: 0, emptyStore: true, storePath: r.store.storePath };
    } else {
      l3Note = r.lastError;
      const fe = semanticSearchFailure(
        "Semantic search failed after retries.",
        "embed_transient",
        r.lastError
      );
      retrievalWarnings.push(fe);
      vectorSearchMeta = {
        hitCount: 0,
        storePath: r.store.storePath,
        forgeError: fe
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "semantic search failed";
    l3Note = msg;
    const fe = semanticSearchFailure("Semantic search failed.", "embed_search", msg);
    retrievalWarnings.push(fe);
    vectorSearchMeta = { hitCount: 0, forgeError: fe };
  }

  const sum = structure.getStructureIndexSummary();
  const l4Text = formatL4(sum, l4);
  const cfg = skiarulesContext?.getSkiarulesConfig() ?? null;
  let l4FileDiagnostics: SkiarulesFileDiagnostics | null = null;
  let lspSkiarules: LspSkiarulesDiagnosticsBundleV1 | null = null;
  if (skiarulesContext) {
    try {
      if (skiarulesContext.getLspSkiarulesBundleForPath) {
        lspSkiarules = await skiarulesContext.getLspSkiarulesBundleForPath(relPosix);
        l4FileDiagnostics = lspFileToSkiarulesDiagnostics(lspSkiarules.file);
      } else {
        l4FileDiagnostics = await skiarulesContext.getDiagnosticsForPath(relPosix);
        lspSkiarules = buildLspSkiarulesDiagnosticsBundleV1(l4FileDiagnostics, null);
      }
    } catch (e) {
      const cause = e instanceof Error ? e.message : String(e);
      retrievalWarnings.push(
        contextRetrievalFailure("Skiarules / diagnostics for path failed; using empty diagnostics.", "l4_diagnostics", cause)
      );
      l4FileDiagnostics = {
        path: relPosix,
        architecture: [],
        naming: [],
        antiPatterns: []
      };
      lspSkiarules = buildLspSkiarulesDiagnosticsBundleV1(l4FileDiagnostics, null);
    }
  }
  const skiarulesSummary = l4FileDiagnostics
    ? countSkiarulesL4Stats(l4FileDiagnostics, cfg)
    : undefined;
  const sdlcBundle = await buildSdlcInsightsBundle(projectRoot, relPosix, cfg);
  await autoTagWorkItemsFromSdlc(
    projectRoot,
    sdlcBundle.heuristics.hotspotFiles.map((x) => x.path),
    sdlcBundle.drift.score
  );
  const sdlcInsights: SdlcInsightsPayloadV1 = {
    recentFailures: sdlcBundle.heuristics.recentFailures,
    hotspotFiles: sdlcBundle.heuristics.hotspotFiles,
    riskScore: sdlcBundle.heuristics.riskScore,
    stabilityScore: sdlcBundle.heuristics.stabilityScore,
    patterns: sdlcBundle.patterns,
    recommendations: sdlcBundle.recommendations,
    healthScore: sdlcBundle.healthScore,
    drift: sdlcBundle.drift,
    risk: sdlcBundle.risk,
    forecast: sdlcBundle.forecast
  };
  const workForPath = (await queryWorkItems(projectRoot, { limit: 100 }))
    .find((w) => w.relatedFiles.includes(relPosix) && (w.status === "todo" || w.status === "in_progress"));
  const workPriorityMeta = workForPath
    ? prioritizeWork(
        workForPath,
        buildWorkBreakdown(workForPath, sdlcBundle, { paths: sum.paths }, cfg),
        sdlcBundle,
        { maxSteps: 20, maxWriteOps: 10, maxTerminalOps: 5 }
      )
    : null;
  const workGraph = await buildWorkGraph(projectRoot);
  const workSchedule = buildWorkSchedule({
    graph: workGraph,
    governanceLimits: { maxSteps: 20, maxWriteOps: 10, maxTerminalOps: 5 },
    forecast: {
      globalNextFailureProbability: sdlcBundle.forecast.globalNextFailureProbability,
      nextAgentRollbackProbability: sdlcBundle.forecast.nextAgentRollbackProbability
    }
  });
  const workDashboard = await buildWorkDashboard(projectRoot, relPosix, cfg);

  const layers: ContextRetrievalLayer[] = [
    {
      id: "L1_currentFile",
      label: "L1 current file",
      tokenEstimate: estimateTokenCount(l1Text),
      text: l1Text
    },
    {
      id: "L2_imports",
      label: "L2 imports & local dependencies",
      tokenEstimate: estimateTokenCount(l2Text),
      text: l2Text,
      meta: { importBlockPresent: importBlock.length > 0, depExtraPresent: depExtra.length > 0 }
    },
    {
      id: "L3_semantic",
      label: "L3 semantic (hybrid) search",
      tokenEstimate: estimateTokenCount(l3Text),
      text: l3Text,
      meta: { query: q, topK, note: l3Note, hitCount: l3Hits.length, vectorSearchMeta }
    },
    {
      id: "L4_structure",
      label: "L4 project structure (structural index)",
      tokenEstimate: estimateTokenCount(l4Text),
      text: l4Text,
      meta: {
        fileCount: sum.fileCount,
        ...(l4FileDiagnostics
          ? {
              architectureDiagnostics: l4FileDiagnostics.architecture,
              skiarulesSummary,
              sdlcTimelineMetrics: sdlcBundle.timeline.metrics,
              sdlcPatterns: sdlcBundle.patterns,
              sdlcRecommendations: sdlcBundle.recommendations,
              sdlcHealthScore: sdlcBundle.healthScore,
              sdlcDrift: sdlcBundle.drift,
              sdlcRisk: sdlcBundle.risk,
              sdlcForecast: sdlcBundle.forecast,
              workPriority: workPriorityMeta,
              workGraph: {
                nodes: workGraph.nodes.length,
                edges: workGraph.edges.length,
                cycles: workGraph.cycles,
                criticalPath: workGraph.criticalPath
              },
              workSchedule,
              workDashboard,
              workRoadmapSummary: {
                phaseCount: workDashboard.roadmap.phases.length,
                phaseOrder: workDashboard.roadmap.global.suggestedPhaseOrder,
                criticalPathItems: workDashboard.roadmap.global.criticalPathItems
              },
              workProgressSummary: workDashboard.progress.project,
              workGovernance: workDashboard.governance,
              workSlaDrift: workDashboard.slaDrift,
              impactSummary:
                workDashboard.impactSummaries.find((x) => x.workItemId === workForPath?.id)?.impact ??
                workDashboard.impactSummaries[0]?.impact ??
                null,
              orchestrationDashboard: workDashboard.orchestrationDashboard,
              autoContext: body.autoContext ?? null,
              sdlcInsights
            }
          : {})
      }
    }
  ];

  const header = `--- SKIA context bundle (D1-07) path=${relPosix} maxTokens≈${maxTokens} ---\n`;
  const blocks = [
    `### L1 current file\n${l1Text}`,
    `### L2 imports & local dependencies\n${l2Text || "[none]"}`,
    `### L3 semantic (hybrid)\n${l3Text || l3Note || "[no hits]"}`,
    `### L4 project structure\n${l4Text}`
  ];
  const compressed = truncateToMaxTokens(header + blocks.join("\n\n"), maxTokens);
  const used = estimateTokenCount(compressed);
  const rulesContext = buildRulesContextSummary(cfg);

  const responseBody: Record<string, unknown> = {
    path: relPosix,
    maxTokens,
    usedTokensEstimate: used,
    layers,
    compressed,
    semanticQuery: q,
    vectorSearchMeta,
    rulesContext: rulesContext || null,
    sdlcInsights,
    workDashboard,
    ...(workPriorityMeta ? { workPriority: workPriorityMeta } : {}),
    retrievalWarnings: retrievalWarnings.length ? retrievalWarnings : undefined
  };
  if (skiarulesSummary) {
    responseBody.skiarulesSummary = skiarulesSummary;
  }
  if (lspSkiarules) {
    responseBody.lspSkiarules = lspSkiarules;
    responseBody.diagnostics = lspSkiarules;
  }

  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "context.retrieve.complete",
    parameters: mergeForgeAuditParamsV1("context_retrieval", {
      path: relPosix,
      autoContext: body.autoContext ?? null,
      rulesContext: rulesContext || null,
      vectorSearchMeta: vectorSearchMeta ?? null,
      lspSkiarules: lspSkiarules ?? null,
      diagnostics: lspSkiarules ?? null,
      governance: null,
      contextRetrievalMeta: {
        usedTokensEstimate: used,
        maxTokens,
        layerIds: layers.map((x) => x.id),
        skiarulesSummary: skiarulesSummary ?? null,
        sdlcTimelineMetrics: sdlcBundle.timeline.metrics,
        sdlcPatterns: sdlcBundle.patterns,
        sdlcRecommendations: sdlcBundle.recommendations,
        sdlcHealthScore: sdlcBundle.healthScore,
        sdlcDrift: sdlcBundle.drift,
        sdlcRisk: sdlcBundle.risk,
        sdlcForecast: sdlcBundle.forecast,
        workPriority: workPriorityMeta,
        workGraph: {
          nodes: workGraph.nodes.length,
          edges: workGraph.edges.length,
          cycles: workGraph.cycles,
          criticalPath: workGraph.criticalPath
        },
        workSchedule,
        workDashboard,
        workRoadmapSummary: {
          phaseCount: workDashboard.roadmap.phases.length,
          phaseOrder: workDashboard.roadmap.global.suggestedPhaseOrder,
          criticalPathItems: workDashboard.roadmap.global.criticalPathItems
        },
        workProgressSummary: workDashboard.progress.project,
        workGovernance: workDashboard.governance,
        workSlaDrift: workDashboard.slaDrift,
        impactSummary:
          workDashboard.impactSummaries.find((x) => x.workItemId === workForPath?.id)?.impact ??
          workDashboard.impactSummaries[0]?.impact ??
          null,
        orchestrationDashboard: workDashboard.orchestrationDashboard,
        autoContext: body.autoContext ?? null,
        sdlcInsights
      },
      retrievalWarnings: retrievalWarnings.length ? retrievalWarnings : null
    }),
    result: "success"
  });
  if (retrievalWarnings.length) {
    await recordSdlcEvent({
      projectRoot,
      type: "context_retrieval",
      status: "failure",
      path: relPosix,
      details: "Retrieval completed with warnings",
      meta: {
        warningCount: retrievalWarnings.length,
        warnings: retrievalWarnings
      }
    });
  }

  return {
    status: 200,
    body: responseBody
  };
}
