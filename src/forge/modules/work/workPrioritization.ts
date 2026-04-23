import type { WorkItemV1, WorkItemPriorityV1 } from "./workItemModel.js";
import type { WorkBreakdownV1 } from "./workDecomposition.js";
import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";

export type WorkPriorityV1 = {
  priorityScore: number;
  urgencyScore: number;
  recommendedPriority: WorkItemPriorityV1;
  rationale: string[];
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function toPriority(score: number): WorkItemPriorityV1 {
  if (score >= 85) return "P0";
  if (score >= 70) return "P1";
  if (score >= 50) return "P2";
  if (score >= 30) return "P3";
  return "P4";
}

export function prioritizeWork(
  workItem: WorkItemV1,
  breakdown: WorkBreakdownV1,
  insights: SdlcInsightsBundleV2,
  governanceLimits: { maxSteps: number; maxWriteOps: number; maxTerminalOps: number }
): WorkPriorityV1 {
  const maxTaskRisk = breakdown.tasks.length ? Math.max(...breakdown.tasks.map((t) => t.estimatedRisk)) : 0;
  const depImpact = Math.min(100, workItem.dependencies.length * 15 + breakdown.tasks.filter((t) => (t.dependsOn?.length ?? 0) > 0).length * 7);
  const governancePressure =
    (breakdown.tasks.length > governanceLimits.maxSteps ? 18 : 0) +
    (breakdown.tasks.filter((t) => t.relatedFiles.length > 0).length > governanceLimits.maxWriteOps ? 12 : 0);
  const priorityScore = Number(
    clamp(
      insights.risk.project.score * 0.34 +
        insights.forecast.globalNextFailureProbability * 0.26 +
        insights.drift.score * 0.18 +
        maxTaskRisk * 0.12 +
        depImpact * 0.1 +
        governancePressure,
      0,
      100
    ).toFixed(2)
  );
  const urgencyScore = Number(
    clamp(
      insights.forecast.globalNextFailureProbability * 0.5 +
        insights.forecast.nextTestRegressionProbability * 0.2 +
        insights.forecast.nextAgentRollbackProbability * 0.2 +
        (100 - insights.healthScore) * 0.1,
      0,
      100
    ).toFixed(2)
  );
  const rationale: string[] = [
    `Project risk class is ${insights.risk.project.class} (${insights.risk.project.score}).`,
    `Forecasted next failure probability is ${insights.forecast.globalNextFailureProbability}.`,
    `Drift severity is ${insights.drift.score}.`,
    `Top task estimated risk is ${maxTaskRisk}.`,
    `Governance pressure contribution is ${governancePressure}.`
  ];
  return {
    priorityScore,
    urgencyScore,
    recommendedPriority: toPriority((priorityScore + urgencyScore) / 2),
    rationale
  };
}
