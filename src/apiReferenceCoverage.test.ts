import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Route source file -> mount prefix (from the app.use calls in server.ts). */
const ROUTE_FILES: Record<string, string> = {
  "src/server.ts": "",
  "src/forgeCodeIntelRoutes.ts": "",
  "src/routes/forgeOrchestratorRoutes.ts": "",
  "src/routes/localHealthRoutes.ts": "/api/local",
  "src/forge/modules/production/productionRoutes.ts": "/api/forge/production",
  "src/forge/modules/healing/healingRoutes.ts": "/api/forge/healing",
  "src/forge/modules/architecture/architectureRoutes.ts": "/api/forge/architecture"
};
const STATIC_ASSET = /\.(css|js|png|ico|svg)$/;

function registeredRoutes(): Set<string> {
  const out = new Set<string>();
  for (const [file, prefix] of Object.entries(ROUTE_FILES)) {
    const src = fs.readFileSync(path.join(root, file), "utf8");
    for (const m of src.matchAll(/\b(?:app|router)\.(?:get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g)) {
      out.add(prefix + m[1]);
    }
  }
  return out;
}

test("server mounts the module routers at the prefixes this test assumes", () => {
  const server = fs.readFileSync(path.join(root, "src/server.ts"), "utf8");
  assert.match(server, /app\.use\("\/api\/local", loopbackOrAuth, localHealthRoutes\)/);
  assert.match(server, /app\.use\("\/api\/forge\/production", createProductionRouter/);
  assert.match(server, /"\/api\/forge\/healing",\s*createHealingRouter/);
  assert.match(server, /"\/api\/forge\/architecture",\s*createArchitectureRouter/);
});

test("every registered API route is in docs/API_REFERENCE.md and every documented path exists", () => {
  const doc = fs.readFileSync(path.join(root, "docs/API_REFERENCE.md"), "utf8");
  const routes = registeredRoutes();
  const undocumented = [...routes].filter((p) => !STATIC_ASSET.test(p) && !doc.includes("`" + p + "`"));
  assert.deepEqual(undocumented, []);

  const documented = [...doc.matchAll(/`(\/[^`\s]*)`/g)].map((m) => m[1]);
  const stale = [...new Set(documented)].filter(
    (p) => !p.includes("*") && !p.startsWith("/docs/") && p !== "/api/health" && !routes.has(p)
  );
  assert.deepEqual(stale, []);
});
