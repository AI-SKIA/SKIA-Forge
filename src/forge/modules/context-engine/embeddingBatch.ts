import { detectLanguage } from "../../../utils.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";
import type { SemanticCodeChunk } from "./semanticChunking.js";
import type { EmbeddingVectorStore } from "./embeddingVectorStore.js";

const DEFAULT_MIN_DELAY_MS = 75;
const EMBED_MAX_CHARS = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type BatchEmbedFileResult = {
  path: string;
  embedded: number;
  errors: string[];
  model?: string;
};

/**
 * D1-03: rate-limited sequential embeds, then file-store persist (D1-04 file mode).
 */
export async function batchEmbedFileAndStore(options: {
  relativePath: string;
  content: string;
  mtimeIso: string;
  chunks: SemanticCodeChunk[];
  skia: SkiaFullAdapter;
  store: EmbeddingVectorStore;
  minDelayMs?: number;
}): Promise<BatchEmbedFileResult> {
  const { chunks, skia, store, minDelayMs = DEFAULT_MIN_DELAY_MS, mtimeIso, relativePath } = options;
  const errors: string[] = [];
  const items: { chunk: SemanticCodeChunk; vector: number[]; model?: string }[] = [];
  let lastModel: string | undefined;
  for (const chunk of chunks) {
    const text = chunk.content.slice(0, EMBED_MAX_CHARS);
    try {
      const { vector, model } = await skia.embedTextOrThrow(text);
      lastModel = model ?? lastModel;
      items.push({ chunk, vector, model });
    } catch (e) {
      errors.push(
        `chunk ${chunk.id}: ${e instanceof Error ? e.message : "error"}`
      );
    }
    if (minDelayMs > 0) {
      await sleep(minDelayMs);
    }
  }
  const language = detectLanguage(relativePath);
  if (items.length) {
    await store.replaceFileEmbeddings(relativePath, mtimeIso, language, lastModel, items);
  } else {
    /* D1-06: 0 chunks or all embeds failed — remove prior rows for this file in Lance / file store */
    await store.replaceFileEmbeddings(relativePath, mtimeIso, language, lastModel, []);
  }
  return { path: relativePath, embedded: items.length, errors, model: lastModel };
}
