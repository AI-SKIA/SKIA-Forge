import assert from "node:assert/strict";
import test from "node:test";
import type { ProjectIndex } from "./types.js";
import { ContextEngine } from "./contextEngine.js";

const engines: ContextEngine[] = [];

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

async function closeEngines(): Promise<void> {
  while (engines.length) {
    const engine = engines.pop()!;
    await engine.stopIncrementalWatcher().catch(() => undefined);
    // Constructor starts skiarules watcher asynchronously — wait briefly then close.
    for (let i = 0; i < 50; i++) {
      const rules = (engine as unknown as { skiaRulesWatcher?: { close: () => Promise<void> } | null })
        .skiaRulesWatcher;
      if (rules) {
        await rules.close().catch(() => undefined);
        (engine as unknown as { skiaRulesWatcher: null }).skiaRulesWatcher = null;
        break;
      }
      await new Promise((r) => setTimeout(r, 20));
    }
  }
}

test.after(async () => {
  await closeEngines();
  // Match contextEngine.test.ts: drop leftover watcher timers so the suite can exit.
  const active = (process as unknown as { _getActiveHandles?: () => unknown[] })._getActiveHandles?.() ?? [];
  for (const h of active) {
    if (h === process.stdout || h === process.stderr || h === process.stdin) continue;
    const maybe = h as { close?: () => void; unref?: () => void };
    maybe.unref?.();
    maybe.close?.();
  }
});

test("ContextEngine.search uses lexical path when SKIA_EMBEDDING_VECTOR_PROVISIONED is false", async () => {
  const prev = process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED;
  process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED = "false";

  const engine = new ContextEngine(process.cwd());
  engines.push(engine);
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

  const engine = new ContextEngine(process.cwd());
  engines.push(engine);
  (engine as unknown as { index: ProjectIndex }).index = stubIndex();

  const hits = await engine.search("helloWorld", 5);
  assert.ok(hits.length >= 1);

  if (prev === undefined) delete process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED;
  else process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED = prev;
});

test("ContextEngine.search falls back to lexical when store empty (hybrid no hits)", async () => {
  const prev = process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED;
  process.env.SKIA_EMBEDDING_VECTOR_PROVISIONED = "true";

  const engine = new ContextEngine(process.cwd());
  engines.push(engine);
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

  const engine = new ContextEngine(process.cwd());
  engines.push(engine);
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
