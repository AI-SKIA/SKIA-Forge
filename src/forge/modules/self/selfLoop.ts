import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { queryAutoMemory, recordAutoMemory } from "../auto/autoMemory.js";
import { listAutoSessions } from "../auto/autoSessionModel.js";
import { buildSdlcInsightsBundle } from "../sdlc/sdlcInsights.js";
import { analyzeSelfPerformance } from "./selfInsights.js";
import { buildSelfImprovementPlan } from "./selfPlanner.js";
import { runSelfImprovementTasks } from "./selfExecutor.js";
import { planLongHorizonGoals } from "../auto/autoLongHorizonPlanner.js";
import { computeAutoStrategy } from "../auto/autoStrategy.js";
import { runAdvancedSelfImprovementCycle } from "./selfOrchestrator.js";
import { runMetaOptimizationCycle } from "./selfMetaOptimizer.js";
import { getSelfImprovementStateSnapshot } from "./selfState.js";
import { computeEvolutionPolicy } from "./selfEvolutionPolicy.js";
import { computeSelfImprovementHealth } from "./selfHealth.js";
import { runSelfImprovementConsolidation } from "./selfConsolidation.js";
import { runGlobalAutoExecution } from "../global/globalAutoOrchestrator.js";
import { getGlobalStateSnapshot } from "../global/globalState.js";
import { computeGlobalEvolutionPolicy } from "../global/globalEvolutionPolicy.js";
import { buildGlobalHealthSurface } from "../global/globalHealthSurface.js";
import { runGlobalSafetyGateway } from "../safety/globalSafetyGateway.js";

export type SelfImprovementLoopResultV1 = {
  status: "completed" | "paused" | "halted";
  ticks: number;
  reason: string;
};

export async function runSelfImprovementLoop(
  projectRoot: string,
  options?: {
    maxTicks?: number;
    advancedMode?: boolean;
    metaOptimizationMode?: boolean;
    introspectionSnapshot?: boolean;
    globalMode?: boolean;
    globalProjectRoots?: string[];
    sessionId?: string;
  }
): Promise<SelfImprovementLoopResultV1> {
  const maxTicks = Math.max(1, Math.min(10, options?.maxTicks ?? 3));
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.loop.start",
    parameters: mergeForgeAuditParamsV1("self_loop", { maxTicks }),
    result: "success"
  });
  for (let tick = 1; tick <= maxTicks; tick++) {
    const localGateway = await runGlobalSafetyGateway([projectRoot], await getGlobalStateSnapshot([projectRoot]));
    if (localGateway.gatewayStatus === "halt") {
      return { status: "halted", ticks: tick, reason: "safety gateway halted self loop" };
    }
    if (options?.globalMode && options.globalProjectRoots && options.globalProjectRoots.length > 0) {
      const globalRun = await runGlobalAutoExecution(options.globalProjectRoots, {
        maxGlobalCycles: 1,
        enableMetaOptimizationTick: options.metaOptimizationMode,
        explicitBaselineTick: options.metaOptimizationMode
      });
      if (options.metaOptimizationMode) {
        const gState = await getGlobalStateSnapshot(options.globalProjectRoots);
        const gPolicy = await computeGlobalEvolutionPolicy(options.globalProjectRoots, gState);
        const gHealth = await buildGlobalHealthSurface(options.globalProjectRoots, gState, gPolicy);
        await appendAuditLog(projectRoot, {
          timestamp: new Date().toISOString(),
          action: "global.health.surface",
          parameters: mergeForgeAuditParamsV1("self_loop", { tick, globalHealthSurface: gHealth }),
          result: "success"
        });
      }
      await appendAuditLog(projectRoot, {
        timestamp: new Date().toISOString(),
        action: "self.loop.tick",
        parameters: mergeForgeAuditParamsV1("self_loop", {
          tick,
          globalMode: true,
          globalRun
        }),
        result: "success"
      });
      if (globalRun.status === "halted") {
        return { status: "halted", ticks: tick, reason: globalRun.reason };
      }
      continue;
    }
    if (options?.advancedMode) {
      const advanced = await runAdvancedSelfImprovementCycle(projectRoot, {
        sessionId: options.sessionId,
        maxTicks: 1
      });
      const snapshot = await getSelfImprovementStateSnapshot(projectRoot, {
        emitAudit: options.introspectionSnapshot
      });
      const sdlcForPolicy = await buildSdlcInsightsBundle(projectRoot);
      const evolutionPolicy = computeEvolutionPolicy(projectRoot, snapshot, sdlcForPolicy);
      const health = computeSelfImprovementHealth(projectRoot, snapshot, evolutionPolicy);
      const metaOptimization = options.metaOptimizationMode
        ? await runMetaOptimizationCycle(projectRoot, { sessionId: options.sessionId })
        : null;
      const consolidation =
        options.metaOptimizationMode && evolutionPolicy.evolutionPhase === "stabilize"
          ? await runSelfImprovementConsolidation(projectRoot, {
              selfStateSnapshot: snapshot,
              evolutionPolicy,
              selfImprovementHealth: health,
              sessionId: options.sessionId
            })
          : null;
      await appendAuditLog(projectRoot, {
        timestamp: new Date().toISOString(),
        action: "self.loop.tick",
        parameters: mergeForgeAuditParamsV1("self_loop", {
          tick,
          advanced,
          evolutionPolicy,
          health,
          ...(metaOptimization ? { metaOptimization } : {}),
          ...(consolidation ? { consolidation } : {}),
          ...(options.introspectionSnapshot ? { selfStateSnapshot: snapshot } : {})
        }),
        result: "success"
      });
      await appendAuditLog(projectRoot, {
        timestamp: new Date().toISOString(),
        action: "self.health",
        parameters: mergeForgeAuditParamsV1("self_loop", { tick, health }),
        result: "success"
      });
      if (advanced.strategyEvolution.recommendedDefaultProfile === "stabilize_mode") {
        await appendAuditLog(projectRoot, {
          timestamp: new Date().toISOString(),
          action: "self.loop.complete",
          parameters: mergeForgeAuditParamsV1("self_loop", {
            status: "completed",
            tick
          }),
          result: "success"
        });
        return { status: "completed", ticks: tick, reason: "advanced targets reached" };
      }
      continue;
    }
    const [memory, sessions, sdlc] = await Promise.all([
      queryAutoMemory(projectRoot, { limit: 1000 }),
      listAutoSessions(projectRoot, { limit: 200 }),
      buildSdlcInsightsBundle(projectRoot)
    ]);
    const insights = analyzeSelfPerformance(projectRoot, memory, sessions, sdlc);
    const plan = buildSelfImprovementPlan(insights, memory, sdlc);
    const exec = await runSelfImprovementTasks(projectRoot, plan);
    const longHorizon = await planLongHorizonGoals(projectRoot);
    const strategy = await computeAutoStrategy(projectRoot, longHorizon, memory, sdlc);
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action: "self.loop.tick",
      parameters: mergeForgeAuditParamsV1("self_loop", {
        tick,
        insights,
        plan,
        exec,
        longHorizon,
        strategy
      }),
      result: "success"
    });
    await recordAutoMemory(projectRoot, {
      category: "workitem_history",
      outcome: "success",
      details: `self.loop tick ${tick}`,
      meta: { insights, plan, exec, strategy }
    });
    const done =
      insights.metaStabilityScore >= 80 &&
      insights.metaRiskScore <= 40 &&
      sdlc.heuristics.stabilityScore >= 75;
    if (done) {
      await appendAuditLog(projectRoot, {
        timestamp: new Date().toISOString(),
        action: "self.loop.complete",
        parameters: mergeForgeAuditParamsV1("self_loop", {
          status: "completed",
          tick
        }),
        result: "success"
      });
      return { status: "completed", ticks: tick, reason: "meta targets reached" };
    }
  }
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.loop.complete",
    parameters: mergeForgeAuditParamsV1("self_loop", {
      status: "paused",
      ticks: maxTicks
    }),
    result: "success"
  });
  return { status: "paused", ticks: maxTicks, reason: "max ticks reached" };
}
