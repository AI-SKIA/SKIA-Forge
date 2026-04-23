import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import {
  appendAutoSessionStep,
  createAutoSession,
  getAutoSession,
  updateAutoSessionStatus
} from "./autoSessionModel.js";

test("auto session lifecycle persists append-only snapshots", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "auto-session-"));
  const s = await createAutoSession(root, ["w1"], {
    planVersionUsed: "v1",
    governanceSnapshot: { ok: true },
    sdlcSnapshot: { risk: "medium" },
    orchestrationSnapshot: { phase: 1 }
  });
  await appendAutoSessionStep(root, s.id, {
    type: "plan",
    workItemId: "w1",
    planId: "p1",
    outcome: "success",
    notes: "created plan"
  });
  await updateAutoSessionStatus(root, s.id, "completed", "done");
  const got = await getAutoSession(root, s.id);
  assert.ok(got);
  assert.equal(got!.status, "completed");
  assert.ok(got!.steps.length >= 1);
  await fs.rm(root, { recursive: true, force: true });
});
