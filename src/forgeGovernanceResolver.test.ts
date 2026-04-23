import assert from "node:assert/strict";
import test from "node:test";
import { resolveModeAndApproval } from "./forgeGovernanceResolver.js";

test("resolveModeAndApproval falls back when mode missing", () => {
  const out = resolveModeAndApproval({}, "adaptive");
  assert.equal(out.mode, "adaptive");
  assert.equal(out.approved, false);
});

test("resolveModeAndApproval accepts explicit strict and approval", () => {
  const out = resolveModeAndApproval({ mode: "strict", approved: true }, "adaptive");
  assert.equal(out.mode, "strict");
  assert.equal(out.approved, true);
});

test("resolveModeAndApproval includes approval token when provided", () => {
  const out = resolveModeAndApproval({ approvalToken: "abc123" }, "adaptive");
  assert.equal(out.approvalToken, "abc123");
});
