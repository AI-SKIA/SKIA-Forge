import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import type { ContextRetrievalStructureSource, ForgeContextSkiarulesContext } from "../context-engine/contextRetrievalRequest.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";
import { planLongHorizonGoals } from "./autoLongHorizonPlanner.js";
import { queryAutoMemory, recordAutoMemory } from "./autoMemory.js";
import { buildSdlcInsightsBundle } from "../sdlc/sdlcInsights.js";
import { computeAutoStrategy } from "./autoStrategy.js";
import { runAutoExecutionSession } from "./autoOrchestrator.js";
import { listAutoSessions } from "./autoSessionModel.js";
import { evaluateAutoOutcome } from "./autoEvaluator.js";
import { resumeAutoSession } from "./autoResume.js";
import { evaluateAutoStability } from "./autoStability.js";
import { buildWorkDashboard } from "../work/workDashboard.js";
import { evaluateAutoSafety } from "./autoSafety.js";

export type AutoMultiSessionLoopResultV1 = {
  status: "completed" | "paused" | "halted" | "escalated";
  sessionsRun: number;
  lastSessionId: string | null;
  reason: string;
};

export async function runAutoMultiSessionLoop(
  projectRoot: string,
  options: {
    skia: SkiaFullAdapter;
    env: NodeJS.ProcessEnv;
    structure: ContextRetrievalStructureSource;
    skiarulesContext?: ForgeContextSkiarulesContext;
    passthroughHeaders?: Record<string, string>;
    maxSessions?: number;
  }
): Promise<AutoMultiSessionLoopResultV1> {
  const maxSessions = Math.max(1, Math.min(20, options.maxSessions ?? 4));
  let lastSessionId: string | null = null;
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "auto.multiSession.start",
    parameters: mergeForgeAuditParamsV1("auto_multi_session", { maxSessions }),
    result: "success"
  });
  for (let i = 0; i < maxSessions; i++) {
    const [plan, memory, sdlc] = await Promise.all([
      planLongHorizonGoals(projectRoot),
      queryAutoMemory(projectRoot, { limit: 600 }),
      buildSdlcInsightsBundle(projectRoot)
    ]);
    const strategy = await computeAutoStrategy(projectRoot, plan, memory, sdlc);
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action: "auto.multiSession.tick",
      parameters: mergeForgeAuditParamsV1("auto_multi_session", {
        tick: i + 1,
        longHorizonPlan: plan,
        strategy
      }),
      result: "success"
    });
    const resume = await resumeAutoSession(projectRoot);
    if (resume.action === "escalate_to_human") {
      await appendAuditLog(projectRoot, {
        timestamp: new Date().toISOString(),
        action: "auto.multiSession.complete",
        parameters: mergeForgeAuditParamsV1("auto_multi_session", {
          status: "escalated",
          tick: i + 1,
          reason: resume.reason
        }),
        result: "failure"
      });
      return { status: "escalated", sessionsRun: i, lastSessionId, reason: resume.reason };
    }
    const run = await runAutoExecutionSession(projectRoot, {
      skia: options.skia,
      env: options.env,
      structure: options.structure,
      skiarulesContext: options.skiarulesContext,
      passthroughHeaders: options.passthroughHeaders,
      maxSessionSteps: strategy.sessionLength,
      maxRetriesPerItem: strategy.correctionBudget,
      ...(resume.action === "resume" && resume.session ? { resumeSessionId: resume.session.id } : {}),
      selectionOptions: {
        maxItems: strategy.sessionLength,
        riskThreshold: strategy.mode === "risk_first" ? 40 : 20,
        longHorizonPlan: plan
      }
    });
    lastSessionId = run.sessionId;
    const sessions = await listAutoSessions(projectRoot, { limit: 1 });
    const current = sessions[0] ?? null;
    if (!current) continue;
    const currentSdlc = await buildSdlcInsightsBundle(projectRoot);
    const outcome = evaluateAutoOutcome(current, plan, strategy, currentSdlc);
    await recordAutoMemory(projectRoot, {
      sessionId: current.id,
      category: "workitem_history",
      outcome: outcome.overallOutcomeScore >= 60 ? "success" : "failure",
      details: `overallOutcomeScore=${outcome.overallOutcomeScore}`,
      meta: outcome
    });
    const dashboard = await buildWorkDashboard(projectRoot);
    const stability = evaluateAutoStability(current, { updatedStrategy: {
      plannerPreference: strategy.plannerPreference,
      selectionWeights: strategy.selectionWeights,
      correctionBudget: strategy.correctionBudget,
      driftMitigationMode: strategy.driftMitigationPriority === "high" ? "strict" : "normal",
      stabilityMode: strategy.mode === "stability_first" ? "stabilize_first" : "normal"
    }, notes: strategy.rationale }, memory, currentSdlc);
    const safety = evaluateAutoSafety(current, stability, dashboard.governance, dashboard.slaDrift);
    if (safety.recommendedAction === "halt" || safety.recommendedAction === "require_human_review") {
      await appendAuditLog(projectRoot, {
        timestamp: new Date().toISOString(),
        action: "auto.multiSession.complete",
        parameters: mergeForgeAuditParamsV1("auto_multi_session", {
          status: "halted",
          tick: i + 1,
          lastSessionId: current.id,
          safety
        }),
        result: "failure"
      });
      return { status: "halted", sessionsRun: i + 1, lastSessionId: current.id, reason: `safety=${safety.recommendedAction}` };
    }
  }
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "auto.multiSession.complete",
    parameters: mergeForgeAuditParamsV1("auto_multi_session", {
      status: "completed",
      sessionsRun: maxSessions,
      lastSessionId
    }),
    result: "success"
  });
  return { status: "completed", sessionsRun: maxSessions, lastSessionId, reason: "max sessions reached" };
}
