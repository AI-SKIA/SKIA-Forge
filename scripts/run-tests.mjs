#!/usr/bin/env node
// Runs every src/**/*.test.ts through `tsx --test`.
// Node 20's test runner does not expand globs, and an unquoted glob in package.json
// is expanded by /bin/sh without globstar, which silently skips nested directories.
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function listTestFiles(baseDir = root) {
  return readdirSync(path.join(baseDir, "src"), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".test.ts"))
    .map((entry) => path.relative(baseDir, path.join(entry.parentPath ?? entry.path, entry.name)))
    .sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = listTestFiles();
  if (files.length === 0) {
    console.error("run-tests: no src/**/*.test.ts files found");
    process.exit(1);
  }
  const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
  const result = spawnSync(process.execPath, [tsxCli, "--test", ...process.argv.slice(2), ...files], {
    cwd: root,
    stdio: "inherit",
  });
  process.exit(result.status ?? 1);
}
