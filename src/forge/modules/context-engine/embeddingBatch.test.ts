import test from "node:test";
import assert from "node:assert/strict";
import { batchEmbedFileAndStore } from "./embeddingBatch.js";
import type { SemanticCodeChunk } from "./semanticChunking.js";
import type { EmbeddingVectorStore } from "./embeddingVectorStore.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";

test("batchEmbedFileAndStore clears file when 0 successful vectors (0 chunks)", async () => {
  const lastArgs: { itemsLen: number } = { itemsLen: -1 };
  const store: Pick<EmbeddingVectorStore, "replaceFileEmbeddings"> = {
    async replaceFileEmbeddings(_a, _b, _c, _d, items) {
      lastArgs.itemsLen = items.length;
    }
  };
  const skia = { embedTextOrThrow: async () => ({ vector: [1, 0], model: "m" }) } as unknown as SkiaFullAdapter;
  const r = await batchEmbedFileAndStore({
    relativePath: "x.ts",
    content: "",
    mtimeIso: new Date().toISOString(),
    chunks: [],
    skia,
    store: store as EmbeddingVectorStore
  });
  assert.equal(r.embedded, 0);
  assert.equal(lastArgs.itemsLen, 0);
});

test("batchEmbedFileAndStore clears when all embeds fail", async () => {
  const lastArgs: { itemsLen: number } = { itemsLen: -1 };
  const store: Pick<EmbeddingVectorStore, "replaceFileEmbeddings"> = {
    async replaceFileEmbeddings(_a, _b, _c, _d, items) {
      lastArgs.itemsLen = items.length;
    }
  };
  const ch: SemanticCodeChunk = {
    id: "c1",
    filePath: "x.ts",
    kind: "function",
    name: "a",
    startLine: 1,
    endLine: 1,
    content: "x",
    tokenEstimate: 1
  };
  const skia = {
    embedTextOrThrow: async () => {
      throw new Error("upstream");
    }
  } as unknown as SkiaFullAdapter;
  const r = await batchEmbedFileAndStore({
    relativePath: "x.ts",
    content: "a",
    mtimeIso: new Date().toISOString(),
    chunks: [ch],
    skia,
    store: store as EmbeddingVectorStore,
    minDelayMs: 0
  });
  assert.equal(r.embedded, 0);
  assert.equal(lastArgs.itemsLen, 0);
});
