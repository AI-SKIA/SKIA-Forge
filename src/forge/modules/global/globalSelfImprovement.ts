import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { getSelfImprovementStateSnapshot } from "../self/selfState.js";
import type { GlobalContextGraphV1 } from "./globalContextGraph.js";
import type { GlobalDashboardV1 } from "./globalDashboard.js";
import { getLatestGlobalStrategyEvolutionV1, type GlobalStrategyEvolutionV1 } from "./globalStrategyEvolution.js";
import { analyzeGlobalHeuristicConvergence, type GlobalHeuristicConvergenceV1 } from "./globalHeuristicConvergence.js";
import { getLatestGlobalMetaOptimizationV1 } from "./globalMetaOptimizer.js";

export type GlobalSelfImprovementResultV1 = {
  globalMetaStability: number;
  globalMetaRisk: number;
  globalMetaEfficiency: number;
  globalArchitectureImprovement: number;
  globalSelfImprovementPlan: {
    crossRepoHeuristicAlignment: string[];
    crossRepoStrategyHarmonization: string[];
    crossRepoArchitecturePriorities: string[];
    globalMetaTasks: string[];
  };
  strategyEvolution: GlobalStrategyEvolutionV1 | null;
  globalHeuristicConvergence: GlobalHeuristicConvergenceV1;
  updatedGlobalGuardrails?: {
    maxHeuristicChangeRate: number;
    maxStrategyChangeRate: number;
    allowedGlobalChanges: Array<"heuristics" | "strategy" | "architecture">;
    blockedGlobalChanges: Array<"heuristics" | "strategy" | "architecture">;
  };
};

let latestGlobalSelfImprovementResult: GlobalSelfImprovementResultV1 | null = null;

export function getLatestGlobalSelfImprovementV1(): GlobalSelfImprovementResultV1 | null {
  return latestGlobalSelfImprovementResult;
}

export async function runGlobalSelfImprovement(
  projectRoots: string[],
  options?: { globalContextGraph?: GlobalContextGraphV1; globalDashboard?: GlobalDashboardV1 }
): Promise<GlobalSelfImprovementResultV1> {
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.selfImprovement.start",
    parameters: mergeForgeAuditParamsV1("global_self_improvement", { repoCount: projectRoots.length }),
    result: "success"
  });
  const snapshots = await Promise.all(projectRoots.map((root) => getSelfImprovementStateSnapshot(root)));
  const globalHeuristicConvergence = await analyzeGlobalHeuristicConvergence(projectRoots);
  const latestMetaOptimization = getLatestGlobalMetaOptimizationV1();
  const globalMetaStability = Number(
    (snapshots.reduce((s, x) => s + x.keyScores.metaStabilityScore, 0) / Math.max(1, snapshots.length)).toFixed(2)
  );
  const globalMetaRisk = Number(
    (snapshots.reduce((s, x) => s + x.keyScores.metaRiskScore, 0) / Math.max(1, snapshots.length)).toFixed(2)
  );
  const globalMetaEfficiency = Number(
    (snapshots.reduce((s, x) => s + x.keyScores.metaEfficiencyScore, 0) / Math.max(1, snapshots.length)).toFixed(2)
  );
  const globalArchitectureImprovement = Number(
    (
      snapshots.reduce((s, x) => s + (x.keyScores.architectureImprovementScore ?? 50), 0) /
      Math.max(1, snapshots.length)
    ).toFixed(2)
  );
  const crossRepoArchitecturePriorities =
    options?.globalContextGraph?.globalHotspotRanking.slice(0, 8).map((x) => x.path) ??
    snapshots.flatMap((x) => x.latestArchitectureAdvice?.persistentHotspots ?? []).slice(0, 8);
  const globalSelfImprovementPlan = {
    crossRepoHeuristicAlignment: [
      "normalize risk/drift thresholds across repos",
      "standardize hotspot scoring calibration"
    ],
    crossRepoStrategyHarmonization: [
      "align stabilize-first triggers for high drift repos",
      "align correction budget policy by risk class"
    ],
    crossRepoArchitecturePriorities,
    globalMetaTasks: [
      "global embedding refresh",
      "global chunking alignment",
      "cross-repo tagging normalization",
      "cross-repo work item classification normalization"
    ]
  };
  if (latestMetaOptimization?.updatedGlobalGuardrails.blockedGlobalChanges.includes("heuristics")) {
    globalSelfImprovementPlan.globalMetaTasks = globalSelfImprovementPlan.globalMetaTasks.filter(
      (x) => !/chunking|tagging/i.test(x)
    );
  }
  const strategyEvolution = getLatestGlobalStrategyEvolutionV1();
  const out: GlobalSelfImprovementResultV1 = {
    globalMetaStability,
    globalMetaRisk,
    globalMetaEfficiency,
    globalArchitectureImprovement,
    globalSelfImprovementPlan,
    strategyEvolution,
    globalHeuristicConvergence,
    ...(latestMetaOptimization ? { updatedGlobalGuardrails: latestMetaOptimization.updatedGlobalGuardrails } : {})
  };
  latestGlobalSelfImprovementResult = out;
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.selfImprovement.tick",
    parameters: mergeForgeAuditParamsV1("global_self_improvement", {
      globalMetaStability,
      globalMetaRisk,
      globalMetaEfficiency,
      globalArchitectureImprovement,
      globalHeuristicConvergenceScore: globalHeuristicConvergence.globalConvergenceScore,
      globalMetaTaskCount: globalSelfImprovementPlan.globalMetaTasks.length
    }),
    result: "success"
  });
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.selfImprovement.complete",
    parameters: mergeForgeAuditParamsV1("global_self_improvement", {
      status: "completed",
      strategyEvolutionPresent: Boolean(strategyEvolution)
    }),
    result: "success"
  });
  return out;
}
