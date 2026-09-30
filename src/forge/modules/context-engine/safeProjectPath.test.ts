import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assertSafeRelativeProjectPath } from "./safeProjectPath.js";

const projectRoot = path.join(os.tmpdir(), "proj");

test("safe project path rejects dotdot", () => {
  const out = assertSafeRelativeProjectPath(projectRoot, "../x");
  assert.equal(out.ok, false);
});

test("safe project path allows nested file", () => {
  const out = assertSafeRelativeProjectPath(projectRoot, "src/test.ts");
  assert.equal(out.ok, true);
  if (out.ok) {
    assert.equal(out.absPath, path.join(projectRoot, "src", "test.ts"));
    assert.equal(out.relPosix, "src/test.ts");
  }
});
