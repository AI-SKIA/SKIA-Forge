import type { SovereignExecutionMode } from "../../../forgeGovernance.js";
import type { AnomalyReportV1 } from "./healingDetector.js";

export type HealingActionTypeV1 = "restart" | "rollback" | "scale" | "alert";

export type HealingActionPlanV1 = {
  action: HealingActionTypeV1;
  service: string;
  reason: string;
  requiresApproval: boolean;
  safeToAutoRemediate: boolean;
  escalation: "none" | "human_review";
};

export function chooseHealingAction(
  anomaly: AnomalyReportV1,
  mode: SovereignExecutionMode
): HealingActionPlanV1 {
  const baseAction: HealingActionTypeV1 =
    anomaly.type === "restarts" ? "rollback" : anomaly.type === "latency" ? "scale" : "restart";
  const requiresApproval = mode === "strict" || anomaly.severity === "critical";
  const safeToAutoRemediate = mode === "autonomous" && anomaly.severity !== "critical";
  return {
    action: baseAction,
    service: anomaly.service,
    reason: `${anomaly.type}=${anomaly.observedValue} exceeded ${anomaly.threshold}`,
    requiresApproval,
    safeToAutoRemediate,
    escalation: requiresApproval && !safeToAutoRemediate ? "human_review" : "none"
  };
}

