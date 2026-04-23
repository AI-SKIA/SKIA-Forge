import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { buildSdlcInsightsBundle } from "../sdlc/sdlcInsights.js";
import { queryWorkItems, type WorkItemTypeV1, type WorkItemV1 } from "../work/workItemModel.js";
import { buildWorkDashboard } from "../work/workDashboard.js";
import { queryAutoMemory } from "./autoMemory.js";
import type { AutoLongHorizonPlanV1 } from "./autoLongHorizonPlanner.js";

export type AutoTaskSelectionItemV1 = {
  workItemId: string;
  score: number;
  rationale: string[];
  governanceJustification: string[];
  slaJustification: string[];
  riskJustification: string[];
};

export type AutoTaskSelectionV1 = {
  selected: AutoTaskSelectionItemV1[];
  generatedAt: string;
};

export async function selectNextWorkItems(
  projectRoot: string,
  options?: {
    maxItems?: number;
    allowedTypes?: WorkItemTypeV1[];
    riskThreshold?: number;
    includeBlocked?: boolean;
    longHorizonPlan?: AutoLongHorizonPlanV1 | null;
  }
): Promise<AutoTaskSelectionV1> {
  const maxItems = Math.max(1, Math.min(20, options?.maxItems ?? 5));
  const dashboard = await buildWorkDashboard(projectRoot);
  const sdlc = await buildSdlcInsightsBundle(projectRoot);
  const memory = await queryAutoMemory(projectRoot, { limit: 500 });
  const all = await queryWorkItems(projectRoot, { limit: 500 });
  const allowed = options?.allowedTypes ? new Set(options.allowedTypes) : null;
  const riskThreshold = options?.riskThreshold ?? 0;
  const pool = all
    .filter((w) => (allowed ? allowed.has(w.type) : true))
    .filter((w) => (options?.includeBlocked ? true : w.status !== "blocked"))
    .filter((w) => w.sdlcSignals.risk >= riskThreshold);
  const selected = pool
    .map((w): AutoTaskSelectionItemV1 => {
      const workMem = memory.filter((m) => m.workItemId === w.id);
      const memSuccess = workMem.filter((m) => m.outcome === "success").length;
      const memFailure = workMem.filter((m) => m.outcome === "failure").length;
      const memoryAdjustment = memSuccess * 3 - memFailure * 4;
      const blockedPenalty = w.status === "blocked" ? -25 : 0;
      const goalBoost =
        options?.longHorizonPlan?.recommendedWorkItems.includes(w.id) ||
        options?.longHorizonPlan?.recommendedOrdering.includes(w.id)
          ? 14
          : 0;
      const score =
        w.sdlcSignals.risk * 0.45 +
        w.sdlcSignals.drift * 0.25 +
        w.sdlcSignals.forecast * 0.2 +
        (dashboard.criticalPath.includes(w.id) ? 12 : 0) +
        goalBoost +
        memoryAdjustment +
        blockedPenalty;
      return {
        workItemId: w.id,
        score: Math.round(score),
        rationale: [
          `risk=${w.sdlcSignals.risk} drift=${w.sdlcSignals.drift} forecast=${w.sdlcSignals.forecast}`,
          dashboard.criticalPath.includes(w.id) ? "on critical path" : "off critical path",
          `projectRisk=${sdlc.risk.project.class}`,
          `memory success=${memSuccess} failure=${memFailure}`,
          `goalAwareBoost=${goalBoost}`
        ],
        governanceJustification: [
          ...dashboard.governance.violations,
          ...dashboard.governance.warnings,
          `policy completion target=${dashboard.governance.policy.targetCompletionPercent}%`
        ],
        slaJustification: [
          `slaSeverity=${dashboard.slaDrift.severity}`,
          ...dashboard.slaDrift.notes
        ],
        riskJustification: [
          `globalFailureForecast=${sdlc.forecast.globalNextFailureProbability}`,
          `rollbackForecast=${sdlc.forecast.nextAgentRollbackProbability}`
        ]
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems);
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "auto.taskSelection",
    parameters: mergeForgeAuditParamsV1("auto_task_selector", {
      options: options ?? null,
      selectedCount: selected.length,
      selected
    }),
    result: "success"
  });
  return { selected, generatedAt: new Date().toISOString() };
}

export function mapSelectionToItems(
  items: WorkItemV1[],
  selection: AutoTaskSelectionV1
): WorkItemV1[] {
  const byId = new Map(items.map((w) => [w.id, w]));
  return selection.selected.map((x) => byId.get(x.workItemId)).filter((x): x is WorkItemV1 => Boolean(x));
}
