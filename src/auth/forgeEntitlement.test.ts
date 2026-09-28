import assert from "node:assert/strict";
import test from "node:test";
import { readForgeEntitlement } from "./forgeEntitlement.ts";

test("reads the server entitlement and ignores a client claim", () => {
  const parsed = readForgeEntitlement({
    forgeEntitlement: {
      entitled: false,
      planId: "free",
      reasonCode: "PLAN_REQUIRED",
      expiresAt: null
    },
    entitled: true
  });
  assert.equal(parsed?.entitled, false);
  assert.equal(parsed?.reasonCode, "PLAN_REQUIRED");
  assert.equal(parsed?.planId, "free");
});

test("returns null when the server omitted the object", () => {
  assert.equal(readForgeEntitlement({ user: { subscriptionPlan: "company" } }), null);
});
