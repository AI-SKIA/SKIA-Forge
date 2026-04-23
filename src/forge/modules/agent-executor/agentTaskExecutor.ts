import path from "node:path";
import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { evaluateCommandSafety } from "../../../agentSafety.js";
import { recordSdlcEvent } from "../sdlc/sdlcEventModel.js";
import { isToolSuccess } from "../tools/index.js";
import type { ToolRegistry } from "../tools/toolRegistry.js";
import type { ToolContext } from "../tools/types.js";
import type { AgentTaskPlanV1 } from "../agent-planner/agentPlannerRequest.js";
import { computeFileMutationDiffPreview } from "./fileMutationPreview.js";
import { aggregatePreviewDiffStats } from "./diffStats.js";
import { assertActionDependentsCovered, orderActionsForPlan } from "./planOrder.js";
import {
  advanceRunGovernanceUsageV1,
  buildStepGovernanceMetadataV1,
  countActionUsage,
  governanceLimitsV1,
  initialRunGovernanceUsageV1,
  validateExecutorGovernance,
  type GovernanceLimitsV1,
  type RunGovernanceUsageV1,
  type StepGovernanceMetadataV1
} from "../governance/agentGovernance.js";
import {
  collectWriteEditSkiarulesViolations,
  enforceAgentTool,
  type SkiarulesViolationItem,
  type AgentToolEnforcement
} from "../skiarules/agentEnforcer.js";
import { buildRulesContextSummary } from "../skiarules/skiarulesRulesContext.js";
import type { SkiarulesConfig } from "../skiarules/skiarulesTypes.js";

const MUTATION_TOOLS = new Set(["write_file", "edit_file"]);

function ts(): string {
  return new Date().toISOString();
}

function ruleText(get?: () => SkiarulesConfig | null): string | null {
  return buildRulesContextSummary(get?.() ?? null) || null;
}

function relPathFromRollbackHandle(projectRoot: string, handle: unknown): string | undefined {
  if (!handle || typeof handle !== "object") {
    return undefined;
  }
  const o = handle as { relPosix?: string; absPath?: string };
  if (typeof o.relPosix === "string") {
    return o.relPosix;
  }
  if (typeof o.absPath === "string") {
    return path.relative(projectRoot, o.absPath).split(path.sep).join("/");
  }
  return undefined;
}

type RollbackEntry = { stepId: string; tool: string; name: string; handle: unknown };
export type RollbackLineItem = {
  stepId: string;
  tool: string;
  relPath?: string;
  success: boolean;
  error?: string;
};

function finalizeRecord(
  r: StepResultRecord,
  t0: number,
  startedAt: string,
  enf: AgentToolEnforcement,
  contentBlock: boolean,
  governance?: StepGovernanceMetadataV1
): StepResultRecord {
  const endedAt = new Date().toISOString();
  return {
    ...r,
    ...(governance ? { governance } : {}),
    startedAt,
    endedAt,
    durationMs: Date.now() - t0,
    toolSafety: {
      blocked: enf.state === "block" || contentBlock,
      needsApproval: r.status === "blocked_approval",
      autoApproved: enf.state === "auto_approve" && (r.status === "ok" || r.status === "preview_gated")
    },
    ...(enf.state === "auto_approve" && (r.status === "ok" || r.status === "preview_gated")
      ? { autoApproved: true as const }
      : {})
  };
}

export type StepAction = { stepId: string; tool: string; input: unknown };

export type StepResultRecord = {
  stepId: string;
  tool: string;
  status:
    | "ok"
    | "preview_gated"
    | "blocked_approval"
    | "failed"
    | "skipped_dependency";
  data?: unknown;
  error?: string;
  fileMutation?: {
    path: string;
    diff: string;
    before: string | null;
    after: string;
  };
  commandPreview?: {
    command: string;
    needsApproval: boolean;
    reason: string;
  };
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  toolSafety?: { blocked: boolean; needsApproval: boolean; autoApproved: boolean };
  /** When blocked by .skiarules (path or command) or content/boundary. */
  rule?: string;
  blockedBy?: "skiarules";
  path?: string;
  autoApproved?: boolean;
  skiarulesViolations?: SkiarulesViolationItem[];
  governance?: StepGovernanceMetadataV1;
};

export type RollbackSummary = {
  rolledBackSteps: RollbackLineItem[];
  filesRestored: string[];
  success: "full" | "partial" | "none";
  errors?: string[];
};

export type AgentTaskExecutionResult = {
  mode: "preview" | "apply";
  planTitle: string;
  stepResults: StepResultRecord[];
  stopReason?: string;
  governanceCode?: string;
  /** True if a mutation in this run was rolled back (after a later failure). */
  appliedRollback: boolean;
  rollbackSummary?: RollbackSummary;
  diffSummary?: {
    filesTouched: number;
    hunkCount: number;
    linesAdded: number;
    linesRemoved: number;
  };
};

/**
 * D1-10: step the v1 plan through the tool registry with gating and audit to `.skia/agent-log.json`.
 * Does not modify the planner (D1-08) or tool behavior beyond registry wiring.
 */
export async function runAgentTaskExecution(
  projectRoot: string,
  plan: AgentTaskPlanV1,
  actions: StepAction[],
  registry: ToolRegistry,
  options: {
    mode: "preview" | "apply";
    fileMutationApprovals: Record<string, true>;
    highRiskCommandApprovals: Record<string, true>;
    /** D1-12: when set, enforces .skiarules agent rules before each tool. */
    getSkiarulesConfig?: () => SkiarulesConfig | null;
    /** D1-15: executor caps (defaults to DEFAULT_AGENT_GOVERNANCE). */
    governanceLimits?: GovernanceLimitsV1;
  }
): Promise<AgentTaskExecutionResult> {
  const mode = options.mode;
  const limits = options.governanceLimits ?? governanceLimitsV1();
  const emitAgentRun = (status: "success" | "failure", details?: string) =>
    recordSdlcEvent({
      projectRoot,
      type: "agent_run",
      status,
      details,
      meta: {
        mode,
        planTitle: plan.title
      }
    });
  const seen = new Set<string>();
  for (const a of actions) {
    if (seen.has(a.stepId)) {
      await emitAgentRun("failure", "Duplicate stepId in actions list.");
      return {
        mode,
        planTitle: plan.title,
        stepResults: [],
        stopReason: "Duplicate stepId in actions list.",
        appliedRollback: false
      };
    }
    seen.add(a.stepId);
  }
  const actionSet = new Set(actions.map((a) => a.stepId));
  const byStep = new Map(
    plan.steps.map((s) => [s.id, s] as [string, (typeof plan.steps)[0]])
  );
  for (const a of actions) {
    if (!byStep.has(a.stepId)) {
      await emitAgentRun("failure", `Step id not in plan: ${a.stepId}.`);
      return {
        mode,
        planTitle: plan.title,
        stepResults: [],
        stopReason: `Step id not in plan: ${a.stepId}.`,
        appliedRollback: false
      };
    }
  }

  const depCheck = assertActionDependentsCovered(plan, actionSet);
  if (!depCheck.ok) {
    await emitAgentRun("failure", depCheck.error);
    return {
      mode,
      planTitle: plan.title,
      stepResults: [],
      stopReason: depCheck.error,
      appliedRollback: false
    };
  }

  const order = orderActionsForPlan(
    plan,
    actions.map((a) => a.stepId)
  );
  if (!order.ok) {
    await emitAgentRun("failure", order.error);
    return {
      mode,
      planTitle: plan.title,
      stepResults: [],
      stopReason: order.error,
      appliedRollback: false
    };
  }
  const ordered = order.orderedIds;
  const actionById = new Map(
    actions.map((a) => [a.stepId, a] as [string, StepAction])
  );

  const Gov = validateExecutorGovernance(plan, actions, limits);
  if (!Gov.ok) {
    await emitAgentRun("failure", Gov.reason);
    return {
      mode,
      planTitle: plan.title,
      stepResults: [],
      stopReason: Gov.reason,
      governanceCode: Gov.code,
      appliedRollback: false
    };
  }

  const stepResults: StepResultRecord[] = [];
  const satisfied = new Set<string>();
  const rollbackStack: RollbackEntry[] = [];
  let appliedRollback = false;
  const allRollbackItems: RollbackLineItem[] = [];
  const ctx: ToolContext = { projectRoot };
  const getCfg = options.getSkiarulesConfig;
  let runUsage: RunGovernanceUsageV1 = initialRunGovernanceUsageV1();

  await appendAuditLog(projectRoot, {
    timestamp: ts(),
    action: "agent.execute.start",
    parameters: mergeForgeAuditParamsV1("agent_execute", {
      mode,
      planTitle: plan.title,
      rulesContext: ruleText(getCfg),
      vectorSearchMeta: null,
      lspSkiarules: null,
      diagnostics: null,
      contextRetrievalMeta: null,
      retrievalWarnings: null,
      governance: { limits, plan: { planStepCount: plan.steps.length, actionCount: actions.length }, policy: "pre_run" }
    }),
    result: "success"
  });

  const recordStep = (
    r0: StepResultRecord,
    t0: number,
    startedAt: string,
    enf: AgentToolEnforcement,
    contentBlock: boolean
  ): StepResultRecord => {
    runUsage = advanceRunGovernanceUsageV1(runUsage, r0.tool);
    const gov = buildStepGovernanceMetadataV1(plan, actions, runUsage, limits);
    return finalizeRecord(r0, t0, startedAt, enf, contentBlock, gov);
  };

  const auditV1 = (action: string, spec: Record<string, unknown>, result: "success" | "failure", details?: string) =>
    appendAuditLog(projectRoot, {
      timestamp: ts(),
      action,
      parameters: mergeForgeAuditParamsV1("agent_execute", { ...spec, rulesContext: ruleText(getCfg) }),
      result,
      details
    });

  for (const stepId of ordered) {
    const meta = byStep.get(stepId);
    if (!meta) {
      continue;
    }
    const t0 = Date.now();
    const startedAt = new Date().toISOString();
    const deps = meta.dependsOn ?? [];
    const unmet = deps.find((d) => !satisfied.has(d));
    if (unmet !== undefined) {
      const r0: StepResultRecord = {
        stepId,
        tool: actionById.get(stepId)?.tool ?? "?",
        status: "skipped_dependency",
        error: `Unmet dependency: ${unmet}.`
      };
      const r = recordStep(r0, t0, startedAt, { state: "allow" } as AgentToolEnforcement, false);
      stepResults.push(r);
      await auditV1(
        "agent.execute.step",
        { stepId, tool: r.tool, mode, stepStatus: "skipped_dependency", governance: r.governance },
        "failure",
        r.error
      );
      continue;
    }

    const a = actionById.get(stepId);
    if (!a) {
      const r0: StepResultRecord = {
        stepId,
        tool: "?",
        status: "failed",
        error: "Action missing (internal error)."
      };
      const r = recordStep(r0, t0, startedAt, { state: "allow" } as AgentToolEnforcement, false);
      stepResults.push(r);
      await auditV1(
        "agent.execute.step",
        { stepId, mode, stepStatus: "failed", governance: r.governance },
        "failure",
        r.error
      );
      break;
    }
    const tool = registry.get(a.tool);
    if (!tool) {
      const r0: StepResultRecord = { stepId, tool: a.tool, status: "failed", error: `Unknown tool: ${a.tool}.` };
      const r = recordStep(r0, t0, startedAt, { state: "allow" } as AgentToolEnforcement, false);
      stepResults.push(r);
      await auditV1(
        "agent.execute.step",
        { stepId, tool: a.tool, mode, stepStatus: "failed", governance: r.governance },
        "failure",
        r.error
      );
      break;
    }
    const val = tool.validate(a.input);
    if (!val.ok) {
      const r0: StepResultRecord = { stepId, tool: a.tool, status: "failed", error: val.error };
      const r = recordStep(r0, t0, startedAt, { state: "allow" } as AgentToolEnforcement, false);
      stepResults.push(r);
      await auditV1(
        "agent.execute.step",
        { stepId, tool: a.tool, mode, stepStatus: "failed", governance: r.governance },
        "failure",
        val.error
      );
      break;
    }
    const input = val.data;
    const skiarules = getCfg?.() ?? null;
    const enf: AgentToolEnforcement = enforceAgentTool(projectRoot, skiarules, a.tool, a.input);
    if (enf.state === "block") {
      const r0: StepResultRecord = {
        stepId,
        tool: a.tool,
        status: "failed",
        error: enf.message,
        rule: enf.rule,
        blockedBy: enf.blockedBy,
        path: enf.path,
        skiarulesViolations: enf.skiarulesViolations
      };
      const r = recordStep(r0, t0, startedAt, enf, false);
      stepResults.push(r);
      await auditV1(
        "agent.enforce.blocked",
        { stepId, tool: a.tool, mode, rule: enf.rule, path: enf.path, governance: r.governance },
        "failure",
        enf.message
      );
      break;
    }
    if (enf.state === "auto_approve") {
      await auditV1("agent.enforce.autoApprove", { stepId, tool: a.tool, mode, governance: null }, "success");
    }
    const skipGates = enf.state === "auto_approve";

    if (MUTATION_TOOLS.has(a.tool) && (a.tool === "write_file" || a.tool === "edit_file")) {
      const viol = await collectWriteEditSkiarulesViolations(
        projectRoot,
        skiarules,
        a.tool,
        a.input
      );
      if (viol.length) {
        const r0: StepResultRecord = {
          stepId,
          tool: a.tool,
          status: "failed",
          error: "Write/edit blocked by .skiarules (naming, architecture, or anti-patterns on resulting content).",
          rule: "skiarules.content",
          blockedBy: "skiarules",
          path: (input as { path?: string })?.path,
          skiarulesViolations: viol
        };
        const r = recordStep(r0, t0, startedAt, { state: "allow" } as AgentToolEnforcement, true);
        stepResults.push(r);
        await auditV1(
        "agent.enforce.content",
        { stepId, tool: a.tool, mode, count: viol.length, governance: r.governance },
          "failure"
        );
        break;
      }
    }

    // ——— File mutations (diff gating) ———
    if (MUTATION_TOOLS.has(a.tool)) {
      if (mode === "preview") {
        const p = await computeFileMutationDiffPreview(projectRoot, a.tool, a.input);
        if (!p.ok) {
          const r0: StepResultRecord = { stepId, tool: a.tool, status: "failed", error: p.error };
          const r = recordStep(r0, t0, startedAt, enf, false);
          stepResults.push(r);
          await auditV1(
            "agent.execute.step",
            { stepId, tool: a.tool, mode, stepStatus: "failed", governance: r.governance },
            "failure",
            p.error
          );
          break;
        }
        const r0: StepResultRecord = {
          stepId,
          tool: a.tool,
          status: "preview_gated",
          fileMutation: { path: p.path, diff: p.diff, before: p.before, after: p.after }
        };
        const r = recordStep(r0, t0, startedAt, enf, false);
        stepResults.push(r);
        satisfied.add(stepId);
        await auditV1(
          "agent.execute.step",
          { stepId, tool: a.tool, mode, stepStatus: "preview_gated", path: p.path, governance: r.governance },
          "success",
          p.diff
        );
        continue;
      }
      {
        const p = await computeFileMutationDiffPreview(projectRoot, a.tool, a.input);
        if (!p.ok) {
          const r0: StepResultRecord = { stepId, tool: a.tool, status: "failed", error: p.error };
          const r = recordStep(r0, t0, startedAt, enf, false);
          stepResults.push(r);
          const rb = await rollbackAll(ctx, registry, rollbackStack, projectRoot);
          allRollbackItems.push(...rb.items);
          appliedRollback ||= rb.any;
          await auditV1(
            "agent.execute.step",
            { stepId, tool: a.tool, mode, stepStatus: "failed", governance: r.governance },
            "failure",
            p.error
          );
          break;
        }
        if (!options.fileMutationApprovals[stepId] && !skipGates) {
          const r0: StepResultRecord = {
            stepId,
            tool: a.tool,
            status: "blocked_approval",
            fileMutation: { path: p.path, diff: p.diff, before: p.before, after: p.after }
          };
          const r = recordStep(r0, t0, startedAt, enf, false);
          stepResults.push(r);
          await auditV1(
            "agent.execute.step",
            { stepId, tool: a.tool, mode, stepStatus: "blocked_approval", governance: r.governance },
            "success",
            p.diff
          );
          await auditV1(
            "agent.enforce.needsApproval",
            { stepId, tool: a.tool, kind: "file_mutation", governance: r.governance },
            "success"
          );
          continue;
        }
        const ex = await tool.execute(ctx, a.input);
        if (!isToolSuccess(ex)) {
          const r0: StepResultRecord = { stepId, tool: a.tool, status: "failed", error: ex.error };
          const r = recordStep(r0, t0, startedAt, enf, false);
          stepResults.push(r);
          const rb = await rollbackAll(ctx, registry, rollbackStack, projectRoot);
          allRollbackItems.push(...rb.items);
          appliedRollback ||= rb.any;
          await auditV1(
            "agent.execute.step",
            { stepId, tool: a.tool, mode, stepStatus: "failed", governance: r.governance },
            "failure",
            ex.error
          );
          break;
        }
        if (ex.rollbackHandle !== undefined) {
          rollbackStack.push({ stepId, tool: a.tool, name: a.tool, handle: ex.rollbackHandle });
        }
        const r0: StepResultRecord = { stepId, tool: a.tool, status: "ok", data: ex.data };
        const r = recordStep(r0, t0, startedAt, enf, false);
        stepResults.push(r);
        satisfied.add(stepId);
        await auditV1(
          "agent.execute.step",
          { stepId, tool: a.tool, mode, data: ex.data, stepStatus: "ok", governance: r.governance },
          "success"
        );
        continue;
      }
    }

    // ——— run_terminal ———
    if (a.tool === "run_terminal") {
      const cmd = (input as { command?: string })?.command ?? "";
      const safety = evaluateCommandSafety(cmd);
      const highRisk = !safety.allowed && safety.approvalRequired;
      if (mode === "preview") {
        const r0: StepResultRecord = {
          stepId,
          tool: a.tool,
          status: "preview_gated",
          commandPreview: { command: cmd, needsApproval: highRisk, reason: safety.reason }
        };
        const r = recordStep(r0, t0, startedAt, enf, false);
        stepResults.push(r);
        satisfied.add(stepId);
        await auditV1(
          "agent.execute.step",
          { stepId, tool: a.tool, mode, stepStatus: "preview_gated", command: cmd, highRisk, governance: r.governance },
          "success"
        );
        continue;
      }
      if (highRisk && !options.highRiskCommandApprovals[stepId] && !skipGates) {
        const r0: StepResultRecord = {
          stepId,
          tool: a.tool,
          status: "blocked_approval",
          commandPreview: { command: cmd, needsApproval: true, reason: safety.reason }
        };
        const r = recordStep(r0, t0, startedAt, enf, false);
        stepResults.push(r);
        await auditV1(
          "agent.execute.step",
          { stepId, tool: a.tool, mode, stepStatus: "blocked_approval", command: cmd, governance: r.governance },
          "success"
        );
        await auditV1(
          "agent.enforce.needsApproval",
          { stepId, tool: a.tool, kind: "high_risk_command", governance: r.governance },
          "success"
        );
        continue;
      }
      const toRun =
        (highRisk && (options.highRiskCommandApprovals[stepId] || skipGates))
          ? { ...(input as object), approved: true as const }
          : input;
      const ex = await tool.execute(ctx, toRun);
      if (!isToolSuccess(ex)) {
        const r0: StepResultRecord = { stepId, tool: a.tool, status: "failed", error: ex.error };
        const r = recordStep(r0, t0, startedAt, enf, false);
        stepResults.push(r);
        const rb = await rollbackAll(ctx, registry, rollbackStack, projectRoot);
        allRollbackItems.push(...rb.items);
        appliedRollback ||= rb.any;
        await auditV1(
          "agent.execute.step",
          { stepId, tool: a.tool, mode, stepStatus: "failed", governance: r.governance },
          "failure",
          ex.error
        );
        break;
      }
      const r0: StepResultRecord = { stepId, tool: a.tool, status: "ok", data: ex.data };
      const r = recordStep(r0, t0, startedAt, enf, false);
      stepResults.push(r);
      satisfied.add(stepId);
      await auditV1(
        "agent.execute.step",
        { stepId, tool: a.tool, mode, data: ex.data, stepStatus: "ok", governance: r.governance },
        "success"
      );
      continue;
    }

    // ——— other tools: execute (preview: read/search/git/list; apply: same) ———
    const exo = await tool.execute(ctx, a.input);
    if (!isToolSuccess(exo)) {
      const r0: StepResultRecord = { stepId, tool: a.tool, status: "failed", error: exo.error };
      const r = recordStep(r0, t0, startedAt, enf, false);
      stepResults.push(r);
      if (mode === "apply") {
        const rb = await rollbackAll(ctx, registry, rollbackStack, projectRoot);
        allRollbackItems.push(...rb.items);
        appliedRollback ||= rb.any;
      }
      await auditV1(
        "agent.execute.step",
        { stepId, tool: a.tool, mode, stepStatus: "failed", governance: r.governance },
        "failure",
        exo.error
      );
      break;
    }
    const r0: StepResultRecord = { stepId, tool: a.tool, status: "ok", data: exo.data };
    const r = recordStep(r0, t0, startedAt, enf, false);
    stepResults.push(r);
    satisfied.add(stepId);
    await auditV1(
      "agent.execute.step",
      { stepId, tool: a.tool, mode, data: exo.data, stepStatus: "ok", governance: r.governance },
      "success"
    );
  }

  const planned = countActionUsage(actions);
  await auditV1(
    "agent.execute.complete",
    {
      mode,
      stopReason: null,
      governance: {
        limits,
        runSummary: runUsage,
        planned,
        planSteps: plan.steps.length,
        actionCount: actions.length,
        completedStepResults: stepResults.length
      }
    },
    "success"
  );

  const previewDiffs = stepResults
    .filter((s) => s.status === "preview_gated" && s.fileMutation?.diff)
    .map((s) => s.fileMutation!.diff);
  const diffSummary = mode === "preview" && previewDiffs.length ? aggregatePreviewDiffStats(previewDiffs) : undefined;

  const filesRestored = [
    ...new Set(allRollbackItems.filter((x) => x.success).map((x) => x.relPath).filter(Boolean) as string[])
  ];
  const badItems = allRollbackItems.filter((x) => !x.success);
  const rollbackSummary: RollbackSummary | undefined = allRollbackItems.length
    ? {
        rolledBackSteps: allRollbackItems,
        filesRestored,
        success: badItems.length ? "partial" : "full",
        errors: badItems.length ? badItems.map((b) => b.error ?? "rollback error") : undefined
      }
    : undefined;

  const runFailed = stepResults.some((s) => s.status === "failed" || s.status === "skipped_dependency");
  await emitAgentRun(runFailed ? "failure" : "success", runFailed ? "One or more steps failed." : undefined);

  return {
    mode,
    planTitle: plan.title,
    stepResults,
    appliedRollback,
    ...(typeof diffSummary !== "undefined" ? { diffSummary } : {}),
    ...(rollbackSummary ? { rollbackSummary } : {})
  };
}

async function rollbackAll(
  ctx: ToolContext,
  registry: ToolRegistry,
  stack: RollbackEntry[],
  projectRoot: string
): Promise<{ any: boolean; items: RollbackLineItem[] }> {
  const items: RollbackLineItem[] = [];
  let any = false;
  while (stack.length) {
    const e = stack.pop()!;
    any = true;
    const t = registry.get(e.name);
    if (!t) {
      items.push({ stepId: e.stepId, tool: e.tool, success: false, error: "Tool missing" });
      continue;
    }
    const ex = await t.rollback(ctx, e.handle);
    const relPath = relPathFromRollbackHandle(projectRoot, e.handle);
    if (!isToolSuccess(ex)) {
      items.push({
        stepId: e.stepId,
        tool: e.tool,
        relPath,
        success: false,
        error: (ex as { error?: string }).error ?? "rollback failed"
      });
    } else {
      items.push({ stepId: e.stepId, tool: e.tool, relPath, success: true });
    }
  }
  return { any, items };
}