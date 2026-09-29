import assert from "node:assert/strict";
import test from "node:test";
import type { ProjectIndex } from "./types.js";

function stubIndex(): ProjectIndex {
  return {
    generatedAt: new Date().toISOString(),
    rootPath: process.cwd(),
    files: [],
    chunks: [
      {
        id: "1",
        filePath: "a.ts",
        language: "typescript",
        symbolName: "helloWorld",
        symbolType: "function",
        startLine: 1,
        endLine: 3,
        tokenCount: 10,
        content: "function helloWorld() {}",
        checksum: "x",
        updatedAt: new Date().toISOString()
      }
    ]
  };
}

test("ContextEngine.search uses lexical path when SKIA_EMBEDDING_VECTOR_PROVISIONED is false", async () => {
  const prev = process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED;
  process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED = "false";

  const { ContextEngine } = await import("./contextEngine.js");
  const engine = new ContextEngine(process.cwd());
  (engine as unknown as { index: ProjectIndex }).index = stubIndex();

  const hits = await engine.search("helloWorld", 5);
  assert.ok(hits.length >= 1);
  assert.ok(hits[0].score > 0);

  if (prev === undefined) delete process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED;
  else process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED = prev;
});

test("ContextEngine.search falls back to lexical when vector flag true but adapter unbound", async () => {
  const prev = process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED;
  process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED = "true";

  const { ContextEngine } = await import("./contextEngine.js");
  const engine = new ContextEngine(process.cwd());
  (engine as unknown as { index: ProjectIndex }).index = stubIndex();

  const hits = await engine.search("helloWorld", 5);
  assert.ok(hits.length >= 1);

  if (prev === undefined) delete process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED;
  else process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED = prev;
});

test("ContextEngine.search falls back to lexical when store empty (hybrid no hits)", async () => {
  const prev = process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED;
  process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED = "true";

  const { ContextEngine } = await import("./contextEngine.js");
  const engine = new ContextEngine(process.cwd());
  engine.bindSkiaFullAdapter({
    embedTextOrThrow: async () => ({ vector: [1, 0, 0, 0, 0, 0, 0, 0] })
  } as never);
  (engine as unknown as { index: ProjectIndex }).index = stubIndex();

  const hits = await engine.search("helloWorld", 5);
  assert.ok(hits.length >= 1);
  assert.ok(hits[0].score > 0);

  if (prev === undefined) delete process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED;
  else process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED = prev;
});

test("ContextEngine.search falls back to lexical when brain embed throws/times out", async () => {
  const prev = process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED;
  process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED = "true";

  const { ContextEngine } = await import("./contextEngine.js");
  const engine = new ContextEngine(process.cwd());
  engine.bindSkiaFullAdapter({
    embedTextOrThrow: async () => {
      throw new Error("brain embed timeout");
    }
  } as never);
  (engine as unknown as { index: ProjectIndex }).index = stubIndex();

  const hits = await engine.search("helloWorld", 5);
  assert.ok(hits.length >= 1);
  assert.ok(hits[0].score > 0);
  assert.equal(hits[0].chunk.symbolName, "helloWorld");

  if (prev === undefined) delete process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED;
  else process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED = prev;
});
