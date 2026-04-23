import assert from "node:assert/strict";
import test from "node:test";
import { ApprovalTokenStore } from "./approvalTokens.js";

test("approval token can be consumed exactly once", () => {
  const store = new ApprovalTokenStore(60_000);
  const issued = store.issue("module");
  assert.equal(store.consume(issued.token, "module"), true);
  assert.equal(store.consume(issued.token, "module"), false);
});

test("approval token expires", async () => {
  const store = new ApprovalTokenStore(5);
  const issued = store.issue("module");
  await new Promise((resolve) => setTimeout(resolve, 12));
  assert.equal(store.consume(issued.token, "module"), false);
});

test("approval token scope must match consumer purpose", () => {
  const store = new ApprovalTokenStore(60_000);
  const issued = store.issue("orchestration");
  assert.equal(store.consume(issued.token, "module"), false);
  assert.equal(store.consume(issued.token, "orchestration"), true);
});

test("approval token stats track issued, consumed, and rejected", () => {
  const store = new ApprovalTokenStore(60_000);
  const t1 = store.issue("module");
  const t2 = store.issue("remediation");
  assert.equal(store.consume(t1.token, "module"), true);
  assert.equal(store.consume(t2.token, "orchestration"), false);
  const stats = store.getStats();
  assert.equal(stats.issuedByPurpose.module, 1);
  assert.equal(stats.issuedByPurpose.remediation, 1);
  assert.equal(stats.consumedByPurpose.module, 1);
  assert.ok(stats.rejected >= 1);
});
