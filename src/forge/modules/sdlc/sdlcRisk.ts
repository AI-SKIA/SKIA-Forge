import type { SdlcInsightsBundleV1 } from "./sdlcInsights.js";
import type { SdlcDriftV1 } from "./sdlcDrift.js";

export type SdlcRiskClass = "low" | "medium" | "high" | "critical";

export type SdlcRiskV1 = {
  project: { score: number; class: SdlcRiskClass };
  files: Array<{ path: string; score: number; class: SdlcRiskClass }>;
};

function toClass(score: number): SdlcRiskClass {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function classifySdlcRisk(insights: SdlcInsightsBundleV1, drift: SdlcDriftV1): SdlcRiskV1 {
  const projectScore = Number(
    clamp(
      (100 - insights.healthScore) * 0.35 +
        drift.score * 0.25 +
        insights.patterns.severity * 0.15 +
        insights.heuristics.riskScore * 0.25,
      0,
      100
    ).toFixed(2)
  );
  const files = insights.heuristics.hotspotFiles.slice(0, 12).map((f) => {
    const flaky = insights.heuristics.flakyFiles.find((x) => x.path === f.path)?.score ?? 0;
    const recentFailBoost = insights.heuristics.recentFailures.some((x) => x.path === f.path) ? 15 : 0;
    const rollbackBoost = insights.patterns.agent.rollbackCycles > 0 ? 6 : 0;
    const score = Number(
      clamp(f.score * 1.6 + flaky * 1.4 + insights.heuristics.riskScore * 0.25 + recentFailBoost + rollbackBoost, 0, 100).toFixed(2)
    );
    return { path: f.path, score, class: toClass(score) };
  });
  return {
    project: { score: projectScore, class: toClass(projectScore) },
    files
  };
}
