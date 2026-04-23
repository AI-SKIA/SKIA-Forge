import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extractJsonObjectString, runAgentPlannerRequest, agentTaskPlanV1Schema } from "./agentPlannerRequest.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";

test("extractJsonObjectString handles fenced and bare JSON", () => {
  const j = `Prefix\n\`\`\`json\n{ "a": 1}\n\`\`\`\n tail`;
  assert.deepEqual(JSON.parse(extractJsonObjectString(j)!), { a: 1 });
  const bare = 'noise {"x":true} end';
  assert.deepEqual(JSON.parse(extractJsonObjectString(bare)!), { x: true });
});

test("agentTaskPlanV1Schema accepts a minimal v1 plan", () => {
  const v = agentTaskPlanV1Schema.safeParse({
    version: "1",
    title: "Do work",
    steps: [{ id: "s1", title: "First", detail: "d", dependsOn: [] }],
    assumptions: ["a1"]
  });
  assert.equal(v.success, true);
});

test("runAgentPlannerRequest returns plan when chat returns valid JSON", async () => {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "skia-planner-"));
  const rel = "a.ts";
  await fs.writeFile(
    path.join(d, rel),
    "export const n = 1;\nimport { b } from './b.js';\n",
    "utf8"
  );
  await fs.writeFile(path.join(d, "b.js"), "export const b = 0;\n", "utf8");

  const validJson = {
    version: "1" as const,
    title: "T",
    steps: [{ id: "step-1", title: "S", detail: "d", dependsOn: [] as string[] }],
    assumptions: [] as string[]
  };
  const skia = {
    getStatus: () => ({ enabled: true }),
    intelligence: async () => ({ message: JSON.stringify(validJson) })
  } as unknown as SkiaFullAdapter;
  const structure = {
    getStructureIndexSummary() {
      return { fileCount: 1, maxParseDurationMs: 0, paths: [rel] };
    }
  };
  const { status, body } = await runAgentPlannerRequest(
    d,
    { goal: "Explain exports", path: rel, maxTokens: 2000, topK: 3 },
    skia,
    { EMBED_VECTOR_STORE: "file" },
    structure
  );
  assert.equal(status, 200);
  const b = body as { plan: { title: string; steps: { id: string }[] } | null; parseError?: string };
  assert.equal(b.parseError, undefined);
  assert.ok(b.plan);
  assert.equal(b.plan!.title, "T");
  assert.equal(b.plan!.steps[0]!.id, "step-1");
  await fs.rm(d, { recursive: true, force: true });
});

test("runAgentPlannerRequest plan null when adapter disabled", async () => {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "skia-pln-"));
  await fs.writeFile(path.join(d, "a.ts"), "const x=1", "utf8");
  const skia = {
    getStatus: () => ({ enabled: false }),
    intelligence: async () => ({} as Record<string, unknown>)
  } as unknown as SkiaFullAdapter;
  const { status, body } = await runAgentPlannerRequest(
    d,
    { goal: "g", path: "a.ts" },
    skia,
    {},
    { getStructureIndexSummary: () => ({ fileCount: 0, maxParseDurationMs: 0, paths: [] }) }
  );
  assert.equal(status, 503);
  const b = body as { plan: null };
  assert.equal(b.plan, null);
  await fs.rm(d, { recursive: true, force: true });
});
