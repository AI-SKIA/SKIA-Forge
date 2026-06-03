import assert from "node:assert/strict";
import test from "node:test";

// Heuristic path is exercised when adapter is disabled; import via dynamic test of strip logic
// by re-exporting small helpers — here we only assert module loads.
test("inlineCompletion module exports attachInlineCompletionServer", async () => {
  const mod = await import("./inlineCompletion.js");
  assert.equal(typeof mod.attachInlineCompletionServer, "function");
});
