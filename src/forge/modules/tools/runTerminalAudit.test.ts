import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readAuditLog } from "../../../auditLog.js";
import { runTerminalTool } from "./runTerminalTool.js";

test("every run_terminal outcome is written to the project audit log without command output", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-term-audit-"));
  try {
    const ok = await runTerminalTool.execute({ projectRoot, userInitiated: true }, { command: "node --version", source: "user" });
    assert.equal(ok.success, true);

    const blocked = await runTerminalTool.execute({ projectRoot }, { command: "rm -rf /" });
    assert.equal(blocked.success, false);

    const nonZero = await runTerminalTool.execute(
      { projectRoot, userInitiated: true },
      { command: 'node -e "process.exit(3)"', source: "user" }
    );
    assert.equal(nonZero.success, true);

    const entries = (await readAuditLog(projectRoot)).filter((e) => e.action === "tool.run_terminal");
    assert.deepEqual(
      entries.map((e) => [e.parameters?.command, e.result]),
      [
        ["node --version", "success"],
        ["rm -rf /", "blocked"],
        ['node -e "process.exit(3)"', "failure"]
      ]
    );
    assert.equal(entries[0].parameters?.userInitiated, true);
    assert.equal(entries[1].parameters?.errorCode, "SAFETY");
    assert.equal(entries[2].parameters?.exitCode, 3);
    for (const e of entries) {
      assert.equal(typeof e.parameters?.durationMs, "number");
      assert.equal("stdout" in (e.parameters ?? {}), false);
    }
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true });
  }
});
