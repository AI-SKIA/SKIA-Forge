import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createDefaultToolRegistry } from "./toolRegistry.js";
import type { ToolContext } from "./types.js";

test("default registry exposes all eight D1-09 tool names", () => {
  const r = createDefaultToolRegistry();
  const names = r.listNames();
  assert.equal(names.length, 8);
  for (const n of [
    "read_file",
    "write_file",
    "edit_file",
    "search_codebase",
    "search_text",
    "run_terminal",
    "git_operations",
    "list_files"
  ]) {
    assert.ok(r.get(n), `missing ${n}`);
  }
});

test("read_file + write_file + rollback", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-tools-"));
  const rel = "w.txt";
  const ctx: ToolContext = { projectRoot: root };
  const r = createDefaultToolRegistry();
  const read = r.get("read_file")!;
  const write = r.get("write_file")!;
  const v = write.validate({ path: rel, content: "v1" });
  assert.equal(v.ok, true);
  if (!v.ok) {
    return;
  }
  const ex = await write.execute(ctx, v.data);
  assert.equal(ex.success, true);
  if (!ex.success) {
    return;
  }
  const rb = ex.rollbackHandle;
  const r1 = await read.execute(ctx, { path: rel });
  assert.equal(r1.success, true);
  if (r1.success) {
    assert.equal((r1.data as { content: string }).content, "v1");
  }
  const roll = await write.rollback(ctx, rb);
  assert.equal(roll.success, true);
  const r2 = await read.execute(ctx, { path: rel });
  assert.equal(r2.success, false);
  await fs.rm(root, { recursive: true, force: true });
});

test("edit_file rollback restores content", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-tool-e-"));
  const rel = "e.txt";
  await fs.writeFile(path.join(root, rel), "alpha beta", "utf8");
  const ctx: ToolContext = { projectRoot: root };
  const edit = createDefaultToolRegistry().get("edit_file")!;
  const ex = await edit.execute(ctx, { path: rel, oldText: "beta", newText: "gamma" });
  assert.equal(ex.success, true);
  if (!ex.success) {
    return;
  }
  const t = await fs.readFile(path.join(root, rel), "utf8");
  assert.equal(t, "alpha gamma");
  const roll = await edit.rollback(ctx, ex.rollbackHandle);
  assert.equal(roll.success, true);
  const t2 = await fs.readFile(path.join(root, rel), "utf8");
  assert.equal(t2, "alpha beta");
  await fs.rm(root, { recursive: true, force: true });
});

test("search_text finds literal in file", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-tool-s-"));
  await fs.writeFile(path.join(root, "a.ts"), "const secret = 1", "utf8");
  const ctx: ToolContext = { projectRoot: root };
  const t = createDefaultToolRegistry().get("search_text")!;
  const ex = await t.execute(ctx, { query: "secret", path: "a.ts" });
  assert.equal(ex.success, true);
  if (!ex.success) {
    return;
  }
  const data = ex.data as { hits: { file: string }[] };
  assert.ok(data.hits.length >= 1);
  await fs.rm(root, { recursive: true, force: true });
});

test("list_files returns paths", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-tool-l-"));
  await fs.writeFile(path.join(root, "a.txt"), "x", "utf8");
  const ctx: ToolContext = { projectRoot: root };
  const t = createDefaultToolRegistry().get("list_files")!;
  const ex = await t.execute(ctx, { pattern: "**/a.txt", maxFiles: 10 });
  assert.equal(ex.success, true);
  if (!ex.success) {
    return;
  }
  const files = (ex.data as { files: string[] }).files;
  assert.ok(files.includes("a.txt") || files.some((f: string) => f.endsWith("a.txt")));
  await fs.rm(root, { recursive: true, force: true });
});
