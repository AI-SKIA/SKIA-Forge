import { detectLanguage } from "../../../utils.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";
import { createEmbeddingVectorStore } from "./embeddingVectorStoreFactory.js";
import { indexOneFile } from "./embedIndexRequest.js";
import type { EmbedIndexQueue } from "./embedIndexQueue.js";
import { EmbedIndexQueueBackpressureError } from "./embedIndexQueue.js";
import type { EmbeddingVectorStore } from "./embeddingVectorStore.js";

export type IncrementalEmbedOnSaveHook = {
  onFileChange: (relPosix: string) => void;
  onFileUnlink: (relPosix: string) => void;
};

/**
 * D1-06: file-save → re-parse (structure, already in ContextEngine) → re-chunk → re-embed →
 * `replaceFileEmbeddings` (Lance deletes by filePath + append; drops removed chunks). Same queue as HTTP.
 */
export function createEmbedIncrementalOnSaveHandler(options: {
  projectRoot: string;
  env: NodeJS.ProcessEnv;
  skia: SkiaFullAdapter;
  queue: EmbedIndexQueue;
  isPathIgnored: (relPosix: string) => boolean;
}): IncrementalEmbedOnSaveHook {
  const { projectRoot, env, skia, queue, isPathIgnored } = options;
  const store: EmbeddingVectorStore = createEmbeddingVectorStore(projectRoot, env);
  const debounceMs = Math.max(0, parseInt(env.EMBED_INCREMENTAL_DEBOUNCE_MS ?? "400", 10) || 400);
  const rawMin = env.EMBED_INCREMENTAL_MIN_DELAY_MS;
  const minDelayMs =
    rawMin != null && rawMin !== "" && Number.isFinite(parseInt(rawMin, 10))
      ? Math.max(0, parseInt(rawMin, 10))
      : undefined;
  const debounceByPath = new Map<string, ReturnType<typeof setTimeout>>();

  const safeEnqueue = (label: string, work: () => Promise<unknown>): void => {
    try {
      queue.enqueueAsync(work);
    } catch (e) {
      if (e instanceof EmbedIndexQueueBackpressureError) {
        process.emitWarning(
          `[embed incremental] queue backpressure (${label}); ${e.message}`,
          { code: "SKIA_EMBED_INCREMENTAL" }
        );
        return;
      }
      throw e;
    }
  };

  const clearEmbeddingsForPath = (relPosix: string): void => {
    const mtimeIso = new Date().toISOString();
    const language = detectLanguage(relPosix);
    safeEnqueue(`clear:${relPosix}`, async () => {
      await store.replaceFileEmbeddings(relPosix, mtimeIso, language, undefined, []);
    });
  };

  const runIndex = (relPosix: string): void => {
    safeEnqueue(`index:${relPosix}`, async () => {
      await indexOneFile(projectRoot, relPosix, minDelayMs, skia, store, env);
    });
  };

  return {
    onFileChange(relPosix: string) {
      if (isPathIgnored(relPosix)) {
        clearEmbeddingsForPath(relPosix);
        return;
      }
      if (debounceMs === 0) {
        runIndex(relPosix);
        return;
      }
      const prev = debounceByPath.get(relPosix);
      if (prev) {
        clearTimeout(prev);
      }
      debounceByPath.set(
        relPosix,
        setTimeout(() => {
          debounceByPath.delete(relPosix);
          runIndex(relPosix);
        }, debounceMs)
      );
    },
    onFileUnlink(relPosix: string) {
      const t = debounceByPath.get(relPosix);
      if (t) {
        clearTimeout(t);
        debounceByPath.delete(relPosix);
      }
      clearEmbeddingsForPath(relPosix);
    }
  };
}
