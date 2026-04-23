import { ForgeGovernancePolicy } from "./forgePolicy.js";
import { SovereignExecutionMode } from "./forgeGovernance.js";
import { ControlPlaneRecommendation } from "./forgeControlPlaneRecommendations.js";

export type ControlPlaneRemediationAction =
  | "align_mode"
  | "reduce_block_pressure"
  | "healthy_posture"
  | "rotate_intent_key_cleanup";

export function executeControlPlaneRemediation(
  action: ControlPlaneRemediationAction,
  mode: SovereignExecutionMode,
  policy: ForgeGovernancePolicy
): { applied: boolean; nextMode: SovereignExecutionMode; message: string } {
  if (action === "align_mode") {
    return {
      applied: mode !== policy.defaultMode,
      nextMode: policy.defaultMode,
      message: `Runtime mode aligned to policy default ${policy.defaultMode}.`
    };
  }
  if (action === "reduce_block_pressure") {
    return {
      applied: false,
      nextMode: mode,
      message: "Use preflight preview and explicit approvals for sensitive module runs."
    };
  }
  if (action === "rotate_intent_key_cleanup") {
    return {
      applied: false,
      nextMode: mode,
      message: "Remove previous signed-intent key after rotation grace window, or extend grace intentionally."
    };
  }
  return {
    applied: false,
    nextMode: mode,
    message: "Governance posture is already healthy."
  };
}

export function executeRecommendedRemediations(
  recommendations: ControlPlaneRecommendation[],
  startMode: SovereignExecutionMode,
  policy: ForgeGovernancePolicy
) {
  let mode = startMode;
  const outcomes = recommendations.map((recommendation) => {
    const out = executeControlPlaneRemediation(recommendation.code, mode, policy);
    mode = out.nextMode;
    return {
      action: recommendation.code,
      ...out
    };
  });
  return {
    nextMode: mode,
    outcomes
  };
}
