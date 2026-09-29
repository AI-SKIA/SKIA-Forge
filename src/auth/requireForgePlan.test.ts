import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FORGE_PLAN_CACHE_TTL_MS,
  isForgeOpenRoute,
  isPaidForgeRequest,
  loadForgeEntitlementForToken,
  resetForgePlanCacheForTests
} from "./requireForgePlan.js";

function session(entitled: boolean, reasonCode: string): Response {
  return new Response(
    JSON.stringify({
      forgeEntitlement: { entitled, planId: entitled ? "freelancer" : "free", reasonCode, expiresAt: null }
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

test("paid forge routes are the model and embedding calls", () => {
  assert.equal(FORGE_PLAN_CACHE_TTL_MS <= 60_000, true);
  assert.equal(isPaidForgeRequest("POST", "/api/forge/agent/plan"), true);
  assert.equal(isPaidForgeRequest("POST", "/api/forge/module/agent"), true);
  assert.equal(isPaidForgeRequest("POST", "/api/forge/module/agent/preview"), false);
  assert.equal(isPaidForgeRequest("GET", "/api/forge/context/structure"), false);
  assert.equal(isPaidForgeRequest("POST", "/api/forge/orchestrate/preview"), false);
});

test("a lapsed plan is hidden for at most 60 seconds, then the next lookup is denied", async () => {
  resetForgePlanCacheForTests();
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return session(calls === 1, calls === 1 ? "OK" : "SUBSCRIPTION_INACTIVE");
  }) as typeof fetch;
  const t0 = 1_700_000_000_000;
  const first = await loadForgeEntitlementForToken("tok-a", t0, fetchImpl, "https://api.skia.ca");
  const cached = await loadForgeEntitlementForToken("tok-a", t0 + 30_000, fetchImpl, "https://api.skia.ca");
  const lapsed = await loadForgeEntitlementForToken(
    "tok-a",
    t0 + FORGE_PLAN_CACHE_TTL_MS + 1,
    fetchImpl,
    "https://api.skia.ca"
  );
  assert.equal(first.view?.entitled, true);
  assert.equal(cached.view?.entitled, true);
  assert.equal(calls, 2);
  assert.equal(lapsed.view?.entitled, false);
  assert.equal(lapsed.view?.reasonCode, "SUBSCRIPTION_INACTIVE");
});

test("a client claim on the session body is not the entitlement object", async () => {
  resetForgePlanCacheForTests();
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ entitled: true, user: { subscriptionPlan: "company" } }), {
      status: 200
    })) as typeof fetch;
  const result = await loadForgeEntitlementForToken("tok-b", 10, fetchImpl, "https://api.skia.ca");
  assert.equal(result.view?.entitled, false);
  assert.equal(result.view?.reasonCode, "PLAN_REQUIRED");
});

test("session JSON body still drives entitlement after data-init lint fix", async () => {
  resetForgePlanCacheForTests();
  const fetchImpl = (async () => session(true, "OK")) as typeof fetch;
  const ok = await loadForgeEntitlementForToken("tok-json-ok", 20, fetchImpl, "https://api.skia.ca");
  assert.equal(ok.status, 200);
  assert.equal(ok.view?.entitled, true);
  assert.equal(ok.view?.planId, "freelancer");

  resetForgePlanCacheForTests();
  const badJson = (async () =>
    new Response("not-json", { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  const fail = await loadForgeEntitlementForToken("tok-json-bad", 20, badJson, "https://api.skia.ca");
  assert.equal(fail.status, 503);
  assert.equal(fail.view, null);
});

test("every /api/forge route is allowlisted or registered after the plan guard", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const serverPath = path.join(root, "src", "server.ts");
  const server = fs.readFileSync(serverPath, "utf8");
  const guardAt = server.indexOf('app.use("/api/forge", requirePaidForgePlan)');
  assert.ok(guardAt >= 0, "requirePaidForgePlan must be mounted on /api/forge");

  const routes: Array<{ method: string; routePath: string; at: number }> = [];
  const direct = /app\.(get|post|put|patch|delete)\(\s*"(\/api\/forge[^"]+)"/g;
  for (const match of server.matchAll(direct)) {
    routes.push({
      method: match[1].toUpperCase(),
      routePath: match[2],
      at: match.index ?? 0
    });
  }

  const mounts: Array<{ prefix: string; file: string; at: number }> = [
    {
      prefix: "/api/forge/production",
      file: "src/forge/modules/production/productionRoutes.ts",
      at: server.indexOf('app.use("/api/forge/production"')
    },
    {
      prefix: "/api/forge/healing",
      file: "src/forge/modules/healing/healingRoutes.ts",
      at: server.indexOf('"/api/forge/healing"')
    },
    {
      prefix: "/api/forge/architecture",
      file: "src/forge/modules/architecture/architectureRoutes.ts",
      at: server.indexOf('"/api/forge/architecture"')
    }
  ];
  for (const mount of mounts) {
    assert.ok(mount.at >= 0, `missing mount ${mount.prefix}`);
    const src = fs.readFileSync(path.join(root, mount.file), "utf8");
    const nested = /router\.(get|post|put|patch|delete)\(\s*"(\/[^"]+)"/g;
    for (const match of src.matchAll(nested)) {
      routes.push({
        method: match[1].toUpperCase(),
        routePath: `${mount.prefix}${match[2]}`.replace(/\/+/g, "/"),
        at: mount.at
      });
    }
  }

  const registrars: Array<{ file: string; marker: string }> = [
    { file: "src/forgeCodeIntelRoutes.ts", marker: "registerForgeCodeIntelRoutes(" },
    { file: "src/routes/forgeOrchestratorRoutes.ts", marker: "registerLowRiskForgeOrchestratorRoutes(" }
  ];
  for (const registrar of registrars) {
    const at = server.indexOf(registrar.marker);
    assert.ok(at > guardAt, `${registrar.marker} must be registered after the plan guard`);
    const src = fs.readFileSync(path.join(root, registrar.file), "utf8");
    const nested = /app\.(get|post|put|patch|delete)\(\s*"(\/api\/forge[^"]+)"/g;
    for (const match of src.matchAll(nested)) {
      routes.push({
        method: match[1].toUpperCase(),
        routePath: match[2],
        at
      });
    }
  }

  assert.ok(routes.length > 10, "expected the forge route table to be scanned");
  const uncovered = routes.filter(
    (route) => !isForgeOpenRoute(route.method, route.routePath) && route.at < guardAt
  );
  assert.deepEqual(
    uncovered.map((route) => `${route.method} ${route.routePath}`),
    []
  );
  assert.equal(isPaidForgeRequest("POST", "/api/forge/agent/plan"), true);
  assert.equal(isForgeOpenRoute("GET", "/api/forge/context/embed/jobs/job-1"), true);
});
