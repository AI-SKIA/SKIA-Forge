import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { runAgentPlannerRequest, type AgentPlannerRequestBody } from "../agent-planner/agentPlannerRequest.js";
import { runAgentExecutorRequest } from "../agent-executor/agentExecutorRequest.js";
import type { ContextRetrievalStructureSource, ForgeContextSkiarulesContext } from "../context-engine/contextRetrievalRequest.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";
import { buildWorkDashboard } from "../work/workDashboard.js";
import { buildSdlcInsightsBundle } from "../sdlc/sdlcInsights.js";
import { queryWorkItems, updateWorkItem } from "../work/workItemModel.js";
import { selectNextWorkItems, mapSelectionToItems } from "./autoTaskSelector.js";
import {
  appendAutoSessionStep,
  createAutoSession,
  getAutoSession,
  updateAutoSessionStatus,
  type AutoExecutionPlanVersionV1
} from "./autoSessionModel.js";
import { analyzeAutoFailure } from "./autoFailureRecovery.js";
import { adaptAutoStrategy } from "./autoAdaptation.js";
import { queryAutoMemory, recordAutoMemory } from "./autoMemory.js";
import { evaluateAutoStability } from "./autoStability.js";
import { evaluateAutoSafety } from "./autoSafety.js";
import type { AutoLongHorizonPlanV1 } from "./autoLongHorizonPlanner.js";

export type AutoExecutionResultV1 = {
  sessionId: string | null;
  status: "completed" | "aborted" | "paused";
  processedItems: string[];
  reason?: string;
};

function choosePlanVersionFromPlannerBody(b: Record<string, unknown>): AutoExecutionPlanVersionV1 {
  if (b.workPlanV4) return "v4";
  if (b.workPlanV3) return "v3";
  if (b.workPlanV2) return "v2";
  return "v1";
}

export async function runAutoExecutionSession(
  projectRoot: string,
  options: {
    skia: SkiaFullAdapter;
    env: NodeJS.ProcessEnv;
    structure: ContextRetrievalStructureSource;
    skiarulesContext?: ForgeContextSkiarulesContext;
    passthroughHeaders?: Record<string, string>;
    maxSessionSteps?: number;
    maxRetriesPerItem?: number;
    maxConcurrentItems?: number;
    resumeSessionId?: string;
    selectionOptions?: {
      maxItems?: number;
      allowedTypes?: Array<"feature" | "bug" | "refactor" | "test" | "infra" | "research">;
      riskThreshold?: number;
      includeBlocked?: boolean;
      longHorizonPlan?: AutoLongHorizonPlanV1 | null;
    };
  }
): Promise<AutoExecutionResultV1> {
  const maxSteps = Math.max(1, Math.min(200, options.maxSessionSteps ?? 20));
  let strategy = {
    plannerPreference: "v4" as "v4" | "v3" | "v2",
    selectionWeights: { risk: 0.45, drift: 0.25, forecast: 0.2, stability: 0.1 },
    correctionBudget: Math.max(1, options.maxRetriesPerItem ?? 3),
    driftMitigationMode: "normal" as "normal" | "strict",
    stabilityMode: "normal" as "normal" | "stabilize_first"
  };
  const allItems = await queryWorkItems(projectRoot, { limit: 500 });
  const resumed = options.resumeSessionId ? await getAutoSession(projectRoot, options.resumeSessionId) : null;
  const selection = resumed
    ? { selected: resumed.workItemIds.map((id) => ({ workItemId: id, score: 0, rationale: ["resumed"], governanceJustification: [], slaJustification: [], riskJustification: [] })), generatedAt: new Date().toISOString() }
    : await selectNextWorkItems(projectRoot, {
        maxItems: options.selectionOptions?.maxItems ?? 3,
        allowedTypes: options.selectionOptions?.allowedTypes,
        riskThreshold: options.selectionOptions?.riskThreshold,
        includeBlocked: options.selectionOptions?.includeBlocked,
        longHorizonPlan: options.selectionOptions?.longHorizonPlan
      });
  if (selection.selected.length === 0) {
    return { sessionId: null, status: "completed", processedItems: [], reason: "No eligible work items." };
  }
  const selectedItems = mapSelectionToItems(allItems, selection);
  const dashboard = await buildWorkDashboard(projectRoot);
  const session =
    resumed ??
    (await createAutoSession(projectRoot, selectedItems.map((w) => w.id), {
      planVersionUsed: "v1",
      governanceSnapshot: dashboard.governance,
      sdlcSnapshot: dashboard.sdlcSummary,
      orchestrationSnapshot: dashboard.orchestrationDashboard
    }));
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: resumed ? "auto.session.resume" : "auto.session.start",
    parameters: mergeForgeAuditParamsV1("auto_orchestrator", {
      sessionId: session.id,
      selectedWorkItems: selectedItems.map((w) => w.id),
      selection
    }),
    result: "success"
  });
  const processedItems: string[] = [];
  let stepCount = 0;
  for (const item of selectedItems) {
    const liveSession = await getAutoSession(projectRoot, session.id);
    const memory = await queryAutoMemory(projectRoot, { sessionId: session.id, limit: 300 });
    const sdlcLive = await buildSdlcInsightsBundle(projectRoot, item.relatedFiles[0]);
    const dashboardLive = await buildWorkDashboard(projectRoot, item.relatedFiles[0]);
    const preCycleAdaptation = {
      updatedStrategy: strategy,
      notes: [`plannerPreference=${strategy.plannerPreference}`]
    };
    const stability = evaluateAutoStability(liveSession ?? session, preCycleAdaptation, memory, sdlcLive);
    await appendAutoSessionStep(projectRoot, session.id, {
      type: "stabilityCheck",
      workItemId: item.id,
      outcome: stability.stabilityStatus === "critical" ? "failure" : "success",
      notes: `${stability.stabilityStatus}/${stability.recommendedAction} ${stability.notes.join("; ")}`
    });
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action: "auto.stability",
      parameters: mergeForgeAuditParamsV1("auto_orchestrator", {
        sessionId: session.id,
        workItemId: item.id,
        stability
      }),
      result: stability.stabilityStatus === "critical" ? "failure" : "success"
    });
    const safety = evaluateAutoSafety(liveSession ?? session, stability, dashboardLive.governance, dashboardLive.slaDrift);
    await appendAutoSessionStep(projectRoot, session.id, {
      type: "governanceCheck",
      workItemId: item.id,
      outcome: safety.safetyStatus === "safe" || safety.safetyStatus === "warning" ? "success" : "failure",
      notes: `${safety.safetyStatus}/${safety.recommendedAction} ${safety.notes.join("; ")}`
    });
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action: "auto.safety",
      parameters: mergeForgeAuditParamsV1("auto_orchestrator", {
        sessionId: session.id,
        workItemId: item.id,
        safety
      }),
      result: safety.safetyStatus === "unsafe" || safety.safetyStatus === "critical" ? "failure" : "success"
    });
    if (safety.recommendedAction === "halt" || safety.recommendedAction === "require_human_review") {
      await updateAutoSessionStatus(projectRoot, session.id, "aborted", `safety=${safety.recommendedAction}`);
      return {
        sessionId: session.id,
        status: "aborted",
        processedItems,
        reason: `safety requires ${safety.recommendedAction}`
      };
    }
    if (stability.recommendedAction === "halt" || stability.recommendedAction === "require_human_review") {
      await updateAutoSessionStatus(projectRoot, session.id, "aborted", `stability=${stability.recommendedAction}`);
      return {
        sessionId: session.id,
        status: "aborted",
        processedItems,
        reason: `stability requires ${stability.recommendedAction}`
      };
    }
    if (stepCount >= maxSteps) {
      await updateAutoSessionStatus(projectRoot, session.id, "paused", "maxSessionSteps reached");
      return { sessionId: session.id, status: "paused", processedItems, reason: "maxSessionSteps reached" };
    }
    const plannerBody: AgentPlannerRequestBody = {
      goal: item.title,
      path: item.relatedFiles[0] ?? "src/server.ts",
      resilientRetrieval: true
    };
    const planned = await runAgentPlannerRequest(
      projectRoot,
      plannerBody,
      options.skia,
      options.env,
      options.structure,
      options.passthroughHeaders,
      options.skiarulesContext,
      {
        autoMode: true,
        autoSessionId: session.id,
        autoSelection: {
          selection,
          strategy,
          plannerPreference: strategy.plannerPreference
        }
      }
    );
    stepCount += 1;
    if (planned.status !== 200) {
      await appendAutoSessionStep(projectRoot, session.id, {
        type: "plan",
        workItemId: item.id,
        outcome: "failure",
        notes: `planner status=${planned.status}`
      });
      await updateWorkItem(projectRoot, item.id, { status: "blocked" });
      await recordAutoMemory(projectRoot, {
        sessionId: session.id,
        workItemId: item.id,
        category: "planner_pattern",
        outcome: "failure",
        details: `planner status ${planned.status}`,
        meta: { stepCount }
      });
      continue;
    }
    const pb = planned.body as Record<string, unknown>;
    const plan = pb.plan as { title?: string; steps?: Array<{ id: string; title: string }> } | null;
    if (!plan || !Array.isArray(plan.steps)) {
      await appendAutoSessionStep(projectRoot, session.id, {
        type: "plan",
        workItemId: item.id,
        outcome: "failure",
        notes: "planner returned no v1 plan steps"
      });
      continue;
    }
    await recordAutoMemory(projectRoot, {
      sessionId: session.id,
      workItemId: item.id,
      category: "planner_pattern",
      outcome: "success",
      details: `plan produced using ${choosePlanVersionFromPlannerBody(pb)}`
    });
    await appendAutoSessionStep(projectRoot, session.id, {
      type: "plan",
      workItemId: item.id,
      planId: plan.title ?? item.title,
      outcome: "success",
      notes: `planVersion=${choosePlanVersionFromPlannerBody(pb)}`
    });
    const executeBody = {
      path: item.relatedFiles[0] ?? plannerBody.path,
      mode: "apply" as const,
      selfCorrect: true,
      plan: {
        version: "1" as const,
        title: plan.title ?? item.title,
        goalRestatement: item.description,
        steps: plan.steps.map((s) => ({ id: s.id, title: s.title, detail: "" }))
      },
      steps: plan.steps.map((s) => ({
        stepId: s.id,
        tool: "search_codebase",
        input: { query: s.title, path: item.relatedFiles[0] ?? plannerBody.path }
      })),
      fileMutationApprovals: {},
      highRiskCommandApprovals: {}
    };
    const ex = await runAgentExecutorRequest(projectRoot, executeBody, {
      skia: options.skia,
      getSkiarulesConfig: options.skiarulesContext?.getSkiarulesConfig,
      autoSessionId: session.id
    });
    stepCount += 1;
    const ok = ex.status === 200;
    await appendAutoSessionStep(projectRoot, session.id, {
      type: "execute",
      workItemId: item.id,
      planId: plan.title ?? item.title,
      executorRunId: `${session.id}:${item.id}:${stepCount}`,
      outcome: ok ? "success" : "failure",
      notes: `executor status=${ex.status}`
    });
    await updateWorkItem(projectRoot, item.id, { status: ok ? "done" : "blocked" });
    await recordAutoMemory(projectRoot, {
      sessionId: session.id,
      workItemId: item.id,
      category: "executor_pattern",
      outcome: ok ? "success" : "failure",
      details: `executor status ${ex.status}`
    });
    const exBody = (ex.body ?? {}) as Record<string, unknown>;
    const sc = exBody.selfCorrectSummary as { attemptCount?: number; failedValidationCommands?: unknown[] } | undefined;
    await recordAutoMemory(projectRoot, {
      sessionId: session.id,
      workItemId: item.id,
      category: "self_correct_pattern",
      outcome: sc && (sc.attemptCount ?? 0) > 1 ? "failure" : "success",
      details: sc
        ? `self-correct attempts=${sc.attemptCount ?? 0} failedCommands=${Array.isArray(sc.failedValidationCommands) ? sc.failedValidationCommands.length : 0}`
        : "self-correct metadata unavailable"
    });
    await recordAutoMemory(projectRoot, {
      sessionId: session.id,
      workItemId: item.id,
      category: "workitem_history",
      outcome: ok ? "success" : "failure",
      details: `auto cycle completed for work item`
    });
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action: "auto.session.step",
      parameters: mergeForgeAuditParamsV1("auto_orchestrator", {
        sessionId: session.id,
        workItemId: item.id,
        stepCount,
        plannerStatus: planned.status,
        executorStatus: ex.status
      }),
      result: ok ? "success" : "failure"
    });
    processedItems.push(item.id);
    const currentSession = await getAutoSession(projectRoot, session.id);
    const currentSdlc = await buildSdlcInsightsBundle(projectRoot, item.relatedFiles[0]);
    const currentMemory = await queryAutoMemory(projectRoot, { sessionId: session.id, limit: 500 });
    const last = currentSession?.steps[currentSession.steps.length - 1] ?? null;
    const recovery = analyzeAutoFailure(currentSession ?? session, last, currentSdlc, currentMemory);
    await appendAutoSessionStep(projectRoot, session.id, {
      type: "failureRecovery",
      workItemId: item.id,
      outcome: recovery.severity === "high" || recovery.severity === "critical" ? "failure" : "success",
      notes: `${recovery.failureCategory}/${recovery.severity} ${recovery.recommendedRecoveryActions.join(", ")}`
    });
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action: "auto.failureRecovery",
      parameters: mergeForgeAuditParamsV1("auto_orchestrator", {
        sessionId: session.id,
        workItemId: item.id,
        recovery
      }),
      result: recovery.severity === "high" || recovery.severity === "critical" ? "failure" : "success"
    });
    await recordAutoMemory(projectRoot, {
      sessionId: session.id,
      workItemId: item.id,
      category:
        recovery.failureCategory === "planner"
          ? "planner_pattern"
          : recovery.failureCategory === "executor"
            ? "executor_pattern"
            : recovery.failureCategory === "selfCorrect"
              ? "self_correct_pattern"
              : recovery.failureCategory === "sdlc"
                ? "drift_risk_pattern"
                : "sla_pattern",
      outcome: recovery.severity === "low" || recovery.severity === "medium" ? "success" : "failure",
      details: recovery.notes.join("; "),
      meta: { recommendedRecoveryActions: recovery.recommendedRecoveryActions }
    });
    const adaptation = adaptAutoStrategy(currentSession ?? session, recovery, currentSdlc, currentMemory);
    strategy = adaptation.updatedStrategy;
    await appendAutoSessionStep(projectRoot, session.id, {
      type: "adaptation",
      workItemId: item.id,
      outcome: "success",
      notes: adaptation.notes.join("; ")
    });
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action: "auto.adaptation",
      parameters: mergeForgeAuditParamsV1("auto_orchestrator", {
        sessionId: session.id,
        workItemId: item.id,
        adaptation
      }),
      result: "success"
    });
    if (
      dashboard.slaDrift.severity === "critical" ||
      dashboard.governance.violations.length > 0
    ) {
      await appendAutoSessionStep(projectRoot, session.id, {
        type: "slaCheck",
        outcome: "failure",
        notes: "governance/SLA requires halt"
      });
      await recordAutoMemory(projectRoot, {
        sessionId: session.id,
        workItemId: item.id,
        category: "sla_pattern",
        outcome: "failure",
        details: "governance/SLA requires halt"
      });
      await updateAutoSessionStatus(projectRoot, session.id, "aborted", "governance/SLA requires halt");
      await appendAuditLog(projectRoot, {
        timestamp: new Date().toISOString(),
        action: "auto.session.complete",
        parameters: mergeForgeAuditParamsV1("auto_orchestrator", {
          sessionId: session.id,
          processedItems,
          reason: "governance/SLA requires halt"
        }),
        result: "failure"
      });
      return { sessionId: session.id, status: "aborted", processedItems, reason: "governance/SLA requires halt" };
    }
  }
  await updateAutoSessionStatus(projectRoot, session.id, "completed", "auto execution finished");
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "auto.session.complete",
    parameters: mergeForgeAuditParamsV1("auto_orchestrator", {
      sessionId: session.id,
      processedItems
    }),
    result: "success"
  });
  return { sessionId: session.id, status: "completed", processedItems };
}
