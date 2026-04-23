import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { queryAutoMemory } from "../auto/autoMemory.js";
import { listAutoSessions } from "../auto/autoSessionModel.js";
import { buildSdlcInsightsBundle } from "../sdlc/sdlcInsights.js";
import { analyzeSelfPerformance, type SelfImprovementInsightsV1 } from "./selfInsights.js";
import { buildSelfImprovementPlan, type SelfImprovementPlanV1 } from "./selfPlanner.js";
import { getSelfHeuristicOverridesV1, getSelfHeuristicsHistoryV1, type SelfHeuristicsUpdateV1 } from "./selfHeuristics.js";
import { analyzeHeuristicConvergence, type SelfHeuristicConvergenceV1 } from "./selfHeuristicConvergence.js";
import { getEvolvedAutoStrategyProfilesV1 } from "./selfStrategyEvolution.js";
import { analyzeStrategyConvergence, type SelfStrategyConvergenceV1 } from "./selfStrategyConvergence.js";
import { getSelfArchitectureAdviceHistoryV1, type SelfArchitectureAdviceV1 } from "./selfArchitecture.js";
import { getLastArchitectureEvolutionScoreV1, type SelfArchitectureEvolutionScoreV1 } from "./selfArchitectureScoring.js";
import type { SelfMetaOptimizationResultV1 } from "./selfMetaOptimizer.js";

let latestMetaOptimizationSummary: SelfMetaOptimizationResultV1["metaOptimizationSummary"] | null = null;

export type SelfImprovementStateSnapshotV1 = {
  latestSelfInsights: SelfImprovementInsightsV1;
  latestSelfPlan: SelfImprovementPlanV1;
  latestSelfHeuristicsUpdate: SelfHeuristicsUpdateV1 | null;
  latestHeuristicsConvergence: SelfHeuristicConvergenceV1;
  latestStrategyProfiles: ReturnType<typeof getEvolvedAutoStrategyProfilesV1>;
  latestStrategyConvergence: SelfStrategyConvergenceV1;
  latestArchitectureAdvice: SelfArchitectureAdviceV1 | null;
  latestArchitectureEvolutionScore: SelfArchitectureEvolutionScoreV1 | null;
  latestMetaOptimizationSummary: SelfMetaOptimizationResultV1["metaOptimizationSummary"] | null;
  keyScores: {
    metaStabilityScore: number;
    metaRiskScore: number;
    metaEfficiencyScore: number;
    architectureImprovementScore: number | null;
    overallOutcomeScore: number | null;
  };
};

export type SelfImprovementHistorySummaryV1 = {
  trends: {
    metaStability: "improving" | "degrading" | "flat";
    metaRisk: "improving" | "degrading" | "flat";
    metaEfficiency: "improving" | "degrading" | "flat";
    heuristicConvergence: "improving" | "degrading" | "flat";
    strategyConvergence: "improving" | "degrading" | "flat";
    architectureEvolution: "improving" | "degrading" | "flat";
  };
  samples: number;
};

function trend(first: number, last: number, eps = 2): "improving" | "degrading" | "flat" {
  if (last > first + eps) return "improving";
  if (last < first - eps) return "degrading";
  return "flat";
}

export function setLatestMetaOptimizationSummaryV1(
  summary: SelfMetaOptimizationResultV1["metaOptimizationSummary"] | null
): void {
  latestMetaOptimizationSummary = summary;
}

export async function getSelfImprovementStateSnapshot(
  projectRoot: string,
  options?: { emitAudit?: boolean }
): Promise<SelfImprovementStateSnapshotV1> {
  const [memory, sessions, sdlc] = await Promise.all([
    queryAutoMemory(projectRoot, { limit: 1000 }),
    listAutoSessions(projectRoot, { limit: 200 }),
    buildSdlcInsightsBundle(projectRoot)
  ]);
  const latestSelfInsights = analyzeSelfPerformance(projectRoot, memory, sessions, sdlc);
  const latestSelfPlan = buildSelfImprovementPlan(latestSelfInsights, memory, sdlc);
  const heuristicsHistory = getSelfHeuristicsHistoryV1();
  const latestSelfHeuristicsUpdate = getSelfHeuristicOverridesV1() ?? heuristicsHistory.at(-1) ?? null;
  const latestHeuristicsConvergence = analyzeHeuristicConvergence(projectRoot, memory, heuristicsHistory);
  const latestStrategyProfiles = getEvolvedAutoStrategyProfilesV1();
  const outcomeHistory = memory
    .map((m) => ({
      profileId: String((m.meta as { profileId?: string } | undefined)?.profileId ?? ""),
      overallOutcomeScore: Number((m.meta as { overallOutcomeScore?: number } | undefined)?.overallOutcomeScore ?? NaN),
      stateTag: String((m.meta as { stateTag?: string } | undefined)?.stateTag ?? "")
    }))
    .filter((x) => Number.isFinite(x.overallOutcomeScore));
  const latestStrategyConvergence = analyzeStrategyConvergence(
    projectRoot,
    latestStrategyProfiles?.updatedStrategyProfiles ?? [],
    outcomeHistory,
    memory
  );
  const latestArchitectureAdvice = getSelfArchitectureAdviceHistoryV1().at(-1) ?? null;
  const latestArchitectureEvolutionScore = getLastArchitectureEvolutionScoreV1();
  const overallOutcomeScore =
    memory
      .map((m) => Number((m.meta as { overallOutcomeScore?: number } | undefined)?.overallOutcomeScore ?? NaN))
      .filter((x) => Number.isFinite(x))
      .at(-1) ?? null;
  const snapshot: SelfImprovementStateSnapshotV1 = {
    latestSelfInsights,
    latestSelfPlan,
    latestSelfHeuristicsUpdate,
    latestHeuristicsConvergence,
    latestStrategyProfiles,
    latestStrategyConvergence,
    latestArchitectureAdvice,
    latestArchitectureEvolutionScore,
    latestMetaOptimizationSummary,
    keyScores: {
      metaStabilityScore: latestSelfInsights.metaStabilityScore,
      metaRiskScore: latestSelfInsights.metaRiskScore,
      metaEfficiencyScore: latestSelfInsights.metaEfficiencyScore,
      architectureImprovementScore: latestArchitectureEvolutionScore?.architectureImprovementScore ?? null,
      overallOutcomeScore
    }
  };
  if (options?.emitAudit) {
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action: "self.state.snapshot",
      parameters: mergeForgeAuditParamsV1("self_state", snapshot),
      result: "success"
    });
  }
  return snapshot;
}

export async function getSelfImprovementHistorySummary(
  projectRoot: string,
  options?: { limit?: number }
): Promise<SelfImprovementHistorySummaryV1> {
  const limit = Math.max(10, Math.min(400, options?.limit ?? 100));
  const memory = await queryAutoMemory(projectRoot, { limit });
  const scoreRows = memory
    .map((m) => ({
      metaStability: Number((m.meta as { metaStabilityScore?: number } | undefined)?.metaStabilityScore ?? NaN),
      metaRisk: Number((m.meta as { metaRiskScore?: number } | undefined)?.metaRiskScore ?? NaN),
      metaEfficiency: Number((m.meta as { metaEfficiencyScore?: number } | undefined)?.metaEfficiencyScore ?? NaN),
      heuristicConv: Number((m.meta as { heuristicConvergenceScore?: number } | undefined)?.heuristicConvergenceScore ?? NaN),
      strategyConv: Number((m.meta as { strategyConvergenceScore?: number } | undefined)?.strategyConvergenceScore ?? NaN),
      architecture: Number((m.meta as { architectureImprovementScore?: number } | undefined)?.architectureImprovementScore ?? NaN)
    }))
    .filter((x) => Object.values(x).some((v) => Number.isFinite(v)));
  const first = scoreRows[0] ?? null;
  const last = scoreRows.at(-1) ?? null;
  return {
    trends: {
      metaStability: first && last && Number.isFinite(first.metaStability) && Number.isFinite(last.metaStability)
        ? trend(first.metaStability, last.metaStability)
        : "flat",
      metaRisk: first && last && Number.isFinite(first.metaRisk) && Number.isFinite(last.metaRisk)
        ? trend(last.metaRisk, first.metaRisk)
        : "flat",
      metaEfficiency: first && last && Number.isFinite(first.metaEfficiency) && Number.isFinite(last.metaEfficiency)
        ? trend(first.metaEfficiency, last.metaEfficiency)
        : "flat",
      heuristicConvergence:
        first && last && Number.isFinite(first.heuristicConv) && Number.isFinite(last.heuristicConv)
          ? trend(first.heuristicConv, last.heuristicConv)
          : "flat",
      strategyConvergence:
        first && last && Number.isFinite(first.strategyConv) && Number.isFinite(last.strategyConv)
          ? trend(first.strategyConv, last.strategyConv)
          : "flat",
      architectureEvolution:
        first && last && Number.isFinite(first.architecture) && Number.isFinite(last.architecture)
          ? trend(first.architecture, last.architecture)
          : "flat"
    },
    samples: scoreRows.length
  };
}
