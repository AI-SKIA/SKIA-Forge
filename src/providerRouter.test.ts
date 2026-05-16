import assert from "node:assert/strict";
import test from "node:test";
import { ProviderRouter } from "./providerRouter.js";

test("provider router defaults to Sovereign with skia-serve healthy", () => {
  const router = new ProviderRouter();
  assert.equal(router.routeForTask("chat"), "skia-serve");
  assert.equal(router.getStatus(), "Sovereign");
});

test("provider router falls back to google when skia-serve unhealthy", () => {
  const router = new ProviderRouter();
  router.setProviderHealth("skia-serve", false, 900);
  assert.equal(router.routeForTask("chat"), "google");
  assert.equal(router.getStatus(), "Adaptive");
});
