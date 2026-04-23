import assert from "node:assert/strict";
import test from "node:test";
import { createEmbeddingVectorStore } from "./embeddingVectorStoreFactory.js";
import { FileEmbeddingVectorStore } from "./vectorStoreFile.js";
import { LanceEmbeddingVectorStore } from "./lanceEmbeddingVectorStore.js";

test("createEmbeddingVectorStore: file default", () => {
  const s = createEmbeddingVectorStore("C:/proj", {} as NodeJS.ProcessEnv);
  assert.ok(s instanceof FileEmbeddingVectorStore);
});

test("createEmbeddingVectorStore: lance when EMBED_VECTOR_STORE=lance", () => {
  const s = createEmbeddingVectorStore("C:/proj", {
    EMBED_VECTOR_STORE: "lance"
  } as NodeJS.ProcessEnv);
  assert.ok(s instanceof LanceEmbeddingVectorStore);
});
