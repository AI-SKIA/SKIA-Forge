import fs from "node:fs/promises";
import { batchEmbedFileAndStore } from "./embeddingBatch.js";
import type { EmbeddingVectorStore } from "./embeddingVectorStore.js";
import { extractStructuralSymbols } from "./extractStructuralSymbols.js";
import { buildSemanticChunksFromStructure } from "./semanticChunking.js";
import { assertSafeRelativeProjectPath } from "./safeProjectPath.js";
import { createEmbeddingVectorStore } from "./embeddingVectorStoreFactory.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";
import type { EmbedIndexQueue } from "./embedIndexQueue.js";
import { EmbedIndexQueueBackpressureError } from "./embedIndexQueue.js";

const DEFAULT_MAX_CHUNKS_PER_FILE = 50_000;
const DEFAULT_SYNC_MAX_CHUNKS = 2_000;

function maxChunksPerFile(env: NodeJS.ProcessEnv): number {
  const n = parseInt(env.EMBED_MAX_CHUNKS_PER_FILE ?? String(DEFAULT_MAX_CHUNKS_PER_FILE), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_CHUNKS_PER_FILE;
}

function syncMaxChunks(env: NodeJS.ProcessEnv): number {
  const n = parseInt(env.EMBED_SYNC_MAX_CHUNKS ?? String(DEFAULT_SYNC_MAX_CHUNKS), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_SYNC_MAX_CHUNKS;
}

export type EmbedIndexRequestBody = {
  path?: string;
  paths?: string[];
  minDelayMs?: number;
  /** Prefer async (202) when combined with heuristics */
  async?: boolean;
};

function normalizePaths(body: EmbedIndexRequestBody): string[] {
  if (body.paths && body.paths.length > 0) {
    return dedupeOrder(body.paths);
  }
  if (body.path && body.path.length > 0) {
    return [body.path];
  }
  return [];
}

function dedupeOrder(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    const t = p.trim();
    if (!t || seen.has(t)) {
      continue;
    }
    seen.add(t);
    out.push(t);
  }
  return out;
}

type OneFileResult = {
  path: string;
  chunkCount: number;
  embedded: number;
  errors: string[];
  model?: string;
  error?: string;
};

/** D1-06: shared by POST /embed/index and file-save incremental pipeline. */
export async function indexOneFile(
  projectRoot: string,
  rel: string,
  minDelayMs: number | undefined,
  skia: SkiaFullAdapter,
  store: EmbeddingVectorStore,
  env: NodeJS.ProcessEnv
): Promise<OneFileResult> {
  const check = assertSafeRelativeProjectPath(projectRoot, rel);
  if (!check.ok) {
    return { path: rel, chunkCount: 0, embedded: 0, errors: [check.error], error: check.error };
  }
  let st: Awaited<ReturnType<typeof fs.stat>>;
  let content: string;
  try {
    st = await fs.stat(check.absPath);
    if (!st.isFile()) {
      return { path: rel, chunkCount: 0, embedded: 0, errors: ["Path is not a file."], error: "Path is not a file." };
    }
    content = await fs.readFile(check.absPath, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return { path: rel, chunkCount: 0, embedded: 0, errors: ["File not found."], error: "File not found." };
    }
    return { path: rel, chunkCount: 0, embedded: 0, errors: ["Failed to read file."], error: "Failed to read file." };
  }
  const { engine, symbols } = extractStructuralSymbols(check.relPosix, content);
  if (engine === "unsupported") {
    return {
      path: rel,
      chunkCount: 0,
      embedded: 0,
      errors: ["File type not supported for structural/semantic pipeline."],
      error: "File type not supported for structural/semantic pipeline."
    };
  }
  const chunks = buildSemanticChunksFromStructure(check.relPosix, content, symbols);
  const cap = maxChunksPerFile(env);
  if (chunks.length > cap) {
    return {
      path: rel,
      chunkCount: chunks.length,
      embedded: 0,
      errors: [`Chunk count ${chunks.length} exceeds per-file cap ${cap}.`],
      error: `Chunk count ${chunks.length} exceeds per-file cap ${cap}.`
    };
  }
  const r = await batchEmbedFileAndStore({
    relativePath: check.relPosix,
    content,
    mtimeIso: st.mtime.toISOString(),
    chunks,
    skia,
    store,
    minDelayMs
  });
  return { path: rel, chunkCount: chunks.length, embedded: r.embedded, errors: r.errors, model: r.model };
}

/**
 * POST /api/forge/context/embed/index — single file, small runs may block (200);
 * multi-file or very large chunk counts return 202 with jobId; backpressure 429.
 */
export async function runEmbedIndexRequest(
  projectRoot: string,
  body: EmbedIndexRequestBody,
  skia: SkiaFullAdapter,
  queue: EmbedIndexQueue,
  env: NodeJS.ProcessEnv
): Promise<{ status: number; result: unknown }> {
  const paths = normalizePaths(body);
  if (paths.length === 0) {
    return { status: 400, result: { error: "path or paths (non-empty) is required." } };
  }
  const minDelayMs = Number.isFinite(body.minDelayMs) ? Math.max(0, body.minDelayMs as number) : undefined;
  const store = createEmbeddingVectorStore(projectRoot, env);
  const smax = syncMaxChunks(env);
  const preferAsync = body.async === true;

  const runMany = async () => {
    const results: OneFileResult[] = [];
    for (const rel of paths) {
      results.push(await indexOneFile(projectRoot, rel, minDelayMs, skia, store, env));
    }
    const stats = await store.getStats();
    const totalEmbedded = results.reduce((a, b) => a + b.embedded, 0);
    return { results, store: stats, totalEmbedded, files: paths.length };
  };

  if (paths.length > 1 || preferAsync) {
    try {
      const jobId = queue.enqueueAsync(runMany);
      return {
        status: 202,
        result: {
          status: "queued",
          jobId,
          files: paths.length,
          message:
            "Embedding job accepted. Poll GET /api/forge/context/embed/jobs/:jobId until state is succeeded or failed."
        }
      };
    } catch (e) {
      if (e instanceof EmbedIndexQueueBackpressureError) {
        return {
          status: 429,
          result: {
            error: e.message,
            code: e.code,
            depth: e.depth,
            maxQueued: e.maxQueued,
            retryAfterSec: 5
          }
        };
      }
      throw e;
    }
  }

  // Single file: inspect chunk count to decide async when too large
  const only = paths[0]!;
  const check = assertSafeRelativeProjectPath(projectRoot, only);
  if (!check.ok) {
    return { status: 400, result: { error: check.error } };
  }
  let content: string;
  try {
    const st = await fs.stat(check.absPath);
    if (!st.isFile()) {
      return { status: 400, result: { error: "Path is not a file." } };
    }
    content = await fs.readFile(check.absPath, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: 404, result: { error: "File not found." } };
    }
    return { status: 500, result: { error: "Failed to read file." } };
  }
  const { engine, symbols } = extractStructuralSymbols(check.relPosix, content);
  if (engine === "unsupported") {
    return { status: 422, result: { error: "File type not supported for structural/semantic pipeline." } };
  }
  const chunks = buildSemanticChunksFromStructure(check.relPosix, content, symbols);
  if (chunks.length > maxChunksPerFile(env)) {
    return {
      status: 400,
      result: { error: `Chunk count ${chunks.length} exceeds per-file cap ${maxChunksPerFile(env)}.` }
    };
  }
  if (chunks.length > smax) {
    try {
      const jobId = queue.enqueueAsync(runMany);
      return {
        status: 202,
        result: {
          status: "queued",
          jobId,
          chunkCount: chunks.length,
          reason: "chunk_count_exceeds_sync_limit",
          syncMaxChunks: smax,
          message: `Job queued: ${chunks.length} chunks > sync limit ${smax}. Poll GET /api/forge/context/embed/jobs/:jobId.`
        }
      };
    } catch (e) {
      if (e instanceof EmbedIndexQueueBackpressureError) {
        return {
          status: 429,
          result: {
            error: e.message,
            code: e.code,
            depth: e.depth,
            maxQueued: e.maxQueued,
            retryAfterSec: 5
          }
        };
      }
      throw e;
    }
  }

  // Sync path: wait in queue
  try {
    const r = (await queue.runWaiting(async () =>
      indexOneFile(projectRoot, only, minDelayMs, skia, store, env)
    )) as OneFileResult;
    const stats = await store.getStats();
    if (r.error) {
      if (r.error === "File not found.") {
        return { status: 404, result: { ...r, store: stats, mode: "sync" } };
      }
      if (r.error === "File type not supported for structural/semantic pipeline.") {
        return { status: 422, result: { ...r, store: stats, mode: "sync" } };
      }
      if (r.error.includes("exceeds per-file cap")) {
        return { status: 400, result: { ...r, store: stats, mode: "sync" } };
      }
      return { status: 400, result: { ...r, store: stats, mode: "sync" } };
    }
    return {
      status: 200,
      result: { ...r, store: stats, mode: "sync" }
    };
  } catch (e) {
    if (e instanceof EmbedIndexQueueBackpressureError) {
      return {
        status: 429,
        result: {
          error: e.message,
          code: e.code,
          depth: e.depth,
          maxQueued: e.maxQueued,
          retryAfterSec: 5
        }
      };
    }
    return { status: 500, result: { error: e instanceof Error ? e.message : "index failed" } };
  }
}
