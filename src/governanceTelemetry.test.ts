import assert from "node:assert/strict";
import test from "node:test";
import { GovernanceTelemetryStore } from "./governanceTelemetry.js";

test("governance telemetry tracks decision counters", () => {
  const store = new GovernanceTelemetryStore();
  store.record("adaptive", "production", "blocked");
  store.record("adaptive", "production", "allowed");
  store.record("strict", "agent", "blocked");

  const out = store.getSummary();
  assert.equal(out.totalDecisions, 3);
  assert.equal(out.byDecision.blocked, 2);
  assert.equal(out.byMode.adaptive, 2);
  const production = out.byModule.find((m) => m.module === "production");
  assert.equal(production?.allowed, 1);
  assert.equal(production?.blocked, 1);
});

test("governance telemetry snapshot round-trip restores counts", () => {
  const a = new GovernanceTelemetryStore();
  a.record("strict", "production", "blocked");
  a.record("adaptive", "context", "allowed");
  const b = new GovernanceTelemetryStore();
  b.restoreFromSnapshot(a.toSnapshot());
  const out = b.getSummary();
  assert.equal(out.totalDecisions, 2);
  assert.equal(out.byDecision.blocked, 1);
  assert.equal(out.byMode.strict, 1);
});
