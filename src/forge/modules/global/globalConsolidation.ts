import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { setFrozenHeuristicDimensionsV1 } from "../self/selfHeuristics.js";
import { setBaselineStrategyProfilesV1 } from "../self/selfStrategyEvolution.js";
import { setPromotedArchitectureHintsV1 } from "../self/selfArchitecture.js";
import type { GlobalSelfImprovementResultV1 } from "./globalSelfImprovement.js";
import type { GlobalStrategyEvolutionV1 } from "./globalStrategyEvolution.js";
import { getLatestGlobalMetaOptimizationV1 } from "./globalMetaOptimizer.js";
import { getGlobalStateSnapshot } from "./globalState.js";
import { computeGlobalEvolutionPolicy } from "./globalEvolutionPolicy.js";
import { runGlobalBaselineConsolidation } from "./globalBaselineConsolidation.js";
import { evaluateGlobalPolicy } from "../safety/globalPolicyEngine.js";

export type GlobalConsolidationResultV1 = {
  status: "completed" | "paused" | "halted";
  frozenGlobalHeuristicDimensions: string[];
  frozenGlobalStrategyProfiles: string[];
  promotedArchitectureHints: string[];
  rolledBackHeuristicDimensions: string[];
  rolledBackStrategyProfiles: string[];
  normalizationActions: string[];
};
let latestGlobalConsolidation: GlobalConsolidationResultV1 | null = null;

export function getLatestGlobalConsolidationV1(): GlobalConsolidationResultV1 | null {
  return latestGlobalConsolidation;
}

export async function runGlobalConsolidation(
  projectRoots: string[],
  options: {
    globalSelfImprovement?: GlobalSelfImprovementResultV1 | null;
    strategyEvolution?: GlobalStrategyEvolutionV1 | null;
    evolutionPhase?: "explore" | "exploit" | "stabilize";
  }
): Promise<GlobalConsolidationResultV1> {
  const state = await getGlobalStateSnapshot(projectRoots);
  const policy = await computeGlobalEvolutionPolicy(projectRoots, state);
  const orgPolicy = await evaluateGlobalPolicy(projectRoots, state);
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.consolidation.start",
    parameters: mergeForgeAuditParamsV1("global_consolidation", {
      repoCount: projectRoots.length,
      evolutionPhase: options.evolutionPhase ?? "exploit"
    }),
    result: "success"
  });
  const frozenGlobalHeuristicDimensions =
    options.evolutionPhase === "stabilize" && orgPolicy.policyStatus !== "blocked"
      ? [
          "riskWeight",
          "driftWeight",
          "riskHighThreshold",
          "driftTrigger",
          ...(getLatestGlobalMetaOptimizationV1()?.globalMetaOptimizationSummary.globalHeuristicConvergence
            .convergedDimensions ?? [])
        ]
      : [];
  setFrozenHeuristicDimensionsV1(frozenGlobalHeuristicDimensions);
  const preferred = options.strategyEvolution?.recommendedDefaultProfile ?? "global_explore";
  const mapToLocal: Record<string, "stabilize_mode" | "explore_mode" | "aggressive_mode" | "conservative_mode"> = {
    global_stabilize: "stabilize_mode",
    global_explore: "explore_mode",
    global_aggressive: "aggressive_mode",
    global_conservative: "conservative_mode"
  };
  const frozenGlobalStrategyProfiles =
    options.evolutionPhase === "stabilize" && orgPolicy.policyStatus !== "blocked" ? [preferred] : [];
  if (frozenGlobalStrategyProfiles.length > 0) {
    setBaselineStrategyProfilesV1([mapToLocal[preferred] ?? "explore_mode"]);
  }
  const promotedArchitectureHints =
    options.globalSelfImprovement?.globalSelfImprovementPlan.crossRepoArchitecturePriorities.slice(0, 8) ?? [];
  setPromotedArchitectureHintsV1(promotedArchitectureHints);
  const rolledBackHeuristicDimensions =
    [
      ...(options.globalSelfImprovement && options.globalSelfImprovement.globalMetaRisk > 70 ? ["forecastWeight"] : []),
      ...((getLatestGlobalMetaOptimizationV1()?.recommendedGlobalMetaActions ?? [])
        .filter((x) => /dampen oscillating heuristic/i.test(x))
        .map(() => "oscillatingDimensions"))
    ];
  const rolledBackStrategyProfiles =
    [
      ...(options.strategyEvolution?.repoSpecificStrategyDeltas.some((x) => x.preferredProfile === "global_aggressive")
        ? ["global_aggressive"]
        : []),
      ...((getLatestGlobalMetaOptimizationV1()?.recommendedGlobalMetaActions ?? [])
        .filter((x) => /retire_or_merge:global_aggressive/i.test(x))
        .map(() => "global_aggressive"))
    ];
  const normalizationActions = [
    "normalize cross-repo tagging",
    "normalize chunking and embedding strategy",
    "normalize work item classification"
  ];
  const out: GlobalConsolidationResultV1 = {
    status: "completed",
    frozenGlobalHeuristicDimensions,
    frozenGlobalStrategyProfiles,
    promotedArchitectureHints,
    rolledBackHeuristicDimensions,
    rolledBackStrategyProfiles,
    normalizationActions
  };
  if ((options.evolutionPhase ?? policy.evolutionPhase.replace("global_", "") as "explore" | "exploit" | "stabilize") === "stabilize") {
    const baseline = await runGlobalBaselineConsolidation(projectRoots);
    out.frozenGlobalHeuristicDimensions.push(...baseline.frozenGlobalDimensions);
    out.frozenGlobalStrategyProfiles.push(...baseline.baselineGlobalProfiles);
    out.promotedArchitectureHints.push(...baseline.promotedGlobalArchitectureHints);
  }
  latestGlobalConsolidation = out;
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.consolidation.tick",
    parameters: mergeForgeAuditParamsV1("global_consolidation", out),
    result: "success"
  });
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.consolidation.complete",
    parameters: mergeForgeAuditParamsV1("global_consolidation", {
      status: out.status,
      frozenHeuristics: out.frozenGlobalHeuristicDimensions.length,
      frozenProfiles: out.frozenGlobalStrategyProfiles.length
    }),
    result: "success"
  });
  return out;
}
