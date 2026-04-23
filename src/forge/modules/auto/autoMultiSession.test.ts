import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAutoOutcome } from "./autoEvaluator.js";
import type { AutoExecutionSessionV1 } from "./autoSessionModel.js";

test("auto evaluator computes bounded overall score", () => {
  const session: AutoExecutionSessionV1 = {
    v: 1,
    id: "s1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "completed",
    workItemIds: ["w1"],
    planVersionUsed: "v4",
    governanceSnapshot: {},
    sdlcSnapshot: {},
    orchestrationSnapshot: {},
    steps: [
      { timestamp: new Date().toISOString(), type: "plan", outcome: "success" },
      { timestamp: new Date().toISOString(), type: "execute", outcome: "success" },
      { timestamp: new Date().toISOString(), type: "governanceCheck", outcome: "success" }
    ]
  };
  const out = evaluateAutoOutcome(
    session,
    {
      longHorizonGoals: ["improve stability score"],
      recommendedWorkItems: ["w1"],
      recommendedOrdering: ["w1"],
      rationale: [],
      riskForecast: [],
      expectedOutcome: []
    },
    {
      plannerPreference: "v4",
      correctionBudget: 2,
      driftMitigationPriority: "high",
      testStabilizationPriority: "high",
      mode: "stability_first",
      selectionWeights: { risk: 0.3, drift: 0.2, forecast: 0.15, stability: 0.35 },
      sessionLength: 4,
      sessionCadenceMs: 30000,
      rationale: []
    },
    {
      heuristics: { stabilityScore: 75 },
      drift: { score: 40 },
      forecast: { globalNextFailureProbability: 35, nextAgentRollbackProbability: 30 },
      risk: { project: { class: "medium" } }
    } as any
  );
  assert.ok(out.overallOutcomeScore >= 0 && out.overallOutcomeScore <= 100);
});
