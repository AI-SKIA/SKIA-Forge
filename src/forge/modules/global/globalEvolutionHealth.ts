import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import type { GlobalHeuristicConvergenceV1 } from "./globalHeuristicConvergence.js";
import type { GlobalStrategyConvergenceV1 } from "./globalStrategyConvergence.js";
import type { GlobalSelfImprovementResultV1 } from "./globalSelfImprovement.js";

export type GlobalEvolutionHealthV1 = {
  globalEvolutionScore: number;
  healthCategory: "excellent" | "good" | "fair" | "poor" | "critical";
  heuristicAlignmentScore: number;
  strategyAlignmentScore: number;
  architectureAlignmentScore: number;
  governanceAlignmentScore: number;
  globalOverfittingRisk: boolean;
  globalUnderAdaptationRisk: boolean;
  globalInstabilityRisk: boolean;
  globalFragmentationRisk: boolean;
};
let latestGlobalEvolutionHealth: GlobalEvolutionHealthV1 | null = null;

export function getLatestGlobalEvolutionHealthV1(): GlobalEvolutionHealthV1 | null {
  return latestGlobalEvolutionHealth;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function computeGlobalEvolutionHealth(
  projectRoots: string[],
  globalHeuristicConvergence: GlobalHeuristicConvergenceV1,
  globalStrategyConvergence: GlobalStrategyConvergenceV1,
  globalSelfImprovementResult: GlobalSelfImprovementResultV1
): Promise<GlobalEvolutionHealthV1> {
  const heuristicAlignmentScore = globalHeuristicConvergence.globalConvergenceScore;
  const strategyAlignmentScore = clamp(
    Object.values(globalStrategyConvergence.globalProfileScores).reduce((a, b) => a + b, 0) / 4
  );
  const architectureAlignmentScore = clamp(globalSelfImprovementResult.globalArchitectureImprovement);
  const governanceAlignmentScore = clamp(
    100 -
      globalHeuristicConvergence.divergentRepos.length * 8 -
      globalStrategyConvergence.repoProfileExceptions.length * 6
  );
  const globalEvolutionScore = clamp(
    heuristicAlignmentScore * 0.3 +
      strategyAlignmentScore * 0.3 +
      architectureAlignmentScore * 0.2 +
      governanceAlignmentScore * 0.2
  );
  const healthCategory: GlobalEvolutionHealthV1["healthCategory"] =
    globalEvolutionScore >= 85
      ? "excellent"
      : globalEvolutionScore >= 70
        ? "good"
        : globalEvolutionScore >= 55
          ? "fair"
          : globalEvolutionScore >= 40
            ? "poor"
            : "critical";
  const out: GlobalEvolutionHealthV1 = {
    globalEvolutionScore,
    healthCategory,
    heuristicAlignmentScore,
    strategyAlignmentScore,
    architectureAlignmentScore,
    governanceAlignmentScore,
    globalOverfittingRisk:
      globalHeuristicConvergence.convergedDimensions.length >= 6 && strategyAlignmentScore < 60,
    globalUnderAdaptationRisk:
      globalSelfImprovementResult.globalMetaRisk > 65 && globalHeuristicConvergence.globalConvergenceScore > 75,
    globalInstabilityRisk:
      globalHeuristicConvergence.oscillatingDimensions.length >= 3 ||
      globalStrategyConvergence.recommendedGlobalProfileAdjustments.some((x) => /retire/i.test(x)),
    globalFragmentationRisk:
      globalHeuristicConvergence.divergentRepos.length >= Math.max(2, Math.floor(projectRoots.length / 2))
  };
  latestGlobalEvolutionHealth = out;
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.evolution.health",
    parameters: mergeForgeAuditParamsV1("global_evolution_health", out),
    result: healthCategory === "critical" ? "failure" : "success"
  });
  return out;
}
