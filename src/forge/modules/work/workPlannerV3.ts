import type { WorkItemV1 } from "./workItemModel.js";
import type { WorkGraphV1 } from "./workGraph.js";
import type { WorkScheduleV1 } from "./workScheduler.js";
import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";

export type WorkPlanV3Task = {
  id: string;
  title: string;
  detail: string;
  tool: string;
  input: unknown;
  dependsOn?: string[];
  risk: number;
  rationale: string;
  workItemIds: string[];
};

export type WorkPlanV3 = {
  version: "3";
  title: string;
  tasks: WorkPlanV3Task[];
  rationale: string[];
  governanceWarnings: string[];
  sdlcContext: string[];
};

function toolForItemType(t: WorkItemV1["type"]): string {
  if (t === "test" || t === "infra") return "run_terminal";
  return "search_codebase";
}

export function buildWorkPlanV3(input: {
  workItems: WorkItemV1[];
  graph: WorkGraphV1;
  schedule: WorkScheduleV1;
  insights: SdlcInsightsBundleV2;
}): WorkPlanV3 {
  const byId = new Map(input.workItems.map((w) => [w.id, w]));
  const tasks: WorkPlanV3Task[] = [];
  const ordered = input.schedule.orderedWorkItemIds.filter((id) => byId.has(id));
  for (const id of ordered) {
    const w = byId.get(id)!;
    tasks.push({
      id: `w3-${id}`,
      title: w.title,
      detail: `${w.description}\n[type=${w.type} priority=${w.priority}]`,
      tool: toolForItemType(w.type),
      input:
        toolForItemType(w.type) === "run_terminal"
          ? { command: w.type === "test" ? "npm run test" : "npm run lint" }
          : { query: w.title, path: w.relatedFiles[0] ?? "" },
      ...(w.dependencies.length ? { dependsOn: w.dependencies.map((d) => `w3-${d}`) } : {}),
      risk: w.sdlcSignals.risk,
      rationale: `Scheduled via work graph/scheduler; drift=${w.sdlcSignals.drift} forecast=${w.sdlcSignals.forecast}.`,
      workItemIds: [w.id]
    });
  }
  // shared tasks
  const sharedRefactor = input.workItems.filter((w) => w.type === "refactor");
  if (sharedRefactor.length > 1) {
    tasks.push({
      id: "w3-shared-refactor",
      title: "Shared refactor coordination",
      detail: "Consolidate repeated refactor changes across related work items.",
      tool: "search_codebase",
      input: { query: "shared refactor", path: sharedRefactor[0]!.relatedFiles[0] ?? "" },
      dependsOn: sharedRefactor.map((w) => `w3-${w.id}`),
      risk: Math.max(...sharedRefactor.map((w) => w.sdlcSignals.risk)),
      rationale: "Generated because multiple refactor items are in scope.",
      workItemIds: sharedRefactor.map((w) => w.id)
    });
  }
  const sharedTests = input.workItems.filter((w) => w.relatedTests.length > 0);
  if (sharedTests.length > 1) {
    tasks.push({
      id: "w3-shared-tests",
      title: "Shared test stabilization",
      detail: "Stabilize overlapping tests affected by multiple work items.",
      tool: "run_terminal",
      input: { command: "npm run test" },
      dependsOn: sharedTests.map((w) => `w3-${w.id}`),
      risk: input.insights.forecast.nextTestRegressionProbability,
      rationale: "Generated from overlapping test surfaces.",
      workItemIds: sharedTests.map((w) => w.id)
    });
  }
  return {
    version: "3",
    title: `Multi-item plan (${input.workItems.length} items)`,
    tasks,
    rationale: [
      ...input.schedule.rationale,
      `Critical path: ${input.graph.criticalPath.join(" -> ") || "n/a"}`
    ],
    governanceWarnings: [...input.graph.governanceWarnings],
    sdlcContext: [
      `health=${input.insights.healthScore}`,
      `riskClass=${input.insights.risk.project.class}`,
      `forecastFailure=${input.insights.forecast.globalNextFailureProbability}`
    ]
  };
}
