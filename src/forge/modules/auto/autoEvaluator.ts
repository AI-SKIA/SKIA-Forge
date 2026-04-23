import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";
import type { AutoExecutionSessionV1 } from "./autoSessionModel.js";
import type { AutoLongHorizonPlanV1 } from "./autoLongHorizonPlanner.js";
import type { AutoStrategyV1 } from "./autoStrategy.js";

export type AutoOutcomeV1 = {
  goalProgressScore: number;
  riskReductionScore: number;
  driftReductionScore: number;
  stabilityImprovementScore: number;
  slaRecoveryScore: number;
  governanceComplianceScore: number;
  overallOutcomeScore: number;
  recommendedNextSteps: string[];
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function evaluateAutoOutcome(
  session: AutoExecutionSessionV1,
  longHorizonPlan: AutoLongHorizonPlanV1,
  strategy: AutoStrategyV1,
  sdlcInsights: SdlcInsightsBundleV2
): AutoOutcomeV1 {
  const totalSteps = Math.max(1, session.steps.length);
  const successSteps = session.steps.filter((s) => s.outcome === "success").length;
  const goalProgressScore = clamp((successSteps / totalSteps) * 100);
  const riskReductionScore = clamp(100 - sdlcInsights.forecast.globalNextFailureProbability + (strategy.mode === "risk_first" ? 5 : 0));
  const driftReductionScore = clamp(100 - sdlcInsights.drift.score + (strategy.driftMitigationPriority === "high" ? 8 : 0));
  const stabilityImprovementScore = clamp(sdlcInsights.heuristics.stabilityScore + (strategy.testStabilizationPriority === "high" ? 6 : 0));
  const slaRecoveryScore = clamp(100 - sdlcInsights.forecast.nextAgentRollbackProbability);
  const governanceComplianceScore = clamp(
    100 -
      session.steps.filter((s) => s.type === "governanceCheck" && s.outcome === "failure").length * 15
  );
  const overallOutcomeScore = clamp(
    goalProgressScore * 0.2 +
      riskReductionScore * 0.2 +
      driftReductionScore * 0.15 +
      stabilityImprovementScore * 0.2 +
      slaRecoveryScore * 0.15 +
      governanceComplianceScore * 0.1
  );
  const recommendedNextSteps = [
    ...(overallOutcomeScore < 60 ? ["Increase stabilization and drift-mitigation coverage next session."] : []),
    ...(riskReductionScore < 55 ? ["Prioritize high-risk items earlier in ordering."] : []),
    ...(driftReductionScore < 55 ? ["Force architecture drift correction tasks before expansion."] : []),
    ...(goalProgressScore < 60 ? ["Narrow session scope to fewer work items with higher completion likelihood."] : []),
    `Continue with goals: ${longHorizonPlan.longHorizonGoals.slice(0, 2).join("; ")}`
  ];
  return {
    goalProgressScore,
    riskReductionScore,
    driftReductionScore,
    stabilityImprovementScore,
    slaRecoveryScore,
    governanceComplianceScore,
    overallOutcomeScore,
    recommendedNextSteps
  };
}
