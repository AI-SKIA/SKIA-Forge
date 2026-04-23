import assert from "node:assert/strict";
import test from "node:test";
import { enforceTextSize, RateLimiter } from "./guardrails.js";

test("rate limiter blocks after max requests", () => {
  const limiter = new RateLimiter(2, 10000);
  assert.equal(limiter.check("k").allowed, true);
  assert.equal(limiter.check("k").allowed, true);
  assert.equal(limiter.check("k").allowed, false);
});

test("enforceTextSize rejects oversized text", () => {
  const result = enforceTextSize("abcdef", 3);
  assert.equal(result.ok, false);
});
