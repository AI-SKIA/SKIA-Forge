import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import ignore from "ignore";
import { StructureIndexCache } from "./structureIndexCache.js";

test("structureIndexCache: stores entry for ts file and respects ignore", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-struct-"));
  const ig = ignore();
  await fs.writeFile(path.join(root, "a.ts"), "export const x = 1;", "utf8");
  const cache = new StructureIndexCache();
  await cache.updateFromFile(root, "a.ts", ig);
  assert.equal(cache.size, 1);
  const e = cache.get("a.ts");
  assert.ok(e);
  assert.equal(e?.engine, "typescript");
  assert.ok((e?.parseDurationMs ?? 0) >= 0);

  ig.add("a.ts");
  await cache.updateFromFile(root, "a.ts", ig);
  assert.equal(cache.size, 0);
});

test("structureIndexCache: remove on missing file", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-struct-"));
  const ig = ignore();
  const cache = new StructureIndexCache();
  await fs.writeFile(path.join(root, "gone.ts"), "export const x = 1;", "utf8");
  await cache.updateFromFile(root, "gone.ts", ig);
  assert.equal(cache.size, 1);
  await fs.rm(path.join(root, "gone.ts"));
  await cache.updateFromFile(root, "gone.ts", ig);
  assert.equal(cache.size, 0);
});
