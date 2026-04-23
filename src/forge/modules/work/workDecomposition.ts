import type { WorkItemV1 } from "./workItemModel.js";
import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";
import type { SkiarulesConfig } from "../skiarules/skiarulesTypes.js";

export type WorkTaskV1 = {
  id: string;
  title: string;
  detail: string;
  estimatedComplexity: 1 | 2 | 3 | 4 | 5;
  estimatedRisk: number;
  relatedFiles: string[];
  relatedTests: string[];
  dependsOn?: string[];
};

export type WorkBreakdownV1 = {
  tasks: WorkTaskV1[];
};

function pickRisk(ins: SdlcInsightsBundleV2, files: string[]): number {
  const byFile = ins.risk.files.filter((r) => files.includes(r.path));
  if (!byFile.length) return ins.risk.project.score;
  return Math.max(...byFile.map((x) => x.score));
}

export function buildWorkBreakdown(
  workItem: WorkItemV1,
  insights: SdlcInsightsBundleV2,
  projectStructure: { paths: string[] },
  skiarules: SkiarulesConfig | null
): WorkBreakdownV1 {
  const files = workItem.relatedFiles.length ? workItem.relatedFiles : insights.heuristics.hotspotFiles.slice(0, 3).map((x) => x.path);
  const tests = workItem.relatedTests.length ? workItem.relatedTests : projectStructure.paths.filter((p) => /\.test\./i.test(p)).slice(0, 3);
  const out: WorkTaskV1[] = [];
  out.push({
    id: "task-1",
    title: "Implement primary changes",
    detail: `Apply core ${workItem.type} changes for the target scope.`,
    estimatedComplexity: 3,
    estimatedRisk: pickRisk(insights, files),
    relatedFiles: files,
    relatedTests: []
  });
  out.push({
    id: "task-2",
    title: "Update and stabilize tests",
    detail: "Adjust failing tests and add regression checks for touched behavior.",
    estimatedComplexity: tests.length > 2 ? 4 : 2,
    estimatedRisk: Math.max(20, pickRisk(insights, tests)),
    relatedFiles: [],
    relatedTests: tests,
    dependsOn: ["task-1"]
  });
  if (insights.recommendations.dependencyCleanup.length) {
    out.push({
      id: "task-3",
      title: "Dependency cleanup",
      detail: insights.recommendations.dependencyCleanup.join(" "),
      estimatedComplexity: 2,
      estimatedRisk: insights.risk.project.score,
      relatedFiles: files,
      relatedTests: [],
      dependsOn: ["task-1"]
    });
  }
  if ((skiarules?.architecture?.boundaries?.length ?? 0) > 0) {
    out.push({
      id: "task-4",
      title: "Architecture alignment",
      detail: "Validate imports and file placement against .skiarules architecture boundaries.",
      estimatedComplexity: 3,
      estimatedRisk: insights.drift.importBoundaryDrift,
      relatedFiles: files,
      relatedTests: [],
      dependsOn: ["task-1"]
    });
  }
  out.push({
    id: "task-5",
    title: "Agent-safe execution pass",
    detail: "Sequence operations to minimize rollback risk and respect governance limits.",
    estimatedComplexity: 2,
    estimatedRisk: insights.forecast.nextAgentRollbackProbability,
    relatedFiles: files,
    relatedTests: tests,
    dependsOn: ["task-1"]
  });
  return { tasks: out };
}
