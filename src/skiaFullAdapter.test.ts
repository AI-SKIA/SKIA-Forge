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

test("search calls SKIA-FULL /api/skia/search and never substitutes meta routing", async () => {
  const realFetch = globalThis.fetch;
  const calls: string[] = [];
  const adapter = new SkiaFullAdapter({
    enabled: true,
    baseUrl: "https://full.test",
    timeoutMs: 5000,
    allowLocalFallback: true,
    brainOnly: false
  });
  try {
    globalThis.fetch = (async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ query: "fs", source: "searxng", results: [{ url: "https://nodejs.org", title: "Node", snippet: "fs" }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as typeof fetch;
    const ok = await adapter.search("fs");
    assert.deepEqual(ok.results, [{ url: "https://nodejs.org", title: "Node", snippet: "fs" }]);

    globalThis.fetch = (async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ error: "Search provider unavailable" }), { status: 502 });
    }) as typeof fetch;
    await assert.rejects(adapter.search("fs"), /502/);
    assert.deepEqual(calls, ["https://full.test/api/skia/search", "https://full.test/api/skia/search"]);
  } finally {
    globalThis.fetch = realFetch;
  }
});
