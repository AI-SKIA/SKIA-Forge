import assert from "node:assert/strict";
import test from "node:test";
import { isForgeModuleName, runForgeModule } from "./forgeModuleExecutor.js";
import { SkiaFullAdapter } from "./skiaFullAdapter.js";

test("isForgeModuleName validates known modules", () => {
  assert.equal(isForgeModuleName("context"), true);
  assert.equal(isForgeModuleName("unknown"), false);
});

test("runForgeModule calls expected adapter route", async () => {
  let called = "";
  const fake = {
    routeReasoning: async () => {
      called = "route";
      return { ok: true };
    },
    intelligence: async () => {
      called = "intelligence";
      return { ok: true };
    },
    routingEstimate: async () => {
      called = "routing";
      return { ok: true };
    }
  } as unknown as SkiaFullAdapter;

  await runForgeModule(fake, "production", { task: "x" });
  assert.equal(called, "routing");
});
