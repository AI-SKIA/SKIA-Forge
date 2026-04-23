import assert from "node:assert/strict";
import test from "node:test";
import { runForgeContextStructure } from "./contextStructureRequest.js";

const root = "C:/proj";

test("context structure: 400 on empty path", async () => {
  const r = await runForgeContextStructure(root, "  ", async () => "");
  assert.equal(r.status, 400);
  assert.equal((r.body as { error: string }).error.includes("Missing"), true);
});

test("context structure: 400 on unsafe path", async () => {
  const r = await runForgeContextStructure(root, "../x.ts", async () => "");
  assert.equal(r.status, 400);
});

test("context structure: 404 when read throws ENOENT", async () => {
  const err = new Error("nope") as NodeJS.ErrnoException;
  err.code = "ENOENT";
  const r = await runForgeContextStructure(root, "a.ts", async () => {
    throw err;
  });
  assert.equal(r.status, 404);
});

test("context structure: 422 for unsupported extension", async () => {
  const r = await runForgeContextStructure(root, "a.py", async () => "x=1");
  assert.equal(r.status, 422);
  const b = r.body as { error: string; path: string; engine: string };
  assert.equal(b.engine, "unsupported");
  assert.equal(b.path, "a.py");
});

test("context structure: 200 for TypeScript and passes schema", async () => {
  const r = await runForgeContextStructure(
    root,
    "a.ts",
    async () => "export function f(): void { }"
  );
  assert.equal(r.status, 200);
  const b = r.body as { path: string; engine: string; count: number };
  assert.equal(b.engine, "typescript");
  assert.ok(b.count >= 1);
});

test("context structure: 200 for empty .ts (engine empty)", async () => {
  const r = await runForgeContextStructure(root, "empty.ts", async () => "");
  assert.equal(r.status, 200);
  const b = r.body as { engine: string; count: number };
  assert.equal(b.engine, "empty");
  assert.equal(b.count, 0);
});
