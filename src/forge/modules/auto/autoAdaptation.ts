import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";
import type { AutoExecutionSessionV1 } from "./autoSessionModel.js";
import type { AutoFailureRecoveryV1 } from "./autoFailureRecovery.js";
import type { AutoMemoryEventV1 } from "./autoMemory.js";

export type AutoAdaptationV1 = {
  updatedStrategy: {
    plannerPreference: "v4" | "v3" | "v2";
    selectionWeights: { risk: number; drift: number; forecast: number; stability: number };
    correctionBudget: number;
    driftMitigationMode: "normal" | "strict";
    stabilityMode: "normal" | "stabilize_first";
  };
  notes: string[];
};

export function adaptAutoStrategy(
  session: AutoExecutionSessionV1,
  failureRecovery: AutoFailureRecoveryV1,
  sdlcInsights: SdlcInsightsBundleV2,
  memoryEvents: AutoMemoryEventV1[] = []
): AutoAdaptationV1 {
  const plannerFailures = memoryEvents.filter((m) => m.category === "planner_pattern" && m.outcome === "failure").length;
  const fallbackCount = session.steps.filter((s) => s.type === "plan" && /planVersion=v[23]/i.test(s.notes ?? "")).length;
  let plannerPreference: "v4" | "v3" | "v2" = "v4";
  if (failureRecovery.failureCategory === "planner" || plannerFailures >= 3 || fallbackCount >= 3) plannerPreference = "v3";
  if (plannerFailures >= 6) plannerPreference = "v2";
  const stabilityFirst =
    failureRecovery.failureCategory === "sdlc" ||
    failureRecovery.failureCategory === "selfCorrect" ||
    sdlcInsights.heuristics.stabilityScore < 60;
  const riskWeight = stabilityFirst ? 0.35 : 0.45;
  const driftWeight = stabilityFirst ? 0.25 : 0.25;
  const forecastWeight = stabilityFirst ? 0.15 : 0.2;
  const stabilityWeight = stabilityFirst ? 0.25 : 0.1;
  const correctionBudget =
    failureRecovery.severity === "critical" ? 1 : failureRecovery.severity === "high" ? 2 : 3;
  return {
    updatedStrategy: {
      plannerPreference,
      selectionWeights: {
        risk: riskWeight,
        drift: driftWeight,
        forecast: forecastWeight,
        stability: stabilityWeight
      },
      correctionBudget,
      driftMitigationMode:
        sdlcInsights.drift.score >= 60 || failureRecovery.recommendedRecoveryActions.includes("force drift mitigation")
          ? "strict"
          : "normal",
      stabilityMode: stabilityFirst ? "stabilize_first" : "normal"
    },
    notes: [
      `plannerPreference=${plannerPreference}`,
      `stabilityScore=${sdlcInsights.heuristics.stabilityScore}`,
      `failureSeverity=${failureRecovery.severity}`,
      `correctionBudget=${correctionBudget}`
    ]
  };
}
