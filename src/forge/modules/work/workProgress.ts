import { queryWorkItems } from "./workItemModel.js";
import { querySdlcEvents } from "../sdlc/sdlcEventModel.js";

export type WorkProgressItemV1 = {
  workItemId: string;
  completedTasks: number;
  totalTasks: number;
  completionPercent: number;
  lastUpdatedAt: string;
};

export type WorkProgressV1 = {
  items: WorkProgressItemV1[];
  project: {
    totalCompletedTasks: number;
    totalTasks: number;
    completionPercent: number;
    burndownSeries: Array<{ bucket: string; completed: number; remaining: number }>;
    estimatedCompletionTrend: "improving" | "degrading" | "flat";
  };
};

function pct(a: number, b: number): number {
  if (b <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((a / b) * 100)));
}

export async function buildWorkProgress(projectRoot: string): Promise<WorkProgressV1> {
  const [items, events] = await Promise.all([
    queryWorkItems(projectRoot, { limit: 500 }),
    querySdlcEvents(projectRoot, { types: ["agent_run", "planner_run"], limit: 2000 })
  ]);
  const mapped: WorkProgressItemV1[] = items.map((w) => {
    const totalTasks = Math.max(1, w.relatedFiles.length + w.relatedTests.length + Math.max(1, w.dependencies.length));
    const completedTasks = w.status === "done" ? totalTasks : w.status === "in_progress" ? Math.floor(totalTasks * 0.6) : 0;
    return {
      workItemId: w.id,
      completedTasks,
      totalTasks,
      completionPercent: pct(completedTasks, totalTasks),
      lastUpdatedAt: w.updatedAt
    };
  });
  const totalCompletedTasks = mapped.reduce((s, x) => s + x.completedTasks, 0);
  const totalTasks = mapped.reduce((s, x) => s + x.totalTasks, 0);
  const byDay = new Map<string, number>();
  for (const e of events) {
    if (e.status !== "success") continue;
    const day = e.timestamp.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const days = [...byDay.keys()].sort();
  let runningCompleted = 0;
  const burndownSeries = days.map((d) => {
    runningCompleted += byDay.get(d) ?? 0;
    return { bucket: d, completed: runningCompleted, remaining: Math.max(0, totalTasks - runningCompleted) };
  });
  const trend: "improving" | "degrading" | "flat" =
    burndownSeries.length >= 2
      ? burndownSeries[burndownSeries.length - 1]!.completed > burndownSeries[0]!.completed
        ? "improving"
        : "degrading"
      : "flat";
  return {
    items: mapped,
    project: {
      totalCompletedTasks,
      totalTasks,
      completionPercent: pct(totalCompletedTasks, totalTasks),
      burndownSeries,
      estimatedCompletionTrend: trend
    }
  };
}
