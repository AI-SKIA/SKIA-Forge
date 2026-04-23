import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { runAgentSelfCorrectingExecute } from "./agentSelfCorrection.js";
import { runPackageValidation } from "./packageValidation.js";
import { SkiaFullAdapter } from "../../../skiaFullAdapter.js";

const baseBody = (path: string) => ({
  path,
  plan: {
    title: "P",
    steps: [{ id: "s1", title: "S", detail: "" }]
  },
  steps: [{ stepId: "s1", tool: "list_files", input: { pattern: "*.md", maxFiles: 3 } }],
  mode: "apply" as const,
  selfCorrect: true,
  fileMutationApprovals: {} as Record<string, true>,
  highRiskCommandApprovals: {} as Record<string, true>
});

test("D1-11: success on first attempt — validation ok (no scripts = skip)", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sc-"));
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ name: "x" }),
    "utf8"
  );
  const skia = new SkiaFullAdapter({
    enabled: false,
    baseUrl: "https://x",
    timeoutMs: 1000,
    allowLocalFallback: false,
    brainOnly: true
  });
  const r = await runAgentSelfCorrectingExecute(root, baseBody("a.ts") as any, { skia, goalText: "g" });
  const bodyB = r.body as { attempts: { validation: { ok: boolean } }[]; finalStatus: string };
  const last = bodyB.attempts[bodyB.attempts.length - 1]!;
  // no scripts → validation summary skip → ok
  assert.equal(last.validation?.ok, true, JSON.stringify(bodyB.attempts));
  assert.equal(bodyB.finalStatus, "success");
});

test("D1-11: failure then model returns valid JSON → second attempt", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sc2-"));
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ scripts: { test: "exit 1" } }),
    "utf8"
  );
  let n = 0;
  const skia = {
    getStatus: () => ({ enabled: true }),
    intelligence: async () => {
      n++;
      return {
        message: JSON.stringify({
          plan: {
            title: "P2",
            steps: [
              { id: "s1", title: "S", detail: "" },
              { id: "s2", title: "S2", detail: "" }
            ]
          },
          steps: [
            { stepId: "s1", tool: "list_files", input: { pattern: "*.md" } },
            { stepId: "s2", tool: "list_files", input: { pattern: "*.ts" } }
          ]
        })
      };
    }
  } as unknown as SkiaFullAdapter;
  const b = { ...baseBody("a.ts"), selfCorrect: true };
  const r: Awaited<ReturnType<typeof runAgentSelfCorrectingExecute>> = await runAgentSelfCorrectingExecute(
    root,
    b as any,
    { skia, goalText: "goal" }
  );
  const body = r.body as { attempts: { validation: { ok: boolean } }[]; finalStatus: string };
  assert.equal(body.attempts[0]!.validation?.ok, false, "test script should fail");
  assert.equal(body.attempts.length >= 2, true);
  assert.ok(n >= 1, "one SKIA call");
});

test("D1-11: 3 failed validations + model → max_retries", { skip: "slow" }, async () => {});

test("D1-11: model parse error → finalStatus", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sc3-"));
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ scripts: { test: "exit 1" } }),
    "utf8"
  );
  const skia = {
    getStatus: () => ({ enabled: true }),
    intelligence: async () => ({ message: "not json at all" })
  } as unknown as SkiaFullAdapter;
  const r = await runAgentSelfCorrectingExecute(
    root,
    baseBody("a.ts") as any,
    { skia, goalText: "g" }
  );
  assert.equal((r.body as { finalStatus: string }).finalStatus, "parse_error");
});

test("packageValidation empty scripts → ok", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pv-"));
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ name: "x" }), "utf8");
  const p = await runPackageValidation(root);
  assert.equal(p.ok, true);
  assert.match(p.summary, /skipped/i);
});
