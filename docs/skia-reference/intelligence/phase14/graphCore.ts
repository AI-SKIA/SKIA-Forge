export type GraphNodeType = "concept" | "file" | "tool" | "task" | "decision";

export type GraphEdgeType = "relationship" | "dependency";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  type: GraphEdgeType;
  from: string;
  to: string;
  metadata?: Record<string, unknown>;
}

export interface IntelligenceGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
}

export function createGraph(): IntelligenceGraph {
  // TODO: Add persistence and indexing strategy for larger graph sizes.
  return {
    nodes: new Map<string, GraphNode>(),
    edges: new Map<string, GraphEdge>(),
  };
}

export function addNode(graph: IntelligenceGraph, node: GraphNode): void {
  // TODO: Add validation for duplicate IDs and schema constraints.
  graph.nodes.set(node.id, node);
}

export function addEdge(graph: IntelligenceGraph, edge: GraphEdge): void {
  // TODO: Validate node existence and prevent invalid edge cycles if needed.
  graph.edges.set(edge.id, edge);
}
