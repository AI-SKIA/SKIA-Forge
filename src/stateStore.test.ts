import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { GovernanceTelemetryStore } from "./governanceTelemetry.js";
import { ProviderRouter } from "./providerRouter.js";
import { TelemetryStore } from "./telemetry.js";
import { loadRuntimeState, persistRuntimeState } from "./stateStore.js";

test("runtime state persists and restores provider + telemetry", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-state-"));
  const providerA = new ProviderRouter();
  const telemetryA = new TelemetryStore();
  const governanceTelemetryA = new GovernanceTelemetryStore();
  let modeA: "strict" | "adaptive" | "autonomous" = "strict";
  let lockdownA = true;
  providerA.setProviderHealth("gemini", false, 900);
  providerA.forceProvider("skia");
  telemetryA.record("inline_completion_latency_ms", 123);
  governanceTelemetryA.record("strict", "production", "blocked");
  await persistRuntimeState(root, providerA, telemetryA, {
    getMode: () => modeA,
    getLockdown: () => lockdownA,
    governanceTelemetry: governanceTelemetryA
  });

  const providerB = new ProviderRouter();
  const telemetryB = new TelemetryStore();
  const governanceTelemetryB = new GovernanceTelemetryStore();
  let modeB: "strict" | "adaptive" | "autonomous" = "adaptive";
  let lockdownB = false;
  await loadRuntimeState(root, providerB, telemetryB, {
    setMode: (mode) => {
      modeB = mode;
    },
    setLockdown: (enabled) => {
      lockdownB = enabled;
    },
    governanceTelemetry: governanceTelemetryB
  });
  assert.equal(providerB.getForcedProvider(), "skia");
  const summary = telemetryB.getSummary();
  assert.ok(summary.inline_completion_latency_ms.count >= 1);
  assert.equal(modeB, "strict");
  assert.equal(lockdownB, true);
  assert.equal(governanceTelemetryB.getSummary().byDecision.blocked, 1);
  void modeA;
  void lockdownA;
});
