import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { queryAutoMemory } from "../auto/autoMemory.js";
import { analyzeGlobalHeuristicConvergence, type GlobalHeuristicConvergenceV1 } from "./globalHeuristicConvergence.js";
import { analyzeGlobalStrategyConvergence, type GlobalStrategyConvergenceV1 } from "./globalStrategyConvergence.js";
import { computeGlobalEvolutionHealth, type GlobalEvolutionHealthV1 } from "./globalEvolutionHealth.js";
import { getLatestGlobalStrategyEvolutionV1 } from "./globalStrategyEvolution.js";
import { getLatestGlobalSelfImprovementV1 } from "./globalSelfImprovement.js";
import { setLatestGlobalMetaOptimizationSummaryV1 } from "./globalState.js";
import { getGlobalStateSnapshot } from "./globalState.js";
import { computeGlobalEvolutionPolicy } from "./globalEvolutionPolicy.js";
import { evaluateGlobalPolicy } from "../safety/globalPolicyEngine.js";

export type GlobalMetaOptimizationResultV1 = {
  globalMetaOptimizationSummary: {
    globalHeuristicConvergence: GlobalHeuristicConvergenceV1;
    globalStrategyConvergence: GlobalStrategyConvergenceV1;
    globalEvolutionHealth: GlobalEvolutionHealthV1;
  };
  recommendedGlobalMetaActions: string[];
  updatedGlobalGuardrails: {
    maxHeuristicChangeRate: number;
    maxStrategyChangeRate: number;
    allowedGlobalChanges: Array<"heuristics" | "strategy" | "architecture">;
    blockedGlobalChanges: Array<"heuristics" | "strategy" | "architecture">;
  };
};

let latestGlobalMetaOptimization: GlobalMetaOptimizationResultV1 | null = null;

export function getLatestGlobalMetaOptimizationV1(): GlobalMetaOptimizationResultV1 | null {
  return latestGlobalMetaOptimization;
}

export async function runGlobalMetaOptimization(
  projectRoots: string[],
  _options?: { allowAggressiveChanges?: boolean }
): Promise<GlobalMetaOptimizationResultV1> {
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.metaOptimization.start",
    parameters: mergeForgeAuditParamsV1("global_meta_optimization", { repoCount: projectRoots.length }),
    result: "success"
  });
  const globalHeuristicConvergence = await analyzeGlobalHeuristicConvergence(projectRoots);
  const strategyEvolution = getLatestGlobalStrategyEvolutionV1();
  const memoryRows = await Promise.all(projectRoots.map((r) => queryAutoMemory(r, { limit: 300 })));
  const outcomeHistory = memoryRows.flatMap((rows, i) =>
    rows
      .map((m) => ({
        projectRoot: projectRoots[i]!,
        overallOutcomeScore: Number((m.meta as { overallOutcomeScore?: number } | undefined)?.overallOutcomeScore ?? NaN),
        profileId: String((m.meta as { profileId?: string } | undefined)?.profileId ?? "")
      }))
      .filter((x) => Number.isFinite(x.overallOutcomeScore))
  );
  const globalStrategyConvergence = await analyzeGlobalStrategyConvergence(
    projectRoots,
    strategyEvolution?.globalStrategyProfiles ?? [],
    outcomeHistory
  );
  const globalSelfImprovement = getLatestGlobalSelfImprovementV1() ?? {
    globalMetaStability: 60,
    globalMetaRisk: 50,
    globalMetaEfficiency: 60,
    globalArchitectureImprovement: 55,
    globalSelfImprovementPlan: {
      crossRepoHeuristicAlignment: [],
      crossRepoStrategyHarmonization: [],
      crossRepoArchitecturePriorities: [],
      globalMetaTasks: []
    },
    strategyEvolution: null,
    globalHeuristicConvergence: {
      globalConvergenceScore: 55,
      oscillatingDimensions: [],
      convergedDimensions: [],
      divergentRepos: []
    }
  };
  const globalEvolutionHealth = await computeGlobalEvolutionHealth(
    projectRoots,
    globalHeuristicConvergence,
    globalStrategyConvergence,
    globalSelfImprovement
  );
  const recommendedGlobalMetaActions = [
    ...(globalHeuristicConvergence.convergedDimensions.length >= 4 ? ["freeze converged heuristic dimensions"] : []),
    ...(globalHeuristicConvergence.oscillatingDimensions.length > 0 ? ["dampen oscillating heuristic dimensions"] : []),
    ...(globalStrategyConvergence.recommendedGlobalProfileAdjustments.map((x) => `strategy:${x}`)),
    ...(globalEvolutionHealth.globalFragmentationRisk ? ["enforce cross-repo alignment policy"] : [])
  ];
  const blockedGlobalChanges: Array<"heuristics" | "strategy" | "architecture"> = [
    ...(globalEvolutionHealth.globalInstabilityRisk ? (["heuristics"] as const) : []),
    ...(globalEvolutionHealth.globalOverfittingRisk ? (["strategy"] as const) : [])
  ];
  const all: Array<"heuristics" | "strategy" | "architecture"> = ["heuristics", "strategy", "architecture"];
  const stateSnapshot = await getGlobalStateSnapshot(projectRoots);
  const evolutionPolicy = await computeGlobalEvolutionPolicy(projectRoots, stateSnapshot);
  const globalPolicy = await evaluateGlobalPolicy(projectRoots, stateSnapshot);
  const mergedBlocked = [...new Set([...blockedGlobalChanges, ...evolutionPolicy.blockedGlobalChanges])];
  if (globalPolicy.policyStatus === "blocked") {
    mergedBlocked.push("heuristics", "strategy");
  }
  const updatedGlobalGuardrails = {
    maxHeuristicChangeRate: Math.min(
      globalEvolutionHealth.globalInstabilityRisk ? 0.04 : 0.1,
      evolutionPolicy.guardrails.maxGlobalHeuristicChangeRate
    ),
    maxStrategyChangeRate: Math.min(
      globalEvolutionHealth.globalOverfittingRisk ? 0.06 : 0.14,
      evolutionPolicy.guardrails.maxGlobalStrategyChurn / 20
    ),
    allowedGlobalChanges: all.filter((x) => !mergedBlocked.includes(x)),
    blockedGlobalChanges: mergedBlocked
  };
  const out: GlobalMetaOptimizationResultV1 = {
    globalMetaOptimizationSummary: {
      globalHeuristicConvergence,
      globalStrategyConvergence,
      globalEvolutionHealth
    },
    recommendedGlobalMetaActions,
    updatedGlobalGuardrails
  };
  latestGlobalMetaOptimization = out;
  setLatestGlobalMetaOptimizationSummaryV1(out.globalMetaOptimizationSummary);
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.metaOptimization.tick",
    parameters: mergeForgeAuditParamsV1("global_meta_optimization", out),
    result: "success"
  });
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.metaOptimization.complete",
    parameters: mergeForgeAuditParamsV1("global_meta_optimization", {
      status: "completed",
      recommendedActions: out.recommendedGlobalMetaActions.length
    }),
    result: "success"
  });
  return out;
}
