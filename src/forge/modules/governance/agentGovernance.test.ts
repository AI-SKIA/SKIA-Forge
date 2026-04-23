import test from "node:test";
import assert from "node:assert/strict";
import { validateExecutorGovernance, warnPlannerStepCount, DEFAULT_AGENT_GOVERNANCE } from "./agentGovernance.js";

const plan = (n: number) => ({
  title: "p",
  steps: Array.from({ length: n }, (_, i) => ({ id: `s${i}`, title: "t", detail: "" }))
});

test("validateExecutorGovernance: rejects > max write ops", () => {
  const bigPlan = plan(11);
  const many = Array.from({ length: 11 }, (_, i) => ({
    stepId: `s${i}`,
    tool: "write_file" as const,
    input: {}
  }));
  const r = validateExecutorGovernance(
    { title: "p", steps: bigPlan.steps },
    many,
    DEFAULT_AGENT_GOVERNANCE
  );
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.code, "max_write");
  }
});

test("warnPlannerStepCount: warns over max steps", () => {
  const w = warnPlannerStepCount({ title: "p", steps: plan(25).steps } as any);
  assert.ok(w && w.includes("25"));
});
