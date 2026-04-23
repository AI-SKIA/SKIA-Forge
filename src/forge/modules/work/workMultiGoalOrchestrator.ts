import type { WorkItemV1 } from "./workItemModel.js";
import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";
import type { WorkGraphV1 } from "./workGraph.js";
import type { WorkScheduleV1 } from "./workScheduler.js";
import { buildWorkPlanV3 } from "./workPlannerV3.js";

export type MultiGoalPlanV1 = {
  version: "1";
  goals: string[];
  combinedTasks: ReturnType<typeof buildWorkPlanV3>["tasks"];
  perGoalSubplans: Array<{ goal: string; workItemIds: string[]; taskIds: string[] }>;
  sharedTasks: ReturnType<typeof buildWorkPlanV3>["tasks"];
  governanceWarnings: string[];
  sdlcContext: string[];
};

function normalizeGoal(goal: string): string[] {
  return goal
    .split(/\band\b|,|;/i)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function detectCompoundGoals(goal: string): string[] {
  const pieces = normalizeGoal(goal);
  return pieces.length > 1 ? pieces : [goal.trim()];
}

export function buildMultiGoalPlan(input: {
  goals: string[];
  workItems: WorkItemV1[];
  graph: WorkGraphV1;
  schedule: WorkScheduleV1;
  insights: SdlcInsightsBundleV2;
}): MultiGoalPlanV1 {
  const goalToItems = input.goals.map((g) => {
    const l = g.toLowerCase();
    const items = input.workItems.filter(
      (w) =>
        w.title.toLowerCase().includes(l.slice(0, 16)) ||
        w.description.toLowerCase().includes(l.slice(0, 16)) ||
        w.relatedFiles.some((f) => l.includes(f.toLowerCase().split("/").at(-1) ?? ""))
    );
    return { goal: g, items: items.length ? items : input.workItems.slice(0, 1) };
  });
  const plans = goalToItems.map((x) =>
    buildWorkPlanV3({
      workItems: x.items,
      graph: input.graph,
      schedule: input.schedule,
      insights: input.insights
    })
  );
  const combinedTasks = plans.flatMap((p) => p.tasks);
  const sharedTasks = combinedTasks.filter((t) => t.workItemIds.length > 1 || t.id.includes("shared"));
  return {
    version: "1",
    goals: input.goals,
    combinedTasks,
    perGoalSubplans: goalToItems.map((x, i) => ({
      goal: x.goal,
      workItemIds: x.items.map((w) => w.id),
      taskIds: plans[i]!.tasks.map((t) => t.id)
    })),
    sharedTasks,
    governanceWarnings: [...new Set(plans.flatMap((p) => p.governanceWarnings))],
    sdlcContext: [...new Set(plans.flatMap((p) => p.sdlcContext))]
  };
}
