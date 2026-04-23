import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadSkiarules, createSkiarulesWatcher, type LoadSkiarulesResult } from "./skiarulesLoader.js";

test("loadSkiarules: valid file → config", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-sr-"));
  await fs.writeFile(
    path.join(root, ".skiarules"),
    [
      "project:",
      "  name: x",
      "governance:",
      "  default_mode: adaptive",
      "agent:",
      "  auto_approve:",
      "    - list_files"
    ].join("\n"),
    "utf8"
  );
  const r = await loadSkiarules(root);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.config?.project?.name, "x");
  }
});

test("loadSkiarules: invalid yaml → error", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-sr2-"));
  await fs.writeFile(path.join(root, ".skiarules"), "project: [ bad", "utf8");
  const r = await loadSkiarules(root);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.error.message.includes("YAML") || r.error.message.includes("parse"));
  }
});

test("loadSkiarules: schema violation → error", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-sr3-"));
  await fs.writeFile(
    path.join(root, ".skiarules"),
    "governance:\n  default_mode: notamode",
    "utf8"
  );
  const r = await loadSkiarules(root);
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.ok(r.error.message.length > 0);
  }
});

test("watcher onChange receives load result on change", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-sr4-"));
  try {
    await fs.rm(path.join(root, ".skiarules"));
  } catch {
    /* */
  }
  const received: LoadSkiarulesResult[] = [];
  const { close } = createSkiarulesWatcher(root, (r) => received.push(r));
  await new Promise((r) => setTimeout(r, 200));
  await fs.writeFile(
    path.join(root, ".skiarules"),
    "project:\n  name: first",
    "utf8"
  );
  await new Promise((r) => setTimeout(r, 1_200));
  assert.ok(received.length >= 1, "watcher should fire on add/change");
  const last = received[received.length - 1]!;
  assert.equal(last?.ok, true);
  if (last.ok) {
    assert.equal(last.config?.project?.name, "first");
  }
  await close();
});
