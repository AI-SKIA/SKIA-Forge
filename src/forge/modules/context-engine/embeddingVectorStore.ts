import type { SemanticCodeChunk } from "./semanticChunking.js";
import type { StoredEmbeddingRow } from "./vectorStoreFile.js";

/** D1-03 — Per-query retrieval tuning (LanceDB ANN + hybrid filters; JSON file store may ignore). */
export type EmbeddingSearchOptions = {
  nprobes?: number;
  refineFactor?: number;
  /** SQL predicate on scalar columns (e.g. `language = 'ts' AND kind = 'function'`) */
  where?: string;
  /** If true, exhaustive vector scan; if false, use ANN index when present */
  bypassVectorIndex?: boolean;
};

export type EmbeddingStoreStats = {
  rowCount: number;
  storePath: string;
  updatedAt: string;
  lanceVectorIndex?: { type: string; present: boolean };
};

/**
 * D1-02+ — Persists and queries embeddings. Implemented by the file store today;
 * LanceDB (or any backend) can swap in without changing queue / batch call sites.
 */
export type EmbeddingVectorStore = {
  get storePath(): string;
  replaceFileEmbeddings(
    filePathRel: string,
    mtimeIso: string,
    language: string,
    model: string | undefined,
    items: { chunk: SemanticCodeChunk; vector: number[] }[]
  ): Promise<void>;
  getStats(): Promise<EmbeddingStoreStats>;
  searchByVector(
    queryVector: number[],
    topK: number,
    options?: EmbeddingSearchOptions
  ): Promise<{ row: StoredEmbeddingRow; score: number }[]>;
};
