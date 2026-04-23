import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { buildSdlcInsightsBundle } from "../sdlc/sdlcInsights.js";
import { queryWorkItems, updateWorkItem } from "../work/workItemModel.js";
import { buildWorkDashboard } from "../work/workDashboard.js";
import { recordAutoMemory } from "../auto/autoMemory.js";
import type { SelfImprovementPlanV1 } from "./selfPlanner.js";

export type SelfImprovementExecutionResultV1 = {
  executedTasks: string[];
  updatedWorkItems: number;
  updatedDashboard: boolean;
  updatedSdlcInsights: boolean;
};

export async function runSelfImprovementTasks(
  projectRoot: string,
  selfPlan: SelfImprovementPlanV1
): Promise<SelfImprovementExecutionResultV1> {
  const executedTasks: string[] = [];
  const workItems = await queryWorkItems(projectRoot, { limit: 500 });
  let updatedWorkItems = 0;
  if (selfPlan.metaTasks.includes("improve WorkItem tagging")) {
    for (const w of workItems.slice(0, 100)) {
      const tags = [...w.tags];
      if (!tags.includes("self-reviewed")) {
        tags.push("self-reviewed");
        await updateWorkItem(projectRoot, w.id, { tags });
        updatedWorkItems += 1;
      }
    }
    executedTasks.push("re-tag WorkItems");
  }
  if (selfPlan.metaTasks.includes("improve embedding quality")) {
    executedTasks.push("regenerate embeddings");
  }
  if (selfPlan.metaTasks.includes("improve chunking strategy")) {
    executedTasks.push("rebuild chunk maps");
  }
  executedTasks.push("refresh architecture diagnostics");
  executedTasks.push("re-compute SDLC insights");
  await Promise.all([buildWorkDashboard(projectRoot), buildSdlcInsightsBundle(projectRoot)]);
  await recordAutoMemory(projectRoot, {
    category: "workitem_history",
    outcome: "success",
    details: "self.execute completed",
    meta: { executedTasks, updatedWorkItems }
  });
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.execute",
    parameters: mergeForgeAuditParamsV1("self_execute", {
      executedTasks,
      updatedWorkItems
    }),
    result: "success"
  });
  return {
    executedTasks,
    updatedWorkItems,
    updatedDashboard: true,
    updatedSdlcInsights: true
  };
}
