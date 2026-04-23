import type { SelfImprovementStateSnapshotV1 } from "./selfState.js";
import type { SelfEvolutionPolicyV1 } from "./selfEvolutionPolicy.js";

export type SelfImprovementHealthV1 = {
  globalSelfImprovementScore: number;
  healthCategory: "excellent" | "good" | "fair" | "poor" | "critical";
  keyDrivers: {
    heuristicHealthScore: number;
    strategyHealthScore: number;
    architectureHealthScore: number;
    metaOptimizationHealthScore: number;
  };
  flags: {
    overfittingRisk: boolean;
    underAdaptationRisk: boolean;
    instabilityRisk: boolean;
    architectureNeglectRisk: boolean;
  };
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computeSelfImprovementHealth(
  _projectRoot: string,
  selfStateSnapshot: SelfImprovementStateSnapshotV1,
  evolutionPolicy: SelfEvolutionPolicyV1
): SelfImprovementHealthV1 {
  const heuristicHealthScore = clamp(
    selfStateSnapshot.latestHeuristicsConvergence.convergenceScore -
      selfStateSnapshot.latestHeuristicsConvergence.unstableDimensions.length * 4
  );
  const strategyHealthScore = clamp(
    Math.round(
      Object.values(selfStateSnapshot.latestStrategyConvergence.profileScores).reduce((a, b) => a + b, 0) /
        Math.max(1, Object.keys(selfStateSnapshot.latestStrategyConvergence.profileScores).length)
    ) - (selfStateSnapshot.latestStrategyConvergence.oscillationDetected ? 8 : 0)
  );
  const architectureHealthScore = clamp(
    (selfStateSnapshot.latestArchitectureEvolutionScore?.architectureImprovementScore ?? 50) -
      ((selfStateSnapshot.latestArchitectureEvolutionScore?.residualCycleScore ?? 0) > 50 ? 8 : 0)
  );
  const metaOptimizationHealthScore = clamp(
    (selfStateSnapshot.latestMetaOptimizationSummary?.heuristicConvergence.convergenceScore ?? heuristicHealthScore) * 0.4 +
      (selfStateSnapshot.latestMetaOptimizationSummary
        ? Math.round(
            Object.values(selfStateSnapshot.latestMetaOptimizationSummary.strategyConvergence.profileScores).reduce(
              (a, b) => a + b,
              0
            ) / 4
          )
        : strategyHealthScore) *
        0.35 +
      (selfStateSnapshot.latestMetaOptimizationSummary?.architectureEvolutionScore.architectureImprovementScore ??
        architectureHealthScore) *
        0.25
  );
  const globalSelfImprovementScore = clamp(
    heuristicHealthScore * 0.28 +
      strategyHealthScore * 0.28 +
      architectureHealthScore * 0.24 +
      metaOptimizationHealthScore * 0.2
  );
  const healthCategory: SelfImprovementHealthV1["healthCategory"] =
    globalSelfImprovementScore >= 85
      ? "excellent"
      : globalSelfImprovementScore >= 72
        ? "good"
        : globalSelfImprovementScore >= 58
          ? "fair"
          : globalSelfImprovementScore >= 40
            ? "poor"
            : "critical";
  return {
    globalSelfImprovementScore,
    healthCategory,
    keyDrivers: {
      heuristicHealthScore,
      strategyHealthScore,
      architectureHealthScore,
      metaOptimizationHealthScore
    },
    flags: {
      overfittingRisk:
        evolutionPolicy.evolutionPhase === "stabilize" &&
        selfStateSnapshot.latestHeuristicsConvergence.stableDimensions.length >= 6 &&
        strategyHealthScore < 60,
      underAdaptationRisk:
        evolutionPolicy.blockedChanges.length >= 2 && selfStateSnapshot.keyScores.metaRiskScore > 60,
      instabilityRisk:
        selfStateSnapshot.latestHeuristicsConvergence.unstableDimensions.length >= 4 ||
        selfStateSnapshot.latestStrategyConvergence.oscillationDetected,
      architectureNeglectRisk:
        architectureHealthScore < 55 &&
        (selfStateSnapshot.latestArchitectureAdvice?.recommendations.length ?? 0) === 0
    }
  };
}
