import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import type { GlobalContextGraphV1 } from "./globalContextGraph.js";
import type { GlobalWorkPlanV1 } from "./globalPlanner.js";
import type { GlobalGovernanceV1 } from "./globalGovernance.js";
import { getSelfImprovementStateSnapshot } from "../self/selfState.js";
import { getLatestGlobalSelfImprovementV1 } from "./globalSelfImprovement.js";
import { getLatestGlobalMetaOptimizationV1 } from "./globalMetaOptimizer.js";
import { getGlobalStateSnapshot } from "./globalState.js";
import { computeGlobalEvolutionPolicy } from "./globalEvolutionPolicy.js";
import { buildGlobalHealthSurface, type GlobalHealthSurfaceV1 } from "./globalHealthSurface.js";
import { getOperatorControlStateV1 } from "../safety/operatorControls.js";

export type GlobalDashboardV1 = {
  globalRisk: number;
  globalDrift: number;
  globalHotspots: Array<{ path: string; score: number; repos: string[] }>;
  globalCriticalPath: string[];
  globalRecommendedActions: string[];
  perRepoSummaries: Array<{
    repo: string;
    risk: number;
    drift: number;
    health: number;
    hotspots: string[];
  }>;
  crossRepoDependencyMap: Array<{ from: string; to: string; reason: string }>;
  globalArchitectureSignals: string[];
  globalGovernanceStatus: GlobalGovernanceV1;
  globalSelfImprovementHealth: {
    averageMetaStability: number;
    averageMetaRisk: number;
    averageMetaEfficiency: number;
  };
  globalImprovementSignals?: {
    globalMetaStability: number;
    globalMetaRisk: number;
    globalMetaEfficiency: number;
    globalArchitectureImprovement: number;
  };
  globalEvolutionHealth?: {
    globalEvolutionScore: number;
    healthCategory: "excellent" | "good" | "fair" | "poor" | "critical";
    heuristicAlignmentScore: number;
    strategyAlignmentScore: number;
    architectureAlignmentScore: number;
    governanceAlignmentScore: number;
  };
  globalHealthSurface?: GlobalHealthSurfaceV1;
  operatorPanel?: ReturnType<typeof getOperatorControlStateV1>;
};
let latestGlobalDashboard: GlobalDashboardV1 | null = null;

export function getLatestGlobalDashboardV1(): GlobalDashboardV1 | null {
  return latestGlobalDashboard;
}

export async function buildGlobalDashboard(
  globalContextGraph: GlobalContextGraphV1,
  globalPlan: GlobalWorkPlanV1,
  globalGovernance: GlobalGovernanceV1
): Promise<GlobalDashboardV1> {
  const perRepoSummaries = globalContextGraph.repos.map((r) => ({
    repo: r.projectRoot,
    risk: r.sdlcInsights.heuristics.riskScore,
    drift: r.sdlcInsights.drift.score,
    health: r.sdlcInsights.healthScore,
    hotspots: r.sdlcInsights.heuristics.hotspotFiles.map((x) => x.path).slice(0, 6)
  }));
  const selfStates = await Promise.all(
    globalContextGraph.repos.map((r) => getSelfImprovementStateSnapshot(r.projectRoot))
  );
  const globalSelfImprovementHealth = {
    averageMetaStability: Number(
      (selfStates.reduce((s, x) => s + x.keyScores.metaStabilityScore, 0) / Math.max(1, selfStates.length)).toFixed(2)
    ),
    averageMetaRisk: Number(
      (selfStates.reduce((s, x) => s + x.keyScores.metaRiskScore, 0) / Math.max(1, selfStates.length)).toFixed(2)
    ),
    averageMetaEfficiency: Number(
      (selfStates.reduce((s, x) => s + x.keyScores.metaEfficiencyScore, 0) / Math.max(1, selfStates.length)).toFixed(2)
    )
  };
  const globalImprovement = getLatestGlobalSelfImprovementV1();
  const globalMetaOptimization = getLatestGlobalMetaOptimizationV1();
  const stateSnapshot = await getGlobalStateSnapshot(globalContextGraph.repos.map((r) => r.projectRoot));
  const evolutionPolicy = await computeGlobalEvolutionPolicy(
    globalContextGraph.repos.map((r) => r.projectRoot),
    stateSnapshot
  );
  const globalHealthSurface = await buildGlobalHealthSurface(
    globalContextGraph.repos.map((r) => r.projectRoot),
    stateSnapshot,
    evolutionPolicy
  );
  const out: GlobalDashboardV1 = {
    globalRisk: globalContextGraph.globalRiskPropagation,
    globalDrift: globalContextGraph.globalDriftPropagation,
    globalHotspots: globalContextGraph.globalHotspotRanking,
    globalCriticalPath: globalContextGraph.crossRepoCriticalPath,
    globalRecommendedActions: globalPlan.globalRecommendedActions,
    perRepoSummaries,
    crossRepoDependencyMap: globalContextGraph.edges.filter((e) => e.reason !== "intra_repo_dependency").slice(0, 200),
    globalArchitectureSignals: [
      ...globalContextGraph.repos.flatMap((r) => r.architectureHints),
      ...globalContextGraph.sharedModules.slice(0, 15).map((m) => `shared-module:${m}`)
    ].slice(0, 40),
    globalGovernanceStatus: globalGovernance,
    globalSelfImprovementHealth,
    ...(globalImprovement
      ? {
          globalImprovementSignals: {
            globalMetaStability: globalImprovement.globalMetaStability,
            globalMetaRisk: globalImprovement.globalMetaRisk,
            globalMetaEfficiency: globalImprovement.globalMetaEfficiency,
            globalArchitectureImprovement: globalImprovement.globalArchitectureImprovement
          }
        }
      : {}),
    ...(globalMetaOptimization
      ? {
          globalEvolutionHealth: globalMetaOptimization.globalMetaOptimizationSummary.globalEvolutionHealth
        }
      : {}),
    globalHealthSurface,
    operatorPanel: getOperatorControlStateV1()
  };
  latestGlobalDashboard = out;
  await appendAuditLog(globalContextGraph.repos[0]?.projectRoot ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.dashboard.build",
    parameters: mergeForgeAuditParamsV1("global_dashboard", {
      repoCount: perRepoSummaries.length,
      risk: out.globalRisk,
      drift: out.globalDrift,
      recommendedActions: out.globalRecommendedActions.length,
      governance: globalGovernance.governanceStatus
    }),
    result: "success"
  });
  return out;
}
