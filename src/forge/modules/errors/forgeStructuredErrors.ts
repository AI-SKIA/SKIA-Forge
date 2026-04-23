/**
 * D1-14: stable internal error shapes (no HTTP contract).
 * D1-15: extended stages for L3 / Lance / embed without breaking existing consumers.
 */
export type ForgeStructuredError = {
  stage:
    | "vector_store"
    | "context_retrieval"
    | "semantic_search"
    | "lance"
    | "planner"
    | "executor";
  code: string;
  message: string;
  cause?: string;
};

export function vectorStoreFailure(
  message: string,
  cause?: string
): ForgeStructuredError {
  return { stage: "vector_store", code: "vector_store", message, cause };
}

export function semanticSearchFailure(
  message: string,
  code: string = "semantic_search",
  cause?: string
): ForgeStructuredError {
  return { stage: "semantic_search", code, message, cause };
}

export function lanceOperationFailure(
  message: string,
  code: string = "lance_io",
  cause?: string
): ForgeStructuredError {
  return { stage: "lance", code, message, cause };
}

export function contextRetrievalFailure(
  message: string,
  code: string = "context_retrieval",
  cause?: string
): ForgeStructuredError {
  return { stage: "context_retrieval", code, message, cause };
}

export function plannerFailure(
  message: string,
  cause?: string
): ForgeStructuredError {
  return { stage: "planner", code: "planner", message, cause };
}

export function executorFailure(
  message: string,
  cause?: string
): ForgeStructuredError {
  return { stage: "executor", code: "executor", message, cause };
}
