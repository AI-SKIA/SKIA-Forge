import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { buildWorkGraph, type WorkGraphV1 } from "../work/workGraph.js";
import { buildWorkDashboard } from "../work/workDashboard.js";
import { buildSdlcInsightsBundle, type SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";
import { queryAutoMemory, type AutoMemoryEventV1 } from "../auto/autoMemory.js";

export type GlobalContextGraphV1 = {
  repos: Array<{
    projectRoot: string;
    workGraph: WorkGraphV1;
    sdlcInsights: SdlcInsightsBundleV2;
    roadmap: Awaited<ReturnType<typeof buildWorkDashboard>>["roadmap"];
    architectureHints: string[];
    autoMemoryPatterns: Record<string, number>;
  }>;
  nodes: Array<{ id: string; repo: string; kind: "workItem" | "sharedModule" | "sharedLibrary" }>;
  edges: Array<{ from: string; to: string; reason: string }>;
  sharedModules: string[];
  sharedLibraries: string[];
  globalHotspots: Array<{ path: string; score: number; repos: string[] }>;
  globalRiskPropagation: number;
  globalDriftPropagation: number;
  globalHotspotRanking: Array<{ path: string; score: number; repos: string[] }>;
  crossRepoCriticalPath: string[];
};
let latestGlobalContextGraph: GlobalContextGraphV1 | null = null;

export function getLatestGlobalContextGraphV1(): GlobalContextGraphV1 | null {
  return latestGlobalContextGraph;
}

function memPatternCounts(memory: AutoMemoryEventV1[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of memory) {
    const k = `${m.category}:${m.outcome}`;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function basename(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? p;
}

export async function buildGlobalContextGraph(
  projectRoots: string[],
  options?: { hotspotLimit?: number }
): Promise<GlobalContextGraphV1> {
  const roots = [...new Set(projectRoots)].filter(Boolean);
  const perRepo = await Promise.all(
    roots.map(async (projectRoot) => {
      const [workGraph, sdlcInsights, dashboard, memory] = await Promise.all([
        buildWorkGraph(projectRoot),
        buildSdlcInsightsBundle(projectRoot),
        buildWorkDashboard(projectRoot),
        queryAutoMemory(projectRoot, { limit: 800 })
      ]);
      return {
        projectRoot,
        workGraph,
        sdlcInsights,
        roadmap: dashboard.roadmap,
        architectureHints: dashboard.roadmap.architectureOptimizationHints ?? [],
        autoMemoryPatterns: memPatternCounts(memory)
      };
    })
  );
  const hotspotMap = new Map<string, { path: string; score: number; repos: Set<string> }>();
  const nodes: GlobalContextGraphV1["nodes"] = [];
  const edges: GlobalContextGraphV1["edges"] = [];
  const moduleRepoMap = new Map<string, Set<string>>();
  const libRepoMap = new Map<string, Set<string>>();
  for (const repo of perRepo) {
    const repoName = basename(repo.projectRoot);
    for (const n of repo.workGraph.nodes) {
      nodes.push({ id: `${repoName}:${n.id}`, repo: repo.projectRoot, kind: "workItem" });
      for (const dep of n.dependencies) {
        edges.push({ from: `${repoName}:${n.id}`, to: `${repoName}:${dep}`, reason: "intra_repo_dependency" });
      }
      for (const file of n.relatedFiles) {
        const key = file.toLowerCase();
        const set = moduleRepoMap.get(key) ?? new Set<string>();
        set.add(repo.projectRoot);
        moduleRepoMap.set(key, set);
        if (/node_modules|packages|libs|vendor/i.test(file)) {
          const ls = libRepoMap.get(key) ?? new Set<string>();
          ls.add(repo.projectRoot);
          libRepoMap.set(key, ls);
        }
      }
    }
    for (const h of repo.sdlcInsights.heuristics.hotspotFiles) {
      const prev = hotspotMap.get(h.path) ?? { path: h.path, score: 0, repos: new Set<string>() };
      prev.score += h.score;
      prev.repos.add(repo.projectRoot);
      hotspotMap.set(h.path, prev);
    }
  }
  const sharedModules = [...moduleRepoMap.entries()].filter(([, repos]) => repos.size > 1).map(([k]) => k).slice(0, 50);
  const sharedLibraries = [...libRepoMap.entries()].filter(([, repos]) => repos.size > 1).map(([k]) => k).slice(0, 50);
  for (const m of sharedModules) {
    const moduleNode = `shared:${m}`;
    nodes.push({ id: moduleNode, repo: "global", kind: "sharedModule" });
    for (const repo of moduleRepoMap.get(m) ?? []) {
      edges.push({ from: moduleNode, to: basename(repo), reason: "shared_module_presence" });
    }
  }
  const globalHotspotRanking = [...hotspotMap.values()]
    .map((x) => ({ path: x.path, score: Number(x.score.toFixed(3)), repos: [...x.repos] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, options?.hotspotLimit ?? 25);
  const globalRiskPropagation = Number(
    (
      perRepo.reduce((s, r) => s + r.sdlcInsights.heuristics.riskScore + r.sdlcInsights.forecast.globalNextFailureProbability * 0.2, 0) /
      Math.max(1, perRepo.length)
    ).toFixed(2)
  );
  const globalDriftPropagation = Number(
    (perRepo.reduce((s, r) => s + r.sdlcInsights.drift.score, 0) / Math.max(1, perRepo.length)).toFixed(2)
  );
  const crossRepoCriticalPath = perRepo.flatMap((r) => r.workGraph.criticalPath.map((x) => `${basename(r.projectRoot)}:${x}`)).slice(0, 25);
  const out: GlobalContextGraphV1 = {
    repos: perRepo,
    nodes,
    edges,
    sharedModules,
    sharedLibraries,
    globalHotspots: globalHotspotRanking,
    globalRiskPropagation,
    globalDriftPropagation,
    globalHotspotRanking,
    crossRepoCriticalPath
  };
  latestGlobalContextGraph = out;
  await appendAuditLog(roots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "global.contextGraph.build",
    parameters: mergeForgeAuditParamsV1("global_context_graph", {
      repoCount: roots.length,
      globalRiskPropagation,
      globalDriftPropagation,
      hotspotCount: globalHotspotRanking.length
    }),
    result: "success"
  });
  return out;
}
