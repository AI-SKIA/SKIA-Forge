import type { SelfArchitectureAdviceV1 } from "./selfArchitecture.js";
import type { WorkGraphV1 } from "../work/workGraph.js";
import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";

export type SelfArchitectureEvolutionScoreV1 = {
  architectureImprovementScore: number;
  residualHotspotScore: number;
  residualDriftScore: number;
  residualCycleScore: number;
};

let lastArchitectureEvolutionScore: SelfArchitectureEvolutionScoreV1 | null = null;

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function getLastArchitectureEvolutionScoreV1(): SelfArchitectureEvolutionScoreV1 | null {
  return lastArchitectureEvolutionScore;
}

export function scoreArchitectureEvolution(
  _projectRoot: string,
  architectureAdvice: SelfArchitectureAdviceV1,
  workGraphHistory: WorkGraphV1[],
  sdlcInsightsHistory: SdlcInsightsBundleV2[]
): SelfArchitectureEvolutionScoreV1 {
  const recentGraphs = workGraphHistory.slice(-5);
  const recentSdlc = sdlcInsightsHistory.slice(-5);
  const firstGraph = recentGraphs[0] ?? null;
  const lastGraph = recentGraphs[recentGraphs.length - 1] ?? null;
  const firstSdlc = recentSdlc[0] ?? null;
  const lastSdlc = recentSdlc[recentSdlc.length - 1] ?? null;
  const cycleDrop =
    firstGraph && lastGraph ? Math.max(0, firstGraph.cycles.length - lastGraph.cycles.length) : 0;
  const cycleResidual = lastGraph?.cycles.length ?? 0;
  const hotspotResidual = lastSdlc?.heuristics.hotspotFiles.length ?? architectureAdvice.persistentHotspots.length;
  const driftResidual = lastSdlc?.drift.score ?? 60;
  const hotspotDrop =
    firstSdlc && lastSdlc
      ? Math.max(0, firstSdlc.heuristics.hotspotFiles.length - lastSdlc.heuristics.hotspotFiles.length)
      : 0;
  const driftDrop = firstSdlc && lastSdlc ? Math.max(0, firstSdlc.drift.score - lastSdlc.drift.score) : 0;
  const architectureImprovementScore = clamp(
    45 + cycleDrop * 8 + hotspotDrop * 4 + driftDrop * 0.6 - cycleResidual * 6 - hotspotResidual * 3
  );
  const out = {
    architectureImprovementScore,
    residualHotspotScore: clamp(hotspotResidual * 12),
    residualDriftScore: clamp(driftResidual),
    residualCycleScore: clamp(cycleResidual * 20)
  };
  lastArchitectureEvolutionScore = out;
  return out;
}
