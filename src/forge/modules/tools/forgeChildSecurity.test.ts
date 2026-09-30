import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { isSecretEnvName, scrubbedChildEnv } from "./childEnv.js";
import { runTerminalTool } from "./runTerminalTool.js";
import { buildArchitectureGraph } from "../architecture/architectureGraph.js";

const ctx = { projectRoot: process.cwd(), emitEvent: () => {} };

test("B-144: tool input source='user' does not bypass the command safety gate", async () => {
  const r = await runTerminalTool.execute(ctx, { command: "echo drop", source: "user" });
  assert.equal(r.success, false);
  assert.equal((r as { code?: string }).code, "SAFETY");
});

test("B-144: tool input source='user' does not allow multi-line agent scripts", async () => {
  const v = runTerminalTool.validate({ command: "echo a\necho b", source: "user" });
  assert.equal(v.ok, false);
  const r = await runTerminalTool.execute(ctx, { command: "echo a\necho b", source: "user" });
  assert.equal(r.success, false);
});

test("B-144: only host-set ctx.userInitiated skips the gate", async () => {
  const r = await runTerminalTool.execute({ ...ctx, userInitiated: true }, { command: "echo drop" });
  assert.equal(r.success, true);
  assert.match(String((r as { data?: { stdout: string } }).data?.stdout), /drop/);
});

test("B-144: run_terminal child processes do not inherit Forge secrets", async (t) => {
  process.env.FORGE_TEST_API_KEY = "forge-secret-sentinel";
  t.after(() => {
    delete process.env.FORGE_TEST_API_KEY;
  });
  const r = await runTerminalTool.execute(ctx, {
    command: `node -e "process.stdout.write(String(process.env.FORGE_TEST_API_KEY))"`
  });
  assert.equal(r.success, true);
  const out = String((r as { data?: { stdout: string } }).data?.stdout);
  assert.ok(!out.includes("forge-secret-sentinel"), "secret leaked to child");
  assert.equal(out.trim(), "undefined");
});

test("scrubbedChildEnv drops secret-like names and keeps ordinary ones", () => {
  const env = scrubbedChildEnv(
    { SKIA_FORGE: "1" },
    { PATH: "/bin", HOME: "/h", OPENAI_API_KEY: "x", DATABASE_URL: "x", GITHUB_TOKEN: "x", SSH_AUTH_SOCK: "/s" }
  );
  assert.deepEqual(Object.keys(env).sort(), ["HOME", "PATH", "SKIA_FORGE", "SSH_AUTH_SOCK"]);
  assert.equal(isSecretEnvName("STRIPE_WEBHOOK_SECRET"), true);
  assert.equal(isSecretEnvName("NODE_ENV"), false);
});

test(
  "architecture graph does not run shell syntax embedded in project file names",
  { skip: process.platform === "win32" ? "Windows file names cannot contain the quote needed for injection" : false },
  async (t) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "forge-arch-"));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    execFileSync("git", ["init", "-q"], { cwd: dir });
    const evil = 'a$(touch PWNED).ts';
    writeFileSync(path.join(dir, evil), "export const x = 1;\n");
    await buildArchitectureGraph(dir, [evil]);
    assert.equal(existsSync(path.join(dir, "PWNED")), false, "file name was executed by a shell");
  }
);
