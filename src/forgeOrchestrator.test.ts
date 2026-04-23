import assert from "node:assert/strict";
import test from "node:test";
import { runForgeOrchestration } from "./forgeOrchestrator.js";
import { SkiaFullAdapter } from "./skiaFullAdapter.js";

test("forge orchestration returns ordered stages", async () => {
  const adapter = new SkiaFullAdapter({
    enabled: false,
    baseUrl: "http://invalid",
    timeoutMs: 1,
    allowLocalFallback: false,
    brainOnly: true
  });

  // Minimal mock for deterministic unit behavior.
  const fake = {
    routeReasoning: async (_q: string, intent?: string) => ({ intent: intent ?? "none" }),
    intelligence: async () => ({ ok: true }),
    routingEstimate: async () => ({ route: "fast" })
  } as unknown as SkiaFullAdapter;

  const out = await runForgeOrchestration(fake, {
    intent: "Ship feature X",
    mode: "autonomous"
  });
  assert.equal(out.stages[0].stage, "context");
  assert.equal(out.stages[1].stage, "architecture");
  assert.equal(out.stages[2].stage, "sdlc");
  assert.equal(out.stages[3].stage, "production");
  assert.equal(out.stages[4].stage, "healing");
  assert.equal(out.status, "success");
  assert.equal(out.summary.failedCount, 0);
  void adapter; // avoid accidental unused during future edits
});

test("forge orchestration reports partial success", async () => {
  const fake = {
    routeReasoning: async (_q: string, intent?: string) => {
      if (intent === "architecture") throw new Error("arch unavailable");
      return { intent: intent ?? "none" };
    },
    intelligence: async () => ({ ok: true }),
    routingEstimate: async () => ({ route: "fast" })
  } as unknown as SkiaFullAdapter;

  const out = await runForgeOrchestration(fake, { intent: "Ship feature Y" });
  assert.equal(out.status, "partial_success");
  assert.ok(out.summary.failedCount >= 1);
  assert.ok(out.stages.some((s) => s.stage === "architecture" && s.status === "failed"));
});

test("forge orchestration strict mode blocks unapproved critical stages", async () => {
  const fake = {
    routeReasoning: async (_q: string, intent?: string) => ({ intent: intent ?? "none" }),
    intelligence: async () => ({ ok: true }),
    routingEstimate: async () => ({ route: "fast" })
  } as unknown as SkiaFullAdapter;

  const out = await runForgeOrchestration(fake, {
    intent: "Ship feature Z",
    mode: "strict",
    approved: false
  });
  assert.ok(out.stages.some((s) => s.stage === "production" && s.status === "blocked"));
  assert.ok(out.stages.some((s) => s.stage === "healing" && s.status === "blocked"));
});

test("forge orchestration emits stage decisions", async () => {
  const fake = {
    routeReasoning: async (_q: string, intent?: string) => ({ intent: intent ?? "none" }),
    intelligence: async () => ({ ok: true }),
    routingEstimate: async () => ({ route: "fast" })
  } as unknown as SkiaFullAdapter;

  const seen: string[] = [];
  await runForgeOrchestration(fake, {
    intent: "Ship feature telemetry",
    mode: "strict",
    approved: false,
    onStageDecision: (stage, status, mode) => {
      seen.push(`${mode}:${stage}:${status}`);
    }
  });
  assert.ok(seen.some((row) => row.includes("strict:production:blocked")));
});
