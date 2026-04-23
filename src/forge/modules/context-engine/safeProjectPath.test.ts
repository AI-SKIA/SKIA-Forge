import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { assertSafeRelativeProjectPath } from "./safeProjectPath.js";

test("safe project path rejects dotdot", () => {
  const root = "C:/proj";
  const out = assertSafeRelativeProjectPath(root, "../x");
  assert.equal(out.ok, false);
});

test("safe project path allows nested file", () => {
  const base = "C:/proj";
  const out = assertSafeRelativeProjectPath(base, "src/test.ts");
  assert.equal(out.ok, true);
  if (out.ok) {
    assert.equal(out.absPath, path.join(base, "src", "test.ts"));
  }
});
