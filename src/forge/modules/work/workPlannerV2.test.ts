import test from "node:test";
import assert from "node:assert/strict";
import { buildWorkBreakdown } from "./workDecomposition.js";
import { prioritizeWork } from "./workPrioritization.js";
import { buildWorkPlanV2 } from "./workPlannerV2.js";

const workItem = {
  v: 1 as const,
  id: "w1",
  title: "Improve auth flow",
  description: "fix issues",
  type: "feature" as const,
  priority: "P2" as const,
  status: "in_progress" as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  relatedFiles: ["src/auth.ts"],
  relatedTests: ["src/auth.test.ts"],
  sdlcSignals: { risk: 50, drift: 40, forecast: 60, health: 70 },
  dependencies: [],
  tags: []
};

const insights = {
  timeline: { eventCount: 0, days: [], metrics: { failureStreak: 1, testPassStreak: 0, averageValidationTimeMs: 100, agentSuccessRate: 0.5 } },
  heuristics: { recentFailures: [], hotspotFiles: [{ path: "src/auth.ts", score: 30, edits: 4, failures: 2 }], riskScore: 50, stabilityScore: 70, flakyFiles: [] },
  patterns: { recurringFailures: [], temporal: { failureHourClusters: [], fridayRegression: { failures: 0, total: 0, ratio: 0 } }, agent: { rollbackCycles: 1, selfCorrectionLoops: 1, plannerParseErrors: 0 }, severity: 20 },
  recommendations: { refactorFiles: ["src/auth.ts"], stabilizeTests: [], enforceLintRules: [], agentGuardrails: [], chunkingOrEmbeddingRefresh: [], dependencyCleanup: [] },
  healthScore: 72,
  drift: { structureVsRules: 20, importBoundaryDrift: 20, churnVsStability: 25, coverageApproxDrift: 20, agentGovernanceDrift: 20, score: 21, notes: [] },
  risk: { project: { score: 52, class: "medium" as const }, files: [{ path: "src/auth.ts", score: 60, class: "high" as const }] },
  forecast: { globalNextFailureProbability: 55, fileNextFailureProbability: [{ path: "src/auth.ts", probability: 62 }], nextAgentRollbackProbability: 30, nextTestRegressionProbability: 40, stabilityTrend: "flat" as const }
};

test("buildWorkPlanV2 emits task-level plan", () => {
  const breakdown = buildWorkBreakdown(workItem, insights as any, { paths: ["src/auth.ts", "src/auth.test.ts"] }, null);
  const priority = prioritizeWork(workItem, breakdown, insights as any, { maxSteps: 20, maxWriteOps: 10, maxTerminalOps: 5 });
  const p = buildWorkPlanV2({ workItem, breakdown, priority, insights: insights as any });
  assert.equal(p.version, "2");
  assert.ok(p.tasks.length > 0);
  assert.ok(p.tasks[0]!.id.length > 0);
});
