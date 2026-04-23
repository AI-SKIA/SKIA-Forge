import { z } from "zod";

/**
 * Locked contract for SKIA-FULL `POST /api/skia/embedding` (D1-03).
 * Request: `input` is canonical; `text` is duplicated for older gateways that expect `text`.
 * Response: `embedding` or `vector` (or nested `data.embedding`).
 */
export const SKIA_FULL_EMBEDDING_PATH_DEFAULT = "/api/skia/embedding";
export const SKIA_FULL_EMBED_DIM_DEFAULT = 1536;

export const skiaFullEmbeddingRequestBodySchema = z.object({
  input: z.string().min(1),
  text: z.string().min(1).optional(),
  source: z.string().optional(),
  model: z.string().optional()
});

export const skiaFullEmbeddingResponseSchema = z.union([
  z.object({
    embedding: z.array(z.number()),
    model: z.string().optional(),
    dimensions: z.number().int().optional()
  }),
  z.object({ vector: z.array(z.number()) }),
  z.object({
    data: z.object({ embedding: z.array(z.number()) })
  })
]);

export function buildSkiaFullEmbeddingRequestRecord(input: {
  text: string;
  source?: string;
  model?: string;
}): Record<string, unknown> {
  const t = input.text;
  return {
    input: t,
    text: t,
    source: input.source ?? "skia-forge",
    ...(input.model ? { model: input.model } : {})
  };
}

export function parseSkiaFullEmbeddingVector(data: unknown): {
  vector: number[];
  model?: string;
} | null {
  const p = skiaFullEmbeddingResponseSchema.safeParse(data);
  if (p.success) {
    if ("data" in p.data) {
      return { vector: p.data.data.embedding };
    }
    if ("embedding" in p.data) {
      return { vector: p.data.embedding, model: p.data.model };
    }
    return { vector: p.data.vector };
  }
  if (data && typeof data === "object") {
    const r = data as Record<string, unknown>;
    const emb = r.embedding;
    if (Array.isArray(emb) && emb.every((x) => typeof x === "number")) {
      return { vector: emb, model: typeof r.model === "string" ? r.model : undefined };
    }
  }
  return null;
}
