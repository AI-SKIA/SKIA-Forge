import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";
import { runHybridEmbedSearch } from "./hybridEmbedSearch.js";

export type EmbedSearchRequestBody = {
  query?: string;
  topK?: number;
  nprobes?: number;
  refineFactor?: number;
  where?: string;
  bypassVectorIndex?: boolean;
};

/**
 * POST /api/forge/context/embed/search — D1-03: optional nprobes, refineFactor, `where`, bypass (Lance ANN + hybrid)
 */
export async function runEmbedSearchRequest(
  projectRoot: string,
  body: EmbedSearchRequestBody,
  skia: SkiaFullAdapter,
  env: NodeJS.ProcessEnv
): Promise<{ status: number; result: unknown }> {
  const query = String(body.query ?? "").trim();
  if (!query) {
    return { status: 400, result: { error: "Missing query string." } };
  }
  const topK = Number.isFinite(body.topK) ? Math.min(50, Math.max(1, body.topK as number)) : 8;
  try {
    const r = await runHybridEmbedSearch(
      projectRoot,
      query,
      topK,
      {
        nprobes: body.nprobes,
        refineFactor: body.refineFactor,
        where: body.where,
        bypassVectorIndex: body.bypassVectorIndex
      },
      skia,
      env
    );
    if (r.kind === "empty_store") {
      return {
        status: 200,
        result: { hits: [], message: r.message, store: r.store }
      };
    }
    return {
      status: 200,
      result: {
        topK: r.topK,
        queryDim: r.queryDim,
        candidateK: r.candidateK,
        ranking: r.ranking,
        retrieval: r.retrieval,
        hits: r.hits,
        store: r.store
      }
    };
  } catch (e) {
    return {
      status: 502,
      result: { error: e instanceof Error ? e.message : "Embedding query failed" }
    };
  }
}
