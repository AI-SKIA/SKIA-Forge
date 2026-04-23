import type { ContextRetrievalStructureSource, ForgeContextSkiarulesContext } from "../context-engine/contextRetrievalRequest.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";
import { runAutoExecutionSession, type AutoExecutionResultV1 } from "./autoOrchestrator.js";
import { runAutoHeartbeat, type AutoHeartbeatResultV1 } from "./autoHeartbeat.js";
import { runAutoController, type AutoControllerResultV1 } from "./autoController.js";
import { runAutoMultiSessionLoop, type AutoMultiSessionLoopResultV1 } from "./autoMultiSessionLoop.js";
import { runSelfImprovementLoop, type SelfImprovementLoopResultV1 } from "../self/selfLoop.js";
import {
  getSelfImprovementStateSnapshot,
  getSelfImprovementHistorySummary,
  type SelfImprovementHistorySummaryV1,
  type SelfImprovementStateSnapshotV1
} from "../self/selfState.js";
import { buildGlobalContextGraph, type GlobalContextGraphV1 } from "../global/globalContextGraph.js";
import { planGlobalWork, type GlobalWorkPlanV1 } from "../global/globalPlanner.js";
import { evaluateGlobalGovernance, type GlobalGovernanceV1 } from "../global/globalGovernance.js";
import { buildGlobalDashboard, type GlobalDashboardV1 } from "../global/globalDashboard.js";
import { runGlobalAutoExecution, type GlobalAutoExecutionResultV1 } from "../global/globalAutoOrchestrator.js";
import { runGlobalSelfImprovement, type GlobalSelfImprovementResultV1 } from "../global/globalSelfImprovement.js";
import { runGlobalConsolidation, type GlobalConsolidationResultV1 } from "../global/globalConsolidation.js";
import { getGlobalStateSnapshot, getGlobalHistorySummary, type GlobalStateSnapshotV1, type GlobalHistorySummaryV1 } from "../global/globalState.js";
import { computeGlobalEvolutionPolicy, type GlobalEvolutionPolicyV1 } from "../global/globalEvolutionPolicy.js";
import { buildGlobalHealthSurface, type GlobalHealthSurfaceV1 } from "../global/globalHealthSurface.js";
import { runGlobalBaselineConsolidation, type GlobalBaselineConsolidationResultV1 } from "../global/globalBaselineConsolidation.js";
import {
  pauseGlobalEvolution,
  resumeGlobalEvolution,
  freezeAllHeuristics,
  freezeAllStrategyProfiles,
  enableAnalysisOnlyMode,
  disableAnalysisOnlyMode,
  triggerGlobalBaselineConsolidation,
  setGlobalRiskProfile,
  type GlobalRiskProfileV1
} from "../safety/operatorControls.js";

export async function startAutoExecutionOnce(
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
    selectionOptions?: {
      maxItems?: number;
      allowedTypes?: Array<"feature" | "bug" | "refactor" | "test" | "infra" | "research">;
      riskThreshold?: number;
      includeBlocked?: boolean;
    };
  }
): Promise<AutoExecutionResultV1> {
  return runAutoExecutionSession(projectRoot, options);
}

export async function startAutoHeartbeatOnce(
  projectRoot: string,
  options: {
    skia: SkiaFullAdapter;
    env: NodeJS.ProcessEnv;
    structure: ContextRetrievalStructureSource;
    skiarulesContext?: ForgeContextSkiarulesContext;
    passthroughHeaders?: Record<string, string>;
    intervalMs?: number;
    maxContinuousSessions?: number;
    stabilityThreshold?: "stable" | "unstable" | "degraded" | "critical";
    slaThreshold?: "none" | "mild" | "moderate" | "severe" | "critical";
  }
): Promise<AutoHeartbeatResultV1> {
  return runAutoHeartbeat(projectRoot, options);
}

export async function startAutoControllerOnce(
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
  }
): Promise<AutoControllerResultV1> {
  return runAutoController(projectRoot, options);
}

export async function startAutoMultiSessionLoopOnce(
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
  return runAutoMultiSessionLoop(projectRoot, options);
}

export async function startSelfImprovementOnce(
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
  return runSelfImprovementLoop(projectRoot, options);
}

export async function getSelfImprovementSnapshotOnce(
  projectRoot: string,
  options?: { emitAudit?: boolean }
): Promise<SelfImprovementStateSnapshotV1> {
  return getSelfImprovementStateSnapshot(projectRoot, options);
}

export async function getSelfImprovementHistorySummaryOnce(
  projectRoot: string,
  options?: { limit?: number }
): Promise<SelfImprovementHistorySummaryV1> {
  return getSelfImprovementHistorySummary(projectRoot, options);
}

export async function startGlobalContextGraphOnce(
  projectRoots: string[],
  options?: { hotspotLimit?: number }
): Promise<GlobalContextGraphV1> {
  return buildGlobalContextGraph(projectRoots, options);
}

export async function startGlobalPlanningOnce(
  projectRoots: string[],
  options?: { maxItems?: number }
): Promise<{
  globalContextGraph: GlobalContextGraphV1;
  globalPlan: GlobalWorkPlanV1;
  globalGovernance: GlobalGovernanceV1;
  globalDashboard: GlobalDashboardV1;
}> {
  const globalContextGraph = await buildGlobalContextGraph(projectRoots);
  const globalPlan = await planGlobalWork(globalContextGraph, options);
  const globalGovernance = await evaluateGlobalGovernance(
    globalContextGraph,
    globalPlan,
    globalContextGraph.repos.map((r) => ({ projectRoot: r.projectRoot, sdlcInsights: r.sdlcInsights }))
  );
  const globalDashboard = await buildGlobalDashboard(globalContextGraph, globalPlan, globalGovernance);
  return { globalContextGraph, globalPlan, globalGovernance, globalDashboard };
}

export async function startGlobalAutoExecutionOnce(
  projectRoots: string[],
  options: {
    skia?: SkiaFullAdapter;
    env?: NodeJS.ProcessEnv;
    structure?: ContextRetrievalStructureSource;
    skiarulesContext?: ForgeContextSkiarulesContext;
    passthroughHeaders?: Record<string, string>;
    maxGlobalCycles?: number;
    maxSessionSteps?: number;
    maxRetriesPerItem?: number;
    riskThreshold?: number;
    driftThreshold?: number;
    enableMetaOptimizationTick?: boolean;
    explicitBaselineTick?: boolean;
  }
): Promise<GlobalAutoExecutionResultV1> {
  return runGlobalAutoExecution(projectRoots, options);
}

export async function startGlobalSelfImprovementOnce(
  projectRoots: string[]
): Promise<GlobalSelfImprovementResultV1> {
  return runGlobalSelfImprovement(projectRoots);
}

export async function startGlobalConsolidationOnce(
  projectRoots: string[],
  options: { evolutionPhase?: "explore" | "exploit" | "stabilize" }
): Promise<GlobalConsolidationResultV1> {
  return runGlobalConsolidation(projectRoots, options);
}

export async function getGlobalStateSnapshotOnce(
  projectRoots: string[],
  options?: { emitAudit?: boolean }
): Promise<GlobalStateSnapshotV1> {
  return getGlobalStateSnapshot(projectRoots, options);
}

export async function getGlobalHistorySummaryOnce(
  projectRoots: string[],
  options?: { limit?: number }
): Promise<GlobalHistorySummaryV1> {
  return getGlobalHistorySummary(projectRoots, options);
}

export async function startGlobalEvolutionPolicyOnce(
  projectRoots: string[]
): Promise<GlobalEvolutionPolicyV1> {
  const state = await getGlobalStateSnapshot(projectRoots);
  return computeGlobalEvolutionPolicy(projectRoots, state);
}

export async function startGlobalHealthSurfaceOnce(
  projectRoots: string[]
): Promise<GlobalHealthSurfaceV1> {
  const state = await getGlobalStateSnapshot(projectRoots);
  const policy = await computeGlobalEvolutionPolicy(projectRoots, state);
  return buildGlobalHealthSurface(projectRoots, state, policy);
}

export async function startGlobalBaselineConsolidationOnce(
  projectRoots: string[],
  options?: { emitAudit?: boolean }
): Promise<GlobalBaselineConsolidationResultV1> {
  return runGlobalBaselineConsolidation(projectRoots, options);
}

export async function pauseGlobalEvolutionOnce(projectRoots: string[]): Promise<void> {
  return pauseGlobalEvolution(projectRoots);
}

export async function resumeGlobalEvolutionOnce(projectRoots: string[]): Promise<void> {
  return resumeGlobalEvolution(projectRoots);
}

export async function freezeAllHeuristicsOnce(projectRoots: string[]): Promise<void> {
  return freezeAllHeuristics(projectRoots);
}

export async function freezeAllStrategyProfilesOnce(projectRoots: string[]): Promise<void> {
  return freezeAllStrategyProfiles(projectRoots);
}

export async function enableAnalysisOnlyModeOnce(projectRoots: string[]): Promise<void> {
  return enableAnalysisOnlyMode(projectRoots);
}

export async function disableAnalysisOnlyModeOnce(projectRoots: string[]): Promise<void> {
  return disableAnalysisOnlyMode(projectRoots);
}

export async function triggerGlobalBaselineConsolidationOnce(projectRoots: string[]): Promise<void> {
  return triggerGlobalBaselineConsolidation(projectRoots);
}

export async function setGlobalRiskProfileOnce(
  projectRoots: string[],
  profile: GlobalRiskProfileV1
): Promise<void> {
  return setGlobalRiskProfile(projectRoots, profile);
}
