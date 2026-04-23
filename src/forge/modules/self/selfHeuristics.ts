import type { AutoMemoryEventV1 } from "../auto/autoMemory.js";
import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";
import type { SelfImprovementInsightsV1 } from "./selfInsights.js";

export type SelfHeuristicOverridesV1 = {
  weights: {
    risk: number;
    drift: number;
    sla: number;
    hotspots: number;
    forecast: number;
  };
  thresholds: {
    riskClassBoundaries: { medium: number; high: number; critical: number };
    driftSeverityTrigger: number;
    slaSeverityTrigger: number;
  };
  notes: string[];
  rationale: string[];
  updatedAt: string;
};

export type SelfHeuristicsUpdateV1 = SelfHeuristicOverridesV1;

let overrides: SelfHeuristicOverridesV1 | null = null;
const heuristicsHistory: SelfHeuristicsUpdateV1[] = [];
const frozenHeuristicDimensions = new Set<string>();

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function getSelfHeuristicOverridesV1(): SelfHeuristicOverridesV1 | null {
  return overrides;
}

export function applySelfHeuristicOverridesV1(next: SelfHeuristicOverridesV1): void {
  const prev = overrides;
  const merged =
    prev && frozenHeuristicDimensions.size > 0
      ? {
          ...next,
          weights: {
            risk: frozenHeuristicDimensions.has("riskWeight") ? prev.weights.risk : next.weights.risk,
            drift: frozenHeuristicDimensions.has("driftWeight") ? prev.weights.drift : next.weights.drift,
            sla: frozenHeuristicDimensions.has("slaWeight") ? prev.weights.sla : next.weights.sla,
            hotspots: frozenHeuristicDimensions.has("hotspotWeight") ? prev.weights.hotspots : next.weights.hotspots,
            forecast: frozenHeuristicDimensions.has("forecastWeight") ? prev.weights.forecast : next.weights.forecast
          },
          thresholds: {
            riskClassBoundaries: {
              medium: frozenHeuristicDimensions.has("riskMediumThreshold")
                ? prev.thresholds.riskClassBoundaries.medium
                : next.thresholds.riskClassBoundaries.medium,
              high: frozenHeuristicDimensions.has("riskHighThreshold")
                ? prev.thresholds.riskClassBoundaries.high
                : next.thresholds.riskClassBoundaries.high,
              critical: frozenHeuristicDimensions.has("riskCriticalThreshold")
                ? prev.thresholds.riskClassBoundaries.critical
                : next.thresholds.riskClassBoundaries.critical
            },
            driftSeverityTrigger: frozenHeuristicDimensions.has("driftTrigger")
              ? prev.thresholds.driftSeverityTrigger
              : next.thresholds.driftSeverityTrigger,
            slaSeverityTrigger: frozenHeuristicDimensions.has("slaTrigger")
              ? prev.thresholds.slaSeverityTrigger
              : next.thresholds.slaSeverityTrigger
          }
        }
      : next;
  overrides = merged;
  heuristicsHistory.push(next);
  if (heuristicsHistory.length > 100) {
    heuristicsHistory.splice(0, heuristicsHistory.length - 100);
  }
}

export function getSelfHeuristicsHistoryV1(): SelfHeuristicsUpdateV1[] {
  return [...heuristicsHistory];
}

export function setFrozenHeuristicDimensionsV1(dimensions: string[]): void {
  frozenHeuristicDimensions.clear();
  for (const d of dimensions) frozenHeuristicDimensions.add(d);
}

export function getFrozenHeuristicDimensionsV1(): string[] {
  return [...frozenHeuristicDimensions];
}

export function analyzeAndRefineHeuristics(
  _projectRoot: string,
  autoMemory: AutoMemoryEventV1[],
  sdlcInsights: SdlcInsightsBundleV2,
  selfInsights: SelfImprovementInsightsV1
): SelfHeuristicsUpdateV1 {
  const plannerSuccess = autoMemory.filter((m) => m.category === "planner_pattern" && m.outcome === "success").length;
  const plannerFail = autoMemory.filter((m) => m.category === "planner_pattern" && m.outcome === "failure").length;
  const execSuccess = autoMemory.filter((m) => m.category === "executor_pattern" && m.outcome === "success").length;
  const execFail = autoMemory.filter((m) => m.category === "executor_pattern" && m.outcome === "failure").length;
  const selfCorrectFail = autoMemory.filter((m) => m.category === "self_correct_pattern" && m.outcome === "failure").length;
  const aggressivenessBias = plannerFail + execFail - plannerSuccess - execSuccess;
  const driftBias = sdlcInsights.drift.score >= 60 || selfInsights.weaknesses.some((w) => /drift/i.test(w)) ? 0.1 : -0.05;
  const stabilityBias = sdlcInsights.heuristics.stabilityScore < 65 ? 0.1 : -0.03;
  const weights = {
    risk: clamp(0.4 + aggressivenessBias * 0.01, 0.2, 0.7),
    drift: clamp(0.2 + driftBias, 0.1, 0.5),
    sla: clamp(0.15 + (selfInsights.weaknesses.some((w) => /SLA/i.test(w)) ? 0.1 : 0), 0.05, 0.35),
    hotspots: clamp(0.15 + (sdlcInsights.heuristics.hotspotFiles.length > 3 ? 0.05 : -0.02), 0.05, 0.3),
    forecast: clamp(0.1 + stabilityBias, 0.05, 0.35)
  };
  const out: SelfHeuristicsUpdateV1 = {
    weights,
    thresholds: {
      riskClassBoundaries: {
        medium: clamp(30 + aggressivenessBias * 0.5, 20, 45),
        high: clamp(55 + aggressivenessBias * 0.6, 45, 75),
        critical: clamp(78 + aggressivenessBias * 0.4, 65, 90)
      },
      driftSeverityTrigger: clamp(55 + driftBias * 100, 40, 75),
      slaSeverityTrigger: clamp(60 + (selfInsights.metaStabilityScore < 60 ? -8 : 4), 40, 80)
    },
    notes: [
      `plannerFail=${plannerFail} plannerSuccess=${plannerSuccess}`,
      `execFail=${execFail} execSuccess=${execSuccess}`,
      `selfCorrectFail=${selfCorrectFail}`
    ],
    rationale: [
      "Adjusted thresholds/weights to counter over-aggressive or under-aggressive autonomy behavior.",
      "Raised drift/SLA influence when recurring cycles are detected."
    ],
    updatedAt: new Date().toISOString()
  };
  return out;
}
