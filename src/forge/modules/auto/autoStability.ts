import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";
import type { AutoExecutionSessionV1 } from "./autoSessionModel.js";
import type { AutoAdaptationV1 } from "./autoAdaptation.js";
import type { AutoMemoryEventV1 } from "./autoMemory.js";

export type AutoStabilityV1 = {
  stabilityStatus: "stable" | "unstable" | "degraded" | "critical";
  recommendedAction: "continue" | "slowDown" | "pause" | "halt" | "require_human_review";
  notes: string[];
};

export function evaluateAutoStability(
  session: AutoExecutionSessionV1,
  adaptation: AutoAdaptationV1,
  memory: AutoMemoryEventV1[],
  sdlcInsights: SdlcInsightsBundleV2
): AutoStabilityV1 {
  const steps = session.steps.slice(-20);
  const executeFails = steps.filter((s) => s.type === "execute" && s.outcome === "failure").length;
  const slaFails = steps.filter((s) => s.type === "slaCheck" && s.outcome === "failure").length;
  const planFallbackLoops = steps.filter((s) => s.type === "plan" && /planVersion=v[23]/i.test(s.notes ?? "")).length;
  const rollbackCycles = memory.filter((m) => m.category === "executor_pattern" && /rollback/i.test(m.details ?? "") && m.outcome === "failure").length;
  const oscillation =
    steps.filter((s) => s.type === "adaptation").length >= 4 &&
    steps.filter((s) => s.type === "adaptation" && /(plannerPreference=v3|plannerPreference=v2)/i.test(s.notes ?? "")).length >= 2;
  let score = executeFails * 2 + slaFails * 2 + planFallbackLoops + rollbackCycles;
  if (oscillation) score += 3;
  if (sdlcInsights.forecast.globalNextFailureProbability >= 75) score += 2;
  const stabilityStatus: AutoStabilityV1["stabilityStatus"] =
    score <= 2 ? "stable" : score <= 5 ? "unstable" : score <= 9 ? "degraded" : "critical";
  const recommendedAction: AutoStabilityV1["recommendedAction"] =
    stabilityStatus === "stable"
      ? "continue"
      : stabilityStatus === "unstable"
        ? "slowDown"
        : stabilityStatus === "degraded"
          ? "pause"
          : oscillation || adaptation.updatedStrategy.plannerPreference === "v2"
            ? "require_human_review"
            : "halt";
  return {
    stabilityStatus,
    recommendedAction,
    notes: [
      `executeFails=${executeFails}`,
      `slaFails=${slaFails}`,
      `planFallbackLoops=${planFallbackLoops}`,
      `rollbackCycles=${rollbackCycles}`,
      `oscillation=${oscillation}`
    ]
  };
}
