import test from "node:test";
import assert from "node:assert/strict";
import type { WorkItemV1 } from "./workItemModel.js";
import { detectWorkSlaDrift } from "./workSlaDrift.js";
import { analyzeWorkImpact } from "./workImpact.js";
import { buildWorkPlanV4 } from "./workPlannerV4.js";
import type { WorkGraphV1 } from "./workGraph.js";

test("impact + sla + planner v4 shape", () => {
  const workItem: WorkItemV1 = {
    v: 1,
    id: "w1",
    title: "Refactor core module",
    description: "Refactor",
    type: "refactor",
    priority: "P1",
    status: "in_progress",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    relatedFiles: ["src/core/a.ts", "src/core/b.ts"],
    relatedTests: ["src/core/a.test.ts"],
    sdlcSignals: { risk: 80, drift: 60, forecast: 70, health: 40 },
    dependencies: [],
    tags: []
  };
  const graph: WorkGraphV1 = {
    nodes: [workItem],
    edges: [],
    stronglyConnectedComponents: [["w1"]],
    cycles: [],
    criticalPath: ["w1"],
    parallelGroups: [["w1"]],
    governanceWarnings: []
  };
  const insights: any = {
    heuristics: { stabilityScore: 50 },
    forecast: { nextTestRegressionProbability: 60, globalNextFailureProbability: 70 },
    risk: { project: { class: "critical" } }
  };
  const governance: any = {
    policy: { targetCompletionPercent: 80, targetStabilityScore: 70 },
    violations: [],
    warnings: []
  };
  const progress: any = { project: { completionPercent: 55 } };
  const drift = detectWorkSlaDrift(progress, governance, insights);
  const impact = analyzeWorkImpact(workItem, graph, insights);
  const v4 = buildWorkPlanV4({ workItem, impact, slaDrift: drift, governance, insights });
  assert.ok(["none", "mild", "moderate", "severe", "critical"].includes(drift.severity));
  assert.ok(impact.blastRadius.files >= 1);
  assert.equal(v4.version, "4");
  assert.ok(v4.tasks.length >= 2);
});
