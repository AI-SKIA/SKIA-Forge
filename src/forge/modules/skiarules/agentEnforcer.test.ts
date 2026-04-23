import assert from "node:assert/strict";
import test from "node:test";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { enforceAgentTool } from "./agentEnforcer.js";
import type { SkiarulesConfig } from "./skiarulesTypes.js";

test("agentEnforcer: blocked_paths prevent file read", () => {
  const cfg: SkiarulesConfig = {
    agent: { blocked_paths: ["secrets/"] }
  } as SkiarulesConfig;
  const root = process.cwd();
  const r = enforceAgentTool(
    root,
    cfg,
    "read_file",
    { path: "secrets/x.txt" }
  );
  assert.equal(r.state, "block");
});

test("agentEnforcer: auto_approve on tool name", () => {
  const cfg: SkiarulesConfig = {
    agent: { auto_approve: ["list_files", "read_file"] }
  } as SkiarulesConfig;
  const r = enforceAgentTool(process.cwd(), cfg, "list_files", { pattern: "**/a" });
  assert.equal(r.state, "auto_approve");
});

test("agentEnforcer: allowed_commands for run_terminal", () => {
  const cfg: SkiarulesConfig = { agent: { allowed_commands: ["npm run test", "node"] } } as SkiarulesConfig;
  const a = enforceAgentTool(process.cwd(), cfg, "run_terminal", { command: "node -e 1" });
  assert.equal(a.state, "allow");
  const b = enforceAgentTool(process.cwd(), cfg, "run_terminal", { command: "rm -f x" });
  assert.equal(b.state, "block");
});

test("path safe read allowed with no block", async () => {
  const r = await fs.mkdtemp(path.join(os.tmpdir(), "aenf-"));
  await fs.writeFile(path.join(r, "a.txt"), "1", "utf8");
  const c = enforceAgentTool(r, null, "read_file", { path: "a.txt" });
  assert.equal(c.state, "allow");
});
