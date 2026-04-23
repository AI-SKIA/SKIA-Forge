import type { WorkGovernanceStatusV1 } from "../work/workGovernance.js";
import type { WorkSlaDriftV1 } from "../work/workSlaDrift.js";
import type { AutoExecutionSessionV1 } from "./autoSessionModel.js";
import type { AutoStabilityV1 } from "./autoStability.js";

export type AutoSafetyV1 = {
  safetyStatus: "safe" | "warning" | "unsafe" | "critical";
  recommendedAction: "continue" | "slowDown" | "pause" | "halt" | "require_human_review";
  notes: string[];
};

export function evaluateAutoSafety(
  session: AutoExecutionSessionV1,
  stability: AutoStabilityV1,
  governance: WorkGovernanceStatusV1,
  slaDrift: WorkSlaDriftV1
): AutoSafetyV1 {
  const steps = session.steps.slice(-30);
  const plannerFallback = steps.filter((s) => s.type === "plan" && /planVersion=v[23]/i.test(s.notes ?? "")).length;
  const runawaySelfCorrect = steps.filter((s) => s.type === "selfCorrect").length >= 10;
  const criticalFailures = steps.filter((s) => s.outcome === "failure").length >= 10;
  const govViolations = governance.violations.length;
  const slaCritical = slaDrift.severity === "critical";
  const excessiveWriteHints = steps.filter((s) => /write|mutation|churn/i.test(s.notes ?? "")).length >= 8;
  let score = 0;
  if (stability.stabilityStatus === "degraded") score += 2;
  if (stability.stabilityStatus === "critical") score += 4;
  if (govViolations > 0) score += 2;
  if (slaDrift.severity === "severe") score += 2;
  if (slaCritical) score += 4;
  if (criticalFailures) score += 3;
  if (runawaySelfCorrect) score += 3;
  if (plannerFallback >= 5) score += 2;
  if (excessiveWriteHints) score += 2;
  const safetyStatus: AutoSafetyV1["safetyStatus"] =
    score <= 2 ? "safe" : score <= 5 ? "warning" : score <= 9 ? "unsafe" : "critical";
  const recommendedAction: AutoSafetyV1["recommendedAction"] =
    safetyStatus === "safe"
      ? "continue"
      : safetyStatus === "warning"
        ? "slowDown"
        : safetyStatus === "unsafe"
          ? "pause"
          : slaCritical || govViolations > 0
            ? "require_human_review"
            : "halt";
  return {
    safetyStatus,
    recommendedAction,
    notes: [
      `stability=${stability.stabilityStatus}`,
      `governanceViolations=${govViolations}`,
      `slaSeverity=${slaDrift.severity}`,
      `plannerFallback=${plannerFallback}`,
      `criticalFailures=${criticalFailures}`,
      `runawaySelfCorrect=${runawaySelfCorrect}`,
      `excessiveWriteHints=${excessiveWriteHints}`
    ]
  };
}
