import type { SdlcTimelineV1 } from "./sdlcTimeline.js";
import type { SdlcInsightsV1 } from "./sdlcHeuristics.js";
import type { SdlcPatternsV1 } from "./sdlcPatterns.js";

export type SdlcHealthInputV1 = {
  timeline: SdlcTimelineV1;
  heuristics: SdlcInsightsV1;
  patterns: SdlcPatternsV1;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function computeSdlcHealthScore(input: SdlcHealthInputV1): number {
  const stability = clamp(input.heuristics.stabilityScore, 0, 100) * 0.35;
  const recencyFailures = (100 - clamp(input.heuristics.riskScore, 0, 100)) * 0.25;
  const agentRate = clamp(input.timeline.metrics.agentSuccessRate * 100, 0, 100) * 0.15;
  const hotspot = (100 - clamp(input.heuristics.hotspotFiles.reduce((s, x) => s + x.score, 0), 0, 100)) * 0.1;
  const flaky = (100 - clamp(input.heuristics.flakyFiles.reduce((s, x) => s + x.score, 0), 0, 100)) * 0.1;
  const pattern = (100 - clamp(input.patterns.severity, 0, 100)) * 0.05;
  const raw = stability + recencyFailures + agentRate + hotspot + flaky + pattern;
  return Number(clamp(raw, 0, 100).toFixed(2));
}
