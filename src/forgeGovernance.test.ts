import assert from "node:assert/strict";
import test from "node:test";
import { evaluateForgeModuleAccess } from "./forgeGovernance.js";

test("strict mode blocks production without approval", () => {
  const out = evaluateForgeModuleAccess("strict", "production", false);
  assert.equal(out.allowed, false);
});

test("autonomous mode allows agent without approval", () => {
  const out = evaluateForgeModuleAccess("autonomous", "agent", false);
  assert.equal(out.allowed, true);
});

test("adaptive mode uses policy approval modules", () => {
  const out = evaluateForgeModuleAccess(
    "adaptive",
    "sdlc",
    false,
    { defaultMode: "adaptive", approvalRequiredModules: ["sdlc"] }
  );
  assert.equal(out.allowed, false);
});
