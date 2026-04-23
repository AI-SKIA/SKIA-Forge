import assert from "node:assert/strict";
import test from "node:test";
import {
  controlPlaneRemediationSchema,
  forgeContextStructureOkBodySchema,
  forgeContextStructureUnsupportedBodySchema,
  embedIndexRequestSchema,
  embedSearchRequestSchema,
  forgeContextRetrievalRequestSchema,
  forgeAgentPlanRequestSchema,
  forgeAgentExecuteRequestSchema,
  forgeSemanticChunksBodySchema,
  jsonRpcRequestSchema,
  providerForceSchema,
  providerHealthSchema,
  sovereignModeSchema,
  structuralSymbolSchema,
  telemetryRecordSchema,
  validateCommandSchema
} from "./contracts.js";

test("jsonRpcRequestSchema rejects invalid payload", () => {
  const parsed = jsonRpcRequestSchema.safeParse({ method: "skia/search" });
  assert.equal(parsed.success, false);
});

test("telemetryRecordSchema accepts known metric", () => {
  const parsed = telemetryRecordSchema.safeParse({
    metric: "inline_completion_latency_ms",
    value: 120
  });
  assert.equal(parsed.success, true);
});

test("providerHealthSchema rejects invalid name", () => {
  const parsed = providerHealthSchema.safeParse({
    name: "other",
    healthy: true,
    latencyMs: 10
  });
  assert.equal(parsed.success, false);
});

test("validateCommandSchema requires non-empty command", () => {
  const parsed = validateCommandSchema.safeParse({ command: "" });
  assert.equal(parsed.success, false);
});

test("providerForceSchema supports null", () => {
  const parsed = providerForceSchema.safeParse({ name: null });
  assert.equal(parsed.success, true);
});

test("sovereignModeSchema allows execution modes", () => {
  const parsed = sovereignModeSchema.safeParse({ mode: "adaptive" });
  assert.equal(parsed.success, true);
});

test("controlPlaneRemediationSchema validates remediation action", () => {
  const parsed = controlPlaneRemediationSchema.safeParse({
    action: "align_mode",
    approvalToken: "tok_123"
  });
  assert.equal(parsed.success, true);
});

test("controlPlaneRemediationSchema accepts intent key cleanup action", () => {
  const parsed = controlPlaneRemediationSchema.safeParse({
    action: "rotate_intent_key_cleanup",
    approved: true
  });
  assert.equal(parsed.success, true);
});

test("forgeContextStructureOkBodySchema accepts a minimal 200 body", () => {
  const parsed = forgeContextStructureOkBodySchema.safeParse({
    path: "src/a.ts",
    engine: "typescript",
    count: 1,
    symbols: [
      {
        name: "f",
        kind: "function",
        startLine: 1,
        endLine: 1,
        filePath: "src/a.ts"
      }
    ]
  });
  assert.equal(parsed.success, true);
});

test("structuralSymbolSchema enforces line numbers", () => {
  const bad = structuralSymbolSchema.safeParse({
    name: "x",
    kind: "class",
    startLine: 0,
    endLine: 1,
    filePath: "a.ts"
  });
  assert.equal(bad.success, false);
});

test("forgeContextStructureUnsupportedBodySchema requires engine unsupported", () => {
  const ok = forgeContextStructureUnsupportedBodySchema.safeParse({
    error: "No structural parser",
    path: "a.py",
    engine: "unsupported"
  });
  assert.equal(ok.success, true);
  const bad = forgeContextStructureUnsupportedBodySchema.safeParse({
    error: "x",
    path: "a",
    engine: "typescript"
  });
  assert.equal(bad.success, false);
});

test("embedSearchRequestSchema accepts retrieval tuning fields", () => {
  const p = embedSearchRequestSchema.safeParse({
    query: "hello",
    topK: 5,
    nprobes: 8,
    where: "language = 'ts'",
    bypassVectorIndex: true
  });
  assert.equal(p.success, true);
});

test("forgeContextRetrievalRequestSchema accepts path and optional fields", () => {
  const p = forgeContextRetrievalRequestSchema.safeParse({
    path: "src/a.ts",
    query: "auth flow",
    maxTokens: 8000,
    topK: 8
  });
  assert.equal(p.success, true);
});

test("forgeAgentPlanRequestSchema requires goal and path", () => {
  const ok = forgeAgentPlanRequestSchema.safeParse({
    goal: "Add tests for auth",
    path: "src/auth.ts",
    maxTokens: 4000
  });
  assert.equal(ok.success, true);
  const bad = forgeAgentPlanRequestSchema.safeParse({ path: "a.ts" });
  assert.equal(bad.success, false);
});

test("forgeAgentExecuteRequestSchema requires plan, steps, and mode", () => {
  const ok = forgeAgentExecuteRequestSchema.safeParse({
    path: "a.ts",
    plan: { title: "P", steps: [{ id: "s1", title: "S", detail: "" }] },
    steps: [{ stepId: "s1", tool: "list_files", input: {} }],
    mode: "preview"
  });
  assert.equal(ok.success, true);
  const withSelf = forgeAgentExecuteRequestSchema.safeParse({
    path: "a.ts",
    plan: { title: "P", steps: [{ id: "s1", title: "S", detail: "" }] },
    steps: [{ stepId: "s1", tool: "list_files", input: {} }],
    mode: "apply",
    selfCorrect: true
  });
  assert.equal(withSelf.success, true);
  const bad = forgeAgentExecuteRequestSchema.safeParse({
    path: "a.ts",
    plan: { title: "P", steps: [{ id: "s1", title: "S" }] }
  });
  assert.equal(bad.success, false);
});

test("embedIndexRequestSchema accepts path or paths", () => {
  const a = embedIndexRequestSchema.safeParse({ path: "a.ts" });
  assert.equal(a.success, true);
  const b = embedIndexRequestSchema.safeParse({ paths: ["a.ts", "b.ts"] });
  assert.equal(b.success, true);
  const c = embedIndexRequestSchema.safeParse({});
  assert.equal(c.success, false);
});

test("forgeSemanticChunksBodySchema accepts minimal 200 body", () => {
  const parsed = forgeSemanticChunksBodySchema.safeParse({
    path: "src/x.ts",
    engine: "typescript",
    symbolCount: 0,
    chunkCount: 0,
    chunks: [],
    embed: null
  });
  assert.equal(parsed.success, true);
});
