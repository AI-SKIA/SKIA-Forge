import assert from "node:assert/strict";
import test from "node:test";

const SANDBOX_MSG =
  "SKIA_SANDBOX_NOT_PROVISIONED — cannot run untrusted code on host. Deploy skia-sandbox first.";

test("runTerminalTool untrustedTarget routes to sandbox client", async (t) => {
  const prevUrl = process.env.SKIA_SANDBOX_URL;
  const prevToken = process.env.SKIA_SANDBOX_TOKEN;
  process.env.SKIA_SANDBOX_URL = "http://127.0.0.1:9";
  process.env.SKIA_SANDBOX_TOKEN = "test-token";

  t.after(() => {
    if (prevUrl === undefined) delete process.env.SKIA_SANDBOX_URL;
    else process.env.SKIA_SANDBOX_URL = prevUrl;
    if (prevToken === undefined) delete process.env.SKIA_SANDBOX_TOKEN;
    else process.env.SKIA_SANDBOX_TOKEN = prevToken;
  });

  const calls: unknown[] = [];
  const mod = await import("../../../services/ForgeRoundtripSandboxClient.js");
  const orig = mod.forgeRoundtripSandboxClient.runIsolated.bind(mod.forgeRoundtripSandboxClient);
  mod.forgeRoundtripSandboxClient.runIsolated = async (...args: unknown[]) => {
    calls.push(args);
    return { stdout: "ok\n", stderr: "", exitCode: 0, truncated: false };
  };
  t.after(() => {
    mod.forgeRoundtripSandboxClient.runIsolated = orig;
  });

  const { runTerminalTool } = await import("./runTerminalTool.js");

  const result = await runTerminalTool.execute(
    {
      projectRoot: process.cwd(),
      emitEvent: () => {}
    },
    { command: "echo hi", untrustedTarget: true, source: "agent", timeoutMs: 2_000 }
  );

  assert.equal(result.success, true);
  assert.equal(calls.length, 1);
  assert.equal((calls[0] as string[])[0], "echo hi");
});

test("runTerminalTool untrustedTarget fails closed when sandbox unset", async () => {
  const prevUrl = process.env.SKIA_SANDBOX_URL;
  const prevToken = process.env.SKIA_SANDBOX_TOKEN;
  delete process.env.SKIA_SANDBOX_URL;
  delete process.env.SKIA_SANDBOX_TOKEN;

  const { runTerminalTool } = await import("./runTerminalTool.js");
  const result = await runTerminalTool.execute(
    { projectRoot: process.cwd(), emitEvent: () => {} },
    { command: "echo hi", untrustedTarget: true }
  );

  if (prevUrl !== undefined) process.env.SKIA_SANDBOX_URL = prevUrl;
  if (prevToken !== undefined) process.env.SKIA_SANDBOX_TOKEN = prevToken;

  assert.equal(result.success, false);
  assert.match(String(result.error), /SKIA_SANDBOX_NOT_PROVISIONED/);
});

test("runTerminalTool default path unchanged (no untrustedTarget)", async () => {
  const prevUrl = process.env.SKIA_SANDBOX_URL;
  delete process.env.SKIA_SANDBOX_URL;
  const { runTerminalTool } = await import("./runTerminalTool.js");
  const v = runTerminalTool.validate({ command: "echo ok", source: "user" });
  assert.equal(v.ok, true);
  if (prevUrl !== undefined) process.env.SKIA_SANDBOX_URL = prevUrl;
});
