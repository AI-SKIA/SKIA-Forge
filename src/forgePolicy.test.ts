import assert from "node:assert/strict";
import test from "node:test";
import { buildGovernancePolicy } from "./forgePolicy.js";

test("buildGovernancePolicy uses defaults when rules absent", () => {
  const out = buildGovernancePolicy({});
  assert.equal(out.defaultMode, "adaptive");
  assert.ok(out.approvalRequiredModules.includes("production"));
});

test("buildGovernancePolicy accepts governance overrides", () => {
  const out = buildGovernancePolicy({
    governance: {
      default_mode: "strict",
      approval_required_modules: ["sdlc", "production", "invalid-module"]
    }
  });
  assert.equal(out.defaultMode, "strict");
  assert.deepEqual(out.approvalRequiredModules, ["sdlc", "production"]);
});
