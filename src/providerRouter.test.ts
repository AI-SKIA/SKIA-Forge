import assert from "node:assert/strict";
import test from "node:test";
import { ProviderRouter } from "./providerRouter.js";

test("provider router stays Adaptive until a skia_serve health row is healthy", () => {
  const router = new ProviderRouter();
  const skia = router.getHealth().find((row) => row.name === "skia-serve");
  assert.equal(skia?.healthy, false);
  assert.equal(router.routeForTask("chat"), "google");
  assert.equal(router.getStatus(), "Adaptive");
});

test("provider router maps skia_serve and google_llm from /api/health services", () => {
  const router = new ProviderRouter();
  router.ingestHealthBody({
    services: [
      {
        service: "skia_serve",
        status: "down",
        responseTimeMs: 40,
        checkedAt: "2026-01-01T00:00:00.000Z",
        error: "paused"
      },
      {
        service: "google_llm",
        status: "healthy",
        responseTimeMs: 12,
        checkedAt: "2026-01-01T00:00:01.000Z"
      }
    ]
  });
  const health = router.getHealth();
  const skia = health.find((row) => row.name === "skia-serve");
  const google = health.find((row) => row.name === "google");
  assert.equal(skia?.healthy, false);
  assert.equal(skia?.latencyMs, 40);
  assert.equal(skia?.checkedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(skia?.error, "paused");
  assert.equal(google?.healthy, true);
  assert.equal(google?.latencyMs, 12);
  assert.equal(google?.error, undefined);
  assert.equal(router.routeForTask("chat"), "google");
});

test("provider router marks both providers unhealthy when the health fetch is not 200", async () => {
  const router = new ProviderRouter();
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("", { status: 503 })) as typeof fetch;
  try {
    await router.refreshUpstreamHealth();
  } finally {
    globalThis.fetch = original;
  }
  for (const row of router.getHealth()) {
    assert.equal(row.healthy, false);
    assert.match(row.error || "", /HTTP 503/);
  }
});

test("provider router falls back to google when skia-serve unhealthy", () => {
  const router = new ProviderRouter();
  router.setProviderHealth("skia-serve", false, 900);
  assert.equal(router.routeForTask("chat"), "google");
  assert.equal(router.getStatus(), "Adaptive");
});
