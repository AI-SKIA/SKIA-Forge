import { queryWorkItems } from "./workItemModel.js";
import { buildWorkGraph } from "./workGraph.js";
import { buildWorkSchedule } from "./workScheduler.js";
import { buildSdlcInsightsBundle } from "../sdlc/sdlcInsights.js";
import { buildWorkRoadmap, type WorkRoadmapV1 } from "./workRoadmap.js";
import { buildWorkProgress, type WorkProgressV1 } from "./workProgress.js";
import { evaluateWorkGovernance, type WorkGovernanceStatusV1 } from "./workGovernance.js";
import { detectWorkSlaDrift, type WorkSlaDriftV1 } from "./workSlaDrift.js";
import { analyzeWorkImpact, type WorkImpactV1 } from "./workImpact.js";
import type { SkiarulesConfig } from "../skiarules/skiarulesTypes.js";
import type { SelfArchitectureAdviceV1 } from "../self/selfArchitecture.js";
import { getPromotedArchitectureHintsV1 } from "../self/selfArchitecture.js";

export type WorkDashboardV1 = {
  items: Awaited<ReturnType<typeof queryWorkItems>>;
  graphSummary: {
    nodeCount: number;
    edgeCount: number;
    cycleCount: number;
    criticalPath: string[];
  };
  scheduleSummary: {
    orderedCount: number;
    batchCount: number;
    parallelGroupCount: number;
    rationale: string[];
  };
  sdlcSummary: {
    healthScore: number;
    riskClass: string;
    driftScore: number;
    forecastFailureProbability: number;
    hotspots: string[];
  };
  blockedItems: string[];
  criticalPath: string[];
  recommendedNextActions: string[];
  roadmap: WorkRoadmapV1;
  progress: WorkProgressV1;
  governance: WorkGovernanceStatusV1;
  slaDrift: WorkSlaDriftV1;
  impactSummaries: Array<{ workItemId: string; impact: WorkImpactV1 }>;
  orchestrationDashboard: WorkOrchestrationDashboardV1;
  recommendedNextWorkItems: Array<{ workItemId: string; score: number; rationale: string[] }>;
  architectureAdvice: SelfArchitectureAdviceV1;
};

export type WorkOrchestrationDashboardV1 = {
  roadmap: WorkRoadmapV1;
  progress: WorkProgressV1;
  governance: WorkGovernanceStatusV1;
  slaDrift: WorkSlaDriftV1;
  impactSummaries: Array<{ workItemId: string; impact: WorkImpactV1 }>;
  riskDriftForecastSummary: {
    riskClass: string;
    driftScore: number;
    forecastFailureProbability: number;
  };
  criticalPath: string[];
  recommendedNextActions: string[];
  multiGoalGrouping: Array<{ group: string; workItemIds: string[] }>;
  phaseReadiness: Array<{ phaseId: string; ready: boolean; reason: string }>;
};

export async function buildWorkDashboard(
  projectRoot: string,
  scopePath?: string,
  skiarulesConfig?: SkiarulesConfig | null
): Promise<WorkDashboardV1> {
  const [items, graph, insights, progress] = await Promise.all([
    queryWorkItems(projectRoot, { limit: 500 }),
    buildWorkGraph(projectRoot),
    buildSdlcInsightsBundle(projectRoot, scopePath, skiarulesConfig ?? null),
    buildWorkProgress(projectRoot)
  ]);
  const schedule = buildWorkSchedule({
    graph,
    governanceLimits: { maxSteps: 20, maxWriteOps: 10, maxTerminalOps: 5 },
    forecast: {
      globalNextFailureProbability: insights.forecast.globalNextFailureProbability,
      nextAgentRollbackProbability: insights.forecast.nextAgentRollbackProbability
    }
  });
  const architectureAdvice: SelfArchitectureAdviceV1 = {
    persistentDriftModules: insights.recommendations.refactorFiles.slice(0, 8),
    persistentHotspots: insights.heuristics.hotspotFiles.map((x) => x.path).slice(0, 8),
    cycleNodes: [...new Set(graph.cycles.flat())].slice(0, 10),
    heavyDependencyNodes: graph.criticalPath.slice(0, 8),
    regressionModules: insights.patterns.recurringFailures
      .filter((x) => x.kind === "test_repeated_failure")
      .map((x) => x.key)
      .slice(0, 8),
    recommendations: [
      "prioritize boundary cleanup for persistent drift modules",
      "apply dependency inversion on cycle nodes",
      "stabilize repeated regression suites before expansion"
    ],
    stabilizeBeforeExpandZones: ["phase-1"]
  };
  const promotedArchitectureHints = getPromotedArchitectureHintsV1();
  const roadmap = buildWorkRoadmap({
    graph,
    schedule,
    insights,
    architectureOptimizationHints: [...promotedArchitectureHints, ...architectureAdvice.recommendations].slice(0, 8)
  });
  const governance = evaluateWorkGovernance({
    openP0Count: items.filter((w) => (w.priority === "P0" || w.priority === "P1") && w.status !== "done").length,
    blockedItems: items.filter((w) => w.status === "blocked").length,
    highRiskItems: items.filter((w) => w.sdlcSignals.risk >= 70).length,
    stabilityScore: insights.heuristics.stabilityScore,
    roadmap,
    progress
  });
  const slaDrift = detectWorkSlaDrift(progress, governance, insights);
  const impactSummaries = items.slice(0, 25).map((w) => ({
    workItemId: w.id,
    impact: analyzeWorkImpact(w, graph, insights)
  }));
  const roadmapSummary = `phases=${roadmap.phases.length} criticalPath=${roadmap.global.criticalPathItems.length} blocked=${roadmap.global.blockedItems.length}`;
  const orchestrationDashboard: WorkOrchestrationDashboardV1 = {
    roadmap,
    progress,
    governance,
    slaDrift,
    impactSummaries,
    riskDriftForecastSummary: {
      riskClass: insights.risk.project.class,
      driftScore: insights.drift.score,
      forecastFailureProbability: insights.forecast.globalNextFailureProbability
    },
    criticalPath: graph.criticalPath,
    recommendedNextActions: [
      ...slaDrift.recommendedActions,
      ...governance.warnings,
      ...insights.recommendations.agentGuardrails
    ].slice(0, 12),
    multiGoalGrouping: [
      { group: "stabilization", workItemIds: items.filter((w) => w.type === "test" || w.type === "bug").map((w) => w.id) },
      { group: "expansion", workItemIds: items.filter((w) => w.type === "feature" || w.type === "refactor").map((w) => w.id) }
    ],
    phaseReadiness: roadmap.phases.map((p) => ({
      phaseId: p.id,
      ready: slaDrift.severity === "none" || slaDrift.severity === "mild" || p.id === "phase-1",
      reason: slaDrift.severity === "severe" || slaDrift.severity === "critical"
        ? "SLA drift high; stabilize before later phases."
        : "Phase can proceed with current governance posture."
    }))
  };
  return {
    items,
    graphSummary: {
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      cycleCount: graph.cycles.length,
      criticalPath: graph.criticalPath
    },
    scheduleSummary: {
      orderedCount: schedule.orderedWorkItemIds.length,
      batchCount: schedule.recommendedBatches.length,
      parallelGroupCount: schedule.parallelGroups.length,
      rationale: schedule.rationale
    },
    sdlcSummary: {
      healthScore: insights.healthScore,
      riskClass: insights.risk.project.class,
      driftScore: insights.drift.score,
      forecastFailureProbability: insights.forecast.globalNextFailureProbability,
      hotspots: insights.heuristics.hotspotFiles.slice(0, 8).map((x) => x.path)
    },
    blockedItems: items.filter((w) => w.status === "blocked").map((w) => w.id),
    criticalPath: graph.criticalPath,
    recommendedNextActions: [
      ...schedule.sequencing,
      `Roadmap summary: ${roadmapSummary}`,
      ...slaDrift.recommendedActions,
      ...governance.warnings,
      ...insights.recommendations.agentGuardrails,
      ...promotedArchitectureHints.map((x) => `Promoted architecture hint: ${x}`),
      ...insights.recommendations.refactorFiles.slice(0, 3).map((f) => `Refactor ${f}`)
    ].slice(0, 12),
    roadmap,
    progress,
    governance,
    slaDrift,
    impactSummaries,
    orchestrationDashboard,
    architectureAdvice,
    recommendedNextWorkItems: items
      .filter((w) => w.status !== "done")
      .map((w) => ({
        workItemId: w.id,
        score: Math.round(w.sdlcSignals.risk * 0.5 + w.sdlcSignals.drift * 0.3 + w.sdlcSignals.forecast * 0.2),
        rationale: [
          `risk=${w.sdlcSignals.risk}`,
          `drift=${w.sdlcSignals.drift}`,
          graph.criticalPath.includes(w.id) ? "critical path" : "non-critical path"
        ]
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
  };
}
