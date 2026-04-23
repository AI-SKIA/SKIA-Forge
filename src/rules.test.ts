import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadSkiaRules } from "./rules.js";

test("loadSkiaRules parses valid .skiarules", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-rules-"));
  await fs.writeFile(
    path.join(root, ".skiarules"),
    [
      "project:",
      "  name: test-project",
      "governance:",
      "  default_mode: strict",
      "agent:",
      "  blocked_paths:",
      "    - secrets/"
    ].join("\n"),
    "utf8"
  );

  const rules = await loadSkiaRules(root);
  assert.equal(rules.project?.name, "test-project");
  assert.equal(rules.governance?.default_mode, "strict");
  assert.deepEqual(rules.agent?.blocked_paths, ["secrets/"]);
});

test("loadSkiaRules returns empty object if missing", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-rules-empty-"));
  const rules = await loadSkiaRules(root);
  assert.deepEqual(rules, {});
});
