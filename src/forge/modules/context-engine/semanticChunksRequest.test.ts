import assert from "node:assert/strict";
import test from "node:test";
import { SkiaFullAdapter } from "../../../skiaFullAdapter.js";
import { runForgeContextSemanticChunks } from "./semanticChunksRequest.js";

const disabled = new SkiaFullAdapter({
  enabled: false,
  baseUrl: "https://example.com",
  timeoutMs: 1000,
  allowLocalFallback: false,
  brainOnly: true
});

test("semantic chunks: 200 with chunks for ts, embed null", async () => {
  const src = 'import "node:fs";\nexport function f() { return 1; }\n';
  const r = await runForgeContextSemanticChunks(
    "C:/p",
    "a.ts",
    async () => src,
    disabled,
    false
  );
  assert.equal(r.status, 200);
  const b = r.body as { chunkCount: number; embed: unknown; engine: string };
  assert.equal(b.engine, "typescript");
  assert.ok(b.chunkCount >= 1);
  assert.equal(b.embed, null);
});

test("semantic chunks: 422 for unsupported extension", async () => {
  const r = await runForgeContextSemanticChunks(
    "C:/p",
    "a.py",
    async () => "x=1",
    disabled,
    false
  );
  assert.equal(r.status, 422);
});

test("semantic chunks: embed=1 on disabled adapter", async () => {
  const src = "export function f() { return 1; }\n";
  const r = await runForgeContextSemanticChunks(
    "C:/p",
    "a.ts",
    async () => src,
    disabled,
    true
  );
  const b = r.body as { embed: { ok: boolean; reason?: string; chunkIndex?: number } | null };
  assert.equal(r.status, 200);
  assert.ok(b.embed);
  assert.equal(b.embed?.ok, false);
});
