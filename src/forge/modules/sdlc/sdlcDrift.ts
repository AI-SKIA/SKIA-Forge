import type { SkiarulesConfig } from "../skiarules/skiarulesTypes.js";
import type { SdlcInsightsBundleV1 } from "./sdlcInsights.js";

export type SdlcDriftV1 = {
  structureVsRules: number;
  importBoundaryDrift: number;
  churnVsStability: number;
  coverageApproxDrift: number;
  agentGovernanceDrift: number;
  score: number;
  notes: string[];
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function detectSdlcDrift(
  insights: SdlcInsightsBundleV1,
  skiarulesConfig: SkiarulesConfig | null
): SdlcDriftV1 {
  const expectedBoundaries = skiarulesConfig?.architecture?.boundaries?.length ?? 0;
  const expectedStable = Math.max(1, expectedBoundaries);
  const hotspots = insights.heuristics.hotspotFiles.length;
  const recurring = insights.patterns.recurringFailures.length;
  const risk = insights.heuristics.riskScore;
  const hasTests = insights.timeline.days
    .flatMap((d) => d.events)
    .some((e) => e.type === "test_run");
  const structureVsRules = clamp(expectedBoundaries === 0 ? 20 : hotspots * 8, 0, 100);
  const importBoundaryDrift = clamp(recurring * 7 + (expectedBoundaries === 0 ? 15 : 0), 0, 100);
  const churnVsStability = clamp((hotspots / expectedStable) * 35 + insights.patterns.severity * 0.2, 0, 100);
  const coverageApproxDrift = clamp(hasTests ? 20 + risk * 0.4 : 70 + risk * 0.2, 0, 100);
  const agentGovernanceDrift = clamp(
    insights.patterns.agent.rollbackCycles * 12 +
      insights.patterns.agent.selfCorrectionLoops * 8 +
      insights.patterns.agent.plannerParseErrors * 15,
    0,
    100
  );
  const score = Number(
    (
      structureVsRules * 0.22 +
      importBoundaryDrift * 0.23 +
      churnVsStability * 0.2 +
      coverageApproxDrift * 0.15 +
      agentGovernanceDrift * 0.2
    ).toFixed(2)
  );
  const notes: string[] = [];
  if (expectedBoundaries === 0) notes.push("No architecture boundaries in .skiarules; drift confidence reduced.");
  if (!hasTests) notes.push("No observed test runs; coverage drift is heuristic-only.");
  if (agentGovernanceDrift >= 60) notes.push("Agent behavior frequently diverges from governance expectations.");
  return {
    structureVsRules,
    importBoundaryDrift,
    churnVsStability,
    coverageApproxDrift,
    agentGovernanceDrift,
    score,
    notes
  };
}
