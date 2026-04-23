import assert from "node:assert/strict";
import test from "node:test";
import { buildControlPlaneAlerts } from "./forgeControlPlaneAlerts.js";

test("buildControlPlaneAlerts warns on mode drift", () => {
  const alerts = buildControlPlaneAlerts(
    "strict",
    { defaultMode: "adaptive", approvalRequiredModules: ["production"] },
    { totalDecisions: 1, byDecision: { blocked: 0, allowed: 1 } }
  );
  assert.ok(alerts.some((a) => a.code === "mode_drift" && a.level === "warning"));
});

test("buildControlPlaneAlerts warns on block pressure", () => {
  const alerts = buildControlPlaneAlerts(
    "adaptive",
    { defaultMode: "adaptive", approvalRequiredModules: ["production"] },
    { totalDecisions: 10, byDecision: { blocked: 6, allowed: 4 } }
  );
  assert.ok(alerts.some((a) => a.code === "block_pressure" && a.level === "warning"));
});

test("buildControlPlaneAlerts warns when key rotation grace window is near expiry", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  const alerts = buildControlPlaneAlerts(
    "adaptive",
    { defaultMode: "adaptive", approvalRequiredModules: ["production"] },
    { totalDecisions: 1, byDecision: { blocked: 0, allowed: 1 } },
    {
      enabled: true,
      keyRotation: {
        secondaryConfigured: true,
        secondaryGraceActive: true,
        secondaryGraceUntil: "2026-01-01T12:00:00.000Z"
      }
    },
    now
  );
  assert.ok(alerts.some((a) => a.code === "intent_rotation_grace_window" && a.level === "warning"));
});

test("buildControlPlaneAlerts warns when previous key is stale after grace", () => {
  const alerts = buildControlPlaneAlerts(
    "adaptive",
    { defaultMode: "adaptive", approvalRequiredModules: ["production"] },
    { totalDecisions: 1, byDecision: { blocked: 0, allowed: 1 } },
    {
      enabled: true,
      keyRotation: {
        secondaryConfigured: true,
        secondaryGraceActive: false,
        secondaryGraceUntil: "2026-01-01T00:00:00.000Z"
      }
    }
  );
  assert.ok(
    alerts.some((a) => a.code === "intent_rotation_stale_previous_key" && a.level === "warning")
  );
});
