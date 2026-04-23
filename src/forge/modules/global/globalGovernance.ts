import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import type { GlobalContextGraphV1 } from "./globalContextGraph.js";
import type { GlobalWorkPlanV1 } from "./globalPlanner.js";
import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";

export type GlobalGovernanceV1 = {
  governanceStatus: "compliant" | "warning" | "failing";
  governanceNotes: string[];
  requiredGovernanceActions: string[];
  repoSpecificGovernanceDeltas: Array<{ repo: string; delta: string[] }>;
};
let latestGlobalGovernance: GlobalGovernanceV1 | null = null;

export function getLatestGlobalGovernanceV1(): GlobalGovernanceV1 | null {
  return latestGlobalGovernance;
}

export async function evaluateGlobalGovernance(
  globalContextGraph: GlobalContextGraphV1,
  globalPlan: GlobalWorkPlanV1,
  sdlcInsightsPerRepo: Array<{ projectRoot: string; sdlcInsights: SdlcInsightsBundleV2 }>
): Promise<GlobalGovernanceV1> {
  const notes: string[] = [];
  const actions: string[] = [];
  const deltas: GlobalGovernanceV1["repoSpecificGovernanceDeltas"] = [];
  const avgRisk =
    sdlcInsightsPerRepo.reduce((s, x) => s + x.sdlcInsights.heuristics.riskScore, 0) / Math.max(1, sdlcInsightsPerRepo.length);
  const avgDrift =
    sdlcInsightsPerRepo.reduce((s, x) => s + x.sdlcInsights.drift.score, 0) / Math.max(1, sdlcInsightsPerRepo.length);
  if (avgRisk > 65) {
    notes.push("Cross-repo risk remains elevated.");
    actions.push("Tighten high-risk repo execution gates.");
  }
  if (avgDrift > 60) {
    notes.push("Cross-repo drift propagation is high.");
    actions.push("Prioritize architecture alignment before expansion.");
  }
  if (globalContextGraph.sharedModules.length > 20) {
    notes.push("High shared-module coupling detected.");
    actions.push("Introduce shared module ownership and SLA enforcement.");
  }
  if (globalPlan.globalWorkItems.length < 3) {
    notes.push("Global planning coverage is thin.");
    actions.push("Expand cross-repo work item selection.");
  }
  for (const repo of sdlcInsightsPerRepo) {
    const delta: string[] = [];
    if (repo.sdlcInsights.drift.score > avgDrift + 10) delta.push("drift above global baseline");
    if (repo.sdlcInsights.heuristics.riskScore > avgRisk + 10) delta.push("risk above global baseline");
    if (repo.sdlcInsights.healthScore < 55) delta.push("health below minimum threshold");
    if (delta.length > 0) deltas.push({ repo: repo.projectRoot, delta });
  }
  const governanceStatus: GlobalGovernanceV1["governanceStatus"] =
    notes.length === 0 ? "compliant" : notes.length <= 2 ? "warning" : "failing";
  const out: GlobalGovernanceV1 = {
    governanceStatus,
    governanceNotes: notes,
    requiredGovernanceActions: actions,
    repoSpecificGovernanceDeltas: deltas
  };
  latestGlobalGovernance = out;
  await appendAuditLog(globalContextGraph.repos[0]?.projectRoot ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.governance",
    parameters: mergeForgeAuditParamsV1("global_governance", {
      governanceStatus,
      notes: notes.length,
      actions: actions.length,
      repoDeltas: deltas.length
    }),
    result: governanceStatus === "failing" ? "failure" : "success"
  });
  return out;
}
