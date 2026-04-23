import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ContextEngine } from "./contextEngine.js";
import { handleRpcRequest } from "./rpc.js";
import { resetJavaScriptParserForTests } from "./forge/modules/context-engine/extractJavaScriptTreeSitter.js";

test("rpc returns invalid request for bad envelope", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-rpc-"));
  await fs.writeFile(path.join(root, "a.ts"), "export const a = 1;", "utf8");
  const engine = new ContextEngine(root);
  const response = await handleRpcRequest(root, engine, {
    method: "skia/search",
    params: { query: "a" }
  });
  if (!("error" in response)) {
    assert.fail("Expected rpc error");
  }
  assert.equal(response.error.code, -32600);
});

test("rpc skia/search succeeds for valid envelope", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-rpc-valid-"));
  await fs.writeFile(path.join(root, "a.ts"), "export const a = 1;", "utf8");
  const engine = new ContextEngine(root);
  await engine.buildIndex();
  const response = await handleRpcRequest(root, engine, {
    jsonrpc: "2.0",
    id: 1,
    method: "skia/search",
    params: { query: "export", topK: 2 }
  });
  if (!("result" in response)) {
    assert.fail("Expected rpc result");
  }
  assert.ok(Array.isArray((response.result as { results: unknown[] }).results));
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
