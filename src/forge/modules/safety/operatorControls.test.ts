import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import {
  pauseGlobalEvolution,
  resumeGlobalEvolution,
  freezeAllHeuristics,
  freezeAllStrategyProfiles,
  enableAnalysisOnlyMode,
  disableAnalysisOnlyMode,
  triggerGlobalBaselineConsolidation,
  setGlobalRiskProfile,
  getOperatorControlStateV1,
  resetOperatorControlStateV1
} from "./operatorControls.js";
import { readAuditLog } from "../../../auditLog.js";

type ActionCase = {
  name: string;
  run: (roots: string[]) => Promise<void>;
  expect: (state: ReturnType<typeof getOperatorControlStateV1>) => void;
};

function findLastRecord(
  rows: Awaited<ReturnType<typeof readAuditLog>>,
  action: string
): (Awaited<ReturnType<typeof readAuditLog>>)[number] | undefined {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row?.action === action) return row;
  }
  return undefined;
}

test("operator controls emit start/complete and update state", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "operator-controls-"));
  const roots = [root];
  resetOperatorControlStateV1();
  const actions: ActionCase[] = [
    {
      name: "pauseGlobalEvolution",
      run: pauseGlobalEvolution,
      expect: (s) => assert.equal(s.globalEvolutionPaused, true)
    },
    {
      name: "resumeGlobalEvolution",
      run: resumeGlobalEvolution,
      expect: (s) => assert.equal(s.globalEvolutionPaused, false)
    },
    {
      name: "freezeAllHeuristics",
      run: freezeAllHeuristics,
      expect: (s) => assert.equal(s.freezeAllHeuristics, true)
    },
    {
      name: "freezeAllStrategyProfiles",
      run: freezeAllStrategyProfiles,
      expect: (s) => assert.equal(s.freezeAllStrategyProfiles, true)
    },
    {
      name: "enableAnalysisOnlyMode",
      run: enableAnalysisOnlyMode,
      expect: (s) => assert.equal(s.analysisOnlyMode, true)
    },
    {
      name: "disableAnalysisOnlyMode",
      run: disableAnalysisOnlyMode,
      expect: (s) => assert.equal(s.analysisOnlyMode, false)
    },
    {
      name: "triggerGlobalBaselineConsolidation",
      run: triggerGlobalBaselineConsolidation,
      expect: (s) => assert.equal(typeof s.globalRiskProfile, "string")
    },
    {
      name: "setGlobalRiskProfile",
      run: async (r) => setGlobalRiskProfile(r, "conservative"),
      expect: (s) => assert.equal(s.globalRiskProfile, "conservative")
    }
  ];
  for (const action of actions) {
    const before = getOperatorControlStateV1();
    await action.run(roots);
    const after = getOperatorControlStateV1();
    action.expect(after);
    const audits = await readAuditLog(root);
    const start = findLastRecord(audits, "operator.action.start");
    const complete = findLastRecord(audits, "operator.action.complete");
    assert.ok(start);
    assert.ok(complete);
    assert.equal((start?.parameters as any).actionName, action.name);
    assert.equal((complete?.parameters as any).actionName, action.name);
    assert.deepEqual((start?.parameters as any).previousState, before);
    assert.deepEqual((complete?.parameters as any).newState, after);
    assert.ok(audits.lastIndexOf(start!) < audits.lastIndexOf(complete!));
  }
  await fs.rm(root, { recursive: true, force: true });
});
