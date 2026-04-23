import type { WorkItemV1 } from "./workItemModel.js";
import type { WorkBreakdownV1 } from "./workDecomposition.js";
import type { WorkPriorityV1 } from "./workPrioritization.js";
import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";

export type WorkPlanV2Task = {
  id: string;
  title: string;
  detail: string;
  tool: string;
  input: unknown;
  dependsOn?: string[];
  risk: number;
  rationale: string;
};

export type WorkPlanV2 = {
  version: "2";
  title: string;
  goalRestatement: string;
  tasks: WorkPlanV2Task[];
  assumptions: string[];
  risks: string[];
  governanceWarnings: string[];
};

function toolForTask(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("test")) return "run_terminal";
  if (t.includes("dependency")) return "run_terminal";
  if (t.includes("architecture")) return "search_codebase";
  return "search_codebase";
}

export function buildWorkPlanV2(input: {
  workItem: WorkItemV1;
  breakdown: WorkBreakdownV1;
  priority: WorkPriorityV1;
  insights: SdlcInsightsBundleV2;
}): WorkPlanV2 {
  const tasks: WorkPlanV2Task[] = input.breakdown.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    detail: t.detail,
    tool: toolForTask(t.title),
    input:
      toolForTask(t.title) === "run_terminal"
        ? { command: "npm run test" }
        : { query: t.title, path: t.relatedFiles[0] ?? input.workItem.relatedFiles[0] ?? "" },
    ...(t.dependsOn ? { dependsOn: t.dependsOn } : {}),
    risk: t.estimatedRisk,
    rationale: `Priority=${input.priority.recommendedPriority}; urgency=${input.priority.urgencyScore}; based on SDLC risk and drift.`
  }));
  const governanceWarnings: string[] = [];
  if (input.insights.forecast.nextAgentRollbackProbability >= 60) {
    governanceWarnings.push("High rollback probability: prefer smaller, reviewable task batches.");
  }
  if (input.insights.risk.project.class === "critical") {
    governanceWarnings.push("Project risk is critical: enforce explicit approvals for mutation-heavy tasks.");
  }
  return {
    version: "2",
    title: input.workItem.title,
    goalRestatement: input.workItem.description,
    tasks,
    assumptions: [
      "Current SDLC telemetry is representative of present code health.",
      "Tool registry supports selected task operations."
    ],
    risks: [
      ...input.priority.rationale,
      `Forecast next failure probability=${input.insights.forecast.globalNextFailureProbability}.`
    ],
    governanceWarnings
  };
}
