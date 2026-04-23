import assert from "node:assert/strict";
import test from "node:test";
import { SkiaFullAdapter } from "./skiaFullAdapter.js";

test("adapter status reflects config", () => {
  const adapter = new SkiaFullAdapter({
    enabled: true,
    baseUrl: "https://api.skia.ca",
    timeoutMs: 5000,
    allowLocalFallback: false,
    brainOnly: true
  });
  const status = adapter.getStatus();
  assert.equal(status.enabled, true);
  assert.equal(status.baseUrl, "https://api.skia.ca");
  assert.equal(status.timeoutMs, 5000);
  assert.equal(status.allowLocalFallback, false);
  assert.equal(status.brainOnly, true);
});
