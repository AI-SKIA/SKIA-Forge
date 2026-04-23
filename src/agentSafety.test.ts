import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCommandSafety } from "./agentSafety.js";

test("safe command allowed without approval", () => {
  const result = evaluateCommandSafety("npm run build");
  assert.equal(result.allowed, true);
  assert.equal(result.approvalRequired, false);
});

test("destructive command is blocked and requires approval", () => {
  const result = evaluateCommandSafety("rm -rf .");
  assert.equal(result.allowed, false);
  assert.equal(result.approvalRequired, true);
});
