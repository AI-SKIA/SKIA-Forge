import { z } from "zod";
import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { runForgeContextRetrieval } from "../context-engine/contextRetrievalRequest.js";
import type {
  ContextRetrievalStructureSource,
  ForgeContextSkiarulesContext
} from "../context-engine/contextRetrievalRequest.js";
import { buildRulesContextSummary } from "../skiarules/skiarulesRulesContext.js";
import { warnPlannerStepCount } from "../governance/agentGovernance.js";
import { recordSdlcEvent } from "../sdlc/sdlcEventModel.js";
import { buildSdlcInsightsBundle } from "../sdlc/sdlcInsights.js";
import {
  autoTagWorkItemsFromSdlc,
  ensureWorkItemForPlan,
  queryWorkItems,
  type WorkItemV1
} from "../work/workItemModel.js";
import { buildWorkBreakdown } from "../work/workDecomposition.js";
import { prioritizeWork } from "../work/workPrioritization.js";
import { buildWorkPlanV2, type WorkPlanV2 } from "../work/workPlannerV2.js";
import { buildWorkGraph } from "../work/workGraph.js";
import { buildWorkSchedule } from "../work/workScheduler.js";
import { buildWorkPlanV3, type WorkPlanV3 } from "../work/workPlannerV3.js";
import { buildWorkDashboard } from "../work/workDashboard.js";
import { buildWorkRoadmap } from "../work/workRoadmap.js";
import { buildWorkProgress } from "../work/workProgress.js";
import { evaluateWorkGovernance } from "../work/workGovernance.js";
import { buildMultiGoalPlan, detectCompoundGoals, type MultiGoalPlanV1 } from "../work/workMultiGoalOrchestrator.js";
import { detectWorkSlaDrift } from "../work/workSlaDrift.js";
import { analyzeWorkImpact } from "../work/workImpact.js";
import { buildWorkPlanV4, type WorkPlanV4 } from "../work/workPlannerV4.js";
import { selectNextWorkItems } from "../auto/autoTaskSelector.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";

/**
 * D1-08: stable task-plan shape (v1). Validated from model output when possible.
 */
export const agentTaskPlanV1Schema = z.object({
  version: z.literal("1").optional(),
  title: z.string().min(1),
  goalRestatement: z.string().optional(),
  steps: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1),
        detail: z.string().optional().default(""),
        dependsOn: z.array(z.string().min(1)).optional()
      })
    )
    .min(1),
  assumptions: z.array(z.string().min(1)).optional(),
  risks: z.array(z.string().min(1)).optional()
});

export type AgentTaskPlanV1 = z.infer<typeof agentTaskPlanV1Schema>;

export type AgentPlannerRequestBody = {
  goal: string;
  path: string;
  contextQuery?: string;
  maxTokens?: number;
  topK?: number;
  nprobes?: number;
  refineFactor?: number;
  where?: string;
  bypassVectorIndex?: boolean;
  /** D1-15: default true — do not block planner on context retrieval if set (HTTP may omit; internal default true). */
  resilientRetrieval?: boolean;
};

export type AgentPlannerInternalOptions = {
  autoMode?: boolean;
  autoSessionId?: string;
  autoSelection?: unknown;
};

function mapWorkPlanV2ToV1(p: WorkPlanV2): AgentTaskPlanV1 {
  return {
    version: "1",
    title: p.title,
    goalRestatement: p.goalRestatement,
    steps: p.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      detail: `${t.detail}\n[risk=${t.risk}] ${t.rationale}`,
      ...(t.dependsOn ? { dependsOn: t.dependsOn } : {})
    })),
    assumptions: p.assumptions,
    risks: [...p.risks, ...p.governanceWarnings]
  };
}

function mapWorkPlanV3ToV1(p: WorkPlanV3): AgentTaskPlanV1 {
  return {
    version: "1",
    title: p.title,
    goalRestatement: p.rationale.join(" "),
    steps: p.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      detail: `${t.detail}\n[risk=${t.risk}] ${t.rationale}`,
      ...(t.dependsOn ? { dependsOn: t.dependsOn } : {})
    })),
    assumptions: [...p.sdlcContext],
    risks: [...p.rationale, ...p.governanceWarnings]
  };
}

function mapMultiGoalPlanToV1(p: MultiGoalPlanV1): AgentTaskPlanV1 {
  return {
    version: "1",
    title: `Multi-goal plan (${p.goals.length} goals)`,
    goalRestatement: p.goals.join(" + "),
    steps: p.combinedTasks.map((t) => ({
      id: t.id,
      title: t.title,
      detail: `${t.detail}\n[risk=${t.risk}] ${t.rationale}`,
      ...(t.dependsOn ? { dependsOn: t.dependsOn } : {})
    })),
    assumptions: [...p.sdlcContext],
    risks: [...p.governanceWarnings]
  };
}

function mapWorkPlanV4ToV1(p: WorkPlanV4): AgentTaskPlanV1 {
  return {
    version: "1",
    title: p.title,
    goalRestatement: p.rationale.join(" "),
    steps: p.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      detail: `${t.detail}\n[risk=${t.risk}] ${t.rationale}`,
      ...(t.dependsOn ? { dependsOn: t.dependsOn } : {})
    })),
    assumptions: p.impactSummary,
    risks: [...p.governanceWarnings, ...p.slaDriftWarnings]
  };
}

const SYSTEM_PREFIX = `You are SKIA-Forge's task planner (D1-08). The user will send a goal and a compressed project context (L1–L4).
You MUST reply with a single JSON object only — no markdown fences, no commentary. Use this exact shape:
{
  "version": "1",
  "title": "<short plan title>",
  "goalRestatement": "<optional: one-sentence restatement>",
  "steps": [
    { "id": "step-1", "title": "…", "detail": "…", "dependsOn": [] }
  ],
  "assumptions": ["…"],
  "risks": ["…"]
}
Rules: step ids are unique slugs; dependsOn lists other step ids that must complete first; keep steps ordered for execution.`;

export function extractTextFromSkiaChatResponse(r: Record<string, unknown>): string {
  for (const k of ["message", "response", "text", "content", "answer", "output", "body"]) {
    const v = r[k];
    if (typeof v === "string" && v.trim().length) {
      return v;
    }
  }
  const d = r["data"];
  if (typeof d === "string" && d.trim().length) {
    return d;
  }
  if (d && typeof d === "object" && d !== null) {
    for (const k of ["message", "text", "content"]) {
      const v = (d as Record<string, unknown>)[k];
      if (typeof v === "string" && v.trim().length) {
        return v;
      }
    }
  }
  return JSON.stringify(r);
}

/** Pull a JSON object substring from free-form or fenced text. */
export function extractJsonObjectString(raw: string): string | null {
  const t = raw.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence && fence[1] ? fence[1]!.trim() : t;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) {
    return null;
  }
  return candidate.slice(start, end + 1);
}

/**
 * D1-08: fetch D1-07 context bundle, then one SKIA-FULL `POST /api/skia/chat` (mode agent) to produce a structured v1 plan.
 * Does not invoke the forge module executor, orchestrator, or tools.
 */
export async function runAgentPlannerRequest(
  projectRoot: string,
  body: AgentPlannerRequestBody,
  skia: SkiaFullAdapter,
  env: NodeJS.ProcessEnv,
  structure: ContextRetrievalStructureSource,
  passthroughHeaders?: Record<string, string>,
  skiarulesContext?: ForgeContextSkiarulesContext,
  internalOptions?: AgentPlannerInternalOptions
): Promise<{ status: number; body: unknown }> {
  const goal = String(body.goal ?? "").trim();
  if (!goal) {
    return { status: 400, body: { error: "goal is required." } };
  }
  const relPath = String(body.path ?? "").trim();
  if (!relPath) {
    return { status: 400, body: { error: "path is required (relative file)." } };
  }

  const q = String(body.contextQuery ?? "").trim() || goal;
  const emitPlannerRun = (status: "success" | "failure", details?: string) =>
    recordSdlcEvent({
      projectRoot,
      type: "planner_run",
      status,
      path: relPath,
      details,
      meta: {
        goalLength: goal.length
      }
    });
  const retrieval = await runForgeContextRetrieval(
    projectRoot,
    {
      path: relPath,
      query: q,
      maxTokens: body.maxTokens,
      topK: body.topK,
      nprobes: body.nprobes,
      refineFactor: body.refineFactor,
      where: body.where,
      bypassVectorIndex: body.bypassVectorIndex,
      resilientRetrieval: body.resilientRetrieval !== false,
      autoContext: internalOptions?.autoMode
        ? {
            autoMode: true,
            autoSessionId: internalOptions.autoSessionId,
            autoSelection: internalOptions.autoSelection ?? null
          }
        : undefined
    },
    skia,
    env,
    structure,
    skiarulesContext
  );
  if (retrieval.status !== 200) {
    await emitPlannerRun("failure", `context retrieval status ${retrieval.status}`);
    return { status: retrieval.status, body: retrieval.body };
  }
  const ctx = retrieval.body as {
    path: string;
    maxTokens: number;
    usedTokensEstimate: number;
    compressed: string;
    semanticQuery: string;
    vectorSearchMeta?: Record<string, unknown>;
    sdlcInsights?: {
      riskScore?: number;
      stabilityScore?: number;
      healthScore?: number;
      hotspotFiles?: unknown[];
      patterns?: unknown;
      recommendations?: unknown;
      drift?: unknown;
      risk?: unknown;
      forecast?: unknown;
      [k: string]: unknown;
    };
    layers: { id: string; label: string; tokenEstimate: number; meta?: Record<string, unknown> }[];
  };
  const cfg = skiarulesContext?.getSkiarulesConfig() ?? null;
  const sdlcBundle = await buildSdlcInsightsBundle(projectRoot, relPath, cfg);
  await autoTagWorkItemsFromSdlc(
    projectRoot,
    sdlcBundle.heuristics.hotspotFiles.map((x) => x.path),
    sdlcBundle.drift.score
  );
  const openWorkItems = await queryWorkItems(projectRoot, { limit: 200 });
  const detectedGoals = detectCompoundGoals(goal);
  const hasMultiGoalIntent = detectedGoals.length > 1;
  const existingForPath = openWorkItems
    .find((w) => w.relatedFiles.includes(relPath) && (w.status === "todo" || w.status === "in_progress"));
  const multiMatch = openWorkItems.filter(
    (w) =>
      (w.relatedFiles.includes(relPath) ||
        w.title.toLowerCase().includes(goal.toLowerCase().slice(0, 24))) &&
      (w.status === "todo" || w.status === "in_progress")
  );
  const workItem = existingForPath ?? (await ensureWorkItemForPlan(projectRoot, {
    title: `Plan: ${goal.slice(0, 90)}`,
    description: goal,
    relatedFiles: [relPath],
    sdlcSignals: {
      risk: sdlcBundle.heuristics.riskScore,
      drift: sdlcBundle.drift.score,
      forecast: sdlcBundle.forecast.globalNextFailureProbability,
      health: sdlcBundle.healthScore
    },
    tags: [sdlcBundle.risk.project.class, "planner"]
  }));
  const workBreakdown = buildWorkBreakdown(
    workItem as WorkItemV1,
    sdlcBundle,
    { paths: structure.getStructureIndexSummary().paths },
    cfg
  );
  const workPriority = prioritizeWork(
    workItem,
    workBreakdown,
    sdlcBundle,
    { maxSteps: 20, maxWriteOps: 10, maxTerminalOps: 5 }
  );
  const workPlanV2 = buildWorkPlanV2({
    workItem,
    breakdown: workBreakdown,
    priority: workPriority,
    insights: sdlcBundle
  });
  const workGraph = await buildWorkGraph(projectRoot);
  const workSchedule = buildWorkSchedule({
    graph: workGraph,
    governanceLimits: { maxSteps: 20, maxWriteOps: 10, maxTerminalOps: 5 },
    forecast: {
      globalNextFailureProbability: sdlcBundle.forecast.globalNextFailureProbability,
      nextAgentRollbackProbability: sdlcBundle.forecast.nextAgentRollbackProbability
    }
  });
  const workDashboard = await buildWorkDashboard(projectRoot, relPath, cfg);
  const autoSelection = internalOptions?.autoMode
    ? await selectNextWorkItems(projectRoot, { maxItems: 5 })
    : null;
  const workRoadmap = buildWorkRoadmap({ graph: workGraph, schedule: workSchedule, insights: sdlcBundle });
  const workProgress = await buildWorkProgress(projectRoot);
  const workGovernance = evaluateWorkGovernance({
    openP0Count: openWorkItems.filter((w) => (w.priority === "P0" || w.priority === "P1") && w.status !== "done").length,
    blockedItems: openWorkItems.filter((w) => w.status === "blocked").length,
    highRiskItems: openWorkItems.filter((w) => w.sdlcSignals.risk >= 70).length,
    stabilityScore: sdlcBundle.heuristics.stabilityScore,
    roadmap: workRoadmap,
    progress: workProgress
  });
  const workSlaDrift = detectWorkSlaDrift(workProgress, workGovernance, sdlcBundle);
  const workImpact = analyzeWorkImpact(workItem, workGraph, sdlcBundle);
  const workPlanV3 = multiMatch.length > 1
    ? buildWorkPlanV3({
        workItems: multiMatch,
        graph: workGraph,
        schedule: workSchedule,
        insights: sdlcBundle
      })
    : null;
  const shouldUseV4 =
    workImpact.riskPropagation >= 70 ||
    workSlaDrift.severity === "severe" ||
    workSlaDrift.severity === "critical" ||
    sdlcBundle.risk.project.class === "critical";
  const workPlanV4 = shouldUseV4
    ? buildWorkPlanV4({
        workItem,
        impact: workImpact,
        slaDrift: workSlaDrift,
        governance: workGovernance,
        insights: sdlcBundle
      })
    : null;
  const multiGoalCandidates = hasMultiGoalIntent
    ? openWorkItems.filter((w) => w.status === "todo" || w.status === "in_progress")
    : [];
  const multiGoalPlan = hasMultiGoalIntent && multiGoalCandidates.length > 0
    ? buildMultiGoalPlan({
        goals: detectedGoals,
        workItems: multiGoalCandidates,
        graph: workGraph,
        schedule: workSchedule,
        insights: sdlcBundle
      })
    : null;
  const v2MappedPlan = mapWorkPlanV2ToV1(workPlanV2);
  const v3MappedPlan = workPlanV3 ? mapWorkPlanV3ToV1(workPlanV3) : null;
  const multiGoalMappedPlan = multiGoalPlan ? mapMultiGoalPlanToV1(multiGoalPlan) : null;
  const v4MappedPlan = workPlanV4 ? mapWorkPlanV4ToV1(workPlanV4) : null;

  if (!skia.getStatus().enabled) {
    await emitPlannerRun("failure", "SKIA-FULL disabled");
    return {
      status: 503,
      body: {
        error: "SKIA-FULL adapter is disabled; planner requires /api/skia/chat.",
        context: {
          path: ctx.path,
          maxTokens: ctx.maxTokens,
          usedTokensEstimate: ctx.usedTokensEstimate,
          semanticQuery: ctx.semanticQuery
        },
        plan: multiGoalPlan
          ? multiGoalMappedPlan
          : workPlanV4
            ? v4MappedPlan
            : workPlanV3
              ? v3MappedPlan
              : existingForPath
                ? v2MappedPlan
                : null,
        ...(existingForPath ? { workPlanV2, workItemId: workItem.id, workPriority, workBreakdown } : {}),
        ...(workPlanV3 ? { workPlanV3, workGraph, workSchedule, workDashboard } : {}),
        ...(multiGoalPlan ? { multiGoalPlan } : {}),
        ...(workPlanV4 ? { workPlanV4, workImpact, workSlaDrift } : {}),
        workRoadmap,
        workProgress,
        workGovernance
      }
    };
  }

  const rulesContext = buildRulesContextSummary(
    skiarulesContext?.getSkiarulesConfig() ?? null
  );
  const sdlcRulesContext = ctx.sdlcInsights
    ? `SDLC health=${ctx.sdlcInsights.healthScore ?? "n/a"} risk=${ctx.sdlcInsights.riskScore ?? "n/a"} stability=${ctx.sdlcInsights.stabilityScore ?? "n/a"} drift=${JSON.stringify(ctx.sdlcInsights.drift ?? null)} riskClass=${JSON.stringify(ctx.sdlcInsights.risk ?? null)} forecast=${JSON.stringify(ctx.sdlcInsights.forecast ?? null)}`
    : "";
  const graphRulesContext = `workGraph nodes=${workGraph.nodes.length} edges=${workGraph.edges.length} cycles=${workGraph.cycles.length} criticalPath=${workGraph.criticalPath.length}`;
  const progressRulesContext = `workProgress completion=${workProgress.project.completionPercent}% trend=${workProgress.project.estimatedCompletionTrend}`;
  const governanceRulesContext = `workGovernance violations=${workGovernance.violations.length} warnings=${workGovernance.warnings.length}`;
  const roadmapRulesContext = `workRoadmap phases=${workRoadmap.phases.length} phaseOrder=${workRoadmap.global.suggestedPhaseOrder.join(",")}`;
  const slaRulesContext = `workSlaDrift severity=${workSlaDrift.severity} completionGap=${workSlaDrift.signals.completionGap} stabilityGap=${workSlaDrift.signals.stabilityGap}`;
  const impactRulesContext = `workImpact riskPropagation=${workImpact.riskPropagation} driftPropagation=${workImpact.driftPropagation} regressionImpact=${workImpact.forecastedRegressionImpact}`;
  const combinedRulesContext = [
    rulesContext,
    sdlcRulesContext,
    graphRulesContext,
    progressRulesContext,
    governanceRulesContext,
    roadmapRulesContext,
    slaRulesContext,
    impactRulesContext,
    internalOptions?.autoMode
      ? `autoMode=true autoSessionId=${internalOptions.autoSessionId ?? "none"} autoSelected=${autoSelection?.selected.length ?? 0}`
      : ""
  ].filter(Boolean).join(" ").trim() || null;
  const rulesBlock = rulesContext
    ? `\n\n.skiarules (relevant project rules for planning):\n${rulesContext}\n`
    : "";
  const sdlcRulesBlock = ctx.sdlcInsights
    ? `\n\nSDLC planning context:\n${JSON.stringify({
        healthScore: ctx.sdlcInsights.healthScore ?? null,
        riskScore: ctx.sdlcInsights.riskScore ?? null,
        stabilityScore: ctx.sdlcInsights.stabilityScore ?? null,
        hotspotFiles: Array.isArray(ctx.sdlcInsights.hotspotFiles) ? ctx.sdlcInsights.hotspotFiles.slice(0, 5) : [],
        patterns: ctx.sdlcInsights.patterns ?? null,
        recommendations: ctx.sdlcInsights.recommendations ?? null
      })}\n`
    : "";
  const scheduleBlock = `\n\nWork scheduling:\n${JSON.stringify({
    graph: {
      nodes: workGraph.nodes.length,
      edges: workGraph.edges.length,
      cycles: workGraph.cycles,
      criticalPath: workGraph.criticalPath
    },
    schedule: workSchedule
  })}\n`;
  const roadmapBlock = `\n\nWork roadmap/progress/governance:\n${JSON.stringify({
    roadmap: {
      phases: workRoadmap.phases,
      global: workRoadmap.global
    },
    progress: workProgress.project,
    governance: workGovernance
  })}\n`;
  const impactBlock = `\n\nWork impact + SLA drift:\n${JSON.stringify({
    impact: workImpact,
    slaDrift: workSlaDrift
  })}\n`;
  const orchestrationBlock = `\n\nWork orchestration dashboard:\n${JSON.stringify(workDashboard.orchestrationDashboard)}\n`;
  const autoBlock = internalOptions?.autoMode
    ? `\n\nAutonomous selection/session context:\n${JSON.stringify({
        autoMode: true,
        autoSessionId: internalOptions.autoSessionId ?? null,
        autoSelection: autoSelection ?? internalOptions.autoSelection ?? null
      })}\n`
    : "";
  const sdlcInsightsBlock = ctx.sdlcInsights
    ? `\n\nSDLC insights (D2):\n${JSON.stringify(ctx.sdlcInsights)}\n`
    : "";
  const workBlock = `\n\nWork item context:\n${JSON.stringify({
    workItem,
    workBreakdown,
    workPriority,
    workPlanV2
  })}\n`;
  const userMessage = `Goal:\n${goal}\n\nContext bundle (D1-07, compressed, token-limited):\n${ctx.compressed}\n${rulesBlock}${sdlcRulesBlock}${sdlcInsightsBlock}${scheduleBlock}${roadmapBlock}${impactBlock}${orchestrationBlock}${autoBlock}${workBlock}\nProduce the JSON plan now.`;
  const message = `${SYSTEM_PREFIX}\n\n${userMessage}`;

  let upstream: Record<string, unknown> = {};
  let rawText: string;
  let plan: AgentTaskPlanV1 | null = null;
  let parseError: string | undefined;
  if (multiGoalPlan) {
    plan = multiGoalMappedPlan;
    rawText = JSON.stringify(multiGoalPlan);
  } else if (workPlanV4) {
    plan = v4MappedPlan;
    rawText = JSON.stringify(workPlanV4);
  } else if (workPlanV3) {
    plan = v3MappedPlan;
    rawText = JSON.stringify(workPlanV3);
  } else if (existingForPath) {
    plan = v2MappedPlan;
    rawText = JSON.stringify(workPlanV2);
  } else {
    try {
      upstream = await skia.intelligence(message, "agent", passthroughHeaders);
    } catch (e) {
      await emitPlannerRun("failure", e instanceof Error ? e.message : "Planner chat call failed");
      return {
        status: 502,
        body: {
          error: e instanceof Error ? e.message : "Planner chat call failed",
          context: {
            path: ctx.path,
            usedTokensEstimate: ctx.usedTokensEstimate,
            semanticQuery: ctx.semanticQuery
          },
          plan: null
        }
      };
    }
    rawText = extractTextFromSkiaChatResponse(upstream);
    const jsonSlice = extractJsonObjectString(rawText);
    if (jsonSlice) {
      try {
        const parsed: unknown = JSON.parse(jsonSlice);
        const v = agentTaskPlanV1Schema.safeParse(parsed);
        if (v.success) {
          plan = { ...v.data, version: "1" as const };
        } else {
          parseError = v.error.message;
        }
      } catch (e) {
        parseError = e instanceof Error ? e.message : "json parse";
      }
    } else {
      parseError = "Model response did not contain a JSON object.";
    }
  }

  const retBody = retrieval.body as {
    vectorSearchMeta?: Record<string, unknown>;
    lspSkiarules?: unknown;
    diagnostics?: unknown;
    rulesContext?: string | null;
    retrievalWarnings?: unknown;
  };
  const contextRetrievalMeta = {
    usedTokensEstimate: ctx.usedTokensEstimate,
    maxTokens: ctx.maxTokens,
    semanticQuery: ctx.semanticQuery,
    vectorSearchMeta: ctx.vectorSearchMeta,
    sdlcInsights: ctx.sdlcInsights ?? null,
    workPriority: workPriority,
    workBreakdown: workBreakdown
  };
  const governanceWarning = plan ? warnPlannerStepCount(plan) : null;
  const diag = retBody.diagnostics ?? retBody.lspSkiarules ?? null;
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "agent.planner.call",
    parameters: mergeForgeAuditParamsV1("agent_planner", {
      path: ctx.path,
      rulesContext: combinedRulesContext as string | null,
      contextRetrievalMeta: { ...contextRetrievalMeta, retrievalWarnings: retBody.retrievalWarnings ?? null },
      vectorSearchMeta: ctx.vectorSearchMeta ?? null,
      lspSkiarules: retBody.lspSkiarules ?? null,
      diagnostics: diag,
      governance: governanceWarning ? { warning: governanceWarning } : null,
      priorityDecision: workPriority,
      workGraph: {
        nodes: workGraph.nodes.length,
        edges: workGraph.edges.length,
        cycles: workGraph.cycles,
        criticalPath: workGraph.criticalPath,
        governanceWarnings: workGraph.governanceWarnings
      },
      workSchedule,
      multiGoalSummary: multiGoalPlan
        ? {
            goalCount: multiGoalPlan.goals.length,
            sharedTaskCount: multiGoalPlan.sharedTasks.length
          }
        : null,
      roadmapSummary: {
        phaseCount: workRoadmap.phases.length,
        suggestedPhaseOrder: workRoadmap.global.suggestedPhaseOrder,
        criticalPathItems: workRoadmap.global.criticalPathItems
      },
      workProgress: workProgress.project,
      workGovernance,
      workSlaDrift,
      impactSummary: {
        riskPropagation: workImpact.riskPropagation,
        driftPropagation: workImpact.driftPropagation,
        forecastedRegressionImpact: workImpact.forecastedRegressionImpact
      },
      workPlanVersion: multiGoalPlan ? "multi-goal" : workPlanV4 ? "4" : workPlanV3 ? "3" : existingForPath ? "2" : "1",
      autoMode: internalOptions?.autoMode === true,
      autoSessionId: internalOptions?.autoSessionId ?? null,
      sdlcDrift: ctx.sdlcInsights?.drift ?? null,
      sdlcRisk: ctx.sdlcInsights?.risk ?? null,
      sdlcForecast: ctx.sdlcInsights?.forecast ?? null,
      retrievalWarnings: (retBody.retrievalWarnings as unknown) ?? null
    }),
    result: plan && !parseError ? "success" : "failure",
    details: parseError
  });
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "work.slaDrift",
    parameters: mergeForgeAuditParamsV1("work_sla_drift", {
      path: ctx.path,
      autoSessionId: internalOptions?.autoSessionId ?? null,
      severity: workSlaDrift.severity,
      signals: workSlaDrift.signals,
      notes: workSlaDrift.notes,
      recommendedActions: workSlaDrift.recommendedActions
    }),
    result: workSlaDrift.severity === "none" || workSlaDrift.severity === "mild" ? "success" : "failure"
  });
  await emitPlannerRun(plan && !parseError ? "success" : "failure", parseError);

  return {
    status: 200,
    body: {
      version: "agent-plan-v1" as const,
      goal,
      path: ctx.path,
      context: {
        maxTokens: ctx.maxTokens,
        usedTokensEstimate: ctx.usedTokensEstimate,
        semanticQuery: ctx.semanticQuery,
        layers: ctx.layers,
        contextRetrievalMeta,
        ...(ctx.sdlcInsights ? { sdlcInsights: ctx.sdlcInsights } : {})
      },
      workItem: { id: workItem.id, title: workItem.title, status: workItem.status, priority: workItem.priority },
      workBreakdown,
      workPriority,
      workPlanV2,
      ...(workPlanV3 ? { workPlanV3, workGraph, workSchedule } : {}),
      ...(workPlanV4 ? { workPlanV4, workImpact, workSlaDrift } : {}),
      ...(multiGoalPlan ? { multiGoalPlan } : {}),
      workRoadmap,
      workProgress,
      workGovernance,
      workDashboard,
      ...(internalOptions?.autoMode ? { autoMode: true, autoSelection, autoSessionId: internalOptions.autoSessionId ?? null } : {}),
      plan,
      parseError,
      upstream,
      modelText: rawText,
      ...(governanceWarning ? { governanceWarning } : {})
    }
  };
}
