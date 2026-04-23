import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ContextEngine, chunkFile } from "./contextEngine.js";
import { resetJavaScriptParserForTests } from "./forge/modules/context-engine/extractJavaScriptTreeSitter.js";

const engines: ContextEngine[] = [];

test.afterEach(async () => {
  while (engines.length > 0) {
    const engine = engines.pop();
    if (engine) {
      await engine.stopIncrementalWatcher();
    }
  }
});

test("chunkFile creates chunks with metadata", () => {
  const code = [
    "export function alpha() {",
    "  return 1;",
    "}",
    "",
    "export class Beta {}"
  ].join("\n");
  const chunks = chunkFile("src/sample.ts", "typescript", code);
  assert.ok(chunks.length >= 1);
  assert.equal(chunks[0].filePath, "src/sample.ts");
  assert.ok(chunks[0].tokenCount > 0);
});

test("context engine respects .skiaignore and .gitignore", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-engine-"));
  await fs.writeFile(path.join(root, ".gitignore"), "ignored.ts\n", "utf8");
  await fs.writeFile(path.join(root, ".skiaignore"), "private.ts\n", "utf8");
  await fs.writeFile(path.join(root, "included.ts"), "export const ok = true;", "utf8");
  await fs.writeFile(path.join(root, "ignored.ts"), "export const no = true;", "utf8");
  await fs.writeFile(path.join(root, "private.ts"), "export const no2 = true;", "utf8");

  const engine = new ContextEngine(root);
  engines.push(engine);
  const index = await engine.buildIndex();
  const files = index.files.map((f) => f.path);

  assert.ok(files.includes("included.ts"));
  assert.ok(!files.includes("ignored.ts"));
  assert.ok(!files.includes("private.ts"));
});

test("context engine: reparseStructureFile populates D1-01 structure index", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-struct-r-"));
  await fs.writeFile(path.join(root, "manual.ts"), "export const a = 1;", "utf8");
  const engine = new ContextEngine(root);
  engines.push(engine);
  await engine.buildIndex();
  await engine.reparseStructureFile("manual.ts");
  const sum = engine.getStructureIndexSummary();
  assert.equal(sum.fileCount, 1);
  assert.ok(sum.paths.includes("manual.ts"));
  assert.ok(sum.maxParseDurationMs < 5_000, "single-file parse should stay well under 5s");
});

test("context engine: structure index updates on watcher add", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-struct-w-"));
  const engine = new ContextEngine(root);
  engines.push(engine);
  await engine.buildIndex();
  await engine.startIncrementalWatcher();
  await fs.writeFile(path.join(root, "watcher.ts"), "export function a() { return 1; }", "utf8");
  await new Promise((r) => setTimeout(r, 2_000));
  const sum = engine.getStructureIndexSummary();
  assert.ok(sum.fileCount >= 1, "expected at least one structurally indexed file from watcher add");
  assert.ok(sum.paths.some((p) => p === "watcher.ts"), `paths: ${sum.paths.join(", ")}`);
  assert.ok(sum.maxParseDurationMs < 5_000, "parse should stay well under 5s per file");
});

test.after(() => {
  resetJavaScriptParserForTests();
  const active = (process as unknown as { _getActiveHandles?: () => unknown[] })._getActiveHandles?.() ?? [];
  for (const h of active) {
    if (h === process.stdout || h === process.stderr || h === process.stdin) {
      continue;
    }
    const maybe = h as { close?: () => void; unref?: () => void };
    maybe.unref?.();
    maybe.close?.();
  }
});
