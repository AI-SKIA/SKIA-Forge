import type { AutoMemoryEventV1 } from "../auto/autoMemory.js";
import type { AutoStrategyV1 } from "../auto/autoStrategy.js";
import type { SelfImprovementInsightsV1 } from "./selfInsights.js";
import { analyzeStrategyConvergence } from "./selfStrategyConvergence.js";

export type AutoStrategyProfileV1 = {
  id: "stabilize_mode" | "explore_mode" | "aggressive_mode" | "conservative_mode";
  plannerPreference: "v4" | "v3" | "v2";
  correctionBudget: number;
  mode: "risk_first" | "stability_first";
  selectionWeights: { risk: number; drift: number; forecast: number; stability: number };
};

export type SelfStrategyEvolutionV1 = {
  updatedStrategyProfiles: AutoStrategyProfileV1[];
  mappingRules: string[];
  recommendedDefaultProfile: AutoStrategyProfileV1["id"];
};

let evolvedProfiles: SelfStrategyEvolutionV1 | null = null;
const strategyEvolutionHistory: SelfStrategyEvolutionV1[] = [];
const baselineProfiles = new Set<AutoStrategyProfileV1["id"]>();

export function getEvolvedAutoStrategyProfilesV1(): SelfStrategyEvolutionV1 | null {
  return evolvedProfiles;
}

export function getSelfStrategyEvolutionHistoryV1(): SelfStrategyEvolutionV1[] {
  return [...strategyEvolutionHistory];
}

export function setBaselineStrategyProfilesV1(ids: Array<AutoStrategyProfileV1["id"]>): void {
  baselineProfiles.clear();
  for (const id of ids) baselineProfiles.add(id);
}

export function getBaselineStrategyProfilesV1(): Array<AutoStrategyProfileV1["id"]> {
  return [...baselineProfiles];
}

export function evolveAutoStrategy(
  projectRoot: string,
  currentStrategy: AutoStrategyV1,
  selfInsights: SelfImprovementInsightsV1,
  outcomeHistory: Array<{ overallOutcomeScore: number }>,
  memory: AutoMemoryEventV1[]
): SelfStrategyEvolutionV1 {
  const avgOutcome =
    outcomeHistory.length > 0
      ? outcomeHistory.reduce((s, x) => s + x.overallOutcomeScore, 0) / outcomeHistory.length
      : 50;
  const plannerV2Fail = memory.filter((m) => /planVersion=v2/i.test(m.details ?? "") && m.outcome === "failure").length;
  const plannerV3Success = memory.filter((m) => /planVersion=v3/i.test(m.details ?? "") && m.outcome === "success").length;
  const defaultProfile: SelfStrategyEvolutionV1["recommendedDefaultProfile"] =
    selfInsights.metaStabilityScore < 65 || avgOutcome < 60
      ? "conservative_mode"
      : selfInsights.metaRiskScore > 65
        ? "aggressive_mode"
        : "explore_mode";
  const profiles: AutoStrategyProfileV1[] = [
    {
      id: "stabilize_mode",
      plannerPreference: plannerV2Fail > 3 ? "v3" : "v4",
      correctionBudget: 2,
      mode: "stability_first",
      selectionWeights: { risk: 0.28, drift: 0.22, forecast: 0.15, stability: 0.35 }
    },
    {
      id: "explore_mode",
      plannerPreference: "v4",
      correctionBudget: 3,
      mode: "risk_first",
      selectionWeights: { risk: 0.4, drift: 0.22, forecast: 0.2, stability: 0.18 }
    },
    {
      id: "aggressive_mode",
      plannerPreference: plannerV3Success > 2 ? "v3" : "v4",
      correctionBudget: 3,
      mode: "risk_first",
      selectionWeights: { risk: 0.5, drift: 0.25, forecast: 0.2, stability: 0.05 }
    },
    {
      id: "conservative_mode",
      plannerPreference: "v2",
      correctionBudget: 1,
      mode: "stability_first",
      selectionWeights: { risk: 0.25, drift: 0.25, forecast: 0.15, stability: 0.35 }
    }
  ];
  const convergence = analyzeStrategyConvergence(projectRoot, profiles, outcomeHistory, memory);
  evolvedProfiles = {
    updatedStrategyProfiles: profiles,
    mappingRules: [
      "if metaStability < 65 or SLA severe => stabilize_mode/conservative_mode",
      "if metaRisk > 65 and outcome trend positive => aggressive_mode",
      "otherwise => explore_mode",
      ...convergence.mappingRefinements
    ],
    recommendedDefaultProfile:
      convergence.underperformingProfiles.includes(defaultProfile) && convergence.dominantProfiles.length > 0
        ? convergence.dominantProfiles[0]!
        : defaultProfile
  };
  strategyEvolutionHistory.push(evolvedProfiles);
  if (strategyEvolutionHistory.length > 100) {
    strategyEvolutionHistory.splice(0, strategyEvolutionHistory.length - 100);
  }
  return evolvedProfiles;
}
