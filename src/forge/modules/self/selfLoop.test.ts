import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { createWorkItem } from "../work/workItemModel.js";
import { recordAutoMemory } from "../auto/autoMemory.js";
import { analyzeSelfPerformance } from "./selfInsights.js";
import { buildSelfImprovementPlan } from "./selfPlanner.js";
import { runSelfImprovementTasks } from "./selfExecutor.js";

test("self modules generate and execute meta plan", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "self-loop-"));
  await createWorkItem(root, {
    title: "stabilize a",
    description: "stabilize",
    type: "test",
    priority: "P1",
    status: "in_progress",
    relatedFiles: ["src/a.ts"],
    relatedTests: ["src/a.test.ts"],
    sdlcSignals: { risk: 70, drift: 55, forecast: 65, health: 45 },
    dependencies: [],
    tags: []
  });
  await recordAutoMemory(root, {
    category: "planner_pattern",
    outcome: "failure",
    details: "parse fail"
  });
  const insights = analyzeSelfPerformance(
    root,
    [{ v: 1, id: "m1", timestamp: new Date().toISOString(), category: "planner_pattern", outcome: "failure" }],
    [],
    {
      heuristics: { riskScore: 60, stabilityScore: 50 },
      drift: { score: 60 },
      forecast: { globalNextFailureProbability: 70 },
      recommendations: { refactorFiles: ["src/a.ts"] }
    } as any
  );
  const plan = buildSelfImprovementPlan(insights, [], { drift: { score: 60 }, heuristics: { stabilityScore: 50 } } as any);
  const ex = await runSelfImprovementTasks(root, plan);
  assert.ok(plan.metaTasks.length >= 1);
  assert.ok(ex.executedTasks.length >= 1);
  await fs.rm(root, { recursive: true, force: true });
});
