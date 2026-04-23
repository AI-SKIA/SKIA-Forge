import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import type { GlobalContextGraphV1 } from "./globalContextGraph.js";

export type GlobalWorkPlanV1 = {
  globalWorkItems: Array<{ repo: string; path: string; rationale: string[] }>;
  globalOrdering: string[];
  globalImpactSummary: string[];
  globalRiskForecast: string[];
  globalRecommendedActions: string[];
};
let latestGlobalWorkPlan: GlobalWorkPlanV1 | null = null;

export function getLatestGlobalWorkPlanV1(): GlobalWorkPlanV1 | null {
  return latestGlobalWorkPlan;
}

export async function planGlobalWork(
  globalContextGraph: GlobalContextGraphV1,
  options?: { maxItems?: number }
): Promise<GlobalWorkPlanV1> {
  const maxItems = Math.max(5, Math.min(100, options?.maxItems ?? 30));
  const items: GlobalWorkPlanV1["globalWorkItems"] = [];
  for (const hotspot of globalContextGraph.globalHotspotRanking.slice(0, maxItems)) {
    const repo = hotspot.repos[0] ?? "unknown";
    items.push({
      repo,
      path: hotspot.path,
      rationale: [
        "global hotspot across repositories",
        `score=${hotspot.score}`,
        `repos=${hotspot.repos.length}`
      ]
    });
  }
  for (const m of globalContextGraph.sharedModules.slice(0, 10)) {
    const repo = globalContextGraph.repos.find((r) =>
      r.workGraph.nodes.some((n) => n.relatedFiles.some((f) => f.toLowerCase() === m))
    )?.projectRoot;
    if (repo) {
      items.push({
        repo,
        path: m,
        rationale: ["shared module stabilization target", "cross-repo dependency alignment"]
      });
    }
  }
  const dedup = new Map<string, GlobalWorkPlanV1["globalWorkItems"][number]>();
  for (const it of items) dedup.set(`${it.repo}::${it.path}`, it);
  const globalWorkItems = [...dedup.values()].slice(0, maxItems);
  const globalOrdering = [
    ...globalContextGraph.crossRepoCriticalPath,
    ...globalWorkItems.map((x) => `${x.repo}:${x.path}`)
  ].filter((x, i, arr) => arr.indexOf(x) === i);
  const globalImpactSummary = [
    `repos=${globalContextGraph.repos.length}`,
    `sharedModules=${globalContextGraph.sharedModules.length}`,
    `sharedLibraries=${globalContextGraph.sharedLibraries.length}`,
    `criticalPath=${globalContextGraph.crossRepoCriticalPath.length}`
  ];
  const globalRiskForecast = [
    `globalRiskPropagation=${globalContextGraph.globalRiskPropagation}`,
    `globalDriftPropagation=${globalContextGraph.globalDriftPropagation}`,
    `globalHotspots=${globalContextGraph.globalHotspotRanking.length}`
  ];
  const globalRecommendedActions = [
    "stabilize shared modules first",
    "reduce global drift in critical-path repos",
    "resolve cross-repo dependency cycles",
    "align roadmap stabilize-first phases"
  ];
  const out: GlobalWorkPlanV1 = {
    globalWorkItems,
    globalOrdering,
    globalImpactSummary,
    globalRiskForecast,
    globalRecommendedActions
  };
  latestGlobalWorkPlan = out;
  await appendAuditLog(globalContextGraph.repos[0]?.projectRoot ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.plan",
    parameters: mergeForgeAuditParamsV1("global_planner", {
      itemCount: globalWorkItems.length,
      orderingCount: globalOrdering.length
    }),
    result: "success"
  });
  return out;
}
