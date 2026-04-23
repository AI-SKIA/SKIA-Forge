import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { recordSdlcEvent } from "./sdlcEventModel.js";
import { computeSdlcHeuristics } from "./sdlcHeuristics.js";

test("computeSdlcHeuristics returns risk and hotspots", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdlc-h-"));
  await recordSdlcEvent({ projectRoot: root, type: "agent_run", status: "failure", path: "src/a.ts" });
  await recordSdlcEvent({ projectRoot: root, type: "agent_run", status: "failure", path: "src/a.ts" });
  await recordSdlcEvent({ projectRoot: root, type: "test_run", status: "success", durationMs: 120 });
  const h = await computeSdlcHeuristics(root);
  assert.ok(h.riskScore > 0);
  assert.ok(h.hotspotFiles.length > 0);
  assert.ok(h.flakyFiles.length > 0);
  await fs.rm(root, { recursive: true, force: true });
});
