import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { runGlobalAutoExecution } from "./globalAutoOrchestrator.js";
import { readAuditLog } from "../../../auditLog.js";
import { resetOperatorControlStateV1 } from "../safety/operatorControls.js";

test("global auto orchestrator halts on global kill-switch", async () => {
  resetOperatorControlStateV1();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "global-auto-halt-"));
  const result = await runGlobalAutoExecution([root], {
    maxGlobalCycles: 1,
    safetyGatewayOptions: { safety: { globalKillSwitch: true }, policy: { requiredConvergenceThreshold: 0 } }
  });
  assert.equal(result.status, "halted");
  assert.match(result.reason, /kill_switch/i);
  assert.equal(result.perRepoResults.length, 0);
  await fs.rm(root, { recursive: true, force: true });
});

test("global auto orchestrator honors repo kill-switch and skips only killed repo", async () => {
  resetOperatorControlStateV1();
  const rootA = await fs.mkdtemp(path.join(os.tmpdir(), "global-auto-repo-a-"));
  const rootB = await fs.mkdtemp(path.join(os.tmpdir(), "global-auto-repo-b-"));
  const result = await runGlobalAutoExecution([rootA, rootB], {
    maxGlobalCycles: 1,
    safetyGatewayOptions: { policy: { requiredConvergenceThreshold: 0 } },
    repoKillSwitches: { [rootA]: true }
  });
  assert.equal(result.status, "completed");
  const repoA = result.perRepoResults.find((x) => x.projectRoot === rootA);
  const repoB = result.perRepoResults.find((x) => x.projectRoot === rootB);
  assert.equal(repoA?.reason, "repo kill-switch enabled");
  assert.equal(repoA?.status, "paused");
  assert.equal(repoB?.status, "paused");
  assert.ok(repoB?.reason?.length);
  await fs.rm(rootA, { recursive: true, force: true });
  await fs.rm(rootB, { recursive: true, force: true });
});

test("global auto orchestrator analysis-only mode avoids mutations and marks audit", async () => {
  resetOperatorControlStateV1();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "global-auto-analysis-"));
  const result = await runGlobalAutoExecution([root], {
    maxGlobalCycles: 1,
    safetyGatewayOptions: { safety: { enforceAnalysisOnly: true }, policy: { requiredConvergenceThreshold: 0 } }
  });
  assert.equal(result.status, "completed");
  assert.equal(result.perRepoResults[0]?.status, "paused");
  assert.equal(result.perRepoResults[0]?.reason, "analysis-only mode enforced");
  const audits = await readAuditLog(root);
  const tick = audits.find((x) => x.action === "global.auto.tick");
  assert.equal((tick?.parameters as any)?.gateway?.gatewayStatus, "analysisOnly");
  await fs.rm(root, { recursive: true, force: true });
});
