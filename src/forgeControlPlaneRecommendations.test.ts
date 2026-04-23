import assert from "node:assert/strict";
import test from "node:test";
import { buildControlPlaneRecommendations } from "./forgeControlPlaneRecommendations.js";

test("buildControlPlaneRecommendations suggests align mode", () => {
  const out = buildControlPlaneRecommendations(
    "strict",
    { defaultMode: "adaptive", approvalRequiredModules: ["production"] },
    [{ level: "warning", code: "mode_drift", message: "drift" }]
  );
  assert.ok(out.some((r) => r.code === "align_mode"));
});

test("buildControlPlaneRecommendations emits healthy posture", () => {
  const out = buildControlPlaneRecommendations(
    "adaptive",
    { defaultMode: "adaptive", approvalRequiredModules: ["production"] },
    [{ level: "info", code: "mode_drift", message: "ok" }]
  );
  assert.equal(out[0].code, "healthy_posture");
});

test("buildControlPlaneRecommendations suggests intent key cleanup", () => {
  const out = buildControlPlaneRecommendations(
    "adaptive",
    { defaultMode: "adaptive", approvalRequiredModules: ["production"] },
    [{ level: "warning", code: "intent_rotation_stale_previous_key", message: "stale key" }]
  );
  assert.ok(out.some((r) => r.code === "rotate_intent_key_cleanup"));
});
