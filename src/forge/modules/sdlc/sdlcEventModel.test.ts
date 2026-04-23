import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { querySdlcEvents, recordSdlcEvent } from "./sdlcEventModel.js";

test("record/query SDLC events", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sdlc-events-"));
  await recordSdlcEvent({
    projectRoot: root,
    type: "planner_run",
    status: "success",
    path: "src/a.ts"
  });
  await recordSdlcEvent({
    projectRoot: root,
    type: "test_run",
    status: "failure",
    path: "src/a.ts"
  });
  const all = await querySdlcEvents(root, { limit: 10 });
  assert.equal(all.length, 2);
  const tests = await querySdlcEvents(root, { types: ["test_run"] });
  assert.equal(tests.length, 1);
  assert.equal(tests[0]!.status, "failure");
  await fs.rm(root, { recursive: true, force: true });
});
