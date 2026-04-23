import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import type { GlobalStateSnapshotV1 } from "./globalState.js";

export type GlobalEvolutionPolicyV1 = {
  evolutionPhase: "global_explore" | "global_exploit" | "global_stabilize";
  guardrails: {
    maxGlobalHeuristicChangeRate: number;
    maxGlobalStrategyChurn: number;
    minGlobalConvergenceThresholds: {
      heuristic: number;
      strategy: number;
      evolutionHealth: number;
    };
    architectureChangeAggressiveness: "low" | "medium" | "high";
  };
  allowedGlobalChanges: Array<"heuristics" | "strategy" | "architecture">;
  blockedGlobalChanges: Array<"heuristics" | "strategy" | "architecture">;
  recommendedGlobalFocus: string[];
};

export async function computeGlobalEvolutionPolicy(
  projectRoots: string[],
  globalStateSnapshot: GlobalStateSnapshotV1
): Promise<GlobalEvolutionPolicyV1> {
  const convergence = globalStateSnapshot.latestGlobalHeuristicConvergence?.globalConvergenceScore ?? 50;
  const evolution = globalStateSnapshot.latestGlobalEvolutionHealth?.globalEvolutionScore ?? 50;
  const risk = globalStateSnapshot.latestGlobalContextGraph?.globalRiskPropagation ?? 50;
  const phase: GlobalEvolutionPolicyV1["evolutionPhase"] =
    convergence >= 72 && evolution >= 72
      ? "global_stabilize"
      : evolution >= 58
        ? "global_exploit"
        : "global_explore";
  const guardrails: GlobalEvolutionPolicyV1["guardrails"] = {
    maxGlobalHeuristicChangeRate: phase === "global_stabilize" ? 0.03 : phase === "global_exploit" ? 0.08 : 0.15,
    maxGlobalStrategyChurn: phase === "global_stabilize" ? 1 : phase === "global_exploit" ? 2 : 4,
    minGlobalConvergenceThresholds: {
      heuristic: phase === "global_stabilize" ? 70 : 55,
      strategy: phase === "global_stabilize" ? 65 : 50,
      evolutionHealth: phase === "global_stabilize" ? 70 : 55
    },
    architectureChangeAggressiveness: risk > 70 ? "high" : phase === "global_stabilize" ? "low" : "medium"
  };
  const blockedGlobalChanges: GlobalEvolutionPolicyV1["blockedGlobalChanges"] = [
    ...(phase === "global_stabilize" ? (["heuristics"] as const) : []),
    ...(convergence < guardrails.minGlobalConvergenceThresholds.heuristic ? (["strategy"] as const) : [])
  ];
  const all: Array<"heuristics" | "strategy" | "architecture"> = ["heuristics", "strategy", "architecture"];
  const allowedGlobalChanges = all.filter((x) => !blockedGlobalChanges.includes(x));
  const recommendedGlobalFocus = [
    ...(convergence < 60 ? ["align heuristics globally"] : []),
    ...(evolution < 60 ? ["improve global evolution health"] : []),
    ...(risk > 65 ? ["reduce global risk propagation"] : [])
  ];
  const out: GlobalEvolutionPolicyV1 = {
    evolutionPhase: phase,
    guardrails,
    allowedGlobalChanges,
    blockedGlobalChanges,
    recommendedGlobalFocus: recommendedGlobalFocus.length > 0 ? recommendedGlobalFocus : ["maintain global baselines"]
  };
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.evolution.policy",
    parameters: mergeForgeAuditParamsV1("global_evolution_policy", out),
    result: "success"
  });
  return out;
}
