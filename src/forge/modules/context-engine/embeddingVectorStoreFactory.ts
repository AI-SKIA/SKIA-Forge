import type { EmbeddingVectorStore } from "./embeddingVectorStore.js";
import { FileEmbeddingVectorStore } from "./vectorStoreFile.js";
import { LanceEmbeddingVectorStore } from "./lanceEmbeddingVectorStore.js";

/**
 * D1-04 — Select backing store (JSON file default, or LanceDB). Queue and request handlers
 * use `EmbeddingVectorStore` only; this is the single swap point.
 * `EMBED_VECTOR_STORE= file | lance ` (default `file`).
 * Lance path: `EMBED_LANCE_URI` or `<project>/.skia/lance-embeddings`.
 */
export function createEmbeddingVectorStore(
  projectRoot: string,
  env: NodeJS.ProcessEnv
): EmbeddingVectorStore {
  const m = (env.EMBED_VECTOR_STORE ?? "file").toLowerCase().replaceAll("-", "_");
  if (m === "lance" || m === "lancedb") {
    return new LanceEmbeddingVectorStore(projectRoot, env);
  }
  return new FileEmbeddingVectorStore(projectRoot);
}
