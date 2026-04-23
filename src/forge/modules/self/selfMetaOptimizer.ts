import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { queryAutoMemory } from "../auto/autoMemory.js";
import { listAutoSessions } from "../auto/autoSessionModel.js";
import { buildSdlcInsightsBundle } from "../sdlc/sdlcInsights.js";
import { buildWorkGraph } from "../work/workGraph.js";
import { getSelfHeuristicsHistoryV1 } from "./selfHeuristics.js";
import { getSelfStrategyEvolutionHistoryV1 } from "./selfStrategyEvolution.js";
import { getSelfArchitectureAdviceHistoryV1 } from "./selfArchitecture.js";
import { analyzeHeuristicConvergence, type SelfHeuristicConvergenceV1 } from "./selfHeuristicConvergence.js";
import { analyzeStrategyConvergence, type SelfStrategyConvergenceV1 } from "./selfStrategyConvergence.js";
import { scoreArchitectureEvolution, type SelfArchitectureEvolutionScoreV1 } from "./selfArchitectureScoring.js";
import { getSelfImprovementStateSnapshot, setLatestMetaOptimizationSummaryV1 } from "./selfState.js";
import { computeEvolutionPolicy } from "./selfEvolutionPolicy.js";

export type SelfMetaOptimizationResultV1 = {
  status: "completed" | "paused" | "halted";
  metaOptimizationSummary: {
    heuristicConvergence: SelfHeuristicConvergenceV1;
    strategyConvergence: SelfStrategyConvergenceV1;
    architectureEvolutionScore: SelfArchitectureEvolutionScoreV1;
  };
  recommendedMetaActions: string[];
};

export async function runMetaOptimizationCycle(
  projectRoot: string,
  options?: { sessionId?: string }
): Promise<SelfMetaOptimizationResultV1> {
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.metaOptimization.start",
    parameters: mergeForgeAuditParamsV1("self_meta_optimization", { sessionId: options?.sessionId ?? null }),
    result: "success"
  });
  const [autoMemory, autoSessions, sdlc] = await Promise.all([
    queryAutoMemory(projectRoot, { limit: 1000 }),
    listAutoSessions(projectRoot, { limit: 100 }),
    buildSdlcInsightsBundle(projectRoot)
  ]);
  const workGraph = await buildWorkGraph(projectRoot);
  const heuristicsHistory = getSelfHeuristicsHistoryV1();
  const strategyHistory = getSelfStrategyEvolutionHistoryV1();
  const architectureAdviceHistory = getSelfArchitectureAdviceHistoryV1();
  const heuristicConvergence = analyzeHeuristicConvergence(projectRoot, autoMemory, heuristicsHistory);
  const latestProfiles = strategyHistory.at(-1)?.updatedStrategyProfiles ?? [];
  const outcomeHistory = autoMemory
    .map((m) => ({
      profileId: String((m.meta as { profileId?: string } | undefined)?.profileId ?? ""),
      overallOutcomeScore: Number((m.meta as { overallOutcomeScore?: number } | undefined)?.overallOutcomeScore ?? NaN),
      stateTag: String((m.meta as { stateTag?: string } | undefined)?.stateTag ?? "")
    }))
    .filter((x) => Number.isFinite(x.overallOutcomeScore));
  const strategyConvergence = analyzeStrategyConvergence(projectRoot, latestProfiles, outcomeHistory, autoMemory);
  const sdlcHistory = [sdlc];
  const workGraphHistory = [workGraph];
  const architectureEvolutionScore = scoreArchitectureEvolution(
    projectRoot,
    architectureAdviceHistory.at(-1) ?? {
      persistentDriftModules: [],
      persistentHotspots: [],
      cycleNodes: [],
      heavyDependencyNodes: [],
      regressionModules: [],
      recommendations: [],
      stabilizeBeforeExpandZones: []
    },
    workGraphHistory,
    sdlcHistory
  );
  const recommendedMetaActions = [
    ...(heuristicConvergence.stableDimensions.length >= 4 ? ["freeze stable heuristics"] : []),
    ...(heuristicConvergence.unstableDimensions.length > 0 ? ["dampen unstable dimensions"] : []),
    ...(strategyConvergence.underperformingProfiles.length > 0 ? ["retire/merge weak profiles"] : []),
    ...(architectureEvolutionScore.architectureImprovementScore < 60
      ? ["prioritize high-impact architecture goals"]
      : [])
  ];
  const snapshot = await getSelfImprovementStateSnapshot(projectRoot);
  const evolutionPolicy = computeEvolutionPolicy(projectRoot, snapshot, sdlc);
  const clampedRecommendedMetaActions = recommendedMetaActions.filter((action) => {
    if (action.includes("heuristics") && evolutionPolicy.blockedChanges.includes("heuristics")) return false;
    if (action.includes("profiles") && evolutionPolicy.blockedChanges.includes("strategy")) return false;
    if (action.includes("architecture") && evolutionPolicy.blockedChanges.includes("architecture")) return false;
    return true;
  });
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.metaOptimization.tick",
    parameters: mergeForgeAuditParamsV1("self_meta_optimization", {
      sessionId: options?.sessionId ?? null,
      heuristicConvergence,
      strategyConvergence,
      architectureEvolutionScore,
      recommendedMetaActions: clampedRecommendedMetaActions,
      evolutionPolicy,
      sessionCount: autoSessions.length
    }),
    result: "success"
  });
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.metaOptimization.complete",
    parameters: mergeForgeAuditParamsV1("self_meta_optimization", {
      status: "completed",
      sessionId: options?.sessionId ?? null
    }),
    result: "success"
  });
  const out: SelfMetaOptimizationResultV1 = {
    status: "completed",
    metaOptimizationSummary: {
      heuristicConvergence,
      strategyConvergence,
      architectureEvolutionScore
    },
    recommendedMetaActions: clampedRecommendedMetaActions
  };
  setLatestMetaOptimizationSummaryV1(out.metaOptimizationSummary);
  return out;
}
