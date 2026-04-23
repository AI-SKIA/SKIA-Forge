import type { WorkRoadmapV1 } from "./workRoadmap.js";
import type { WorkProgressV1 } from "./workProgress.js";

export type WorkGovernancePolicyV1 = {
  maxOpenP0: number;
  maxBlockedItems: number;
  maxHighRiskItems: number;
  targetCompletionPercent: number;
  targetStabilityScore: number;
};

export type WorkGovernanceStatusV1 = {
  policy: WorkGovernancePolicyV1;
  violations: string[];
  warnings: string[];
  slaDrift: {
    completionGap: number;
    stabilityGap: number;
  };
};

export function defaultWorkGovernancePolicyV1(): WorkGovernancePolicyV1 {
  return {
    maxOpenP0: 3,
    maxBlockedItems: 5,
    maxHighRiskItems: 12,
    targetCompletionPercent: 75,
    targetStabilityScore: 70
  };
}

export function evaluateWorkGovernance(input: {
  policy?: WorkGovernancePolicyV1;
  openP0Count: number;
  blockedItems: number;
  highRiskItems: number;
  stabilityScore: number;
  roadmap: WorkRoadmapV1;
  progress: WorkProgressV1;
}): WorkGovernanceStatusV1 {
  const policy = input.policy ?? defaultWorkGovernancePolicyV1();
  const violations: string[] = [];
  const warnings: string[] = [];
  if (input.openP0Count > policy.maxOpenP0) violations.push(`Open P0 items exceed policy (${input.openP0Count}/${policy.maxOpenP0}).`);
  if (input.blockedItems > policy.maxBlockedItems) violations.push(`Blocked items exceed policy (${input.blockedItems}/${policy.maxBlockedItems}).`);
  if (input.highRiskItems > policy.maxHighRiskItems) warnings.push(`High-risk items are above target (${input.highRiskItems}/${policy.maxHighRiskItems}).`);
  if (input.stabilityScore < policy.targetStabilityScore) violations.push(`Stability score below target (${input.stabilityScore}/${policy.targetStabilityScore}).`);
  if (input.progress.project.completionPercent < policy.targetCompletionPercent) {
    warnings.push(
      `Completion below target (${input.progress.project.completionPercent}%/${policy.targetCompletionPercent}%).`
    );
  }
  if (input.roadmap.global.criticalPathItems.length > 0 && input.roadmap.phases.length > 0) {
    warnings.push(`Critical path spans ${input.roadmap.global.criticalPathItems.length} item(s); monitor SLA drift.`);
  }
  return {
    policy,
    violations,
    warnings,
    slaDrift: {
      completionGap: policy.targetCompletionPercent - input.progress.project.completionPercent,
      stabilityGap: policy.targetStabilityScore - input.stabilityScore
    }
  };
}
