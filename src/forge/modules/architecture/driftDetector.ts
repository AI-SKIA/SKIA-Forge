import fs from "node:fs/promises";
import path from "node:path";
import type { ArchitectureGraphV1 } from "./architectureGraph.js";

const BASELINE_PATH = path.join(".skia", "architecture-baseline-v1.json");

export type ArchitectureDriftV1 = {
  addedDependencies: Array<{ from: string; to: string }>;
  removedDependencies: Array<{ from: string; to: string }>;
  couplingRegressions: Array<{ module: string; previous: number; current: number }>;
};

function edgeKey(edge: { from: string; to: string }): string {
  return `${edge.from}=>${edge.to}`;
}

async function loadBaseline(projectRoot: string): Promise<ArchitectureGraphV1 | null> {
  try {
    const raw = await fs.readFile(path.join(projectRoot, BASELINE_PATH), "utf8");
    return JSON.parse(raw) as ArchitectureGraphV1;
  } catch {
    return null;
  }
}

export async function saveBaseline(projectRoot: string, graph: ArchitectureGraphV1): Promise<void> {
  const abs = path.join(projectRoot, BASELINE_PATH);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, JSON.stringify(graph, null, 2), "utf8");
}

export async function detectArchitectureDrift(
  projectRoot: string,
  current: ArchitectureGraphV1
): Promise<ArchitectureDriftV1> {
  const baseline = await loadBaseline(projectRoot);
  if (!baseline) {
    return { addedDependencies: [], removedDependencies: [], couplingRegressions: [] };
  }
  const currentEdges = new Map(current.edges.map((x) => [edgeKey(x), x]));
  const baselineEdges = new Map(baseline.edges.map((x) => [edgeKey(x), x]));
  const addedDependencies = [...currentEdges.entries()]
    .filter(([k]) => !baselineEdges.has(k))
    .map(([, v]) => v);
  const removedDependencies = [...baselineEdges.entries()]
    .filter(([k]) => !currentEdges.has(k))
    .map(([, v]) => v);
  const baselineNode = new Map(baseline.nodes.map((x) => [x.module, x]));
  const couplingRegressions = current.nodes
    .map((node) => {
      const prev = baselineNode.get(node.module);
      if (!prev) return null;
      if (node.couplingScore <= prev.couplingScore) return null;
      return { module: node.module, previous: prev.couplingScore, current: node.couplingScore };
    })
    .filter((x): x is { module: string; previous: number; current: number } => x != null);
  return { addedDependencies, removedDependencies, couplingRegressions };
}

