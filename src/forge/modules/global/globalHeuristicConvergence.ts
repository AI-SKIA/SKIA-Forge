import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { getSelfImprovementStateSnapshot } from "../self/selfState.js";
import { getFrozenHeuristicDimensionsV1 } from "../self/selfHeuristics.js";

export type GlobalHeuristicConvergenceV1 = {
  globalConvergenceScore: number;
  oscillatingDimensions: string[];
  convergedDimensions: string[];
  divergentRepos: string[];
};
let latestGlobalHeuristicConvergence: GlobalHeuristicConvergenceV1 | null = null;

export function getLatestGlobalHeuristicConvergenceV1(): GlobalHeuristicConvergenceV1 | null {
  return latestGlobalHeuristicConvergence;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function analyzeGlobalHeuristicConvergence(
  projectRoots: string[],
  _options?: { minRepoAgreement?: number }
): Promise<GlobalHeuristicConvergenceV1> {
  const snapshots = await Promise.all(projectRoots.map((r) => getSelfImprovementStateSnapshot(r)));
  const dimValues = new Map<string, number[]>();
  const repoScores: Array<{ repo: string; score: number }> = [];
  for (let i = 0; i < snapshots.length; i++) {
    const snap = snapshots[i]!;
    const repo = projectRoots[i]!;
    const h = snap.latestSelfHeuristicsUpdate;
    if (!h) continue;
    const pairs: Array<[string, number]> = [
      ["riskWeight", h.weights.risk],
      ["driftWeight", h.weights.drift],
      ["slaWeight", h.weights.sla],
      ["hotspotWeight", h.weights.hotspots],
      ["forecastWeight", h.weights.forecast],
      ["riskHighThreshold", h.thresholds.riskClassBoundaries.high],
      ["driftTrigger", h.thresholds.driftSeverityTrigger],
      ["slaTrigger", h.thresholds.slaSeverityTrigger]
    ];
    for (const [k, v] of pairs) {
      const arr = dimValues.get(k) ?? [];
      arr.push(v);
      dimValues.set(k, arr);
    }
    repoScores.push({ repo, score: snap.latestHeuristicsConvergence.convergenceScore });
  }
  const oscillatingDimensions: string[] = [];
  const convergedDimensions: string[] = [];
  for (const [k, values] of dimValues) {
    const mean = values.reduce((s, x) => s + x, 0) / Math.max(1, values.length);
    const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, values.length);
    if (variance > 40) oscillatingDimensions.push(k);
    else if (variance < 8) convergedDimensions.push(k);
  }
  const globalBaseline =
    repoScores.reduce((s, x) => s + x.score, 0) / Math.max(1, repoScores.length);
  const divergentRepos = repoScores.filter((x) => Math.abs(x.score - globalBaseline) > 20).map((x) => x.repo);
  const frozen = getFrozenHeuristicDimensionsV1();
  const globalConvergenceScore = clamp(
    globalBaseline - oscillatingDimensions.length * 6 + convergedDimensions.length * 3 + frozen.length * 2
  );
  const out: GlobalHeuristicConvergenceV1 = {
    globalConvergenceScore,
    oscillatingDimensions,
    convergedDimensions,
    divergentRepos
  };
  latestGlobalHeuristicConvergence = out;
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.heuristics.convergence",
    parameters: mergeForgeAuditParamsV1("global_heuristics", {
      globalConvergenceScore,
      oscillatingDimensions,
      convergedDimensions,
      divergentRepos
    }),
    result: "success"
  });
  return out;
}
