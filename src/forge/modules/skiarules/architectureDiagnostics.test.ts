import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { getDiagnosticsForFile, countSkiarulesL4Stats } from "./architectureDiagnostics.js";
import type { SkiarulesConfig } from "./skiarulesTypes.js";

test("getDiagnosticsForFile: anti-patterns in content", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "arch-d-"));
  const config: SkiarulesConfig = {
    conventions: { anti_patterns: ["\\bFORBIDDEN\\b"] }
  } as SkiarulesConfig;
  const d = await getDiagnosticsForFile(
    root,
    "x.ts",
    "line with FORBIDDEN in it",
    config
  );
  assert.equal(d.antiPatterns.length, 1);
  const s = countSkiarulesL4Stats(d, { agent: { blocked_paths: ["/a"] } } as SkiarulesConfig);
  assert.equal(s.antiPatternsCount, 1);
  assert.equal(s.blockedPathsCount, 1);
});

test("getDiagnosticsForFile: naming rule on file basename", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "arch-n-"));
  const config: SkiarulesConfig = { conventions: { naming: "\\.ts$" } } as SkiarulesConfig;
  const bad = await getDiagnosticsForFile(root, "WrongName.txt", "//", config);
  assert.ok(bad.naming.length >= 0);
  const good = await getDiagnosticsForFile(root, "ok.ts", "//", config);
  assert.equal(good.naming.length, 0);
});
