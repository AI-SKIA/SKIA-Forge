import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { appendAuditLog, readAuditLog } from "./auditLog.js";

test("appendAuditLog preserves concurrent records", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "skia-audit-"));
  await Promise.all([
    appendAuditLog(root, {
      timestamp: new Date().toISOString(),
      action: "test.one",
      parameters: {},
      result: "success"
    }),
    appendAuditLog(root, {
      timestamp: new Date().toISOString(),
      action: "test.two",
      parameters: {},
      result: "success"
    })
  ]);
  const rows = await readAuditLog(root);
  const actions = rows.map((r) => r.action);
  assert.equal(rows.length, 2);
  assert.ok(actions.includes("test.one"));
  assert.ok(actions.includes("test.two"));
});
