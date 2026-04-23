import assert from "node:assert/strict";
import test from "node:test";
import { buildForgeModuleHealth } from "./forgeModuleHealth.js";

test("buildForgeModuleHealth returns six module statuses", () => {
  const rows = [
    { name: "chat", method: "POST" as const, path: "/api/skia/chat", status: 200, ok: true, reachable: true },
    {
      name: "meta",
      method: "POST" as const,
      path: "/api/meta/route",
      status: 401,
      ok: false,
      reachable: true,
      detail: "unauthorized"
    },
    {
      name: "route",
      method: "POST" as const,
      path: "/api/routing/estimate",
      status: 0,
      ok: false,
      reachable: false,
      detail: "network"
    }
  ];
  const health = buildForgeModuleHealth(rows);
  assert.equal(health.length, 6);
  assert.ok(health.some((m) => m.module === "agent" && m.state === "healthy"));
  assert.ok(health.some((m) => m.module === "context" && m.state === "degraded"));
});
