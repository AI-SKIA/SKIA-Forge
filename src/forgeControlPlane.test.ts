import assert from "node:assert/strict";
import test from "node:test";
import { buildControlPlaneSnapshot } from "./forgeControlPlane.js";

test("buildControlPlaneSnapshot returns filtered forge audit tail", () => {
  const out = buildControlPlaneSnapshot({
    mode: "adaptive",
    lockdown: true,
    policy: {
      defaultMode: "adaptive",
      approvalRequiredModules: ["production"]
    },
    telemetry: { totalDecisions: 2 },
    approvalTokens: { active: 1 },
    intents: { enabled: true, counters: { verified: 2 } },
    auditRows: [
      {
        timestamp: new Date().toISOString(),
        action: "agent.validate_command",
        parameters: {},
        result: "success"
      },
      {
        timestamp: new Date().toISOString(),
        action: "forge.module.decision",
        parameters: {},
        result: "failure",
        details: "blocked"
      }
    ]
  });
  assert.equal(out.mode, "adaptive");
  assert.equal(out.lockdown, true);
  assert.equal(out.recentGovernanceAudit.length, 1);
  assert.equal(out.recentGovernanceAudit[0].action, "forge.module.decision");
  assert.ok(Array.isArray(out.alerts));
  assert.ok(Array.isArray(out.recommendations));
  assert.equal(typeof out.approvalTokens, "object");
  assert.equal(typeof out.intents, "object");
});
