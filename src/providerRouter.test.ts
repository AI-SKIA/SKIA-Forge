import assert from "node:assert/strict";
import test from "node:test";
import { ProviderRouter } from "./providerRouter.js";

test("provider router defaults to Sovereign with gemini healthy", () => {
  const router = new ProviderRouter();
  assert.equal(router.routeForTask("chat"), "gemini");
  assert.equal(router.getStatus(), "Sovereign");
});

test("provider router falls back to skia when gemini unhealthy", () => {
  const router = new ProviderRouter();
  router.setProviderHealth("gemini", false, 900);
  assert.equal(router.routeForTask("chat"), "skia");
  assert.equal(router.getStatus(), "Adaptive");
});
