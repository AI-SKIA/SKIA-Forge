import type { WorkGraphV1 } from "./workGraph.js";
import type { WorkScheduleV1 } from "./workScheduler.js";
import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";

export type WorkRoadmapPhaseV1 = {
  id: string;
  title: string;
  description: string;
  workItemIds: string[];
  startHint: string;
  endHint: string;
  riskSummary: string;
  driftSummary: string;
  forecastSummary: string;
};

export type WorkRoadmapV1 = {
  phases: WorkRoadmapPhaseV1[];
  architectureOptimizationHints?: string[];
  global: {
    totalItems: number;
    criticalPathItems: string[];
    highRiskItems: string[];
    blockedItems: string[];
    suggestedPhaseOrder: string[];
  };
};

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function buildWorkRoadmap(input: {
  graph: WorkGraphV1;
  schedule: WorkScheduleV1;
  insights: SdlcInsightsBundleV2;
  architectureOptimizationHints?: string[];
}): WorkRoadmapV1 {
  const byId = new Map(input.graph.nodes.map((n) => [n.id, n]));
  const ordered = input.schedule.orderedWorkItemIds.filter((id) => byId.has(id));
  const chunk = Math.max(1, Math.ceil(ordered.length / 3));
  const groups = [ordered.slice(0, chunk), ordered.slice(chunk, chunk * 2), ordered.slice(chunk * 2)].filter(
    (g) => g.length
  );
  const phases: WorkRoadmapPhaseV1[] = groups.map((ids, i) => {
    const rows = ids.map((id) => byId.get(id)!);
    const risk = avg(rows.map((x) => x.sdlcSignals.risk));
    const drift = avg(rows.map((x) => x.sdlcSignals.drift));
    const forecast = avg(rows.map((x) => x.sdlcSignals.forecast));
    const title =
      i === 0 ? "Stabilize First" : i === groups.length - 1 ? "Expand Later" : "Consolidate Core Changes";
    return {
      id: `phase-${i + 1}`,
      title,
      description:
        i === 0
          ? "Reduce immediate instability and clear high-risk dependencies."
          : i === groups.length - 1
            ? "Expand into lower-risk improvements after stabilization."
            : "Address medium-risk refactors and shared dependencies.",
      workItemIds: ids,
      startHint: i === 0 ? "now" : `after phase-${i}`,
      endHint: `after ${ids.length} item(s)`,
      riskSummary: `avgRisk=${risk.toFixed(1)} (${risk >= 70 ? "high" : risk >= 45 ? "medium" : "low"})`,
      driftSummary: `avgDrift=${drift.toFixed(1)}`,
      forecastSummary: `avgFailureForecast=${forecast.toFixed(1)}`
    };
  });
  const highRiskItems = input.graph.nodes.filter((n) => n.sdlcSignals.risk >= 70).map((n) => n.id);
  const blockedItems = input.graph.nodes.filter((n) => n.status === "blocked").map((n) => n.id);
  return {
    phases,
    ...(input.architectureOptimizationHints ? { architectureOptimizationHints: input.architectureOptimizationHints } : {}),
    global: {
      totalItems: input.graph.nodes.length,
      criticalPathItems: input.graph.criticalPath,
      highRiskItems,
      blockedItems,
      suggestedPhaseOrder: phases.map((p) => p.id)
    }
  };
}
