import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import type { SelfImprovementStateSnapshotV1 } from "./selfState.js";
import type { SelfEvolutionPolicyV1 } from "./selfEvolutionPolicy.js";
import type { SelfImprovementHealthV1 } from "./selfHealth.js";
import { setFrozenHeuristicDimensionsV1 } from "./selfHeuristics.js";
import { setBaselineStrategyProfilesV1 } from "./selfStrategyEvolution.js";
import { setPromotedArchitectureHintsV1 } from "./selfArchitecture.js";

export type SelfConsolidationResultV1 = {
  status: "completed" | "paused" | "halted";
  consolidationSummary: string[];
  frozenDimensions: string[];
  baselineProfiles: string[];
  promotedArchitectureHints: string[];
};

export async function runSelfImprovementConsolidation(
  projectRoot: string,
  options: {
    selfStateSnapshot: SelfImprovementStateSnapshotV1;
    evolutionPolicy: SelfEvolutionPolicyV1;
    selfImprovementHealth: SelfImprovementHealthV1;
    sessionId?: string;
  }
): Promise<SelfConsolidationResultV1> {
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.consolidation.start",
    parameters: mergeForgeAuditParamsV1("self_consolidation", {
      sessionId: options.sessionId ?? null,
      evolutionPhase: options.evolutionPolicy.evolutionPhase
    }),
    result: "success"
  });
  const frozenDimensions =
    options.evolutionPolicy.evolutionPhase === "stabilize"
      ? options.selfStateSnapshot.latestHeuristicsConvergence.stableDimensions
      : [];
  setFrozenHeuristicDimensionsV1(frozenDimensions);
  const baselineProfiles =
    options.selfImprovementHealth.keyDrivers.strategyHealthScore >= 65 &&
    options.selfStateSnapshot.latestStrategyProfiles?.recommendedDefaultProfile
      ? [options.selfStateSnapshot.latestStrategyProfiles.recommendedDefaultProfile]
      : [];
  setBaselineStrategyProfilesV1(
    baselineProfiles.filter(
      (x): x is "stabilize_mode" | "explore_mode" | "aggressive_mode" | "conservative_mode" => Boolean(x)
    )
  );
  const promotedArchitectureHints = options.selfStateSnapshot.latestArchitectureAdvice?.recommendations.slice(0, 5) ?? [];
  setPromotedArchitectureHintsV1(promotedArchitectureHints);
  const consolidationSummary = [
    ...(frozenDimensions.length ? [`Froze ${frozenDimensions.length} stable heuristic dimension(s).`] : []),
    ...(baselineProfiles.length ? [`Locked baseline profile(s): ${baselineProfiles.join(", ")}`] : []),
    ...(promotedArchitectureHints.length ? ["Promoted architecture hints into long-term signal set."] : [])
  ];
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.consolidation.tick",
    parameters: mergeForgeAuditParamsV1("self_consolidation", {
      sessionId: options.sessionId ?? null,
      frozenDimensions,
      baselineProfiles,
      promotedArchitectureHints,
      consolidationSummary
    }),
    result: "success"
  });
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.consolidation.complete",
    parameters: mergeForgeAuditParamsV1("self_consolidation", {
      status: "completed",
      sessionId: options.sessionId ?? null
    }),
    result: "success"
  });
  return {
    status: "completed",
    consolidationSummary,
    frozenDimensions,
    baselineProfiles,
    promotedArchitectureHints
  };
}
