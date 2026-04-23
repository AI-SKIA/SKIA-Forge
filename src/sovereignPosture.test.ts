import assert from "node:assert/strict";
import test from "node:test";
import { buildSovereignPosture } from "./sovereignPosture.js";

test("buildSovereignPosture reports healthy when no warnings and ready", () => {
  const out = buildSovereignPosture({
    skiaStatus: "Sovereign",
    ready: true,
    mode: "adaptive",
    lockdown: false,
    integration: { enabled: true, brainOnly: true },
    controlPlane: {
      alerts: [{ level: "info" }],
      recommendations: [{ code: "healthy_posture" }],
      intents: { enabled: true }
    }
  });
  assert.equal(out.status, "healthy");
  assert.equal(out.governance.warningCount, 0);
});

test("buildSovereignPosture reports attention when warnings present", () => {
  const out = buildSovereignPosture({
    skiaStatus: "Adaptive",
    ready: true,
    mode: "adaptive",
    lockdown: false,
    integration: { enabled: true, brainOnly: true },
    controlPlane: {
      alerts: [{ level: "warning" }],
      recommendations: [{ code: "rotate_intent_key_cleanup" }],
      intents: { enabled: true }
    }
  });
  assert.equal(out.status, "attention");
  assert.equal(out.governance.warningCount, 1);
});
