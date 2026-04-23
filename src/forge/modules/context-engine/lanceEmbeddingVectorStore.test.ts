import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LanceEmbeddingVectorStore } from "./lanceEmbeddingVectorStore.js";

test(
  "LanceEmbeddingVectorStore: roundtrip replace, stats, search (cosine)",
  { skip: false },
  async (t) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-lance-"));
    const lancePath = path.join(root, "ldb");
    t.after(async () => {
      await fs.rm(root, { recursive: true, force: true });
    });
    const env = {
      EMBED_LANCE_URI: lancePath,
      SKIA_FULL_EMBED_DIM: "8"
    } as NodeJS.ProcessEnv;
    const store = new LanceEmbeddingVectorStore("/unused", env);
    const v = [1, 0, 0, 0, 0, 0, 0, 0].map((x) => x / 8);
    const chunk = {
      id: "c1",
      filePath: "a.ts",
      name: "f",
      kind: "function" as const,
      startLine: 1,
      endLine: 2,
      content: "function f(){}",
      tokenEstimate: 10
    };
    await store.replaceFileEmbeddings("a.ts", new Date().toISOString(), "ts", "m1", [
      { chunk, vector: v }
    ]);
    const st = await store.getStats();
    assert.equal(st.rowCount, 1);
    assert.ok(st.storePath.includes("ldb"));
    const hits = await store.searchByVector(v, 4, { bypassVectorIndex: true });
    assert.equal(hits.length, 1);
    assert.ok(hits[0]!.score > 0.9);
    assert.equal(hits[0]!.row.id, "c1");
    const withWhere = await store.searchByVector(v, 4, {
      where: "language = 'ts'",
      bypassVectorIndex: true
    });
    assert.equal(withWhere.length, 1);
    const emptyWhere = await store.searchByVector(v, 4, {
      where: "language = 'go'",
      bypassVectorIndex: true
    });
    assert.equal(emptyWhere.length, 0);
  }
);
