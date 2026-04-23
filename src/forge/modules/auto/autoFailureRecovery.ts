import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";
import type { AutoExecutionSessionStepV1, AutoExecutionSessionV1 } from "./autoSessionModel.js";
import type { AutoMemoryEventV1 } from "./autoMemory.js";

export type AutoFailureRecoveryV1 = {
  failureCategory: "planner" | "executor" | "selfCorrect" | "governance" | "sdlc";
  severity: "low" | "medium" | "high" | "critical";
  recommendedRecoveryActions: string[];
  notes: string[];
};

function recentCount(
  steps: AutoExecutionSessionStepV1[],
  pred: (s: AutoExecutionSessionStepV1) => boolean,
  window: number = 6
): number {
  return steps.slice(-window).filter(pred).length;
}

export function analyzeAutoFailure(
  session: AutoExecutionSessionV1,
  lastStep: AutoExecutionSessionStepV1 | null,
  sdlcInsights: SdlcInsightsBundleV2,
  memoryEvents: AutoMemoryEventV1[] = []
): AutoFailureRecoveryV1 {
  const steps = session.steps;
  const plannerFails = recentCount(steps, (s) => s.type === "plan" && s.outcome === "failure");
  const executorFails = recentCount(steps, (s) => s.type === "execute" && s.outcome === "failure");
  const selfCorrectLoops = recentCount(steps, (s) => s.type === "selfCorrect" && /cycle/i.test(s.notes ?? ""));
  const haltSignals = recentCount(
    steps,
    (s) => (s.type === "governanceCheck" || s.type === "slaCheck") && s.outcome === "failure"
  );
  const sdlcRegression = sdlcInsights.forecast.globalNextFailureProbability >= 70 || sdlcInsights.drift.score >= 65;
  const memoryPlannerFails = memoryEvents.filter((m) => m.category === "planner_pattern" && m.outcome === "failure").length;
  const memoryExecutorFails = memoryEvents.filter((m) => m.category === "executor_pattern" && m.outcome === "failure").length;

  let failureCategory: AutoFailureRecoveryV1["failureCategory"] = "executor";
  let points = 0;
  if (plannerFails + memoryPlannerFails >= 3 || /parse/i.test(lastStep?.notes ?? "")) {
    failureCategory = "planner";
    points += 3;
  } else if (executorFails + memoryExecutorFails >= 3) {
    failureCategory = "executor";
    points += 3;
  } else if (selfCorrectLoops >= 3) {
    failureCategory = "selfCorrect";
    points += 2;
  } else if (haltSignals >= 2) {
    failureCategory = "governance";
    points += 2;
  } else if (sdlcRegression) {
    failureCategory = "sdlc";
    points += 2;
  }
  points += plannerFails + executorFails + Math.floor(selfCorrectLoops / 2) + haltSignals;
  const severity: AutoFailureRecoveryV1["severity"] =
    points <= 1 ? "low" : points <= 3 ? "medium" : points <= 6 ? "high" : "critical";

  const recommendedRecoveryActions: string[] = [];
  if (failureCategory === "planner") {
    recommendedRecoveryActions.push("regenerate plan with different planner version");
  }
  if (failureCategory === "executor") {
    recommendedRecoveryActions.push("isolate failing WorkItem");
  }
  if (failureCategory === "selfCorrect") {
    recommendedRecoveryActions.push("force test stabilization");
  }
  if (failureCategory === "governance") {
    recommendedRecoveryActions.push("re-prioritize WorkItems");
    recommendedRecoveryActions.push("halt auto mode");
  }
  if (failureCategory === "sdlc") {
    recommendedRecoveryActions.push("force drift mitigation");
    recommendedRecoveryActions.push("force test stabilization");
  }
  if (severity === "critical" && !recommendedRecoveryActions.includes("halt auto mode")) {
    recommendedRecoveryActions.push("halt auto mode");
  }
  return {
    failureCategory,
    severity,
    recommendedRecoveryActions,
    notes: [
      `plannerFails=${plannerFails}`,
      `executorFails=${executorFails}`,
      `selfCorrectLoops=${selfCorrectLoops}`,
      `governanceOrSlaHalts=${haltSignals}`,
      `sdlcRegression=${sdlcRegression}`
    ]
  };
}
