import type { IntelligenceGraph } from "./graphCore";

export interface GraphViewModel {
  graphId: string;
  nodeCount: number;
  edgeCount: number;
}

export function createVisualExplorer(_graph: IntelligenceGraph): GraphViewModel {
  // TODO: Build data mapping for a full visual exploration interface.
  return {
    graphId: "graph-explorer-stub",
    nodeCount: 0,
    edgeCount: 0,
  };
}

export function createInteractiveReasoningMap(
  _graph: IntelligenceGraph,
): GraphViewModel {
  // TODO: Provide interaction primitives for reasoning map navigation.
  return {
    graphId: "reasoning-map-stub",
    nodeCount: 0,
    edgeCount: 0,
  };
}
