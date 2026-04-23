import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";
import type { WorkGraphV1 } from "../work/workGraph.js";
import type { WorkRoadmapV1 } from "../work/workRoadmap.js";
import type { SelfImprovementInsightsV1 } from "./selfInsights.js";
import type { SelfArchitectureEvolutionScoreV1 } from "./selfArchitectureScoring.js";

export type SelfArchitectureAdviceV1 = {
  persistentDriftModules: string[];
  persistentHotspots: string[];
  cycleNodes: string[];
  heavyDependencyNodes: string[];
  regressionModules: string[];
  recommendations: string[];
  stabilizeBeforeExpandZones: string[];
  evolutionScore?: SelfArchitectureEvolutionScoreV1;
};

const architectureAdviceHistory: SelfArchitectureAdviceV1[] = [];
let promotedArchitectureHints: string[] = [];

export function getSelfArchitectureAdviceHistoryV1(): SelfArchitectureAdviceV1[] {
  return [...architectureAdviceHistory];
}

export function setPromotedArchitectureHintsV1(hints: string[]): void {
  promotedArchitectureHints = [...hints];
}

export function getPromotedArchitectureHintsV1(): string[] {
  return [...promotedArchitectureHints];
}

export function analyzeArchitectureOptimization(
  _projectRoot: string,
  sdlcInsights: SdlcInsightsBundleV2,
  workGraph: WorkGraphV1,
  roadmap: WorkRoadmapV1,
  selfInsights: SelfImprovementInsightsV1
): SelfArchitectureAdviceV1 {
  const persistentHotspots = sdlcInsights.heuristics.hotspotFiles.slice(0, 8).map((x) => x.path);
  const persistentDriftModules = sdlcInsights.recommendations.refactorFiles
    .slice(0, 8)
    .map((x) => x);
  const cycleNodes = [...new Set(workGraph.cycles.flat())].slice(0, 10);
  const degree = new Map<string, number>();
  for (const n of workGraph.nodes) degree.set(n.id, 0);
  for (const e of workGraph.edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  const heavyDependencyNodes = [...degree.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id);
  const regressionModules = sdlcInsights.patterns.recurringFailures
    .filter((x) => x.kind === "test_repeated_failure")
    .slice(0, 8)
    .map((x) => x.key);
  const stabilizeBeforeExpandZones = roadmap.phases
    .filter((p, i) => i === 0 || /stabilize/i.test(p.title))
    .map((p) => p.id);
  const recommendations = [
    ...(persistentDriftModules.length > 0 ? ["module boundary adjustments for persistent drift modules"] : []),
    ...(cycleNodes.length > 0 ? ["dependency inversion targets for cyclic dependencies"] : []),
    ...(heavyDependencyNodes.length > 0 ? ["extraction/merge candidates for heavy fan-in/fan-out nodes"] : []),
    ...(regressionModules.length > 0 ? ["test suite restructuring: isolate repeated regressions into layered suites"] : []),
    ...(selfInsights.metaRiskScore > 65 ? ["stabilize before expand in high-risk roadmap zones"] : [])
  ];
  const advice: SelfArchitectureAdviceV1 = {
    persistentDriftModules,
    persistentHotspots,
    cycleNodes,
    heavyDependencyNodes,
    regressionModules,
    recommendations,
    stabilizeBeforeExpandZones
  };
  architectureAdviceHistory.push(advice);
  if (architectureAdviceHistory.length > 100) {
    architectureAdviceHistory.splice(0, architectureAdviceHistory.length - 100);
  }
  return advice;
}
