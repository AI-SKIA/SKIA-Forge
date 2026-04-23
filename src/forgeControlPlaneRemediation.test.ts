import assert from "node:assert/strict";
import test from "node:test";
import {
  executeControlPlaneRemediation,
  executeRecommendedRemediations
} from "./forgeControlPlaneRemediation.js";

test("executeControlPlaneRemediation aligns mode", () => {
  const out = executeControlPlaneRemediation(
    "align_mode",
    "strict",
    { defaultMode: "adaptive", approvalRequiredModules: ["production"] }
  );
  assert.equal(out.applied, true);
  assert.equal(out.nextMode, "adaptive");
});

test("executeControlPlaneRemediation supports no-op guidance action", () => {
  const out = executeControlPlaneRemediation(
    "healthy_posture",
    "adaptive",
    { defaultMode: "adaptive", approvalRequiredModules: ["production"] }
  );
  assert.equal(out.applied, false);
});

test("executeRecommendedRemediations applies align_mode and keeps final mode", () => {
  const out = executeRecommendedRemediations(
    [
      { code: "align_mode", action: "Align mode" },
      { code: "reduce_block_pressure", action: "Reduce blocks" }
    ],
    "strict",
    { defaultMode: "adaptive", approvalRequiredModules: ["production"] }
  );
  assert.equal(out.nextMode, "adaptive");
  assert.equal(out.outcomes.length, 2);
  assert.equal(out.outcomes[0].action, "align_mode");
});
