import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = "forge-orchestrator-test-secret-32b";

type Boot = {
  baseUrl: string;
  token: string;
  projectRoot: string;
  calls: Array<{ projectRoot: string; maxTicks?: number }>;
  close: () => Promise<void>;
};

async function boot(): Promise<Boot> {
  process.env.JWT_SECRET = JWT_SECRET;
  const { requireAuth } = await import("../middleware/requireAuth.js");
  const { registerLowRiskForgeOrchestratorRoutes } = await import("./forgeOrchestratorRoutes.js");
  const { MultiAgentCoordinator } = await import("../forge/modules/agent-executor/MultiAgentCoordinator.js");
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "forge-self-"));
  const app = express();
  const calls: Array<{ projectRoot: string; maxTicks?: number }> = [];
  app.use(express.json());
  app.use("/api/forge", requireAuth);
  registerLowRiskForgeOrchestratorRoutes(app, {
    projectRoot,
    coordinator: new MultiAgentCoordinator(),
    startSelfImprovementOnce: async (root, options) => {
      const { startSelfImprovementOnce } = await import("../forge/modules/auto/autoEntryPoints.js");
      calls.push({ projectRoot: root, maxTicks: options?.maxTicks });
      return startSelfImprovementOnce(root, options);
    },
    enforceForgeModuleAccess: async (req, res) => {
      const approved = Boolean(req.body && typeof req.body === "object" && (req.body as { approved?: boolean }).approved === true);
      if (!approved) {
        res.status(403).json({ error: "Adaptive mode requires approval for agent." });
        return null;
      }
      return { mode: "adaptive", approved: true };
    }
  });
  const server = await new Promise<http.Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not bind");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    token: jwt.sign({ id: "1", role: "user" }, JWT_SECRET),
    projectRoot,
    calls,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  };
}

let ctx: Boot;

test.before(async () => {
  ctx = await boot();
});

test.after(async () => {
  await ctx.close();
});

function authHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = { authorization: `Bearer ${ctx.token}` };
  if (json) headers["content-type"] = "application/json";
  return headers;
}

test("GET /api/forge/agents/status returns the in-memory coordinator snapshot", async () => {
  const res = await fetch(`${ctx.baseUrl}/api/forge/agents/status`, { headers: authHeaders() });
  const body = (await res.json()) as { activeAgents?: unknown[]; queuedTasks?: unknown[]; lastUpdated?: string };
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.activeAgents));
  assert.ok(Array.isArray(body.queuedTasks));
  assert.equal(typeof body.lastUpdated, "string");
});

test("POST /api/forge/agents/spawn returns a handle for a valid role and task", async () => {
  const res = await fetch(`${ctx.baseUrl}/api/forge/agents/spawn`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify({ role: "coder", task: { id: "t1", title: "Write the handler" }, approved: true })
  });
  const body = (await res.json()) as { id?: string; role?: string; task?: { id?: string }; error?: string };
  assert.equal(res.status, 200, body.error);
  assert.equal(body.role, "coder");
  assert.equal(body.task?.id, "t1");
  assert.match(body.id || "", /^coder-/);
});

test("POST /api/forge/agents/coordinate assigns unique tasks", async () => {
  const res = await fetch(`${ctx.baseUrl}/api/forge/agents/coordinate`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify({
      approved: true,
      agents: [{ id: "coder-1", role: "coder", task: { id: "t1", title: "Write the handler" } }],
      graph: { tasks: [{ id: "t1", title: "Write the handler" }] }
    })
  });
  const body = (await res.json()) as {
    assignments?: Array<{ id?: string }>;
    conflicts?: unknown[];
    error?: string;
  };
  assert.equal(res.status, 200, body.error);
  assert.equal(body.assignments?.length, 1);
  assert.equal(body.assignments?.[0]?.id, "coder-1");
  assert.deepEqual(body.conflicts, []);
});

test("POST /api/forge/self/improve runs one local tick", async () => {
  const res = await fetch(`${ctx.baseUrl}/api/forge/self/improve`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify({ maxTicks: 1, approved: true })
  });
  const body = (await res.json()) as { status?: string; ticks?: number; reason?: string; error?: string };
  assert.equal(res.status, 200, body.error ?? JSON.stringify(body));
  assert.equal(ctx.calls.length, 1);
  assert.equal(ctx.calls[0]?.projectRoot, ctx.projectRoot);
  assert.equal(ctx.calls[0]?.maxTicks, 1);
  assert.equal(body.status, "halted");
  assert.equal(body.ticks, 1);
  assert.equal(body.reason, "safety gateway halted self loop");
});
