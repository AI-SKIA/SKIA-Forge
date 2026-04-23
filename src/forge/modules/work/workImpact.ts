import type { WorkItemV1 } from "./workItemModel.js";
import type { WorkGraphV1 } from "./workGraph.js";
import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";

export type WorkImpactV1 = {
  blastRadius: { files: number; tests: number; modules: number };
  dependencyImpact: { upstream: string[]; downstream: string[] };
  riskPropagation: number;
  driftPropagation: number;
  forecastedRegressionImpact: number;
  recommendedMitigationTasks: string[];
};

export function analyzeWorkImpact(
  workItem: WorkItemV1,
  workGraph: WorkGraphV1,
  sdlcInsights: SdlcInsightsBundleV2
): WorkImpactV1 {
  const node = workGraph.nodes.find((n) => n.id === workItem.id) ?? workItem;
  const upstream = workGraph.edges.filter((e) => e.to === node.id).map((e) => e.from);
  const downstream = workGraph.edges.filter((e) => e.from === node.id).map((e) => e.to);
  const modules = new Set(node.relatedFiles.map((f) => f.split("/").slice(0, 2).join("/"))).size;
  const baseRisk = node.sdlcSignals.risk;
  const baseDrift = node.sdlcSignals.drift;
  const riskPropagation = Math.min(100, Math.round(baseRisk + downstream.length * 6 + upstream.length * 3));
  const driftPropagation = Math.min(100, Math.round(baseDrift + downstream.length * 5));
  const forecastedRegressionImpact = Math.min(
    100,
    Math.round((sdlcInsights.forecast.nextTestRegressionProbability + sdlcInsights.forecast.globalNextFailureProbability) / 2 + downstream.length * 4)
  );
  const recommendedMitigationTasks = [
    ...(riskPropagation >= 70 ? ["Add staged validation checkpoints before each dependent item."] : []),
    ...(driftPropagation >= 60 ? ["Apply architecture alignment changes before functional expansion."] : []),
    ...(forecastedRegressionImpact >= 60 ? ["Run targeted regression suites for impacted modules/tests."] : []),
    "Document dependency impact boundaries in plan rationale."
  ];
  return {
    blastRadius: {
      files: node.relatedFiles.length,
      tests: node.relatedTests.length,
      modules
    },
    dependencyImpact: { upstream, downstream },
    riskPropagation,
    driftPropagation,
    forecastedRegressionImpact,
    recommendedMitigationTasks
  };
}
