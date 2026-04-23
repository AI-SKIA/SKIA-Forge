import { z } from "zod";
import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";
import {
  agentTaskPlanV1Schema,
  extractJsonObjectString,
  extractTextFromSkiaChatResponse
} from "../agent-planner/agentPlannerRequest.js";
import { runPackageValidation, validationFailureSummary, type PackageValidationResult } from "./packageValidation.js";
import type { AgentTaskExecutionResult, StepAction } from "./agentTaskExecutor.js";
import { createDefaultToolRegistry } from "../tools/index.js";
import { runAgentTaskExecution } from "./agentTaskExecutor.js";
import type { AgentTaskPlanV1 } from "../agent-planner/agentPlannerRequest.js";
import { forgeAgentExecuteRequestSchema } from "../../../contracts.js";
import type { SkiarulesConfig } from "../skiarules/skiarulesTypes.js";
import {
  DEFAULT_AGENT_GOVERNANCE,
  governanceLimitsV1,
  validateExecutorGovernance
} from "../governance/agentGovernance.js";
import { buildRulesContextSummary } from "../skiarules/skiarulesRulesContext.js";
import { recordSdlcEvent } from "../sdlc/sdlcEventModel.js";
import { buildSdlcInsightsBundle } from "../sdlc/sdlcInsights.js";
import { buildWorkBreakdown } from "../work/workDecomposition.js";
import { prioritizeWork } from "../work/workPrioritization.js";
import { buildWorkGraph } from "../work/workGraph.js";
import { buildWorkSchedule } from "../work/workScheduler.js";
import { appendAutoSessionStep } from "../auto/autoSessionModel.js";

type ParsedAgentExecute = z.infer<typeof forgeAgentExecuteRequestSchema>;

const revisedBundleSchema = z.object({
  plan: agentTaskPlanV1Schema,
  steps: z
    .array(
      z.object({
        stepId: z.string().min(1),
        tool: z.string().min(1),
        input: z.unknown()
      })
    )
    .min(1)
});

const MAX_MODEL_TEXT = 8_000;

export type SelfCorrectAttempt = {
  plan: AgentTaskPlanV1;
  executeResult: AgentTaskExecutionResult;
  validation: PackageValidationResult;
};

export type SelfCorrectingExecuteOutcome =
  | {
      selfCorrect: true;
      finalStatus: "success" | "failed_validation" | "parse_error" | "max_retries";
      attempts: SelfCorrectAttempt[];
      skiaEnabled: boolean;
    }
  | { selfCorrect: false };

function ts() {
  return new Date().toISOString();
}

function failedCommandNames(validation: PackageValidationResult): string[] {
  return validation.results.filter((r) => r.failed).map((r) => r.name);
}

/**
 * D1-11: apply + validation + optional SKIA replan (governance maxRetries from agentGovernance).
 * Caller only invokes when `d.mode === "apply" && d.selfCorrect === true`.
 */
export async function runAgentSelfCorrectingExecute(
  projectRoot: string,
  d: ParsedAgentExecute,
  ctx: {
    skia: SkiaFullAdapter;
    goalText: string;
    passthroughHeaders?: Record<string, string>;
    getSkiarulesConfig?: () => SkiarulesConfig | null;
    autoSessionId?: string;
  }
): Promise<{ status: number; body: unknown; outcome: SelfCorrectingExecuteOutcome }> {
  const maxCorrectionCycles = DEFAULT_AGENT_GOVERNANCE.maxRetries;
  const rulesContext = buildRulesContextSummary(ctx.getSkiarulesConfig?.() ?? null);

  await appendAuditLog(projectRoot, {
    timestamp: ts(),
    action: "agent.selfCorrect.start",
    parameters: mergeForgeAuditParamsV1("self_correct", {
      path: d.path,
      planTitle: d.plan.title,
      rulesContext: rulesContext || null,
      governance: { maxCorrectionCycles, limits: governanceLimitsV1() }
    }),
    result: "success"
  });

  const skiaOn = ctx.skia.getStatus().enabled;
  let plan: AgentTaskPlanV1 = { ...d.plan, version: "1" as const };
  let actions: StepAction[] = d.steps.map((s) => ({ stepId: s.stepId, tool: s.tool, input: s.input }));
  const attempts: SelfCorrectAttempt[] = [];
  let finalStatus: "success" | "failed_validation" | "parse_error" | "max_retries" = "failed_validation";
  const retryTrace: {
    planId: string;
    validationResult: string;
    exitCode: number;
    stderrTail: string;
  }[] = [];
  let modelDiagnostics: { rawModelTextTruncated?: string; parseError?: string } = {};
  let lastRawModel = "";
  let planRevisions = 0;

  for (let cycle = 0; cycle <= maxCorrectionCycles; cycle++) {
    if (ctx.autoSessionId) {
      await appendAutoSessionStep(projectRoot, ctx.autoSessionId, {
        type: "selfCorrect",
        planId: plan.title,
        outcome: "success",
        notes: `self-correction cycle ${cycle} started`
      });
    }
    const registry = createDefaultToolRegistry();
    const executeResult = await runAgentTaskExecution(
      projectRoot,
      plan,
      actions,
      registry,
      {
        mode: "apply",
        fileMutationApprovals: d.fileMutationApprovals,
        highRiskCommandApprovals: d.highRiskCommandApprovals,
        getSkiarulesConfig: ctx.getSkiarulesConfig,
        governanceLimits: governanceLimitsV1()
      }
    );
    if (executeResult.stopReason) {
      finalStatus = "parse_error";
      const valEmpty: PackageValidationResult = {
        ok: false,
        results: [],
        summary: executeResult.stopReason
      };
      attempts.push({ plan, executeResult, validation: valEmpty });
      modelDiagnostics = {
        parseError: executeResult.stopReason,
        rawModelTextTruncated: lastRawModel ? lastRawModel.slice(0, MAX_MODEL_TEXT) : undefined
      };
      await appendAuditLog(projectRoot, {
        timestamp: ts(),
        action: "agent.selfCorrect.complete",
        parameters: mergeForgeAuditParamsV1("self_correct", {
          finalStatus,
          reason: "executeStop",
          rulesContext: rulesContext || null,
          vectorSearchMeta: null,
          lspSkiarules: null,
          diagnostics: null,
          contextRetrievalMeta: null,
          governance: { stop: executeResult.stopReason },
          retrievalWarnings: null
        }),
        result: "failure"
      });
      return {
        status: 400,
        body: {
          version: "agent-execute-v1" as const,
          selfCorrect: true,
          finalStatus,
          path: d.path,
          stopReason: executeResult.stopReason,
          selfCorrectSummary: {
            attemptCount: attempts.length,
            failedValidationCommands: [],
            planRevisionsAttempted: planRevisions
          },
          modelDiagnostics,
          retryTrace,
          attempts: attempts.map((a) => ({
            plan: a.plan,
            execute: a.executeResult,
            validation: a.validation
          }))
        },
        outcome: { selfCorrect: true, finalStatus, attempts, skiaEnabled: skiaOn }
      };
    }
    const validation = await runPackageValidation(projectRoot);
    attempts.push({ plan, executeResult, validation });
    finalStatus = validation.ok ? "success" : "failed_validation";
    await recordSdlcEvent({
      projectRoot,
      type: "agent_run",
      status: validation.ok ? "success" : "failure",
      path: d.path,
      details: `self-correction cycle ${cycle}`,
      meta: {
        phase: "self_correction_attempt",
        cycle,
        validationOk: validation.ok,
        planTitle: plan.title
      }
    });
    await appendAuditLog(projectRoot, {
      timestamp: ts(),
      action: "agent.selfCorrect.attempt",
      parameters: mergeForgeAuditParamsV1("self_correct", {
        cycle,
        planTitle: plan.title,
        rulesContext: rulesContext || null,
        vectorSearchMeta: null,
        lspSkiarules: null,
        diagnostics: null,
        contextRetrievalMeta: null,
        governance: { validationOk: validation.ok, commandLimits: governanceLimitsV1() },
        retrievalWarnings: null
      }),
      result: validation.ok ? "success" : "failure",
      details: JSON.stringify(validation.results)
    });
    if (validation.ok) {
      break;
    }
    if (!skiaOn) {
      finalStatus = "failed_validation";
      break;
    }
    const failCmd = validation.results.find((r) => r.failed);
    retryTrace.push({
      planId: plan.title,
      validationResult: validation.summary,
      exitCode: failCmd?.exitCode ?? 0,
      stderrTail: (failCmd?.stderr ?? "").slice(-4_000)
    });
    if (cycle >= maxCorrectionCycles) {
      finalStatus = "max_retries";
      break;
    }
    const { text: failSummary, byCommand } = validationFailureSummary(validation, 6_000);
    const sdlcHints = await buildSdlcInsightsBundle(projectRoot, d.path);
    const workLike = {
      v: 1 as const,
      id: "self-correct",
      title: plan.title,
      description: ctx.goalText,
      type: "bug" as const,
      priority: "P1" as const,
      status: "in_progress" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      relatedFiles: [d.path],
      relatedTests: validation.results.filter((r) => r.name === "test").map((r) => r.command),
      sdlcSignals: {
        risk: sdlcHints.heuristics.riskScore,
        drift: sdlcHints.drift.score,
        forecast: sdlcHints.forecast.globalNextFailureProbability,
        health: sdlcHints.healthScore
      },
      dependencies: [],
      tags: ["self-correction"]
    };
    const breakdown = buildWorkBreakdown(
      workLike,
      sdlcHints,
      { paths: [d.path] },
      ctx.getSkiarulesConfig?.() ?? null
    );
    const priorityMeta = prioritizeWork(
      workLike,
      breakdown,
      sdlcHints,
      { maxSteps: 20, maxWriteOps: 10, maxTerminalOps: 5 }
    );
    const graph = await buildWorkGraph(projectRoot);
    const schedule = buildWorkSchedule({
      graph,
      governanceLimits: { maxSteps: 20, maxWriteOps: 10, maxTerminalOps: 5 },
      forecast: {
        globalNextFailureProbability: sdlcHints.forecast.globalNextFailureProbability,
        nextAgentRollbackProbability: sdlcHints.forecast.nextAgentRollbackProbability
      }
    });
    const userMsg = [
      `You are SKIA-Forge. The goal was: ${ctx.goalText}.`,
      ` The previous plan (JSON) was: ${JSON.stringify(plan)}. The tool steps were: ${JSON.stringify(actions)}.`,
      ` Validation failed after the last run. Summaries: ${failSummary}.`,
      ` By command: ${JSON.stringify(byCommand)}.`,
      ` SDLC hints: ${JSON.stringify({
        healthScore: sdlcHints.healthScore,
        riskScore: sdlcHints.heuristics.riskScore,
        stabilityScore: sdlcHints.heuristics.stabilityScore,
        hotspotFiles: sdlcHints.heuristics.hotspotFiles.slice(0, 5),
        recentFailures: sdlcHints.heuristics.recentFailures.slice(0, 5),
        drift: sdlcHints.drift,
        risk: sdlcHints.risk,
        forecast: sdlcHints.forecast,
        patterns: sdlcHints.patterns,
        recommendations: sdlcHints.recommendations,
        workBreakdown: breakdown,
        workPriority: priorityMeta,
        workSchedule: schedule
      })}.`,
      ` Return a single JSON object only, no markdown, with "plan" (v1 plan object) and "steps" (array of { "stepId", "tool", "input" }) to fix the issues.`
    ].join("");
    let upstream: Record<string, unknown>;
    try {
      upstream = await ctx.skia.intelligence(userMsg, "agent", ctx.passthroughHeaders);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "chat failed";
      finalStatus = "parse_error";
      modelDiagnostics = { parseError: msg };
      await appendAuditLog(projectRoot, {
        timestamp: ts(),
        action: "agent.selfCorrect.complete",
        parameters: mergeForgeAuditParamsV1("self_correct", {
          finalStatus,
          error: msg,
          rulesContext: rulesContext || null,
          vectorSearchMeta: null,
          lspSkiarules: null,
          diagnostics: null,
          contextRetrievalMeta: null,
          governance: { chat: "intelligence_failed" },
          retrievalWarnings: null
        }),
        result: "failure"
      });
      return {
        status: 200,
        body: {
          version: "agent-execute-v1" as const,
          selfCorrect: true,
          finalStatus,
          path: d.path,
          error: msg,
          selfCorrectSummary: {
            attemptCount: attempts.length,
            failedValidationCommands: failedCommandNames(validation),
            planRevisionsAttempted: planRevisions
          },
          modelDiagnostics,
          retryTrace,
          attempts: attempts.map((a) => ({
            plan: a.plan,
            execute: a.executeResult,
            validation: a.validation
          }))
        },
        outcome: { selfCorrect: true, finalStatus, attempts, skiaEnabled: true }
      };
    }
    const raw = extractTextFromSkiaChatResponse(upstream);
    lastRawModel = raw;
    modelDiagnostics = { rawModelTextTruncated: raw.slice(0, MAX_MODEL_TEXT) };
    const jsonSlice = extractJsonObjectString(raw);
    if (!jsonSlice) {
      finalStatus = "parse_error";
      modelDiagnostics = { ...modelDiagnostics, parseError: "Model response did not contain a JSON object." };
      break;
    }
    let j: unknown;
    try {
      j = JSON.parse(jsonSlice) as unknown;
    } catch (e) {
      finalStatus = "parse_error";
      modelDiagnostics = {
        ...modelDiagnostics,
        parseError: e instanceof Error ? e.message : "json parse"
      };
      break;
    }
    const v = revisedBundleSchema.safeParse(j);
    if (!v.success) {
      finalStatus = "parse_error";
      modelDiagnostics = { ...modelDiagnostics, parseError: v.error.message };
      break;
    }
    const nextPlan = { ...v.data.plan, version: "1" as const };
    const nextActions = v.data.steps.map((s) => ({ stepId: s.stepId, tool: s.tool, input: s.input }));
    const gCheck = validateExecutorGovernance(nextPlan, nextActions, governanceLimitsV1());
    if (!gCheck.ok) {
      finalStatus = "parse_error";
      modelDiagnostics = { ...modelDiagnostics, parseError: `${gCheck.code}: ${gCheck.reason}` };
      await appendAuditLog(projectRoot, {
        timestamp: ts(),
        action: "agent.selfCorrect.governance",
        parameters: mergeForgeAuditParamsV1("self_correct", {
          rulesContext: rulesContext || null,
          vectorSearchMeta: null,
          lspSkiarules: null,
          diagnostics: null,
          contextRetrievalMeta: null,
          governance: { reason: gCheck.reason, code: gCheck.code, limits: governanceLimitsV1() },
          retrievalWarnings: null
        }),
        result: "failure",
        details: gCheck.reason
      });
      break;
    }
    plan = nextPlan;
    actions = nextActions;
    planRevisions += 1;
  }

  const last = attempts[attempts.length - 1];
  const allFailedCmds = new Set<string>();
  for (const a of attempts) {
    for (const n of failedCommandNames(a.validation)) {
      allFailedCmds.add(n);
    }
  }
  await appendAuditLog(projectRoot, {
    timestamp: ts(),
    action: "agent.selfCorrect.complete",
    parameters: mergeForgeAuditParamsV1("self_correct", {
      finalStatus,
      attemptCount: attempts.length,
      planRevisions,
      rulesContext: rulesContext || null,
      vectorSearchMeta: null,
      lspSkiarules: null,
      diagnostics: null,
      contextRetrievalMeta: null,
      governance: { lastValidationOk: last?.validation.ok, limits: governanceLimitsV1() },
      retrievalWarnings: null
    }),
    result: last?.validation.ok ? "success" : "failure"
  });
  if (ctx.autoSessionId) {
    await appendAutoSessionStep(projectRoot, ctx.autoSessionId, {
      type: "selfCorrect",
      planId: last?.plan.title ?? plan.title,
      outcome: last?.validation.ok ? "success" : "failure",
      notes: `self-correction complete status=${finalStatus}`
    });
  }

  return {
    status: 200,
    body: {
      version: "agent-execute-v1" as const,
      path: d.path,
      selfCorrect: true,
      finalStatus,
      skiaEnabled: skiaOn,
      planTitle: last?.plan.title ?? plan.title,
      mode: d.mode,
      stepResults: last?.executeResult.stepResults ?? [],
      appliedRollback: last?.executeResult.appliedRollback ?? false,
      rollbackSummary: last?.executeResult.rollbackSummary,
      diffSummary: last?.executeResult.diffSummary,
      selfCorrectSummary: {
        attemptCount: attempts.length,
        failedValidationCommands: [...allFailedCmds],
        planRevisionsAttempted: planRevisions
      },
      modelDiagnostics,
      retryTrace,
      attempts: attempts.map((a) => ({
        plan: a.plan,
        execute: a.executeResult,
        validation: a.validation
      }))
    },
    outcome: { selfCorrect: true, finalStatus, attempts, skiaEnabled: skiaOn }
  };
}
