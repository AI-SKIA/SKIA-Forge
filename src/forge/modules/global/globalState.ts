import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { buildGlobalContextGraph, getLatestGlobalContextGraphV1, type GlobalContextGraphV1 } from "./globalContextGraph.js";
import { getLatestGlobalWorkPlanV1, type GlobalWorkPlanV1 } from "./globalPlanner.js";
import { getLatestGlobalGovernanceV1, type GlobalGovernanceV1 } from "./globalGovernance.js";
import { getLatestGlobalDashboardV1, type GlobalDashboardV1 } from "./globalDashboard.js";
import { getLatestGlobalSelfImprovementV1, type GlobalSelfImprovementResultV1 } from "./globalSelfImprovement.js";
import { getLatestGlobalStrategyEvolutionV1, type GlobalStrategyEvolutionV1 } from "./globalStrategyEvolution.js";
import { getLatestGlobalConsolidationV1, type GlobalConsolidationResultV1 } from "./globalConsolidation.js";
import { getLatestGlobalHeuristicConvergenceV1, type GlobalHeuristicConvergenceV1 } from "./globalHeuristicConvergence.js";
import { getLatestGlobalStrategyConvergenceV1, type GlobalStrategyConvergenceV1 } from "./globalStrategyConvergence.js";
import { getLatestGlobalEvolutionHealthV1, type GlobalEvolutionHealthV1 } from "./globalEvolutionHealth.js";
import type { GlobalMetaOptimizationResultV1 } from "./globalMetaOptimizer.js";

export type GlobalStateSnapshotV1 = {
  latestGlobalContextGraph: GlobalContextGraphV1 | null;
  latestGlobalWorkPlan: GlobalWorkPlanV1 | null;
  latestGlobalGovernance: GlobalGovernanceV1 | null;
  latestGlobalDashboard: GlobalDashboardV1 | null;
  latestGlobalSelfImprovementResult: GlobalSelfImprovementResultV1 | null;
  latestGlobalStrategyEvolution: GlobalStrategyEvolutionV1 | null;
  latestGlobalConsolidationResult: GlobalConsolidationResultV1 | null;
  latestGlobalHeuristicConvergence: GlobalHeuristicConvergenceV1 | null;
  latestGlobalStrategyConvergence: GlobalStrategyConvergenceV1 | null;
  latestGlobalEvolutionHealth: GlobalEvolutionHealthV1 | null;
  latestGlobalMetaOptimizationSummary: GlobalMetaOptimizationResultV1["globalMetaOptimizationSummary"] | null;
};

export type GlobalHistorySummaryV1 = {
  trends: {
    globalRisk: "improving" | "degrading" | "flat";
    globalDrift: "improving" | "degrading" | "flat";
    globalHotspots: "improving" | "degrading" | "flat";
    globalEvolutionScore: "improving" | "degrading" | "flat";
    globalConvergenceScore: "improving" | "degrading" | "flat";
    governanceStatus: "improving" | "degrading" | "flat";
  };
  samples: number;
};

const globalHistory: Array<{
  timestamp: string;
  globalRisk: number;
  globalDrift: number;
  globalHotspots: number;
  globalEvolutionScore: number;
  globalConvergenceScore: number;
  governanceStatus: GlobalGovernanceV1["governanceStatus"] | "unknown";
}> = [];

let latestGlobalMetaOptimizationSummary: GlobalMetaOptimizationResultV1["globalMetaOptimizationSummary"] | null = null;

function trend(first: number, last: number, eps = 2): "improving" | "degrading" | "flat" {
  if (last > first + eps) return "improving";
  if (last < first - eps) return "degrading";
  return "flat";
}

function govNum(s: "compliant" | "warning" | "failing" | "unknown"): number {
  return s === "compliant" ? 100 : s === "warning" ? 60 : s === "failing" ? 20 : 50;
}

export function setLatestGlobalMetaOptimizationSummaryV1(
  summary: GlobalMetaOptimizationResultV1["globalMetaOptimizationSummary"] | null
): void {
  latestGlobalMetaOptimizationSummary = summary;
}

export async function getGlobalStateSnapshot(
  projectRoots: string[],
  options?: { emitAudit?: boolean }
): Promise<GlobalStateSnapshotV1> {
  const latestGlobalContextGraph = getLatestGlobalContextGraphV1() ?? (await buildGlobalContextGraph(projectRoots));
  const snapshot: GlobalStateSnapshotV1 = {
    latestGlobalContextGraph,
    latestGlobalWorkPlan: getLatestGlobalWorkPlanV1(),
    latestGlobalGovernance: getLatestGlobalGovernanceV1(),
    latestGlobalDashboard: getLatestGlobalDashboardV1(),
    latestGlobalSelfImprovementResult: getLatestGlobalSelfImprovementV1(),
    latestGlobalStrategyEvolution: getLatestGlobalStrategyEvolutionV1(),
    latestGlobalConsolidationResult: getLatestGlobalConsolidationV1(),
    latestGlobalHeuristicConvergence: getLatestGlobalHeuristicConvergenceV1(),
    latestGlobalStrategyConvergence: getLatestGlobalStrategyConvergenceV1(),
    latestGlobalEvolutionHealth: getLatestGlobalEvolutionHealthV1(),
    latestGlobalMetaOptimizationSummary
  };
  const sample = {
    timestamp: new Date().toISOString(),
    globalRisk: latestGlobalContextGraph.globalRiskPropagation,
    globalDrift: latestGlobalContextGraph.globalDriftPropagation,
    globalHotspots: latestGlobalContextGraph.globalHotspotRanking.length,
    globalEvolutionScore: snapshot.latestGlobalEvolutionHealth?.globalEvolutionScore ?? 50,
    globalConvergenceScore: snapshot.latestGlobalHeuristicConvergence?.globalConvergenceScore ?? 50,
    governanceStatus: (snapshot.latestGlobalGovernance?.governanceStatus ?? "unknown") as
      | "unknown"
      | "compliant"
      | "warning"
      | "failing"
  };
  globalHistory.push(sample);
  if (globalHistory.length > 500) globalHistory.splice(0, globalHistory.length - 500);
  if (options?.emitAudit) {
    await appendAuditLog(projectRoots[0] ?? ".", {
      timestamp: new Date().toISOString(),
      action: "global.state.snapshot",
      parameters: mergeForgeAuditParamsV1("global_state", snapshot),
      result: "success"
    });
  }
  return snapshot;
}

export async function getGlobalHistorySummary(
  projectRoots: string[],
  options?: { limit?: number }
): Promise<GlobalHistorySummaryV1> {
  const limit = Math.max(5, Math.min(500, options?.limit ?? 100));
  const rows = globalHistory.slice(-limit);
  const first = rows[0] ?? null;
  const last = rows.at(-1) ?? null;
  if (!first || !last) {
    return {
      trends: {
        globalRisk: "flat",
        globalDrift: "flat",
        globalHotspots: "flat",
        globalEvolutionScore: "flat",
        globalConvergenceScore: "flat",
        governanceStatus: "flat"
      },
      samples: 0
    };
  }
  return {
    trends: {
      globalRisk: trend(last.globalRisk, first.globalRisk),
      globalDrift: trend(last.globalDrift, first.globalDrift),
      globalHotspots: trend(last.globalHotspots, first.globalHotspots, 1),
      globalEvolutionScore: trend(first.globalEvolutionScore, last.globalEvolutionScore),
      globalConvergenceScore: trend(first.globalConvergenceScore, last.globalConvergenceScore),
      governanceStatus: trend(govNum(first.governanceStatus), govNum(last.governanceStatus), 5)
    },
    samples: rows.length
  };
}
