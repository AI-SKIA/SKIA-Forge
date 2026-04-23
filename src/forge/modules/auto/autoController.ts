import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import type { ContextRetrievalStructureSource, ForgeContextSkiarulesContext } from "../context-engine/contextRetrievalRequest.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";
import { runAutoHeartbeat } from "./autoHeartbeat.js";
import { resumeAutoSession } from "./autoResume.js";
import { runAutoExecutionSession } from "./autoOrchestrator.js";
import { buildSdlcInsightsBundle } from "../sdlc/sdlcInsights.js";
import { listAutoSessions } from "./autoSessionModel.js";
import { queryAutoMemory, recordAutoMemory } from "./autoMemory.js";
import { adaptAutoStrategy } from "./autoAdaptation.js";
import { analyzeAutoFailure } from "./autoFailureRecovery.js";
import { evaluateAutoStability } from "./autoStability.js";
import { buildWorkDashboard } from "../work/workDashboard.js";
import { evaluateAutoSafety } from "./autoSafety.js";
import { planLongHorizonGoals } from "./autoLongHorizonPlanner.js";
import { computeAutoStrategy } from "./autoStrategy.js";
import { evaluateAutoOutcome } from "./autoEvaluator.js";
import { runAutoMultiSessionLoop } from "./autoMultiSessionLoop.js";
import { analyzeSelfPerformance } from "../self/selfInsights.js";
import { buildSelfImprovementPlan } from "../self/selfPlanner.js";
import { runSelfImprovementTasks } from "../self/selfExecutor.js";
import { runSelfImprovementLoop } from "../self/selfLoop.js";
import { runAdvancedSelfImprovementCycle } from "../self/selfOrchestrator.js";
import { runMetaOptimizationCycle } from "../self/selfMetaOptimizer.js";
import { getSelfImprovementStateSnapshot } from "../self/selfState.js";
import { computeEvolutionPolicy } from "../self/selfEvolutionPolicy.js";
import { computeSelfImprovementHealth } from "../self/selfHealth.js";
import { runSelfImprovementConsolidation } from "../self/selfConsolidation.js";
import { runGlobalAutoExecution } from "../global/globalAutoOrchestrator.js";
import { getGlobalStateSnapshot } from "../global/globalState.js";
import { computeGlobalEvolutionPolicy } from "../global/globalEvolutionPolicy.js";
import { buildGlobalHealthSurface } from "../global/globalHealthSurface.js";
import { runGlobalSafetyGateway } from "../safety/globalSafetyGateway.js";

export type AutoControllerResultV1 = {
  status: "completed" | "halted" | "unsafe" | "critical_stability";
  cycles: number;
  sessionId: string | null;
  reason: string;
};

export async function runAutoController(
  projectRoot: string,
  options: {
    skia: SkiaFullAdapter;
    env: NodeJS.ProcessEnv;
    structure: ContextRetrievalStructureSource;
    skiarulesContext?: ForgeContextSkiarulesContext;
    passthroughHeaders?: Record<string, string>;
    maxCycles?: number;
    useMultiSessionLoop?: boolean;
    runSelfLoop?: boolean;
    advancedSelfImprovement?: boolean;
    metaOptimizationMode?: boolean;
    introspectionSnapshot?: boolean;
    globalMode?: boolean;
    globalProjectRoots?: string[];
    globalBaselineConsolidationTick?: boolean;
  }
): Promise<AutoControllerResultV1> {
  if (options.runSelfLoop) {
    const self = await runSelfImprovementLoop(projectRoot, {
      maxTicks: options.maxCycles,
      advancedMode: options.advancedSelfImprovement,
      metaOptimizationMode: options.metaOptimizationMode,
      introspectionSnapshot: options.introspectionSnapshot
    });
    return {
      status: self.status === "completed" ? "completed" : self.status === "halted" ? "halted" : "halted",
      cycles: self.ticks,
      sessionId: null,
      reason: self.reason
    };
  }
  if (options.useMultiSessionLoop) {
    const multi = await runAutoMultiSessionLoop(projectRoot, {
      skia: options.skia,
      env: options.env,
      structure: options.structure,
      skiarulesContext: options.skiarulesContext,
      passthroughHeaders: options.passthroughHeaders,
      maxSessions: options.maxCycles
    });
    return {
      status:
        multi.status === "completed"
          ? "completed"
          : multi.status === "halted"
            ? "halted"
            : multi.status === "escalated"
              ? "unsafe"
              : "halted",
      cycles: multi.sessionsRun,
      sessionId: multi.lastSessionId,
      reason: multi.reason
    };
  }
  const maxCycles = Math.max(1, Math.min(20, options.maxCycles ?? 3));
  let cycles = 0;
  let sessionId: string | null = null;
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "auto.controller.start",
    parameters: mergeForgeAuditParamsV1("auto_controller", { maxCycles }),
    result: "success"
  });
  while (cycles < maxCycles) {
    cycles += 1;
    const localGateway = await runGlobalSafetyGateway([projectRoot], await getGlobalStateSnapshot([projectRoot]));
    if (localGateway.gatewayStatus === "halt") {
      return { status: "halted", cycles, sessionId, reason: "safety gateway halted controller cycle" };
    }
    const longHorizonPlan = await planLongHorizonGoals(projectRoot);
    if (options.globalMode && options.globalProjectRoots && options.globalProjectRoots.length > 0) {
      const globalRun = await runGlobalAutoExecution(options.globalProjectRoots, {
        skia: options.skia,
        env: options.env,
        structure: options.structure,
        skiarulesContext: options.skiarulesContext,
        passthroughHeaders: options.passthroughHeaders,
        maxGlobalCycles: 1,
        enableMetaOptimizationTick: options.metaOptimizationMode,
        explicitBaselineTick: options.globalBaselineConsolidationTick
      });
      if (options.metaOptimizationMode) {
        const gState = await getGlobalStateSnapshot(options.globalProjectRoots);
        const gPolicy = await computeGlobalEvolutionPolicy(options.globalProjectRoots, gState);
        const gHealthSurface = await buildGlobalHealthSurface(options.globalProjectRoots, gState, gPolicy);
        await appendAuditLog(projectRoot, {
          timestamp: new Date().toISOString(),
          action: "global.health.surface",
          parameters: mergeForgeAuditParamsV1("auto_controller", {
            cycle: cycles,
            globalHealthSurface: gHealthSurface
          }),
          result: "success"
        });
      }
      await appendAuditLog(projectRoot, {
        timestamp: new Date().toISOString(),
        action: "auto.controller.tick",
        parameters: mergeForgeAuditParamsV1("auto_controller", {
          cycle: cycles,
          globalMode: true,
          globalRun
        }),
        result: globalRun.status === "halted" ? "failure" : "success"
      });
      if (globalRun.status === "halted") {
        return { status: "halted", cycles, sessionId, reason: globalRun.reason };
      }
    }
    const heartbeat = await runAutoHeartbeat(projectRoot, {
      skia: options.skia,
      env: options.env,
      structure: options.structure,
      skiarulesContext: options.skiarulesContext,
      passthroughHeaders: options.passthroughHeaders,
      maxContinuousSessions: 1
    });
    sessionId = heartbeat.sessionId;
    const resume = await resumeAutoSession(projectRoot, sessionId ?? undefined);
    const sessions = await listAutoSessions(projectRoot, { limit: 1 });
    const current = sessions[0] ?? null;
    const sdlc = await buildSdlcInsightsBundle(projectRoot);
    const memory = await queryAutoMemory(projectRoot, { sessionId: current?.id, limit: 300 });
    const dashboard = await buildWorkDashboard(projectRoot);
    const strategyV2 = await computeAutoStrategy(projectRoot, longHorizonPlan, memory, sdlc);
    const selfInsights = analyzeSelfPerformance(projectRoot, memory, sessions, sdlc);
    const selfPlan = buildSelfImprovementPlan(selfInsights, memory, sdlc);
    const recovery = current
      ? analyzeAutoFailure(current, current.steps.at(-1) ?? null, sdlc, memory)
      : {
          failureCategory: "sdlc" as const,
          severity: "low" as const,
          recommendedRecoveryActions: [],
          notes: ["no current session"]
        };
    const adaptation = current
      ? adaptAutoStrategy(current, recovery, sdlc, memory)
      : {
          updatedStrategy: {
            plannerPreference: "v4" as const,
            selectionWeights: { risk: 0.45, drift: 0.25, forecast: 0.2, stability: 0.1 },
            correctionBudget: 2,
            driftMitigationMode: "normal" as const,
            stabilityMode: "normal" as const
          },
          notes: ["default adaptation"]
        };
    const stability = current
      ? evaluateAutoStability(current, adaptation, memory, sdlc)
      : { stabilityStatus: "stable" as const, recommendedAction: "continue" as const, notes: [] };
    const safety = current
      ? evaluateAutoSafety(current, stability, dashboard.governance, dashboard.slaDrift)
      : { safetyStatus: "safe" as const, recommendedAction: "continue" as const, notes: [] };
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action: "auto.controller.tick",
      parameters: mergeForgeAuditParamsV1("auto_controller", {
        cycle: cycles,
        sessionId,
        longHorizonPlan,
        strategyV2,
        selfInsights,
        selfPlan,
        heartbeat,
        resume,
        recovery,
        adaptation,
        stability,
        safety
      }),
      result: "success"
    });
    if (options.advancedSelfImprovement) {
      const advanced = await runAdvancedSelfImprovementCycle(projectRoot, {
        sessionId: sessionId ?? undefined,
        maxTicks: 1
      });
      const snapshot = await getSelfImprovementStateSnapshot(projectRoot, {
        emitAudit: options.introspectionSnapshot
      });
      const evolutionPolicy = computeEvolutionPolicy(projectRoot, snapshot, sdlc);
      const health = computeSelfImprovementHealth(projectRoot, snapshot, evolutionPolicy);
      const metaOptimization = options.metaOptimizationMode
        ? await runMetaOptimizationCycle(projectRoot, { sessionId: sessionId ?? undefined })
        : null;
      const consolidation =
        options.metaOptimizationMode && evolutionPolicy.evolutionPhase === "stabilize"
          ? await runSelfImprovementConsolidation(projectRoot, {
              selfStateSnapshot: snapshot,
              evolutionPolicy,
              selfImprovementHealth: health,
              sessionId: sessionId ?? undefined
            })
          : null;
      await appendAuditLog(projectRoot, {
        timestamp: new Date().toISOString(),
        action: "self.strategy.evolve",
        parameters: mergeForgeAuditParamsV1("auto_controller", {
          cycle: cycles,
          sessionId,
          recommendedProfile: advanced.strategyEvolution.recommendedDefaultProfile,
          mappingRules: advanced.strategyEvolution.mappingRules,
          evolutionPolicy
        }),
        result: "success"
      });
      await appendAuditLog(projectRoot, {
        timestamp: new Date().toISOString(),
        action: "self.health",
        parameters: mergeForgeAuditParamsV1("auto_controller", {
          cycle: cycles,
          sessionId,
          health,
          ...(consolidation ? { consolidation } : {})
        }),
        result: "success"
      });
      if (metaOptimization) {
        await appendAuditLog(projectRoot, {
          timestamp: new Date().toISOString(),
          action: "self.metaOptimization.tick",
          parameters: mergeForgeAuditParamsV1("auto_controller", {
            cycle: cycles,
            sessionId,
            metaOptimization
          }),
          result: "success"
        });
      }
    }
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action: "self.insights",
      parameters: mergeForgeAuditParamsV1("self_meta", {
        cycle: cycles,
        sessionId,
        selfInsights
      }),
      result: "success"
    });
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action: "self.plan",
      parameters: mergeForgeAuditParamsV1("self_meta", {
        cycle: cycles,
        sessionId,
        selfPlan
      }),
      result: "success"
    });
    await recordAutoMemory(projectRoot, {
      sessionId: sessionId ?? undefined,
      category: "workitem_history",
      outcome: "success",
      details: `controller tick ${cycles}`,
      meta: { heartbeatStatus: heartbeat.status, safety: safety.safetyStatus, stability: stability.stabilityStatus }
    });
    if (safety.recommendedAction === "require_human_review" || safety.recommendedAction === "halt") {
      await appendAuditLog(projectRoot, {
        timestamp: new Date().toISOString(),
        action: "auto.controller.complete",
        parameters: mergeForgeAuditParamsV1("auto_controller", {
          status: "unsafe",
          cycle: cycles,
          sessionId,
          reason: `safety=${safety.recommendedAction}`
        }),
        result: "failure"
      });
      return { status: "unsafe", cycles, sessionId, reason: `safety=${safety.recommendedAction}` };
    }
    if (stability.stabilityStatus === "critical") {
      await appendAuditLog(projectRoot, {
        timestamp: new Date().toISOString(),
        action: "auto.controller.complete",
        parameters: mergeForgeAuditParamsV1("auto_controller", {
          status: "critical_stability",
          cycle: cycles,
          sessionId
        }),
        result: "failure"
      });
      return { status: "critical_stability", cycles, sessionId, reason: "critical stability" };
    }
    if (heartbeat.status === "halted" || heartbeat.status === "human_review") {
      await appendAuditLog(projectRoot, {
        timestamp: new Date().toISOString(),
        action: "auto.controller.complete",
        parameters: mergeForgeAuditParamsV1("auto_controller", {
          status: "halted",
          cycle: cycles,
          sessionId,
          reason: heartbeat.reason
        }),
        result: "failure"
      });
      return { status: "halted", cycles, sessionId, reason: heartbeat.reason };
    }
    if (resume.action === "restart" || resume.action === "resume") {
      const run = await runAutoExecutionSession(projectRoot, {
        skia: options.skia,
        env: options.env,
        structure: options.structure,
        skiarulesContext: options.skiarulesContext,
        passthroughHeaders: options.passthroughHeaders,
        maxSessionSteps: strategyV2.sessionLength,
        maxRetriesPerItem: strategyV2.correctionBudget,
        selectionOptions: {
          maxItems: strategyV2.sessionLength,
          riskThreshold: strategyV2.mode === "risk_first" ? 35 : 20,
          longHorizonPlan
        }
      });
      const latest = (await listAutoSessions(projectRoot, { limit: 1 }))[0];
      if (latest) {
        const outcome = evaluateAutoOutcome(latest, longHorizonPlan, strategyV2, sdlc);
        await appendAuditLog(projectRoot, {
          timestamp: new Date().toISOString(),
          action: "auto.outcome",
          parameters: mergeForgeAuditParamsV1("auto_controller", {
            cycle: cycles,
            sessionId: run.sessionId ?? latest.id,
            outcome
          }),
          result: outcome.overallOutcomeScore >= 60 ? "success" : "failure"
        });
        await recordAutoMemory(projectRoot, {
          sessionId: run.sessionId ?? latest.id,
          category: "workitem_history",
          outcome: outcome.overallOutcomeScore >= 60 ? "success" : "failure",
          details: `auto.outcome score=${outcome.overallOutcomeScore}`,
          meta: outcome
        });
        const selfExec = await runSelfImprovementTasks(projectRoot, selfPlan);
        await appendAuditLog(projectRoot, {
          timestamp: new Date().toISOString(),
          action: "self.execute",
          parameters: mergeForgeAuditParamsV1("self_meta", {
            cycle: cycles,
            sessionId: run.sessionId ?? latest.id,
            selfExec
          }),
          result: "success"
        });
      }
    }
  }
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "auto.controller.complete",
    parameters: mergeForgeAuditParamsV1("auto_controller", {
      status: "completed",
      cycles,
      sessionId
    }),
    result: "success"
  });
  return { status: "completed", cycles, sessionId, reason: "max cycles reached" };
}
