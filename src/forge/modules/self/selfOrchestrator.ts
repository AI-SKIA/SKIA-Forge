import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { queryAutoMemory, recordAutoMemory } from "../auto/autoMemory.js";
import { listAutoSessions } from "../auto/autoSessionModel.js";
import { buildSdlcInsightsBundle } from "../sdlc/sdlcInsights.js";
import { buildWorkDashboard } from "../work/workDashboard.js";
import { buildWorkGraph } from "../work/workGraph.js";
import { buildWorkSchedule } from "../work/workScheduler.js";
import { buildWorkRoadmap } from "../work/workRoadmap.js";
import { planLongHorizonGoals } from "../auto/autoLongHorizonPlanner.js";
import { computeAutoStrategy, type AutoStrategyV1 } from "../auto/autoStrategy.js";
import { analyzeSelfPerformance } from "./selfInsights.js";
import { analyzeAndRefineHeuristics, applySelfHeuristicOverridesV1, type SelfHeuristicsUpdateV1 } from "./selfHeuristics.js";
import { evolveAutoStrategy, type SelfStrategyEvolutionV1 } from "./selfStrategyEvolution.js";
import { analyzeArchitectureOptimization, type SelfArchitectureAdviceV1 } from "./selfArchitecture.js";
import { analyzeHeuristicConvergence, type SelfHeuristicConvergenceV1 } from "./selfHeuristicConvergence.js";
import { analyzeStrategyConvergence, type SelfStrategyConvergenceV1 } from "./selfStrategyConvergence.js";
import { scoreArchitectureEvolution, type SelfArchitectureEvolutionScoreV1 } from "./selfArchitectureScoring.js";
import { getSelfImprovementStateSnapshot } from "./selfState.js";
import { computeEvolutionPolicy, type SelfEvolutionPolicyV1 } from "./selfEvolutionPolicy.js";
import { buildSelfImprovementPlan } from "./selfPlanner.js";
import { runSelfImprovementTasks, type SelfImprovementExecutionResultV1 } from "./selfExecutor.js";

export type AdvancedSelfImprovementResultV1 = {
  status: "completed" | "paused" | "halted";
  heuristicsUpdate: SelfHeuristicsUpdateV1;
  strategyEvolution: SelfStrategyEvolutionV1;
  architectureAdvice: SelfArchitectureAdviceV1;
  selfExecution: SelfImprovementExecutionResultV1;
  longHorizonGoals: string[];
  strategy: AutoStrategyV1;
  heuristicConvergence: SelfHeuristicConvergenceV1;
  strategyConvergence: SelfStrategyConvergenceV1;
  architectureEvolutionScore: SelfArchitectureEvolutionScoreV1;
  evolutionPolicy: SelfEvolutionPolicyV1;
};

export async function runAdvancedSelfImprovementCycle(
  projectRoot: string,
  options?: { sessionId?: string; maxTicks?: number }
): Promise<AdvancedSelfImprovementResultV1> {
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.advanced.start",
    parameters: mergeForgeAuditParamsV1("self_advanced", { sessionId: options?.sessionId ?? null }),
    result: "success"
  });
  const [memory, sessions, sdlc, dashboard, graph] = await Promise.all([
    queryAutoMemory(projectRoot, { limit: 1000 }),
    listAutoSessions(projectRoot, { limit: 200 }),
    buildSdlcInsightsBundle(projectRoot),
    buildWorkDashboard(projectRoot),
    buildWorkGraph(projectRoot)
  ]);
  const schedule = buildWorkSchedule({
    graph,
    governanceLimits: { maxSteps: 20, maxWriteOps: 10, maxTerminalOps: 5 },
    forecast: {
      globalNextFailureProbability: sdlc.forecast.globalNextFailureProbability,
      nextAgentRollbackProbability: sdlc.forecast.nextAgentRollbackProbability
    }
  });
  const roadmap = buildWorkRoadmap({
    graph,
    schedule,
    insights: sdlc,
    architectureOptimizationHints: dashboard.architectureAdvice.recommendations.slice(0, 6)
  });
  const selfInsights = analyzeSelfPerformance(projectRoot, memory, sessions, sdlc);
  const currentSnapshot = await getSelfImprovementStateSnapshot(projectRoot);
  const evolutionPolicy = computeEvolutionPolicy(projectRoot, currentSnapshot, sdlc);
  const heuristicsUpdate = analyzeAndRefineHeuristics(projectRoot, memory, sdlc, selfInsights);
  if (!evolutionPolicy.blockedChanges.includes("heuristics")) {
    applySelfHeuristicOverridesV1(heuristicsUpdate);
  }
  const longHorizon = await planLongHorizonGoals(projectRoot);
  const strategy = await computeAutoStrategy(projectRoot, longHorizon, memory, sdlc);
  const outcomeHistory = memory
    .map((m) => ({ overallOutcomeScore: Number((m.meta as { overallOutcomeScore?: number } | undefined)?.overallOutcomeScore ?? NaN) }))
    .filter((x) => Number.isFinite(x.overallOutcomeScore));
  const strategyEvolution = evolveAutoStrategy(projectRoot, strategy, selfInsights, outcomeHistory, memory);
  const strategyConvergence = analyzeStrategyConvergence(
    projectRoot,
    strategyEvolution.updatedStrategyProfiles,
    outcomeHistory.map((x) => ({ ...x, profileId: strategyEvolution.recommendedDefaultProfile })),
    memory
  );
  const architectureAdvice = analyzeArchitectureOptimization(projectRoot, sdlc, graph, roadmap, selfInsights);
  const heuristicConvergence = analyzeHeuristicConvergence(projectRoot, memory, [heuristicsUpdate]);
  const architectureEvolutionScore = scoreArchitectureEvolution(projectRoot, architectureAdvice, [graph], [sdlc]);
  architectureAdvice.evolutionScore = architectureEvolutionScore;
  const selfPlan = buildSelfImprovementPlan(selfInsights, memory, sdlc);
  const selfExecution = await runSelfImprovementTasks(projectRoot, selfPlan);
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.heuristics.update",
    parameters: mergeForgeAuditParamsV1("self_advanced", { heuristicsUpdate }),
    result: "success"
  });
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.strategy.evolve",
    parameters: mergeForgeAuditParamsV1("self_advanced", { strategyEvolution }),
    result: "success"
  });
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.architecture.advice",
    parameters: mergeForgeAuditParamsV1("self_advanced", { architectureAdvice }),
    result: "success"
  });
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.advanced.tick",
    parameters: mergeForgeAuditParamsV1("self_advanced", {
      sessionId: options?.sessionId ?? null,
      heuristicsUpdate,
      strategyEvolution,
      architectureAdvice,
      heuristicConvergence,
      strategyConvergence,
      architectureEvolutionScore,
      evolutionPolicy,
      roadmapHints: roadmap.architectureOptimizationHints ?? [],
      longHorizonGoals: longHorizon.longHorizonGoals,
      selfExecution
    }),
    result: "success"
  });
  await recordAutoMemory(projectRoot, {
    sessionId: options?.sessionId,
    category: "workitem_history",
    outcome: "success",
    details: "self.advanced cycle completed",
    meta: { heuristicsUpdate, strategyEvolution, architectureAdvice }
  });
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.heuristics.convergence",
    parameters: mergeForgeAuditParamsV1("self_advanced", { heuristicConvergence }),
    result: "success"
  });
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.strategy.convergence",
    parameters: mergeForgeAuditParamsV1("self_advanced", { strategyConvergence }),
    result: "success"
  });
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.architecture.evolutionScore",
    parameters: mergeForgeAuditParamsV1("self_advanced", { architectureEvolutionScore }),
    result: "success"
  });
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.evolution.policy",
    parameters: mergeForgeAuditParamsV1("self_advanced", { evolutionPolicy }),
    result: "success"
  });
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "self.advanced.complete",
    parameters: mergeForgeAuditParamsV1("self_advanced", {
      status: "completed",
      sessionId: options?.sessionId ?? null
    }),
    result: "success"
  });
  return {
    status: "completed",
    heuristicsUpdate,
    strategyEvolution,
    architectureAdvice,
    selfExecution,
    longHorizonGoals: longHorizon.longHorizonGoals,
    strategy,
    heuristicConvergence,
    strategyConvergence,
    architectureEvolutionScore,
    evolutionPolicy
  };
}
