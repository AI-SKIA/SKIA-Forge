import assert from "node:assert/strict";
import test from "node:test";
import { acceptForgeDecomposeResponse } from "../../../lib/acceptForgeDecomposeResponse.js";

test("IDE decompose client accepts 422 with fallback steps", () => {
  const plan = { title: "T", steps: [{ id: "s1", title: "Search" }] };
  const steps = [{ stepId: "s1", tool: "search_codebase", input: { query: "x" } }];
  const r = acceptForgeDecomposeResponse(
    422,
    { error: "Model response did not contain a JSON object.", steps },
    plan
  );
  assert.equal(r.ok, true);
  assert.equal(r.usedFallback, true);
  assert.equal(r.steps.length, 1);
});

test("IDE decompose client rejects 422 without steps", () => {
  const r = acceptForgeDecomposeResponse(422, { error: "no steps" }, { title: "T", steps: [] });
  assert.equal(r.ok, false);
});

test("IDE decompose client accepts 200 with steps", () => {
  const steps = [{ stepId: "s1", tool: "read_file", input: { path: "a.ts" } }];
  const r = acceptForgeDecomposeResponse(200, { steps }, { title: "T", steps: [] });
  assert.equal(r.ok, true);
  assert.equal(r.usedFallback, false);
});
