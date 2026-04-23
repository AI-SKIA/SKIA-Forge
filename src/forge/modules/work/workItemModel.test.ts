import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { createWorkItem, queryWorkItems, updateWorkItem, ensureWorkItemForPlan } from "./workItemModel.js";

test("work item create/query/update", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "work-item-"));
  const w = await createWorkItem(root, {
    title: "A",
    description: "desc",
    type: "feature",
    priority: "P2",
    status: "todo",
    relatedFiles: ["src/a.ts"],
    relatedTests: [],
    sdlcSignals: { risk: 10, drift: 20, forecast: 30, health: 90 },
    dependencies: [],
    tags: ["x"]
  });
  assert.ok(w.id.length > 0);
  const got = await queryWorkItems(root, { status: "todo" });
  assert.equal(got.length, 1);
  await updateWorkItem(root, w.id, { status: "in_progress", tags: ["hotspot"] });
  const got2 = await queryWorkItems(root, { status: "in_progress" });
  assert.equal(got2.length, 1);
  const ensured = await ensureWorkItemForPlan(root, {
    title: "A",
    description: "desc2",
    relatedFiles: ["src/a.ts"],
    sdlcSignals: { risk: 1, drift: 1, forecast: 1, health: 99 }
  });
  assert.equal(ensured.id, w.id);
  await fs.rm(root, { recursive: true, force: true });
});
