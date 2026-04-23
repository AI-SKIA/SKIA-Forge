import type { AutoMemoryEventV1 } from "../auto/autoMemory.js";
import type { SelfHeuristicsUpdateV1 } from "./selfHeuristics.js";

export type SelfHeuristicConvergenceV1 = {
  convergenceScore: number;
  oscillationFlags: string[];
  stableDimensions: string[];
  unstableDimensions: string[];
};

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function analyzeHeuristicConvergence(
  _projectRoot: string,
  autoMemory: AutoMemoryEventV1[],
  selfHeuristicsUpdates: SelfHeuristicsUpdateV1[]
): SelfHeuristicConvergenceV1 {
  const updates = selfHeuristicsUpdates.slice(-12);
  if (updates.length < 2) {
    return {
      convergenceScore: 50,
      oscillationFlags: ["insufficient_history"],
      stableDimensions: [],
      unstableDimensions: []
    };
  }
  const dims: Array<{
    name: string;
    pick: (x: SelfHeuristicsUpdateV1) => number;
  }> = [
    { name: "riskWeight", pick: (x) => x.weights.risk },
    { name: "driftWeight", pick: (x) => x.weights.drift },
    { name: "slaWeight", pick: (x) => x.weights.sla },
    { name: "hotspotWeight", pick: (x) => x.weights.hotspots },
    { name: "forecastWeight", pick: (x) => x.weights.forecast },
    { name: "riskMediumThreshold", pick: (x) => x.thresholds.riskClassBoundaries.medium },
    { name: "riskHighThreshold", pick: (x) => x.thresholds.riskClassBoundaries.high },
    { name: "riskCriticalThreshold", pick: (x) => x.thresholds.riskClassBoundaries.critical },
    { name: "driftTrigger", pick: (x) => x.thresholds.driftSeverityTrigger },
    { name: "slaTrigger", pick: (x) => x.thresholds.slaSeverityTrigger }
  ];
  const oscillationFlags: string[] = [];
  const stableDimensions: string[] = [];
  const unstableDimensions: string[] = [];
  let divergencePenalty = 0;
  let stabilityGain = 0;
  for (const d of dims) {
    const values = updates.map(d.pick);
    const deltas = values.slice(1).map((v, i) => v - values[i]!);
    const magnitudes = deltas.map((x) => Math.abs(x));
    const avgDelta = magnitudes.reduce((s, x) => s + x, 0) / Math.max(1, magnitudes.length);
    const firstHalf = magnitudes.slice(0, Math.floor(magnitudes.length / 2));
    const secondHalf = magnitudes.slice(Math.floor(magnitudes.length / 2));
    const firstAvg = firstHalf.length ? firstHalf.reduce((s, x) => s + x, 0) / firstHalf.length : avgDelta;
    const secondAvg = secondHalf.length ? secondHalf.reduce((s, x) => s + x, 0) / secondHalf.length : avgDelta;
    let signFlips = 0;
    for (let i = 1; i < deltas.length; i++) {
      if ((deltas[i - 1] ?? 0) * (deltas[i] ?? 0) < 0) {
        signFlips += 1;
      }
    }
    const isOscillating = signFlips >= 3 && avgDelta > 0.015;
    const isConverging = secondAvg < firstAvg * 0.8 || avgDelta < 0.01;
    const isDiverging = secondAvg > firstAvg * 1.2 && avgDelta > 0.02;
    if (isOscillating) {
      oscillationFlags.push(d.name);
    }
    if (isConverging && !isOscillating) {
      stableDimensions.push(d.name);
      stabilityGain += 5;
    } else if (isDiverging || isOscillating) {
      unstableDimensions.push(d.name);
      divergencePenalty += isOscillating ? 9 : 6;
    }
  }
  const plannerFailures = autoMemory.filter((m) => m.category === "planner_pattern" && m.outcome === "failure").length;
  const executorFailures = autoMemory.filter((m) => m.category === "executor_pattern" && m.outcome === "failure").length;
  const failurePenalty = Math.min(25, plannerFailures + executorFailures);
  const convergenceScore = clamp(70 + stabilityGain - divergencePenalty - failurePenalty);
  return {
    convergenceScore,
    oscillationFlags,
    stableDimensions,
    unstableDimensions
  };
}
