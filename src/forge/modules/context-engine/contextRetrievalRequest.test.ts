import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { estimateTokenCount } from "../../../utils.js";
import { SkiaFullAdapter } from "../../../skiaFullAdapter.js";
import { truncateToMaxTokens, runForgeContextRetrieval } from "./contextRetrievalRequest.js";

test("truncateToMaxTokens never exceeds budget", () => {
  const big = "x".repeat(20_000);
  const t = truncateToMaxTokens(big, 100);
  assert.ok(estimateTokenCount(t) <= 100);
  assert.ok(t.includes("truncated"));
});

test("runForgeContextRetrieval returns 200 with four layers and compressed", async () => {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "skia-ctx-"));
  const rel = "sample.ts";
  await fs.writeFile(
    path.join(d, rel),
    "import { a } from './b';\nexport const x = 1;\n",
    "utf8"
  );
  await fs.writeFile(path.join(d, "b.ts"), "export const a = 2;\n", "utf8");
  const engine = {
    getStructureIndexSummary() {
      return { fileCount: 2, maxParseDurationMs: 1, paths: [rel, "b.ts"] };
    }
  };
  const skia = new SkiaFullAdapter({
    enabled: false,
    baseUrl: "https://api.skia.ca",
    timeoutMs: 1000,
    allowLocalFallback: false,
    brainOnly: true
  });
  const { status, body } = await runForgeContextRetrieval(
    d,
    { path: rel, maxTokens: 2000, query: "x export" },
    skia,
    { ...process.env, EMBED_VECTOR_STORE: "file" },
    engine
  );
  assert.equal(status, 200);
  const b = body as { layers: { id: string }[]; compressed: string };
  assert.equal(b.layers.length, 4);
  assert.equal(b.layers[0]!.id, "L1_currentFile");
  assert.equal(b.layers[1]!.id, "L2_imports");
  assert.equal(b.layers[2]!.id, "L3_semantic");
  assert.equal(b.layers[3]!.id, "L4_structure");
  assert.ok(b.compressed.includes("L1"), "compressed bundles layers");
  await fs.rm(d, { recursive: true, force: true });
});
