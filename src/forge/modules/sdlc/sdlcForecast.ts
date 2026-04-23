import type { SdlcInsightsBundleV1 } from "./sdlcInsights.js";
import type { SdlcDriftV1 } from "./sdlcDrift.js";
import type { SdlcRiskV1 } from "./sdlcRisk.js";

export type SdlcForecastV1 = {
  globalNextFailureProbability: number;
  fileNextFailureProbability: Array<{ path: string; probability: number }>;
  nextAgentRollbackProbability: number;
  nextTestRegressionProbability: number;
  stabilityTrend: "improving" | "degrading" | "flat";
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function forecastSdlcTrends(
  insights: SdlcInsightsBundleV1,
  drift: SdlcDriftV1,
  risk: SdlcRiskV1
): SdlcForecastV1 {
  const globalNextFailureProbability = Number(
    clamp(
      insights.heuristics.riskScore * 0.55 +
        drift.score * 0.25 +
        (100 - insights.healthScore) * 0.2,
      0,
      100
    ).toFixed(2)
  );
  const nextAgentRollbackProbability = Number(
    clamp(
      insights.patterns.agent.rollbackCycles * 12 +
        insights.patterns.agent.selfCorrectionLoops * 8 +
        (risk.project.class === "critical" ? 20 : risk.project.class === "high" ? 10 : 0),
      0,
      100
    ).toFixed(2)
  );
  const nextTestRegressionProbability = Number(
    clamp(
      (100 - insights.heuristics.stabilityScore) * 0.6 +
        insights.patterns.recurringFailures.filter((x) => x.kind === "test_repeated_failure").length * 9,
      0,
      100
    ).toFixed(2)
  );
  const fileNextFailureProbability = risk.files.slice(0, 10).map((f) => ({
    path: f.path,
    probability: Number(clamp(f.score * 0.9 + globalNextFailureProbability * 0.25, 0, 100).toFixed(2))
  }));
  const trendDelta = insights.timeline.metrics.failureStreak - insights.timeline.metrics.testPassStreak;
  const stabilityTrend = trendDelta >= 2 ? "degrading" : trendDelta <= -2 ? "improving" : "flat";
  return {
    globalNextFailureProbability,
    fileNextFailureProbability,
    nextAgentRollbackProbability,
    nextTestRegressionProbability,
    stabilityTrend
  };
}
