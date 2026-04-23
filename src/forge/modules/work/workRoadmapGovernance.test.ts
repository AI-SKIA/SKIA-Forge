import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { createWorkItem } from "./workItemModel.js";
import { buildWorkGraph } from "./workGraph.js";
import { buildWorkSchedule } from "./workScheduler.js";
import { buildWorkRoadmap } from "./workRoadmap.js";
import { buildWorkProgress } from "./workProgress.js";
import { evaluateWorkGovernance } from "./workGovernance.js";

test("roadmap/progress/governance produce additive outputs", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "work-roadmap-"));
  await createWorkItem(root, {
    title: "stabilize tests",
    description: "stabilize tests",
    type: "test",
    priority: "P0",
    status: "in_progress",
    relatedFiles: ["src/a.ts"],
    relatedTests: ["a.test.ts"],
    sdlcSignals: { risk: 80, drift: 50, forecast: 70, health: 40 },
    dependencies: [],
    tags: []
  });
  await createWorkItem(root, {
    title: "refactor module",
    description: "refactor module",
    type: "refactor",
    priority: "P2",
    status: "todo",
    relatedFiles: ["src/b.ts"],
    relatedTests: [],
    sdlcSignals: { risk: 45, drift: 30, forecast: 40, health: 65 },
    dependencies: [],
    tags: []
  });
  const graph = await buildWorkGraph(root);
  const schedule = buildWorkSchedule({
    graph,
    governanceLimits: { maxSteps: 20, maxWriteOps: 10, maxTerminalOps: 5 },
    forecast: { globalNextFailureProbability: 50, nextAgentRollbackProbability: 20 }
  });
  const roadmap = buildWorkRoadmap({
    graph,
    schedule,
    insights: {
      timeline: { projectRoot: root, scopePath: undefined, generatedAt: new Date().toISOString(), days: [], metrics: { failureStreak: 0, testPassStreak: 0, averageValidationTimeMs: 0, agentSuccessRate: 0 } },
      heuristics: { recentFailures: [], hotspotFiles: [], riskScore: 50, stabilityScore: 60, flakyFiles: [] },
      patterns: { recurringFailures: [], temporal: [], agent: [], severity: 10 },
      recommendations: { refactorFiles: [], stabilizeTests: [], enforceLintRules: [], agentGuardrails: [], chunkingOrEmbeddingRefresh: false, dependencyCleanup: [] },
      healthScore: 61,
      drift: { score: 40, summary: [], architecture: [] },
      risk: { project: { class: "medium", score: 50 }, files: [] },
      forecast: { globalNextFailureProbability: 55, nextAgentRollbackProbability: 30, nextTestRegressionProbability: 45, stabilityTrend: "flat" }
    } as any
  });
  const progress = await buildWorkProgress(root);
  const governance = evaluateWorkGovernance({
    openP0Count: 1,
    blockedItems: 0,
    highRiskItems: 1,
    stabilityScore: 60,
    roadmap,
    progress
  });
  assert.ok(roadmap.phases.length > 0);
  assert.ok(typeof progress.project.completionPercent === "number");
  assert.ok(Array.isArray(governance.warnings));
  await fs.rm(root, { recursive: true, force: true });
});
