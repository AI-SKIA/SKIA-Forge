import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";
import type { AutoMemoryEventV1 } from "../auto/autoMemory.js";
import type { AutoExecutionSessionV1 } from "../auto/autoSessionModel.js";

export type SelfImprovementInsightsV1 = {
  weaknesses: string[];
  strengths: string[];
  metaStabilityScore: number;
  metaRiskScore: number;
  metaEfficiencyScore: number;
  metaLearningOpportunities: string[];
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function analyzeSelfPerformance(
  _projectRoot: string,
  autoMemory: AutoMemoryEventV1[],
  autoSessions: AutoExecutionSessionV1[],
  sdlcInsights: SdlcInsightsBundleV2
): SelfImprovementInsightsV1 {
  const plannerFail = autoMemory.filter((m) => m.category === "planner_pattern" && m.outcome === "failure").length;
  const executorFail = autoMemory.filter((m) => m.category === "executor_pattern" && m.outcome === "failure").length;
  const selfCorrectFail = autoMemory.filter((m) => m.category === "self_correct_pattern" && m.outcome === "failure").length;
  const driftRiskFail = autoMemory.filter((m) => m.category === "drift_risk_pattern" && m.outcome === "failure").length;
  const slaFail = autoMemory.filter((m) => m.category === "sla_pattern" && m.outcome === "failure").length;
  const totalMem = Math.max(1, autoMemory.length);
  const successfulSessions = autoSessions.filter((s) => s.status === "completed").length;
  const failedSessions = autoSessions.filter((s) => s.status === "aborted").length;
  const metaStabilityScore = clamp(
    100 -
      failedSessions * 12 -
      (sdlcInsights.forecast.globalNextFailureProbability * 0.25) -
      (slaFail / totalMem) * 100 * 0.2
  );
  const metaRiskScore = clamp(
    sdlcInsights.heuristics.riskScore * 0.55 +
      sdlcInsights.drift.score * 0.2 +
      sdlcInsights.forecast.globalNextFailureProbability * 0.25
  );
  const metaEfficiencyScore = clamp(
    (successfulSessions / Math.max(1, autoSessions.length)) * 100 -
      (plannerFail + executorFail + selfCorrectFail) * 2
  );
  const weaknesses: string[] = [];
  if (plannerFail >= 4) weaknesses.push("planner failure clusters");
  if (executorFail >= 4) weaknesses.push("executor regression patterns");
  if (selfCorrectFail >= 4) weaknesses.push("self-correction inefficiencies");
  if (driftRiskFail >= 3) weaknesses.push("drift/risk cycles that recur");
  if (slaFail >= 3) weaknesses.push("SLA drift cycles");
  if (metaStabilityScore < 60) weaknesses.push("stability degradation patterns");
  const strengths: string[] = [];
  if (plannerFail <= 1) strengths.push("high-success planner modes");
  if (sdlcInsights.heuristics.stabilityScore >= 70) strengths.push("stable modules");
  if (selfCorrectFail <= 1) strengths.push("effective correction strategies");
  if (sdlcInsights.recommendations.refactorFiles.length > 0) strengths.push("high-impact WorkItems");
  const metaLearningOpportunities = [
    ...(plannerFail > 0 ? ["Tune planner fallback sequencing by memory signals."] : []),
    ...(executorFail > 0 ? ["Improve executor gating and rollback risk partitioning."] : []),
    ...(driftRiskFail > 0 ? ["Increase drift mitigation before feature expansion."] : []),
    ...(slaFail > 0 ? ["Tighten SLA-aware scheduling and session length."] : [])
  ];
  return {
    weaknesses,
    strengths,
    metaStabilityScore,
    metaRiskScore,
    metaEfficiencyScore,
    metaLearningOpportunities
  };
}
