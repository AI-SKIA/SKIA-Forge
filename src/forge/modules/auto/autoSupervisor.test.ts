import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAutoSafety } from "./autoSafety.js";
import type { AutoExecutionSessionV1 } from "./autoSessionModel.js";

test("auto safety flags critical conditions", () => {
  const session: AutoExecutionSessionV1 = {
    v: 1,
    id: "s",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "running",
    workItemIds: ["w1"],
    planVersionUsed: "v4",
    governanceSnapshot: {},
    sdlcSnapshot: {},
    orchestrationSnapshot: {},
    steps: Array.from({ length: 12 }, (_, i) => ({
      timestamp: new Date().toISOString(),
      type: i % 2 === 0 ? "execute" : "plan",
      outcome: "failure",
      notes: i % 2 === 0 ? "rollback write churn" : "planVersion=v3 fallback"
    }))
  };
  const safety = evaluateAutoSafety(
    session,
    { stabilityStatus: "critical", recommendedAction: "halt", notes: [] },
    {
      policy: { maxOpenP0: 3, maxBlockedItems: 5, maxHighRiskItems: 12, targetCompletionPercent: 75, targetStabilityScore: 70 },
      violations: ["Blocked items exceed policy"],
      warnings: [],
      slaDrift: { completionGap: 20, stabilityGap: 15 }
    },
    {
      severity: "critical",
      notes: [],
      recommendedActions: ["halt auto mode"],
      signals: { completionGap: 20, stabilityGap: 15, phaseCompletionGap: 12, highRiskBacklog: 1, blockedBacklog: 1 }
    }
  );
  assert.ok(["unsafe", "critical"].includes(safety.safetyStatus));
  assert.ok(["halt", "require_human_review"].includes(safety.recommendedAction));
});
