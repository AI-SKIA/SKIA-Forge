import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { buildWorkDashboard } from "../work/workDashboard.js";
import { buildSdlcInsightsBundle } from "../sdlc/sdlcInsights.js";
import { queryAutoMemory } from "./autoMemory.js";
import { listAutoSessions } from "./autoSessionModel.js";
import { getLastArchitectureEvolutionScoreV1 } from "../self/selfArchitectureScoring.js";

export type AutoLongHorizonPlanV1 = {
  longHorizonGoals: string[];
  recommendedWorkItems: string[];
  recommendedOrdering: string[];
  rationale: string[];
  riskForecast: string[];
  expectedOutcome: string[];
};

export async function planLongHorizonGoals(
  projectRoot: string,
  options?: { maxGoals?: number }
): Promise<AutoLongHorizonPlanV1> {
  const maxGoals = Math.max(1, Math.min(10, options?.maxGoals ?? 5));
  const [dashboard, sdlc, memory, sessions] = await Promise.all([
    buildWorkDashboard(projectRoot),
    buildSdlcInsightsBundle(projectRoot),
    queryAutoMemory(projectRoot, { limit: 500 }),
    listAutoSessions(projectRoot, { limit: 25 })
  ]);
  const goals: string[] = [];
  if (sdlc.heuristics.stabilityScore < 70) goals.push("improve stability score");
  if (sdlc.risk.project.class === "critical" || sdlc.risk.project.class === "high") {
    goals.push("reduce risk class from critical -> medium");
  }
  if (sdlc.drift.score >= 55) goals.push("eliminate drift in module");
  if (dashboard.slaDrift.severity === "severe" || dashboard.slaDrift.severity === "critical") {
    goals.push("reduce SLA drift");
  }
  if (dashboard.roadmap.phases.length > 0) goals.push(`complete roadmap phase ${dashboard.roadmap.phases[0]!.id}`);
  if (dashboard.architectureAdvice.persistentDriftModules.length > 0) {
    goals.push("stabilize architecture boundaries in persistent drift modules");
  }
  if (dashboard.architectureAdvice.cycleNodes.length > 0) {
    goals.push("reduce dependency cycles in critical graph nodes");
  }
  const architectureScore = getLastArchitectureEvolutionScoreV1();
  if (architectureScore && architectureScore.architectureImprovementScore < 60) {
    goals.unshift("prioritize high-impact architecture optimization goals");
  }
  if (goals.length === 0) goals.push("stabilize entire subsystem");
  const recommendedWorkItems = dashboard.recommendedNextWorkItems.map((x) => x.workItemId).slice(0, 12);
  const recommendedOrdering = [...dashboard.criticalPath, ...recommendedWorkItems].filter(
    (x, i, arr) => arr.indexOf(x) === i
  );
  const plannerFailures = memory.filter((m) => m.category === "planner_pattern" && m.outcome === "failure").length;
  const rationale = [
    `health=${dashboard.sdlcSummary.healthScore} riskClass=${dashboard.sdlcSummary.riskClass} drift=${dashboard.sdlcSummary.driftScore}`,
    `slaSeverity=${dashboard.slaDrift.severity} governanceViolations=${dashboard.governance.violations.length}`,
    `memory plannerFailures=${plannerFailures} sessionsSeen=${sessions.length}`,
    `architectureAdvice=${dashboard.architectureAdvice.recommendations.slice(0, 2).join("; ")}`,
    `architectureImprovementScore=${architectureScore?.architectureImprovementScore ?? "n/a"}`
  ];
  const riskForecast = [
    `globalNextFailureProbability=${sdlc.forecast.globalNextFailureProbability}`,
    `nextRollbackProbability=${sdlc.forecast.nextAgentRollbackProbability}`,
    `nextTestRegressionProbability=${sdlc.forecast.nextTestRegressionProbability}`
  ];
  const expectedOutcome = [
    "Lower risk class and reduced failure forecast over successive sessions.",
    "Improved roadmap phase readiness and governance compliance.",
    "Reduced SLA drift severity."
  ];
  const out: AutoLongHorizonPlanV1 = {
    longHorizonGoals: goals.slice(0, maxGoals),
    recommendedWorkItems,
    recommendedOrdering,
    rationale,
    riskForecast,
    expectedOutcome
  };
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "auto.longHorizon.plan",
    parameters: mergeForgeAuditParamsV1("auto_long_horizon", out),
    result: "success"
  });
  return out;
}
