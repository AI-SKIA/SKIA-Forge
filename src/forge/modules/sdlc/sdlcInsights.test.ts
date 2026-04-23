import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { recordSdlcEvent } from "./sdlcEventModel.js";
import { detectSdlcPatterns } from "./sdlcPatterns.js";
import { buildSdlcInsightsBundle } from "./sdlcInsights.js";

test("detectSdlcPatterns finds recurring and temporal signals", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdlc-pat-"));
  await recordSdlcEvent({ projectRoot: root, type: "test_run", status: "failure", path: "src/a.test.ts" });
  await recordSdlcEvent({ projectRoot: root, type: "test_run", status: "failure", path: "src/a.test.ts" });
  const bundle = await buildSdlcInsightsBundle(root, "src");
  const p = detectSdlcPatterns(bundle.timeline.days.flatMap((d) => d.events));
  assert.ok(p.recurringFailures.length > 0);
  assert.ok(bundle.healthScore >= 0 && bundle.healthScore <= 100);
  assert.ok(Array.isArray(bundle.recommendations.refactorFiles));
  await fs.rm(root, { recursive: true, force: true });
});
