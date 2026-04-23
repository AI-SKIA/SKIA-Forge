import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import type { GlobalStrategyEvolutionV1, GlobalStrategyProfileIdV1 } from "./globalStrategyEvolution.js";

export type GlobalStrategyConvergenceV1 = {
  globalProfileScores: Record<GlobalStrategyProfileIdV1, number>;
  recommendedGlobalProfileAdjustments: string[];
  repoProfileExceptions: Array<{ projectRoot: string; profile: GlobalStrategyProfileIdV1; reason: string }>;
  policyAlignmentNotes: string[];
};
let latestGlobalStrategyConvergence: GlobalStrategyConvergenceV1 | null = null;

export function getLatestGlobalStrategyConvergenceV1(): GlobalStrategyConvergenceV1 | null {
  return latestGlobalStrategyConvergence;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function analyzeGlobalStrategyConvergence(
  projectRoots: string[],
  globalStrategyProfiles: GlobalStrategyEvolutionV1["globalStrategyProfiles"],
  outcomeHistory: Array<{ projectRoot: string; overallOutcomeScore: number; profileId?: string }>,
  _options?: { minSamples?: number }
): Promise<GlobalStrategyConvergenceV1> {
  const globalProfileScores: GlobalStrategyConvergenceV1["globalProfileScores"] = {
    global_stabilize: 50,
    global_explore: 50,
    global_aggressive: 50,
    global_conservative: 50
  };
  for (const profile of globalStrategyProfiles) {
    const rows = outcomeHistory.filter((x) => x.profileId === profile.id);
    if (rows.length > 0) {
      globalProfileScores[profile.id] = clamp(rows.reduce((s, x) => s + x.overallOutcomeScore, 0) / rows.length);
    }
  }
  const recommendedGlobalProfileAdjustments: string[] = [];
  if (globalProfileScores.global_aggressive < 45) {
    recommendedGlobalProfileAdjustments.push("retire_or_merge:global_aggressive");
  }
  if (globalProfileScores.global_stabilize > 70) {
    recommendedGlobalProfileAdjustments.push("boost:global_stabilize");
  }
  if (Math.abs(globalProfileScores.global_explore - globalProfileScores.global_conservative) < 4) {
    recommendedGlobalProfileAdjustments.push("merge_candidate:global_explore+global_conservative");
  }
  const repoProfileExceptions: GlobalStrategyConvergenceV1["repoProfileExceptions"] = [];
  for (const repo of projectRoots) {
    const rows = outcomeHistory.filter((x) => x.projectRoot === repo);
    const avg = rows.length ? rows.reduce((s, x) => s + x.overallOutcomeScore, 0) / rows.length : 50;
    if (avg < 45) {
      repoProfileExceptions.push({ projectRoot: repo, profile: "global_stabilize", reason: "low outcome trend" });
    } else if (avg > 75) {
      repoProfileExceptions.push({ projectRoot: repo, profile: "global_explore", reason: "high stable performance" });
    }
  }
  const policyAlignmentNotes = [
    `profilesTracked=${globalStrategyProfiles.length}`,
    `exceptions=${repoProfileExceptions.length}`,
    `adjustments=${recommendedGlobalProfileAdjustments.length}`
  ];
  const out: GlobalStrategyConvergenceV1 = {
    globalProfileScores,
    recommendedGlobalProfileAdjustments,
    repoProfileExceptions,
    policyAlignmentNotes
  };
  latestGlobalStrategyConvergence = out;
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.strategy.convergence",
    parameters: mergeForgeAuditParamsV1("global_strategy_convergence", out),
    result: "success"
  });
  return out;
}
