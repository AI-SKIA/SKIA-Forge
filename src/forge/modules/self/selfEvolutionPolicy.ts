import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";
import type { SelfImprovementStateSnapshotV1 } from "./selfState.js";

export type SelfEvolutionPolicyV1 = {
  evolutionPhase: "explore" | "exploit" | "stabilize";
  guardrails: {
    maxHeuristicChangeRate: number;
    maxStrategyProfileChurn: number;
    minHeuristicConvergenceScore: number;
    minStrategyConvergenceScore: number;
    architectureChangeAggressiveness: "low" | "medium" | "high";
  };
  allowedChanges: Array<"heuristics" | "strategy" | "architecture">;
  blockedChanges: Array<"heuristics" | "strategy" | "architecture">;
  recommendedFocus: string[];
};

export function computeEvolutionPolicy(
  _projectRoot: string,
  selfStateSnapshot: SelfImprovementStateSnapshotV1,
  sdlcInsights: SdlcInsightsBundleV2
): SelfEvolutionPolicyV1 {
  const heuristicConvergence = selfStateSnapshot.latestHeuristicsConvergence.convergenceScore;
  const strategyConvergence =
    Math.round(
      Object.values(selfStateSnapshot.latestStrategyConvergence.profileScores).reduce((a, b) => a + b, 0) /
        Math.max(1, Object.keys(selfStateSnapshot.latestStrategyConvergence.profileScores).length)
    ) ?? 50;
  const architectureScore = selfStateSnapshot.latestArchitectureEvolutionScore?.architectureImprovementScore ?? 50;
  const evolutionPhase: SelfEvolutionPolicyV1["evolutionPhase"] =
    heuristicConvergence >= 72 && strategyConvergence >= 68 && architectureScore >= 62
      ? "stabilize"
      : selfStateSnapshot.keyScores.metaEfficiencyScore >= 65
        ? "exploit"
        : "explore";
  const guardrails: SelfEvolutionPolicyV1["guardrails"] = {
    maxHeuristicChangeRate: evolutionPhase === "stabilize" ? 0.03 : evolutionPhase === "exploit" ? 0.07 : 0.12,
    maxStrategyProfileChurn: evolutionPhase === "stabilize" ? 1 : evolutionPhase === "exploit" ? 2 : 4,
    minHeuristicConvergenceScore: evolutionPhase === "stabilize" ? 70 : 55,
    minStrategyConvergenceScore: evolutionPhase === "stabilize" ? 65 : 50,
    architectureChangeAggressiveness:
      sdlcInsights.drift.score >= 65 || architectureScore < 50
        ? "high"
        : evolutionPhase === "stabilize"
          ? "low"
          : "medium"
  };
  const blockedChanges: SelfEvolutionPolicyV1["blockedChanges"] = [
    ...(evolutionPhase === "stabilize" ? (["heuristics"] as const) : []),
    ...(strategyConvergence < guardrails.minStrategyConvergenceScore ? (["strategy"] as const) : []),
    ...(guardrails.architectureChangeAggressiveness === "low" && architectureScore >= 70
      ? (["architecture"] as const)
      : [])
  ];
  const all: Array<"heuristics" | "strategy" | "architecture"> = ["heuristics", "strategy", "architecture"];
  const allowedChanges = all.filter((x) => !blockedChanges.includes(x));
  const recommendedFocus = [
    ...(heuristicConvergence < 60 ? ["stabilize heuristics"] : []),
    ...(strategyConvergence < 60 ? ["optimize strategy mapping"] : []),
    ...(architectureScore < 60 ? ["focus on architecture"] : [])
  ];
  return {
    evolutionPhase,
    guardrails,
    allowedChanges,
    blockedChanges,
    recommendedFocus: recommendedFocus.length > 0 ? recommendedFocus : ["maintain stable baseline"]
  };
}
