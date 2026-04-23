import type { WorkGraphV1 } from "./workGraph.js";

export type WorkScheduleV1 = {
  orderedWorkItemIds: string[];
  recommendedBatches: string[][];
  parallelGroups: string[][];
  sequencing: string[];
  rationale: string[];
};

export function buildWorkSchedule(input: {
  graph: WorkGraphV1;
  governanceLimits: { maxSteps: number; maxWriteOps: number; maxTerminalOps: number };
  forecast: { globalNextFailureProbability: number; nextAgentRollbackProbability: number };
}): WorkScheduleV1 {
  const byId = new Map(input.graph.nodes.map((n) => [n.id, n]));
  const ordered = [...input.graph.nodes]
    .sort((a, b) => {
      const ad = a.sdlcSignals.drift;
      const bd = b.sdlcSignals.drift;
      if (ad !== bd) return bd - ad;
      return b.sdlcSignals.risk - a.sdlcSignals.risk;
    })
    .map((x) => x.id);
  const batchSize = Math.max(1, Math.min(5, Math.floor(input.governanceLimits.maxSteps / 4)));
  const recommendedBatches: string[][] = [];
  for (let i = 0; i < ordered.length; i += batchSize) {
    recommendedBatches.push(ordered.slice(i, i + batchSize));
  }
  const sequencing = [
    "Fix drift-heavy items before broad refactors.",
    "Execute high-risk/high-forecast-failure items earlier.",
    "Keep rollback-prone items in smaller batches."
  ];
  const rationale = [
    `Global forecasted failure probability=${input.forecast.globalNextFailureProbability}.`,
    `Forecasted rollback probability=${input.forecast.nextAgentRollbackProbability}.`,
    `Graph critical path length=${input.graph.criticalPath.length}.`,
    `Batch size chosen=${batchSize} from governance maxSteps=${input.governanceLimits.maxSteps}.`
  ];
  // prefer graph-computed groups but cap by batch size
  const parallelGroups = input.graph.parallelGroups.map((g) => g.slice(0, batchSize));
  // ensure ordered contains all ids
  const tail = input.graph.nodes.map((n) => n.id).filter((id) => !ordered.includes(id));
  const finalOrdered = [...ordered, ...tail].filter((id) => byId.has(id));
  return {
    orderedWorkItemIds: finalOrdered,
    recommendedBatches,
    parallelGroups,
    sequencing,
    rationale
  };
}
