import { createDefaultToolRegistry } from "../tools/index.js";
import { forgeAgentExecuteRequestSchema } from "../../../contracts.js";
import { runAgentTaskExecution, type StepAction } from "./agentTaskExecutor.js";
import { runAgentSelfCorrectingExecute } from "./agentSelfCorrection.js";
import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";
import type { SkiarulesConfig } from "../skiarules/skiarulesTypes.js";
import { queryWorkItems, updateWorkItem } from "../work/workItemModel.js";
import { buildWorkDashboard } from "../work/workDashboard.js";
import { appendAutoSessionStep } from "../auto/autoSessionModel.js";

export type AgentExecutorRequestOptions = {
  skia?: SkiaFullAdapter;
  getSkiarulesConfig?: () => SkiarulesConfig | null;
  pickPassthroughHeaders?: (req: unknown) => Record<string, string> | undefined;
  /** D1-11: override for self-correct model prompt. */
  selfCorrectGoalText?: string;
  /** D1-11: request when headers come from a handler (Express). */
  expressReq?: { headers: Record<string, string | string[] | undefined> };
  /** D4-04 internal-only auto session linking. */
  autoSessionId?: string;
};

function defaultPickHeaders(_req: unknown): Record<string, string> | undefined {
  return undefined;
}

/**
 * D1-10: HTTP/handler — validates body, default tool registry, executor + audit.
 * D1-11: optional `selfCorrect: true` + `apply` + `options.skia` → validation + SKIA replan loop.
 */
export async function runAgentExecutorRequest(
  projectRoot: string,
  body: unknown,
  options?: AgentExecutorRequestOptions
): Promise<{ status: number; body: unknown }> {
  const p = forgeAgentExecuteRequestSchema.safeParse(
    body && typeof body === "object" ? body : {}
  );
  if (!p.success) {
    return { status: 400, body: { error: p.error.message } };
  }
  const d = p.data;
  const cfg = options?.getSkiarulesConfig?.() ?? null;
  const governanceSnapshot = await buildWorkDashboard(projectRoot, d.path, cfg);
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "work.governance.check",
    parameters: mergeForgeAuditParamsV1("work_governance", {
      path: d.path,
      planTitle: d.plan.title,
      autoSessionId: options?.autoSessionId ?? null,
      workGovernance: governanceSnapshot.governance,
      orchestrationDashboard: governanceSnapshot.orchestrationDashboard,
      roadmapSummary: {
        phaseCount: governanceSnapshot.roadmap.phases.length,
        suggestedPhaseOrder: governanceSnapshot.roadmap.global.suggestedPhaseOrder
      }
    }),
    result: governanceSnapshot.governance.violations.length ? "failure" : "success"
  });
  const linkedWorkItem = (await queryWorkItems(projectRoot, { limit: 100 }))
    .find((w) => w.title.toLowerCase() === d.plan.title.toLowerCase() || w.relatedFiles.includes(d.path));
  if (d.selfCorrect && d.mode === "apply" && options?.skia) {
    const goalText =
      options.selfCorrectGoalText?.trim() ||
      [d.plan.title, d.plan.goalRestatement].filter(Boolean).join(" — ");
    const passthrough =
      options?.pickPassthroughHeaders?.(options.expressReq) ?? defaultPickHeaders(options.expressReq);
    const { status, body: scBody } = await runAgentSelfCorrectingExecute(
      projectRoot,
      d,
      {
        skia: options.skia,
        goalText,
        getSkiarulesConfig: options.getSkiarulesConfig,
        passthroughHeaders: passthrough,
        autoSessionId: options.autoSessionId
      }
    );
    if (options?.autoSessionId) {
      await appendAutoSessionStep(projectRoot, options.autoSessionId, {
        type: "selfCorrect",
        workItemId: linkedWorkItem?.id,
        planId: d.plan.title,
        executorRunId: `${options.autoSessionId}:${Date.now()}`,
        outcome: status === 200 ? "success" : "failure",
        notes: "executor self-correction run"
      });
    }
    if (linkedWorkItem) {
      await updateWorkItem(projectRoot, linkedWorkItem.id, {
        status: status === 200 ? "done" : "blocked"
      });
    }
    return { status, body: scBody };
  }
  const actions: StepAction[] = d.steps.map((s) => ({
    stepId: s.stepId,
    tool: s.tool,
    input: s.input
  }));
  const registry = createDefaultToolRegistry();
  const out = await runAgentTaskExecution(projectRoot, d.plan, actions, registry, {
    mode: d.mode,
    fileMutationApprovals: d.fileMutationApprovals,
    highRiskCommandApprovals: d.highRiskCommandApprovals,
    getSkiarulesConfig: options?.getSkiarulesConfig
  });
  if (out.stopReason) {
    if (options?.autoSessionId) {
      await appendAutoSessionStep(projectRoot, options.autoSessionId, {
        type: "execute",
        workItemId: linkedWorkItem?.id,
        planId: d.plan.title,
        executorRunId: `${options.autoSessionId}:${Date.now()}`,
        outcome: "failure",
        notes: out.stopReason
      });
    }
    if (linkedWorkItem) {
      await updateWorkItem(projectRoot, linkedWorkItem.id, { status: "blocked" });
    }
    return {
      status: 400,
      body: {
        version: "agent-execute-v1" as const,
        error: "Execution request invalid.",
        path: d.path,
        planTitle: d.plan.title,
        stopReason: out.stopReason,
        ...(out.governanceCode ? { governanceCode: out.governanceCode } : {})
      }
    };
  }
  if (linkedWorkItem) {
    await updateWorkItem(projectRoot, linkedWorkItem.id, {
      status: d.mode === "apply" ? "done" : "in_progress"
    });
  }
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "agent.execute.decomposition",
    parameters: mergeForgeAuditParamsV1("agent_execute", {
      planTitle: d.plan.title,
      path: d.path,
      autoSessionId: options?.autoSessionId ?? null,
      decompositionMeta: {
        stepCount: d.steps.length,
        stepIds: d.steps.map((s) => s.stepId)
      },
      workProgressSnapshot: governanceSnapshot.progress.project,
      roadmapSummary: {
        phaseCount: governanceSnapshot.roadmap.phases.length,
        criticalPathItems: governanceSnapshot.roadmap.global.criticalPathItems
      },
      workGovernance: governanceSnapshot.governance,
      orchestrationDashboard: governanceSnapshot.orchestrationDashboard
    }),
    result: "success"
  });
  if (options?.autoSessionId) {
    await appendAutoSessionStep(projectRoot, options.autoSessionId, {
      type: "execute",
      workItemId: linkedWorkItem?.id,
      planId: d.plan.title,
      executorRunId: `${options.autoSessionId}:${Date.now()}`,
      outcome: "success",
      notes: "executor run complete"
    });
  }
  return {
    status: 200,
    body: {
      version: "agent-execute-v1" as const,
      path: d.path,
      ...out
    }
  };
}
