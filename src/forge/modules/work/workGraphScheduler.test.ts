import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { createWorkItem, updateWorkItem } from "./workItemModel.js";
import { buildWorkGraph } from "./workGraph.js";
import { buildWorkSchedule } from "./workScheduler.js";

test("work graph builds critical path and scheduler output", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "work-graph-"));
  const a = await createWorkItem(root, {
    title: "A",
    description: "A",
    type: "feature",
    priority: "P2",
    status: "todo",
    relatedFiles: ["src/a.ts"],
    relatedTests: [],
    sdlcSignals: { risk: 80, drift: 70, forecast: 60, health: 40 },
    dependencies: [],
    tags: []
  });
  const b = await createWorkItem(root, {
    title: "B",
    description: "B",
    type: "refactor",
    priority: "P1",
    status: "todo",
    relatedFiles: ["src/b.ts"],
    relatedTests: [],
    sdlcSignals: { risk: 50, drift: 20, forecast: 30, health: 70 },
    dependencies: [a.id],
    tags: []
  });
  await updateWorkItem(root, b.id, { dependencies: [a.id] });
  const g = await buildWorkGraph(root);
  assert.ok(g.nodes.length >= 2);
  assert.ok(g.edges.length >= 1);
  const s = buildWorkSchedule({
    graph: g,
    governanceLimits: { maxSteps: 20, maxWriteOps: 10, maxTerminalOps: 5 },
    forecast: { globalNextFailureProbability: 50, nextAgentRollbackProbability: 20 }
  });
  assert.ok(s.orderedWorkItemIds.length >= 2);
  await fs.rm(root, { recursive: true, force: true });
});
