import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import type { ContextRetrievalStructureSource, ForgeContextSkiarulesContext } from "../context-engine/contextRetrievalRequest.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";
import { runAutoExecutionSession } from "../auto/autoOrchestrator.js";
import { buildGlobalContextGraph } from "./globalContextGraph.js";
import { planGlobalWork } from "./globalPlanner.js";
import { evaluateGlobalGovernance } from "./globalGovernance.js";
import { buildGlobalDashboard } from "./globalDashboard.js";
import { runGlobalSelfImprovement } from "./globalSelfImprovement.js";
import { evolveGlobalStrategy } from "./globalStrategyEvolution.js";
import { runGlobalConsolidation } from "./globalConsolidation.js";
import { queryAutoMemory } from "../auto/autoMemory.js";
import { runGlobalMetaOptimization } from "./globalMetaOptimizer.js";
import { getGlobalStateSnapshot } from "./globalState.js";
import { computeGlobalEvolutionPolicy } from "./globalEvolutionPolicy.js";
import { runGlobalSafetyGateway } from "../safety/globalSafetyGateway.js";

export type GlobalAutoExecutionResultV1 = {
  status: "completed" | "halted" | "paused";
  cycles: number;
  perRepoResults: Array<{
    projectRoot: string;
    sessionId: string | null;
    status: "completed" | "aborted" | "paused";
    processedItems: string[];
    reason?: string;
  }>;
  reason: string;
};

function parseRepoOrder(projectRoots: string[], globalOrdering: string[]): string[] {
  const rank = new Map<string, number>();
  projectRoots.forEach((p, i) => rank.set(p, i + 1000));
  for (let i = 0; i < globalOrdering.length; i++) {
    const token = globalOrdering[i] ?? "";
    for (const root of projectRoots) {
      const repoName = root.replace(/\\/g, "/").split("/").at(-1) ?? root;
      if (token.startsWith(`${repoName}:`) && (rank.get(root) ?? 9999) > i) {
        rank.set(root, i);
      }
    }
  }
  return [...projectRoots].sort((a, b) => (rank.get(a) ?? 9999) - (rank.get(b) ?? 9999));
}

export async function runGlobalAutoExecution(
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
    safetyGatewayOptions?: Parameters<typeof runGlobalSafetyGateway>[2];
    repoKillSwitches?: Record<string, boolean>;
  }
): Promise<GlobalAutoExecutionResultV1> {
  const roots = [...new Set(projectRoots)].filter(Boolean);
  const maxGlobalCycles = Math.max(1, Math.min(20, options.maxGlobalCycles ?? 3));
  await appendAuditLog(roots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.auto.start",
    parameters: mergeForgeAuditParamsV1("global_auto", { repoCount: roots.length, maxGlobalCycles }),
    result: "success"
  });
  const perRepoResults: GlobalAutoExecutionResultV1["perRepoResults"] = [];
  for (let cycle = 1; cycle <= maxGlobalCycles; cycle++) {
    const preState = await getGlobalStateSnapshot(roots);
    const gateway = await runGlobalSafetyGateway(roots, preState, options.safetyGatewayOptions);
    if (gateway.gatewayStatus === "halt") {
      return {
        status: "halted",
        cycles: cycle,
        perRepoResults,
        reason: `safety gateway halted execution (${gateway.violatedSafetyRules.join(", ") || gateway.violatedPolicies.join(", ") || "unspecified"})`
      };
    }
    const analysisOnly = gateway.gatewayStatus === "analysisOnly";
    const prePolicy = await computeGlobalEvolutionPolicy(roots, preState);
    const globalContextGraph = await buildGlobalContextGraph(roots);
    const globalPlan = await planGlobalWork(globalContextGraph);
    const globalGovernance = await evaluateGlobalGovernance(
      globalContextGraph,
      globalPlan,
      globalContextGraph.repos.map((r) => ({ projectRoot: r.projectRoot, sdlcInsights: r.sdlcInsights }))
    );
    if (globalGovernance.governanceStatus === "failing") {
      await appendAuditLog(roots[0] ?? ".", {
        timestamp: new Date().toISOString(),
        action: "global.auto.complete",
        parameters: mergeForgeAuditParamsV1("global_auto", {
          cycles: cycle,
          reason: "global governance is failing"
        }),
        result: "failure"
      });
      return { status: "halted", cycles: cycle, perRepoResults, reason: "global governance is failing" };
    }
    if (
      globalContextGraph.globalRiskPropagation > (options.riskThreshold ?? 80) ||
      globalContextGraph.globalDriftPropagation > (options.driftThreshold ?? 80)
    ) {
      await appendAuditLog(roots[0] ?? ".", {
        timestamp: new Date().toISOString(),
        action: "global.auto.complete",
        parameters: mergeForgeAuditParamsV1("global_auto", {
          cycles: cycle,
          reason: "global risk/drift threshold exceeded"
        }),
        result: "failure"
      });
      return { status: "halted", cycles: cycle, perRepoResults, reason: "global risk/drift threshold exceeded" };
    }
    const orderedRepos = parseRepoOrder(roots, globalPlan.globalOrdering);
    for (const repoRoot of orderedRepos) {
      if (options.repoKillSwitches?.[repoRoot]) {
        perRepoResults.push({
          projectRoot: repoRoot,
          sessionId: null,
          status: "paused",
          processedItems: [],
          reason: "repo kill-switch enabled"
        });
        continue;
      }
      if (!analysisOnly && options.skia && options.env && options.structure) {
        const session = await runAutoExecutionSession(repoRoot, {
          skia: options.skia,
          env: options.env,
          structure: options.structure,
          skiarulesContext: options.skiarulesContext,
          passthroughHeaders: options.passthroughHeaders,
          maxSessionSteps: options.maxSessionSteps,
          maxRetriesPerItem: options.maxRetriesPerItem,
          selectionOptions: {
            maxItems: 4,
            riskThreshold: 20,
            includeBlocked: false,
            longHorizonPlan: null
          }
        });
        perRepoResults.push({
          projectRoot: repoRoot,
          sessionId: session.sessionId,
          status: session.status,
          processedItems: session.processedItems
        });
      } else {
        perRepoResults.push({
          projectRoot: repoRoot,
          sessionId: null,
          status: "paused",
          processedItems: [],
          reason: analysisOnly ? "analysis-only mode enforced" : "missing execution dependencies"
        });
      }
    }
    const globalDashboard = await buildGlobalDashboard(globalContextGraph, globalPlan, globalGovernance);
    const globalSelfImprovement = await runGlobalSelfImprovement(roots, { globalContextGraph, globalDashboard });
    const outcomeHistory = await Promise.all(
      roots.map(async (root) => {
        const mem = await queryAutoMemory(root, { limit: 200 });
        return mem
          .map((m) => ({
            projectRoot: root,
            overallOutcomeScore: Number((m.meta as { overallOutcomeScore?: number } | undefined)?.overallOutcomeScore ?? NaN)
          }))
          .filter((x) => Number.isFinite(x.overallOutcomeScore));
      })
    );
    const strategyEvolution = await evolveGlobalStrategy(
      roots,
      globalSelfImprovement.globalSelfImprovementPlan,
      globalContextGraph,
      outcomeHistory.flat()
    );
    const globalMetaOptimization = options.enableMetaOptimizationTick &&
      prePolicy.evolutionPhase !== "global_stabilize"
      ? await runGlobalMetaOptimization(roots)
      : null;
    const evolutionPhase =
      globalSelfImprovement.globalMetaStability >= 75 && globalSelfImprovement.globalMetaRisk <= 45
        ? "stabilize"
        : globalSelfImprovement.globalMetaEfficiency >= 65
          ? "exploit"
          : "explore";
    const consolidation =
      evolutionPhase === "stabilize"
        ? await runGlobalConsolidation(roots, {
            globalSelfImprovement,
            strategyEvolution,
            evolutionPhase
          })
        : null;
    if (options.explicitBaselineTick && prePolicy.evolutionPhase === "global_stabilize") {
      await runGlobalConsolidation(roots, {
        globalSelfImprovement,
        strategyEvolution,
        evolutionPhase: "stabilize"
      });
    }
    if (globalMetaOptimization?.globalMetaOptimizationSummary.globalEvolutionHealth.healthCategory === "critical") {
      await appendAuditLog(roots[0] ?? ".", {
        timestamp: new Date().toISOString(),
        action: "global.auto.complete",
        parameters: mergeForgeAuditParamsV1("global_auto", {
          cycles: cycle,
          reason: "global evolution health critical"
        }),
        result: "failure"
      });
      return { status: "halted", cycles: cycle, perRepoResults, reason: "global evolution health critical" };
    }
    await appendAuditLog(roots[0] ?? ".", {
      timestamp: new Date().toISOString(),
      action: "global.auto.tick",
      parameters: mergeForgeAuditParamsV1("global_auto", {
        cycle,
        gateway,
        orderedRepos,
        globalContextGraphSummary: {
          risk: globalContextGraph.globalRiskPropagation,
          drift: globalContextGraph.globalDriftPropagation
        },
        globalPlan,
        globalGovernance,
        globalDashboard,
        globalSelfImprovement,
        strategyEvolution,
        ...(globalMetaOptimization ? { globalMetaOptimization } : {}),
        ...(consolidation ? { consolidation } : {})
      }),
      result: "success"
    });
  }
  await appendAuditLog(roots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.auto.complete",
    parameters: mergeForgeAuditParamsV1("global_auto", {
      status: "completed",
      cycles: maxGlobalCycles,
      reposProcessed: roots.length
    }),
    result: "success"
  });
  return { status: "completed", cycles: maxGlobalCycles, perRepoResults, reason: "max global cycles reached" };
}
