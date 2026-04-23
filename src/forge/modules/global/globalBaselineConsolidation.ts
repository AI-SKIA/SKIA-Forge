import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { setFrozenHeuristicDimensionsV1 } from "../self/selfHeuristics.js";
import { setBaselineStrategyProfilesV1 } from "../self/selfStrategyEvolution.js";
import { setPromotedArchitectureHintsV1 } from "../self/selfArchitecture.js";
import { getGlobalStateSnapshot } from "./globalState.js";
import { computeGlobalEvolutionPolicy } from "./globalEvolutionPolicy.js";
import { getLatestGlobalMetaOptimizationV1 } from "./globalMetaOptimizer.js";

export type GlobalBaselineConsolidationResultV1 = {
  baselineSummary: string[];
  frozenGlobalDimensions: string[];
  baselineGlobalProfiles: string[];
  promotedGlobalArchitectureHints: string[];
};

export async function runGlobalBaselineConsolidation(
  projectRoots: string[],
  options?: { emitAudit?: boolean }
): Promise<GlobalBaselineConsolidationResultV1> {
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.baselineConsolidation.start",
    parameters: mergeForgeAuditParamsV1("global_baseline_consolidation", { repoCount: projectRoots.length }),
    result: "success"
  });
  const snapshot = await getGlobalStateSnapshot(projectRoots, { emitAudit: options?.emitAudit });
  const policy = await computeGlobalEvolutionPolicy(projectRoots, snapshot);
  const latestMeta = getLatestGlobalMetaOptimizationV1();
  const frozenGlobalDimensions = [
    ...(latestMeta?.globalMetaOptimizationSummary.globalHeuristicConvergence.convergedDimensions ?? []),
    ...(policy.evolutionPhase === "global_stabilize" ? ["riskWeight", "driftWeight"] : [])
  ].filter((x, i, arr) => arr.indexOf(x) === i);
  setFrozenHeuristicDimensionsV1(frozenGlobalDimensions);
  const preferred = snapshot.latestGlobalStrategyEvolution?.recommendedDefaultProfile ?? "global_explore";
  const mapToLocal: Record<string, "stabilize_mode" | "explore_mode" | "aggressive_mode" | "conservative_mode"> = {
    global_stabilize: "stabilize_mode",
    global_explore: "explore_mode",
    global_aggressive: "aggressive_mode",
    global_conservative: "conservative_mode"
  };
  const baselineGlobalProfiles = [preferred];
  setBaselineStrategyProfilesV1([mapToLocal[preferred] ?? "explore_mode"]);
  const promotedGlobalArchitectureHints =
    snapshot.latestGlobalSelfImprovementResult?.globalSelfImprovementPlan.crossRepoArchitecturePriorities.slice(0, 12) ?? [];
  setPromotedArchitectureHintsV1(promotedGlobalArchitectureHints);
  const out: GlobalBaselineConsolidationResultV1 = {
    baselineSummary: [
      `phase=${policy.evolutionPhase}`,
      `frozenDimensions=${frozenGlobalDimensions.length}`,
      `baselineProfiles=${baselineGlobalProfiles.length}`,
      `promotedArchitectureHints=${promotedGlobalArchitectureHints.length}`
    ],
    frozenGlobalDimensions,
    baselineGlobalProfiles,
    promotedGlobalArchitectureHints
  };
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.baselineConsolidation.tick",
    parameters: mergeForgeAuditParamsV1("global_baseline_consolidation", out),
    result: "success"
  });
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.baselineConsolidation.complete",
    parameters: mergeForgeAuditParamsV1("global_baseline_consolidation", {
      frozenGlobalDimensions: out.frozenGlobalDimensions.length,
      baselineGlobalProfiles: out.baselineGlobalProfiles.length
    }),
    result: "success"
  });
  return out;
}
