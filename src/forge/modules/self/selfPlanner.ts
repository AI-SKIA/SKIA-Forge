import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";
import type { AutoMemoryEventV1 } from "../auto/autoMemory.js";
import type { SelfImprovementInsightsV1 } from "./selfInsights.js";

export type SelfImprovementPlanV1 = {
  strategyImprovements: string[];
  structuralImprovements: string[];
  metaTasks: string[];
  rationale: string[];
};

export function buildSelfImprovementPlan(
  selfInsights: SelfImprovementInsightsV1,
  autoMemory: AutoMemoryEventV1[],
  sdlcInsights: SdlcInsightsBundleV2
): SelfImprovementPlanV1 {
  const plannerFailures = autoMemory.filter((m) => m.category === "planner_pattern" && m.outcome === "failure").length;
  const strategyImprovements = [
    ...(plannerFailures > 2 ? ["planner strategy: bias to safer fallback path earlier"] : []),
    ...(selfInsights.metaEfficiencyScore < 65 ? ["correction strategy: lower correction budget for unstable cycles"] : []),
    ...(sdlcInsights.drift.score >= 55 ? ["drift mitigation: raise priority to strict mode"] : []),
    ...(sdlcInsights.heuristics.stabilityScore < 70 ? ["stability mode: prefer stabilize-first sessions"] : []),
    ...(selfInsights.metaRiskScore > 65 ? ["selection weights: increase risk + drift weights"] : []),
    "governance thresholds: tighten for repeated critical loops",
    "SLA targets: use stricter threshold until drift declines"
  ];
  const structuralImprovements = [
    ...(selfInsights.weaknesses.some((w) => /drift/i.test(w)) ? ["refactor modules with repeated drift"] : []),
    ...(selfInsights.weaknesses.some((w) => /regression/i.test(w)) ? ["stabilize tests with repeated regressions"] : []),
    "reduce dependency cycles",
    "reduce hotspot churn"
  ];
  const metaTasks = [
    "improve embedding quality",
    "improve chunking strategy",
    "improve file classification",
    "improve WorkItem tagging"
  ];
  return {
    strategyImprovements,
    structuralImprovements,
    metaTasks,
    rationale: [
      `metaStability=${selfInsights.metaStabilityScore}`,
      `metaRisk=${selfInsights.metaRiskScore}`,
      `metaEfficiency=${selfInsights.metaEfficiencyScore}`
    ]
  };
}
