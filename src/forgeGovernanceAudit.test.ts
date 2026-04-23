import assert from "node:assert/strict";
import test from "node:test";
import { buildGovernanceAuditRecord } from "./forgeGovernanceAudit.js";

test("buildGovernanceAuditRecord includes governance metadata", () => {
  const out = buildGovernanceAuditRecord({
    action: "forge.module.decision",
    mode: "strict",
    approved: false,
    module: "production",
    result: "failure",
    details: "blocked by policy"
  });
  assert.equal(out.action, "forge.module.decision");
  assert.equal(out.parameters.mode, "strict");
  assert.equal(out.parameters.module, "production");
  assert.equal(out.result, "failure");
});
