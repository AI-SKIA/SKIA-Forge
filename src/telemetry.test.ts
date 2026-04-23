import assert from "node:assert/strict";
import test from "node:test";
import { TelemetryStore } from "./telemetry.js";

test("telemetry calculates percentile summary", () => {
  const t = new TelemetryStore();
  t.record("inline_completion_latency_ms", 80);
  t.record("inline_completion_latency_ms", 120);
  t.record("inline_completion_latency_ms", 200);
  const summary = t.getSummary();
  assert.equal(summary.inline_completion_latency_ms.count, 3);
  assert.ok(summary.inline_completion_latency_ms.p50 >= 80);
  assert.ok(summary.inline_completion_latency_ms.p95 >= summary.inline_completion_latency_ms.p50);
});
