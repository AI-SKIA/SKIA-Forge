import express from "express";
import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { buildArchitectureGraph } from "./architectureGraph.js";
import { buildArchitectureAdvice } from "./architectureAdvisor.js";
import { detectArchitectureDrift, saveBaseline } from "./driftDetector.js";
import type { SkiarulesFileDiagnostics } from "../skiarules/architectureDiagnostics.js";

export function createArchitectureRouter(options: {
  projectRoot: string;
  getStructurePaths: () => string[];
  getDiagnosticsForPath: (relPath: string) => Promise<SkiarulesFileDiagnostics>;
}): express.Router {
  const router = express.Router();

  router.get("/graph", async (_req, res) => {
    const graph = await buildArchitectureGraph(options.projectRoot, options.getStructurePaths());
    res.json(graph);
  });

  router.post("/analyze", async (_req, res) => {
    const graph = await buildArchitectureGraph(options.projectRoot, options.getStructurePaths());
    const drift = await detectArchitectureDrift(options.projectRoot, graph);
    await saveBaseline(options.projectRoot, graph);
    await appendAuditLog(options.projectRoot, {
      timestamp: new Date().toISOString(),
      action: "architecture.analyze",
      parameters: mergeForgeAuditParamsV1("architecture_analyzer", {
        graphSummary: { nodes: graph.nodes.length, edges: graph.edges.length },
        drift
      }),
      result: "success"
    });
    res.json({ graph, drift });
  });

  router.get("/advice", async (_req, res) => {
    const graph = await buildArchitectureGraph(options.projectRoot, options.getStructurePaths());
    const drift = await detectArchitectureDrift(options.projectRoot, graph);
    const paths = options.getStructurePaths().slice(0, 200);
    const diagnostics = await Promise.all(paths.map((p) => options.getDiagnosticsForPath(p)));
    const advice = buildArchitectureAdvice(graph, drift, diagnostics);
    res.json({ count: advice.length, advice });
  });

  return router;
}

