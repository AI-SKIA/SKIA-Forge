import type { WorkProgressV1 } from "./workProgress.js";
import type { WorkGovernanceStatusV1 } from "./workGovernance.js";
import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";

export type WorkSlaDriftSeverityV1 = "none" | "mild" | "moderate" | "severe" | "critical";

export type WorkSlaDriftV1 = {
  severity: WorkSlaDriftSeverityV1;
  notes: string[];
  recommendedActions: string[];
  signals: {
    completionGap: number;
    stabilityGap: number;
    phaseCompletionGap: number;
    highRiskBacklog: number;
    blockedBacklog: number;
  };
};

export function detectWorkSlaDrift(
  workProgress: WorkProgressV1,
  governanceStatus: WorkGovernanceStatusV1,
  sdlcInsights: SdlcInsightsBundleV2
): WorkSlaDriftV1 {
  const completionGap = Math.max(0, governanceStatus.policy.targetCompletionPercent - workProgress.project.completionPercent);
  const stabilityGap = Math.max(0, governanceStatus.policy.targetStabilityScore - sdlcInsights.heuristics.stabilityScore);
  const phaseCompletionGap = Math.max(0, completionGap - 10);
  const highRiskBacklog = governanceStatus.warnings.some((w) => w.includes("High-risk")) ? 1 : 0;
  const blockedBacklog = governanceStatus.violations.some((v) => v.includes("Blocked")) ? 1 : 0;
  const score = completionGap * 0.35 + stabilityGap * 0.35 + phaseCompletionGap * 0.15 + highRiskBacklog * 8 + blockedBacklog * 12;
  const severity: WorkSlaDriftSeverityV1 =
    score <= 3 ? "none" : score <= 12 ? "mild" : score <= 25 ? "moderate" : score <= 40 ? "severe" : "critical";
  const notes = [
    `Completion gap=${completionGap.toFixed(1)}%.`,
    `Stability gap=${stabilityGap.toFixed(1)}.`,
    `Phase completion gap=${phaseCompletionGap.toFixed(1)}.`,
    `Backlog pressure highRisk=${highRiskBacklog} blocked=${blockedBacklog}.`
  ];
  const recommendedActions = [
    ...(completionGap > 0 ? ["Increase completion throughput on critical-path phases."] : []),
    ...(stabilityGap > 0 ? ["Prioritize validation and test stabilization tasks."] : []),
    ...(blockedBacklog > 0 ? ["Unblock blocked items before expanding scope."] : []),
    ...(highRiskBacklog > 0 ? ["Split high-risk items into smaller reviewable batches."] : [])
  ];
  return {
    severity,
    notes,
    recommendedActions,
    signals: { completionGap, stabilityGap, phaseCompletionGap, highRiskBacklog, blockedBacklog }
  };
}
