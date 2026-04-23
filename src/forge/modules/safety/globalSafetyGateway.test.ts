import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { runGlobalSafetyGateway } from "./globalSafetyGateway.js";
import { readAuditLog } from "../../../auditLog.js";
import type { GlobalStateSnapshotV1 } from "../global/globalState.js";
import { resetOperatorControlStateV1 } from "./operatorControls.js";

const snapshot: GlobalStateSnapshotV1 = {
  latestGlobalContextGraph: null,
  latestGlobalWorkPlan: null,
  latestGlobalGovernance: null,
  latestGlobalDashboard: null,
  latestGlobalSelfImprovementResult: null,
  latestGlobalStrategyEvolution: null,
  latestGlobalConsolidationResult: null,
  latestGlobalHeuristicConvergence: null,
  latestGlobalStrategyConvergence: null,
  latestGlobalEvolutionHealth: null,
  latestGlobalMetaOptimizationSummary: null
};

test("global safety gateway decision matrix + audits", async () => {
  resetOperatorControlStateV1();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "safety-gateway-"));
  const roots = [root];

  const allow = await runGlobalSafetyGateway(roots, snapshot, {
    policy: { requiredConvergenceThreshold: 40 }
  });
  assert.equal(allow.gatewayStatus, "allow");
  assert.equal(allow.violatedSafetyRules.length, 0);
  assert.equal(allow.violatedPolicies.length, 0);
  assert.equal(allow.requiredApprovals.length, 0);

  const allowWithRestrictions = await runGlobalSafetyGateway(roots, snapshot, {
    policy: { humanApprovalRequired: true, requiredConvergenceThreshold: 40 }
  });
  assert.equal(allowWithRestrictions.gatewayStatus, "allowWithRestrictions");
  assert.equal(allowWithRestrictions.policy.policyStatus, "warning");

  const analysisOnly = await runGlobalSafetyGateway(roots, snapshot, {
    safety: { enforceAnalysisOnly: true },
    policy: { requiredConvergenceThreshold: 40 }
  });
  assert.equal(analysisOnly.gatewayStatus, "analysisOnly");

  const haltSafetyHalted = await runGlobalSafetyGateway(roots, snapshot, {
    safety: { globalKillSwitch: true },
    policy: { requiredConvergenceThreshold: 40 }
  });
  assert.equal(haltSafetyHalted.gatewayStatus, "halt");
  assert.ok(haltSafetyHalted.violatedSafetyRules.some((r) => r.includes("global_kill_switch")));

  const haltSafetyDeny = await runGlobalSafetyGateway(roots, snapshot, {
    safety: { requestedChangeVolume: 9999, maxChangeVolumePerCycle: 1 },
    policy: { requiredConvergenceThreshold: 40 }
  });
  assert.equal(haltSafetyDeny.gatewayStatus, "halt");
  assert.ok(haltSafetyDeny.violatedSafetyRules.includes("max_change_volume_exceeded"));

  const haltPolicy = await runGlobalSafetyGateway(roots, snapshot, {
    policy: { requiredConvergenceThreshold: 99 }
  });
  assert.equal(haltPolicy.gatewayStatus, "halt");
  assert.ok(haltPolicy.violatedPolicies.includes("insufficient_global_convergence"));

  const audits = await readAuditLog(root);
  const starts = audits.filter((x) => x.action === "safety.gateway.start");
  const decisions = audits.filter((x) => x.action === "safety.gateway.decision");
  const halts = audits.filter((x) => x.action === "safety.gateway.halt");
  assert.ok(starts.length >= 6);
  assert.ok(decisions.length >= 6);
  assert.ok(halts.length >= 3);
  assert.ok(decisions.every((x) => typeof (x.parameters as any).gatewayStatus === "string"));
  assert.ok(decisions.every((x) => Array.isArray((x.parameters as any).violatedSafetyRules)));
  assert.ok(decisions.every((x) => Array.isArray((x.parameters as any).requiredApprovals)));

  await fs.rm(root, { recursive: true, force: true });
});
