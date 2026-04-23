import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { readAuditLog } from "../../../auditLog.js";
import { createDefaultToolRegistry } from "../tools/index.js";
import { runAgentTaskExecution, type StepAction } from "./agentTaskExecutor.js";

function twoStepPlan() {
  return {
    title: "Test plan",
    steps: [
      { id: "s1", title: "a", detail: "" },
      { id: "s2", title: "b", detail: "", dependsOn: ["s1"] as string[] }
    ]
  };
}

test("agent executor — preview: write_file shows diff without writing", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skia-ex-"));
  const f = "out.txt";
  const actions: StepAction[] = [
    { stepId: "s1", tool: "write_file", input: { path: f, content: "x" } }
  ];
  const r = await runAgentTaskExecution(
    projectRoot,
    { title: "t", steps: [{ id: "s1", title: "A", detail: "" }] },
    actions,
    createDefaultToolRegistry(),
    { mode: "preview", fileMutationApprovals: {}, highRiskCommandApprovals: {} }
  );
  assert.equal(r.stopReason, undefined);
  const step = r.stepResults[0];
  assert.equal(step?.status, "preview_gated");
  assert.equal(step?.fileMutation?.path, f.replace(/\\/g, "/"));
  assert.match(step?.fileMutation?.diff ?? "", /\+x/);
  assert.ok(typeof step?.startedAt === "string" && step.startedAt.length > 0);
  assert.ok(typeof step?.endedAt === "string");
  assert.ok((step?.durationMs ?? 0) >= 0);
  assert.equal(step?.toolSafety?.needsApproval, false);
  assert.equal(r.diffSummary?.filesTouched, 1);
  const stat = await fs.readFile(path.join(projectRoot, f), "utf8").catch((e) => e);
  assert.equal((stat as NodeJS.ErrnoException).code, "ENOENT");
});

test("agent executor — apply: write_file requires fileMutationApprovals[stepId]", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skia-ex-"));
  const f = "w.txt";
  const plan = { title: "p", steps: twoStepPlan().steps };
  const actions: StepAction[] = [
    { stepId: "s1", tool: "write_file", input: { path: f, content: "hello" } }
  ];
  const r = await runAgentTaskExecution(projectRoot, plan, actions, createDefaultToolRegistry(), {
    mode: "apply",
    fileMutationApprovals: {},
    highRiskCommandApprovals: {}
  });
  assert.equal(r.stepResults[0]?.status, "blocked_approval");
  const t = await fs.readFile(path.join(projectRoot, f), "utf8").catch((e) => e);
  assert.equal((t as NodeJS.ErrnoException).code, "ENOENT");
});

test("agent executor — apply: write with approval and rollback on follow-up failure", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skia-ex-"));
  const f1 = "a.txt";
  const f2 = "b.txt";
  const plan = {
    title: "p",
    steps: [
      { id: "s1", title: "w", detail: "" },
      { id: "s2", title: "e", detail: "", dependsOn: ["s1"] }
    ]
  };
  const actions: StepAction[] = [
    { stepId: "s1", tool: "write_file", input: { path: f1, content: "A" } },
    {
      stepId: "s2",
      tool: "edit_file",
      input: { path: f2, oldText: "X", newText: "Y" }
    }
  ];
  const r = await runAgentTaskExecution(
    projectRoot,
    plan,
    actions,
    createDefaultToolRegistry(),
    {
      mode: "apply",
      fileMutationApprovals: { s1: true, s2: true },
      highRiskCommandApprovals: {}
    }
  );
  assert.equal(r.stepResults[0]?.status, "ok");
  assert.equal(r.stepResults[1]?.status, "failed");
  assert.equal(r.appliedRollback, true);
  assert.ok(r.rollbackSummary);
  assert.equal(r.rollbackSummary?.success, "full");
  assert.ok(
    (r.rollbackSummary?.filesRestored ?? []).some(
      (p) => p.replace(/\\/g, "/") === f1
    ) || r.rollbackSummary?.rolledBackSteps.some((s) => s.stepId === "s1")
  );
  const a = await fs.readFile(path.join(projectRoot, f1), "utf8").catch((e) => (e as NodeJS.ErrnoException).code);
  assert.equal(a, "ENOENT", "write rolled back");
});

test("run_terminal — preview does not run; apply blocked without highRisk approval", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skia-ex-"));
  const plan = { title: "p", steps: [{ id: "s1", title: "rm", detail: "" }] };
  const cmd = { stepId: "s1" as const, tool: "run_terminal" as const, input: { command: "rm -rf x" } };
  const prev = await runAgentTaskExecution(projectRoot, plan, [cmd], createDefaultToolRegistry(), {
    mode: "preview",
    fileMutationApprovals: {},
    highRiskCommandApprovals: {}
  });
  assert.equal(prev.stepResults[0]?.status, "preview_gated");
  assert.equal(prev.stepResults[0]?.commandPreview?.needsApproval, true);
  const app = await runAgentTaskExecution(projectRoot, plan, [cmd], createDefaultToolRegistry(), {
    mode: "apply",
    fileMutationApprovals: {},
    highRiskCommandApprovals: {}
  });
  assert.equal(app.stepResults[0]?.status, "blocked_approval");
});

test("D1-12: blocked path surfaces rule, blockedBy, and path in step", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skia-ex-"));
  const cfg = { agent: { blocked_paths: ["forbidden/"] } };
  const plan = { title: "p", steps: [{ id: "s1", title: "w", detail: "" }] };
  const actions: StepAction[] = [
    { stepId: "s1", tool: "write_file", input: { path: "forbidden/x.txt", content: "z" } }
  ];
  const r = await runAgentTaskExecution(projectRoot, plan, actions, createDefaultToolRegistry(), {
    mode: "apply",
    fileMutationApprovals: { s1: true },
    highRiskCommandApprovals: {},
    getSkiarulesConfig: () => cfg as any
  });
  assert.equal(r.stopReason, undefined);
  const st = r.stepResults[0];
  assert.equal(st?.status, "failed");
  assert.equal(st?.blockedBy, "skiarules");
  assert.ok((st?.rule ?? "").includes("blocked_paths"));
  assert.equal(st?.path?.replace(/\\/g, "/"), "forbidden/x.txt");
});

test("governance: too many write ops stops before execution", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skia-gov-"));
  const plan = {
    title: "p",
    steps: Array.from({ length: 11 }, (_, i) => ({ id: `s${i}`, title: "w", detail: "" }))
  };
  const actions: StepAction[] = Array.from({ length: 11 }, (_, i) => ({
    stepId: `s${i}`,
    tool: "write_file" as const,
    input: { path: `a${i}.txt`, content: "x" }
  }));
  const r = await runAgentTaskExecution(
    projectRoot,
    plan,
    actions,
    createDefaultToolRegistry(),
    { mode: "preview", fileMutationApprovals: {}, highRiskCommandApprovals: {} }
  );
  assert.match(r.stopReason ?? "", /file write|write/);
  assert.equal(r.governanceCode, "max_write");
});

test("audit log receives agent.execute events", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "skia-ex-"));
  const before = (await readAuditLog(projectRoot)).length;
  await runAgentTaskExecution(
    projectRoot,
    { title: "p", steps: [{ id: "s1", title: "x", detail: "" }] },
    [{ stepId: "s1", tool: "list_files", input: {} }],
    createDefaultToolRegistry(),
    { mode: "preview", fileMutationApprovals: {}, highRiskCommandApprovals: {} }
  );
  const after = await readAuditLog(projectRoot);
  assert.ok(after.length > before, "audit entries appended");
  const names = after.map((a) => a.action);
  assert.ok(names.includes("agent.execute.start"));
  assert.ok(names.includes("agent.execute.complete"), names.join(","));
});
