import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("npm test runs the discovery runner, not a shell-expanded glob", () => {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(pkg.scripts.test, "node scripts/run-tests.mjs");
});

test("runner discovers nested test files under src/forge", async () => {
  const runner = await import(pathToFileURL(path.join(root, "scripts", "run-tests.mjs")).href);
  const files: string[] = runner.listTestFiles(root).map((f: string) => f.split(path.sep).join("/"));
  assert.ok(files.includes("src/testRunnerCoverage.test.ts"));
  const nested = files.filter((f) => f.split("/").length > 3 && f.startsWith("src/forge/"));
  assert.ok(nested.length > 0, "expected tests below src/forge/<dir>/");
  assert.ok(files.length >= 89, `expected at least 89 test files, found ${files.length}`);
});
