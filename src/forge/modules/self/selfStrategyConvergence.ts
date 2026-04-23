import type { AutoMemoryEventV1 } from "../auto/autoMemory.js";

export type StrategyProfileIdV1 =
  | "stabilize_mode"
  | "explore_mode"
  | "aggressive_mode"
  | "conservative_mode";

export type SelfStrategyConvergenceV1 = {
  profileScores: Record<StrategyProfileIdV1, number>;
  recommendedProfileAdjustments: string[];
  mappingRefinements: string[];
  underperformingProfiles: StrategyProfileIdV1[];
  dominantProfiles: StrategyProfileIdV1[];
  oscillationDetected: boolean;
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function analyzeStrategyConvergence(
  _projectRoot: string,
  strategyProfiles: Array<{ id: StrategyProfileIdV1 }>,
  outcomeHistory: Array<{ profileId?: string; overallOutcomeScore: number; stateTag?: string }>,
  autoMemory: AutoMemoryEventV1[]
): SelfStrategyConvergenceV1 {
  const ids = strategyProfiles.map((p) => p.id);
  const profileScores: Record<StrategyProfileIdV1, number> = {
    stabilize_mode: 50,
    explore_mode: 50,
    aggressive_mode: 50,
    conservative_mode: 50
  };
  for (const id of ids) {
    const rows = outcomeHistory.filter((x) => x.profileId === id);
    if (rows.length > 0) {
      profileScores[id] = clamp(rows.reduce((s, x) => s + x.overallOutcomeScore, 0) / rows.length);
    }
  }
  const plannerFails = autoMemory.filter((m) => m.category === "planner_pattern" && m.outcome === "failure").length;
  const execFails = autoMemory.filter((m) => m.category === "executor_pattern" && m.outcome === "failure").length;
  if (plannerFails > execFails + 2) {
    profileScores.aggressive_mode = clamp(profileScores.aggressive_mode - 8);
  }
  const underperformingProfiles = (Object.entries(profileScores) as Array<[StrategyProfileIdV1, number]>)
    .filter(([, score]) => score < 45)
    .map(([id]) => id);
  const dominantProfiles = (Object.entries(profileScores) as Array<[StrategyProfileIdV1, number]>)
    .filter(([, score]) => score >= 65)
    .map(([id]) => id);
  const profileTrail = outcomeHistory
    .map((x) => x.profileId)
    .filter((x): x is StrategyProfileIdV1 => Boolean(x) && ids.includes(x as StrategyProfileIdV1));
  let profileFlips = 0;
  for (let i = 1; i < profileTrail.length; i++) {
    if (profileTrail[i] !== profileTrail[i - 1]) {
      profileFlips += 1;
    }
  }
  const recentOutcomes = outcomeHistory.slice(-6).map((x) => x.overallOutcomeScore);
  const trendDelta =
    recentOutcomes.length >= 2 ? (recentOutcomes[recentOutcomes.length - 1] ?? 0) - (recentOutcomes[0] ?? 0) : 0;
  const oscillationDetected = profileFlips >= 4 && trendDelta <= 2;
  const recommendedProfileAdjustments: string[] = [];
  if (underperformingProfiles.includes("aggressive_mode")) {
    recommendedProfileAdjustments.push("dampen aggressive_mode weights or merge with explore_mode");
  }
  if (underperformingProfiles.includes("conservative_mode") && dominantProfiles.includes("stabilize_mode")) {
    recommendedProfileAdjustments.push("retire conservative_mode in favor of stabilize_mode");
  }
  if (dominantProfiles.includes("explore_mode") && dominantProfiles.includes("stabilize_mode")) {
    recommendedProfileAdjustments.push("boost hybrid mapping between explore_mode and stabilize_mode");
  }
  if (oscillationDetected) {
    recommendedProfileAdjustments.push("freeze profile switching for short window until outcomes improve");
  }
  const mappingRefinements = [
    ...(dominantProfiles.includes("stabilize_mode")
      ? ["map severe SLA/drift states to stabilize_mode earlier"]
      : []),
    ...(dominantProfiles.includes("explore_mode")
      ? ["map medium-risk + stable states to explore_mode by default"]
      : []),
    ...(underperformingProfiles.includes("aggressive_mode")
      ? ["limit aggressive_mode to high-risk states with positive trend only"]
      : [])
  ];
  return {
    profileScores,
    recommendedProfileAdjustments,
    mappingRefinements,
    underperformingProfiles,
    dominantProfiles,
    oscillationDetected
  };
}
