import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { recordSdlcEvent } from "./sdlcEventModel.js";
import { buildSdlcTimeline } from "./sdlcTimeline.js";

test("buildSdlcTimeline computes streak and rates", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdlc-tl-"));
  await recordSdlcEvent({ projectRoot: root, type: "test_run", status: "success", durationMs: 100 });
  await recordSdlcEvent({ projectRoot: root, type: "agent_run", status: "failure", path: "src/a.ts" });
  await recordSdlcEvent({ projectRoot: root, type: "agent_run", status: "success", path: "src/a.ts" });
  const t = await buildSdlcTimeline(root);
  assert.ok(t.eventCount >= 3);
  assert.ok(t.metrics.averageValidationTimeMs >= 100);
  assert.ok(t.metrics.agentSuccessRate > 0);
  await fs.rm(root, { recursive: true, force: true });
});
