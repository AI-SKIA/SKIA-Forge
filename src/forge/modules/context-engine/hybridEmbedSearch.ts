import { createEmbeddingVectorStore } from "./embeddingVectorStoreFactory.js";
import type { EmbeddingSearchOptions, EmbeddingStoreStats } from "./embeddingVectorStore.js";
import {
  candidateCountForTopK,
  readHybridRankEnv,
  rankVectorHitsHybrid
} from "./embedSearchRanking.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";

export function buildEmbedSearchTuningFromBodyAndEnv(
  body: {
    nprobes?: number;
    refineFactor?: number;
    where?: string;
    bypassVectorIndex?: boolean;
  },
  env: NodeJS.ProcessEnv
): EmbeddingSearchOptions | undefined {
  const np = body.nprobes;
  const envNp = parseInt(env.EMBED_LANCE_DEFAULT_NPROBES ?? "", 10);
  const nprobes =
    np != null
      ? np
      : Number.isFinite(envNp) && envNp > 0
        ? Math.floor(envNp)
        : undefined;
  const rf = body.refineFactor;
  const envRf = parseInt(env.EMBED_LANCE_DEFAULT_REFINE_FACTOR ?? "", 10);
  const refineFactor =
    rf != null
      ? rf
      : Number.isFinite(envRf) && envRf > 0
        ? Math.floor(envRf)
        : undefined;
  const where = body.where?.trim() || undefined;
  let bypassVectorIndex: boolean | undefined = body.bypassVectorIndex;
  if (bypassVectorIndex === undefined) {
    const b = (env.EMBED_LANCE_DEFAULT_BYPASS_INDEX ?? "").toLowerCase();
    if (b === "true" || b === "1" || b === "yes") {
      bypassVectorIndex = true;
    } else if (b === "false" || b === "0" || b === "no") {
      bypassVectorIndex = false;
    }
  }
  if (
    nprobes === undefined &&
    refineFactor === undefined &&
    where === undefined &&
    bypassVectorIndex === undefined
  ) {
    return undefined;
  }
  return {
    ...(nprobes !== undefined ? { nprobes } : {}),
    ...(refineFactor !== undefined ? { refineFactor } : {}),
    ...(where ? { where } : {}),
    ...(bypassVectorIndex !== undefined ? { bypassVectorIndex } : {})
  };
}

export type HybridHit = {
  score: number;
  vectorScore: number;
  structural: number;
  recency: number;
  filePath: string;
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
  preview: string;
};

export type HybridEmbedSearchResult =
  | {
      kind: "ok";
      topK: number;
      queryDim: number;
      candidateK: number;
      ranking: { mode: "hybrid-v1"; recencyHalfLifeDays: number };
      retrieval: EmbeddingSearchOptions | Record<string, never>;
      store: EmbeddingStoreStats;
      hits: HybridHit[];
    }
  | { kind: "empty_store"; store: EmbeddingStoreStats; message: string };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * D1-15: retries transient embed / store failures; empty index is not retried.
 */
export async function runHybridEmbedSearchWithRetry(
  projectRoot: string,
  query: string,
  topK: number,
  tuning: {
    nprobes?: number;
    refineFactor?: number;
    where?: string;
    bypassVectorIndex?: boolean;
  },
  skia: SkiaFullAdapter,
  env: NodeJS.ProcessEnv,
  options?: { maxAttempts?: number; delayMsBase?: number }
): Promise<HybridEmbedSearchResult | { kind: "transient_error"; lastError: string; store: EmbeddingStoreStats }> {
  const maxA = options?.maxAttempts ?? 3;
  const d0 = options?.delayMsBase ?? 40;
  const store0 = createEmbeddingVectorStore(projectRoot, env);
  const st0 = await store0.getStats();
  let lastErr = "";
  for (let attempt = 0; attempt < maxA; attempt++) {
    try {
      return await runHybridEmbedSearch(projectRoot, query, topK, tuning, skia, env);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    if (attempt < maxA - 1) {
      await sleep(d0 * (attempt + 1));
    }
  }
  return { kind: "transient_error", lastError: lastErr, store: st0 };
}

/**
 * D1-07: shared hybrid vector + structural + recency search (no HTTP, no index queue).
 */
export async function runHybridEmbedSearch(
  projectRoot: string,
  query: string,
  topK: number,
  tuning: {
    nprobes?: number;
    refineFactor?: number;
    where?: string;
    bypassVectorIndex?: boolean;
  },
  skia: SkiaFullAdapter,
  env: NodeJS.ProcessEnv
): Promise<HybridEmbedSearchResult> {
  const store = createEmbeddingVectorStore(projectRoot, env);
  const st = await store.getStats();
  if (st.rowCount === 0) {
    return {
      kind: "empty_store",
      store: st,
      message: "No indexed embeddings. POST /api/forge/context/embed/index first."
    };
  }
  const searchOpts = buildEmbedSearchTuningFromBodyAndEnv(tuning, env);
  const rankCfg = readHybridRankEnv(env);
  const candidateK = candidateCountForTopK(topK, rankCfg);
  const nowMs = Date.now();
  const { vector } = await skia.embedTextOrThrow(query);
  const pool = await store.searchByVector(vector, candidateK, searchOpts);
  const ranked = rankVectorHitsHybrid(query, pool, nowMs, rankCfg).slice(0, topK);
  return {
    kind: "ok",
    topK,
    queryDim: vector.length,
    candidateK,
    ranking: { mode: "hybrid-v1", recencyHalfLifeDays: rankCfg.recencyHalfLifeDays },
    retrieval: (searchOpts ?? {}) as EmbeddingSearchOptions | Record<string, never>,
    store: st,
    hits: ranked.map((h) => ({
      score: h.score,
      vectorScore: h.vectorScore,
      structural: h.structural,
      recency: h.recency,
      filePath: h.row.filePath,
      name: h.row.name,
      kind: h.row.kind,
      startLine: h.row.startLine,
      endLine: h.row.endLine,
      preview: h.row.contentPreview
    }))
  };
}
