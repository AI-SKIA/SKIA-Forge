import { queryWorkItems, type WorkItemV1 } from "./workItemModel.js";

export type WorkGraphV1 = {
  nodes: WorkItemV1[];
  edges: Array<{ from: string; to: string; reason: "declared_dependency" | "inferred_file" | "drift_ordering" | "risk_ordering" }>;
  stronglyConnectedComponents: string[][];
  cycles: string[][];
  criticalPath: string[];
  parallelGroups: string[][];
  governanceWarnings: string[];
};

function buildAdj(ids: string[], edges: Array<{ from: string; to: string }>): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const id of ids) m.set(id, []);
  for (const e of edges) {
    const arr = m.get(e.from);
    if (arr && !arr.includes(e.to)) arr.push(e.to);
  }
  return m;
}

function tarjan(ids: string[], adj: Map<string, string[]>): string[][] {
  let index = 0;
  const indices = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const out: string[][] = [];
  const dfs = (v: string) => {
    indices.set(v, index);
    low.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!indices.has(w)) {
        dfs(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, indices.get(w)!));
      }
    }
    if (low.get(v) === indices.get(v)) {
      const scc: string[] = [];
      while (stack.length) {
        const w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
        if (w === v) break;
      }
      out.push(scc);
    }
  };
  for (const id of ids) if (!indices.has(id)) dfs(id);
  return out;
}

export async function buildWorkGraph(projectRoot: string): Promise<WorkGraphV1> {
  const nodes = await queryWorkItems(projectRoot, { limit: 500 });
  const idSet = new Set(nodes.map((n) => n.id));
  const edges: WorkGraphV1["edges"] = [];
  for (const n of nodes) {
    for (const d of n.dependencies) {
      if (idSet.has(d)) edges.push({ from: n.id, to: d, reason: "declared_dependency" });
    }
  }
  // Inferred dependency: overlap files/tests implies ordering by higher priority risk first.
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i]!;
      const b = nodes[j]!;
      const overlap =
        a.relatedFiles.some((f) => b.relatedFiles.includes(f)) ||
        a.relatedTests.some((t) => b.relatedTests.includes(t));
      if (!overlap) continue;
      if (a.sdlcSignals.risk >= b.sdlcSignals.risk) {
        edges.push({ from: b.id, to: a.id, reason: "inferred_file" });
      } else {
        edges.push({ from: a.id, to: b.id, reason: "inferred_file" });
      }
    }
  }
  // Drift/risk ordering hints
  const highDrift = nodes.filter((n) => n.sdlcSignals.drift >= 60);
  const highRisk = nodes.filter((n) => n.sdlcSignals.risk >= 70);
  for (const d of highDrift) {
    for (const n of nodes) {
      if (n.id !== d.id && !n.dependencies.includes(d.id)) {
        edges.push({ from: n.id, to: d.id, reason: "drift_ordering" });
      }
    }
  }
  for (const r of highRisk) {
    for (const n of nodes) {
      if (n.id !== r.id && n.sdlcSignals.risk < r.sdlcSignals.risk) {
        edges.push({ from: n.id, to: r.id, reason: "risk_ordering" });
      }
    }
  }
  const uniq = new Map<string, WorkGraphV1["edges"][number]>();
  for (const e of edges) uniq.set(`${e.from}->${e.to}:${e.reason}`, e);
  const dedup = [...uniq.values()].filter((e) => e.from !== e.to);
  const ids = nodes.map((n) => n.id);
  const adj = buildAdj(ids, dedup);
  const scc = tarjan(ids, adj);
  const cycles = scc.filter((x) => x.length > 1);
  const warnings = cycles.length ? [`Detected ${cycles.length} dependency cycle(s) in work graph.`] : [];
  // Approx critical path: greedy by in-degree, then risk
  const indeg = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const e of dedup) indeg.set(e.from, (indeg.get(e.from) ?? 0) + 1);
  const sorted = [...nodes].sort((a, b) => {
    const ia = indeg.get(a.id) ?? 0;
    const ib = indeg.get(b.id) ?? 0;
    if (ia !== ib) return ib - ia;
    return b.sdlcSignals.risk - a.sdlcSignals.risk;
  });
  const criticalPath = sorted.slice(0, Math.min(8, sorted.length)).map((n) => n.id);
  const parallelGroups: string[][] = [];
  const used = new Set<string>();
  for (const n of sorted) {
    if (used.has(n.id)) continue;
    const group = [n.id];
    used.add(n.id);
    for (const m of sorted) {
      if (used.has(m.id) || m.id === n.id) continue;
      const linked = dedup.some((e) => (e.from === n.id && e.to === m.id) || (e.from === m.id && e.to === n.id));
      if (!linked) {
        group.push(m.id);
        used.add(m.id);
      }
    }
    parallelGroups.push(group);
  }
  return {
    nodes,
    edges: dedup,
    stronglyConnectedComponents: scc,
    cycles,
    criticalPath,
    parallelGroups,
    governanceWarnings: warnings
  };
}
