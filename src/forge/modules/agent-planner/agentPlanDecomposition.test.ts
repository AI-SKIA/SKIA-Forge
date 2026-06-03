import assert from "node:assert/strict";
import test from "node:test";
import { fallbackStepsFromPlan } from "./agentPlanDecomposition.js";

test("fallbackStepsFromPlan maps each plan step to search_codebase", () => {
  const steps = fallbackStepsFromPlan(
    {
      version: "1",
      title: "Fix auth",
      steps: [
        { id: "s1", title: "Find handler", detail: "" },
        { id: "s2", title: "Patch route", detail: "" }
      ]
    },
    "src/auth.ts",
    "Fix login 401"
  );
  assert.equal(steps.length, 2);
  assert.equal(steps[0]?.tool, "search_codebase");
  assert.equal(steps[0]?.stepId, "s1");
  assert.equal((steps[0]?.input as { path?: string }).path, "src/auth.ts");
});
