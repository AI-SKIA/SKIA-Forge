import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import type { GlobalContextGraphV1 } from "./globalContextGraph.js";
import { analyzeGlobalStrategyConvergence } from "./globalStrategyConvergence.js";

export type GlobalStrategyProfileIdV1 =
  | "global_stabilize"
  | "global_explore"
  | "global_aggressive"
  | "global_conservative";

export type GlobalStrategyEvolutionV1 = {
  globalStrategyProfiles: Array<{
    id: GlobalStrategyProfileIdV1;
    mode: "risk_first" | "stability_first";
    correctionBudget: number;
    driftThreshold: number;
    riskThreshold: number;
  }>;
  repoSpecificStrategyDeltas: Array<{
    projectRoot: string;
    preferredProfile: GlobalStrategyProfileIdV1;
    correctionBudgetDelta: number;
    notes: string[];
  }>;
  crossRepoMappingRules: string[];
  recommendedDefaultProfile: GlobalStrategyProfileIdV1;
};

let latestGlobalStrategyEvolution: GlobalStrategyEvolutionV1 | null = null;

export function getLatestGlobalStrategyEvolutionV1(): GlobalStrategyEvolutionV1 | null {
  return latestGlobalStrategyEvolution;
}

export async function evolveGlobalStrategy(
  projectRoots: string[],
  globalSelfImprovementPlan: {
    crossRepoHeuristicAlignment: string[];
    crossRepoStrategyHarmonization: string[];
    crossRepoArchitecturePriorities: string[];
    globalMetaTasks: string[];
  },
  globalContextGraph: GlobalContextGraphV1,
  outcomeHistory: Array<{ projectRoot: string; overallOutcomeScore: number }>
): Promise<GlobalStrategyEvolutionV1> {
  const avgOutcome =
    outcomeHistory.reduce((s, x) => s + x.overallOutcomeScore, 0) / Math.max(1, outcomeHistory.length);
  const profiles: GlobalStrategyEvolutionV1["globalStrategyProfiles"] = [
    { id: "global_stabilize", mode: "stability_first", correctionBudget: 2, driftThreshold: 40, riskThreshold: 35 },
    { id: "global_explore", mode: "risk_first", correctionBudget: 3, driftThreshold: 55, riskThreshold: 50 },
    { id: "global_aggressive", mode: "risk_first", correctionBudget: 4, driftThreshold: 70, riskThreshold: 65 },
    { id: "global_conservative", mode: "stability_first", correctionBudget: 1, driftThreshold: 35, riskThreshold: 30 }
  ];
  const repoSpecificStrategyDeltas = globalContextGraph.repos.map((repo) => {
    const risk = repo.sdlcInsights.heuristics.riskScore;
    const drift = repo.sdlcInsights.drift.score;
    const preferredProfile: GlobalStrategyProfileIdV1 =
      risk > 70 || drift > 70
        ? "global_stabilize"
        : risk > 55
          ? "global_aggressive"
          : avgOutcome < 60
            ? "global_conservative"
            : "global_explore";
    return {
      projectRoot: repo.projectRoot,
      preferredProfile,
      correctionBudgetDelta: preferredProfile === "global_aggressive" ? 1 : preferredProfile === "global_conservative" ? -1 : 0,
      notes: [`risk=${risk}`, `drift=${drift}`]
    };
  });
  const recommendedDefaultProfile: GlobalStrategyProfileIdV1 =
    globalSelfImprovementPlan.crossRepoStrategyHarmonization.length > 2
      ? "global_stabilize"
      : avgOutcome >= 65
        ? "global_explore"
        : "global_conservative";
  const convergence = await analyzeGlobalStrategyConvergence(projectRoots, profiles, outcomeHistory);
  const out: GlobalStrategyEvolutionV1 = {
    globalStrategyProfiles: profiles,
    repoSpecificStrategyDeltas,
    crossRepoMappingRules: [
      "high risk/drift repos => global_stabilize",
      "improving outcomes + moderate risk => global_explore",
      "persistent low outcomes => global_conservative",
      "high velocity + bounded drift => global_aggressive",
      ...convergence.policyAlignmentNotes
    ],
    recommendedDefaultProfile:
      convergence.recommendedGlobalProfileAdjustments.some((x) => /boost:global_stabilize/i.test(x))
        ? "global_stabilize"
        : recommendedDefaultProfile
  };
  latestGlobalStrategyEvolution = out;
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.strategy.evolve",
    parameters: mergeForgeAuditParamsV1("global_strategy", {
      repoCount: projectRoots.length,
      recommendedDefaultProfile,
      harmonizationTargets: globalSelfImprovementPlan.crossRepoStrategyHarmonization.length
    }),
    result: "success"
  });
  return out;
}
