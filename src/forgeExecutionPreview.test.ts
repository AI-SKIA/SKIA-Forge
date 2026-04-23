import assert from "node:assert/strict";
import test from "node:test";
import { previewModuleDecision, previewOrchestrationDecisions } from "./forgeExecutionPreview.js";
import { ForgeGovernancePolicy } from "./forgePolicy.js";

const policy: ForgeGovernancePolicy = {
  defaultMode: "adaptive" as const,
  approvalRequiredModules: ["agent", "production", "healing"]
};

test("previewModuleDecision blocks production in adaptive without approval", () => {
  const out = previewModuleDecision("adaptive", "production", false, policy);
  assert.equal(out.allowed, false);
});

test("previewOrchestrationDecisions returns ordered stage preview", () => {
  const out = previewOrchestrationDecisions("strict", false, true, policy);
  assert.equal(out.stages[0].stage, "context");
  assert.ok(out.stages.some((s) => s.stage === "production" && !s.allowed));
});
