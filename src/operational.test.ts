import assert from "node:assert/strict";
import test from "node:test";
import { buildLiveness, buildReadiness } from "./operational.js";

test("buildLiveness returns uptime and status", () => {
  const state = {
    startedAt: Date.now() - 1000,
    ready: true,
    shuttingDown: false,
    skiaStatus: "Sovereign" as const
  };
  const live = buildLiveness(state);
  assert.equal(live.status, "ok");
  assert.equal(live.shuttingDown, false);
  assert.ok(live.uptimeMs >= 1000);
});

test("buildReadiness false when shutting down", () => {
  const state = {
    startedAt: Date.now(),
    ready: true,
    shuttingDown: true,
    skiaStatus: "Adaptive" as const
  };
  const ready = buildReadiness(state);
  assert.equal(ready.ready, false);
  assert.equal(ready.skiaStatus, "Adaptive");
});
