import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";
import type { AutoMemoryEventV1 } from "./autoMemory.js";
import type { AutoLongHorizonPlanV1 } from "./autoLongHorizonPlanner.js";
import { buildWorkDashboard } from "../work/workDashboard.js";
import { getSelfHeuristicOverridesV1 } from "../self/selfHeuristics.js";
import { getEvolvedAutoStrategyProfilesV1 } from "../self/selfStrategyEvolution.js";

export type AutoStrategyV1 = {
  plannerPreference: "v4" | "v3" | "v2";
  correctionBudget: number;
  driftMitigationPriority: "normal" | "high";
  testStabilizationPriority: "normal" | "high";
  mode: "risk_first" | "stability_first";
  selectionWeights: { risk: number; drift: number; forecast: number; stability: number };
  sessionLength: number;
  sessionCadenceMs: number;
  rationale: string[];
};

export async function computeAutoStrategy(
  projectRoot: string,
  longHorizonPlan: AutoLongHorizonPlanV1,
  memory: AutoMemoryEventV1[],
  sdlcInsights: SdlcInsightsBundleV2
): Promise<AutoStrategyV1> {
  const dashboard = await buildWorkDashboard(projectRoot);
  const plannerFailures = memory.filter((m) => m.category === "planner_pattern" && m.outcome === "failure").length;
  const execFailures = memory.filter((m) => m.category === "executor_pattern" && m.outcome === "failure").length;
  const mode: AutoStrategyV1["mode"] =
    dashboard.slaDrift.severity === "severe" ||
    dashboard.slaDrift.severity === "critical" ||
    sdlcInsights.heuristics.stabilityScore < 65
      ? "stability_first"
      : "risk_first";
  const plannerPreference: AutoStrategyV1["plannerPreference"] =
    plannerFailures >= 6 ? "v2" : plannerFailures >= 3 ? "v3" : "v4";
  const correctionBudget = execFailures >= 5 ? 1 : execFailures >= 2 ? 2 : 3;
  const driftMitigationPriority: AutoStrategyV1["driftMitigationPriority"] =
    sdlcInsights.drift.score >= 60 || longHorizonPlan.longHorizonGoals.some((g) => /drift/i.test(g))
      ? "high"
      : "normal";
  const testStabilizationPriority: AutoStrategyV1["testStabilizationPriority"] =
    mode === "stability_first" ? "high" : "normal";
  const selectionWeights =
    mode === "risk_first"
      ? { risk: 0.45, drift: 0.25, forecast: 0.2, stability: 0.1 }
      : { risk: 0.3, drift: 0.2, forecast: 0.15, stability: 0.35 };
  const heuristicOverrides = getSelfHeuristicOverridesV1();
  const evolved = getEvolvedAutoStrategyProfilesV1();
  const mappedProfileId =
    mode === "stability_first"
      ? heuristicOverrides && heuristicOverrides.thresholds.slaSeverityTrigger < 58
        ? "conservative_mode"
        : "stabilize_mode"
      : evolved?.recommendedDefaultProfile ?? "explore_mode";
  const mappedProfile = evolved?.updatedStrategyProfiles.find((p) => p.id === mappedProfileId) ?? null;
  return {
    plannerPreference: mappedProfile?.plannerPreference ?? plannerPreference,
    correctionBudget: mappedProfile?.correctionBudget ?? correctionBudget,
    driftMitigationPriority,
    testStabilizationPriority,
    mode: mappedProfile?.mode ?? mode,
    selectionWeights:
      mappedProfile?.selectionWeights ??
      (heuristicOverrides
        ? {
            risk: heuristicOverrides.weights.risk,
            drift: heuristicOverrides.weights.drift,
            forecast: heuristicOverrides.weights.forecast,
            stability: Math.max(
              0.05,
              Math.min(0.7, 1 - (heuristicOverrides.weights.risk + heuristicOverrides.weights.drift + heuristicOverrides.weights.forecast) * 0.6)
            )
          }
        : selectionWeights),
    sessionLength: mode === "stability_first" ? 4 : 6,
    sessionCadenceMs: mode === "stability_first" ? 45_000 : 30_000,
    rationale: [
      `plannerFailures=${plannerFailures} execFailures=${execFailures}`,
      `slaSeverity=${dashboard.slaDrift.severity} stability=${sdlcInsights.heuristics.stabilityScore}`,
      `goalCount=${longHorizonPlan.longHorizonGoals.length}`,
      `profile=${mappedProfileId}`
    ]
  };
}
