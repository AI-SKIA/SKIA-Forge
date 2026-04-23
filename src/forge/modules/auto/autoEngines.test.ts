import test from "node:test";
import assert from "node:assert/strict";
import { analyzeAutoFailure } from "./autoFailureRecovery.js";
import { adaptAutoStrategy } from "./autoAdaptation.js";
import { evaluateAutoStability } from "./autoStability.js";
import type { AutoExecutionSessionV1 } from "./autoSessionModel.js";

test("auto recovery/adaptation/stability produce deterministic outputs", () => {
  const session: AutoExecutionSessionV1 = {
    v: 1,
    id: "s1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "running",
    workItemIds: ["w1"],
    planVersionUsed: "v4",
    governanceSnapshot: {},
    sdlcSnapshot: {},
    orchestrationSnapshot: {},
    steps: [
      { timestamp: new Date().toISOString(), type: "plan", outcome: "failure", notes: "parse error" },
      { timestamp: new Date().toISOString(), type: "plan", outcome: "failure", notes: "parse error" },
      { timestamp: new Date().toISOString(), type: "execute", outcome: "failure" }
    ]
  };
  const sdlc: any = {
    drift: { score: 70 },
    heuristics: { stabilityScore: 50 },
    forecast: { globalNextFailureProbability: 80 },
    risk: { project: { class: "high" } }
  };
  const memory: any[] = [
    { category: "planner_pattern", outcome: "failure" },
    { category: "executor_pattern", outcome: "failure", details: "rollback happened" }
  ];
  const recovery = analyzeAutoFailure(session, session.steps.at(-1) ?? null, sdlc, memory as any);
  const adaptation = adaptAutoStrategy(session, recovery, sdlc, memory as any);
  const stability = evaluateAutoStability(session, adaptation, memory as any, sdlc);
  assert.ok(["planner", "executor", "selfCorrect", "governance", "sdlc"].includes(recovery.failureCategory));
  assert.ok(["v4", "v3", "v2"].includes(adaptation.updatedStrategy.plannerPreference));
  assert.ok(["stable", "unstable", "degraded", "critical"].includes(stability.stabilityStatus));
});
