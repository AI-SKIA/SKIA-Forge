import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import type { GlobalStateSnapshotV1 } from "./globalState.js";
import type { GlobalEvolutionPolicyV1 } from "./globalEvolutionPolicy.js";

export type GlobalHealthSurfaceV1 = {
  globalEvolutionScore: number;
  healthCategory: "excellent" | "good" | "fair" | "poor" | "critical";
  driverScores: {
    heuristicAlignmentScore: number;
    strategyAlignmentScore: number;
    architectureAlignmentScore: number;
    governanceAlignmentScore: number;
  };
  keyRisks: {
    globalOverfittingRisk: boolean;
    globalUnderAdaptationRisk: boolean;
    globalInstabilityRisk: boolean;
    globalFragmentationRisk: boolean;
  };
  currentEvolutionPhase: GlobalEvolutionPolicyV1["evolutionPhase"];
  topRecommendedOperatorActions: string[];
};

export async function buildGlobalHealthSurface(
  projectRoots: string[],
  globalStateSnapshot: GlobalStateSnapshotV1,
  globalEvolutionPolicy: GlobalEvolutionPolicyV1
): Promise<GlobalHealthSurfaceV1> {
  const ev = globalStateSnapshot.latestGlobalEvolutionHealth;
  const out: GlobalHealthSurfaceV1 = {
    globalEvolutionScore: ev?.globalEvolutionScore ?? 50,
    healthCategory: ev?.healthCategory ?? "fair",
    driverScores: {
      heuristicAlignmentScore: ev?.heuristicAlignmentScore ?? 50,
      strategyAlignmentScore: ev?.strategyAlignmentScore ?? 50,
      architectureAlignmentScore: ev?.architectureAlignmentScore ?? 50,
      governanceAlignmentScore: ev?.governanceAlignmentScore ?? 50
    },
    keyRisks: {
      globalOverfittingRisk: ev?.globalOverfittingRisk ?? false,
      globalUnderAdaptationRisk: ev?.globalUnderAdaptationRisk ?? false,
      globalInstabilityRisk: ev?.globalInstabilityRisk ?? false,
      globalFragmentationRisk: ev?.globalFragmentationRisk ?? false
    },
    currentEvolutionPhase: globalEvolutionPolicy.evolutionPhase,
    topRecommendedOperatorActions: [
      ...globalEvolutionPolicy.recommendedGlobalFocus,
      ...(globalEvolutionPolicy.blockedGlobalChanges.includes("heuristics")
        ? ["pause global heuristic tuning until convergence improves"]
        : []),
      ...(globalEvolutionPolicy.blockedGlobalChanges.includes("strategy")
        ? ["limit strategy churn; favor baseline profiles"]
        : [])
    ].slice(0, 8)
  };
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.health.surface",
    parameters: mergeForgeAuditParamsV1("global_health_surface", out),
    result: "success"
  });
  return out;
}
