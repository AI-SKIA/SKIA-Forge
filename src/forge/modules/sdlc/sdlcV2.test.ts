import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { recordSdlcEvent } from "./sdlcEventModel.js";
import { buildSdlcInsightsBundle } from "./sdlcInsights.js";

test("SdlcInsightsBundleV2 includes drift/risk/forecast", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdlc-v2-"));
  await recordSdlcEvent({ projectRoot: root, type: "planner_run", status: "failure", path: "src/a.ts", details: "parse error" });
  await recordSdlcEvent({ projectRoot: root, type: "agent_run", status: "failure", path: "src/a.ts", details: "rollback cycle" });
  await recordSdlcEvent({ projectRoot: root, type: "test_run", status: "failure", path: "src/a.test.ts" });
  const b = await buildSdlcInsightsBundle(root, "src", {
    architecture: { boundaries: [{ pathPattern: "src/**", cannotImportFrom: ["../internal/**"] }] }
  } as any);
  assert.ok(typeof b.healthScore === "number");
  assert.ok(typeof b.drift.score === "number");
  assert.ok(typeof b.risk.project.score === "number");
  assert.ok(typeof b.forecast.globalNextFailureProbability === "number");
  await fs.rm(root, { recursive: true, force: true });
});
