import type { Express, Request, Response } from "express";
import {
  MultiAgentCoordinator,
  type AgentHandle,
  type AgentRole,
  type Task
} from "../forge/modules/agent-executor/MultiAgentCoordinator.js";
import type { ForgeModuleName } from "../forgeModuleExecutor.js";

type SelfOptions = {
  maxTicks?: number;
  advancedMode?: boolean;
  metaOptimizationMode?: boolean;
  introspectionSnapshot?: boolean;
  globalMode?: boolean;
  globalProjectRoots?: string[];
  sessionId?: string;
};

const AGENT_ROLES: readonly AgentRole[] = [
  "coder",
  "reviewer",
  "tester",
  "documenter",
  "security-scanner"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTask(value: unknown): value is Task {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.trim() !== "" && typeof value.title === "string" && value.title.trim() !== "";
}

function isRole(value: unknown): value is AgentRole {
  return typeof value === "string" && (AGENT_ROLES as readonly string[]).includes(value);
}

function isAgentHandle(value: unknown): value is AgentHandle {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && value.id.trim() !== "" && isRole(value.role) && isTask(value.task);
}

function parseSelfOptions(body: unknown): { ok: true; options?: SelfOptions } | { ok: false; error: string } {
  if (body == null) return { ok: true };
  if (!isRecord(body)) return { ok: false, error: "Body must be an object." };
  const options: SelfOptions = {};
  if ("maxTicks" in body && body.maxTicks !== undefined) {
    if (typeof body.maxTicks !== "number" || !Number.isFinite(body.maxTicks)) {
      return { ok: false, error: "maxTicks must be a finite number." };
    }
    options.maxTicks = body.maxTicks;
  }
  for (const key of ["advancedMode", "metaOptimizationMode", "introspectionSnapshot", "globalMode"] as const) {
    if (key in body && body[key] !== undefined) {
      if (typeof body[key] !== "boolean") return { ok: false, error: `${key} must be a boolean.` };
      options[key] = body[key];
    }
  }
  if ("globalProjectRoots" in body && body.globalProjectRoots !== undefined) {
    if (!Array.isArray(body.globalProjectRoots) || body.globalProjectRoots.some((item) => typeof item !== "string")) {
      return { ok: false, error: "globalProjectRoots must be an array of strings." };
    }
    options.globalProjectRoots = body.globalProjectRoots;
  }
  if ("sessionId" in body && body.sessionId !== undefined) {
    if (typeof body.sessionId !== "string") return { ok: false, error: "sessionId must be a string." };
    options.sessionId = body.sessionId;
  }
  return { ok: true, options };
}

export function registerLowRiskForgeOrchestratorRoutes(
  app: Express,
  deps: {
    projectRoot: string;
    coordinator: MultiAgentCoordinator;
    startSelfImprovementOnce: (projectRoot: string, options?: SelfOptions) => Promise<{
      status: "completed" | "paused" | "halted";
      ticks: number;
      reason: string;
    }>;
    enforceForgeModuleAccess: (
      req: Request,
      res: Response,
      moduleName: ForgeModuleName
    ) => Promise<{ mode: string; approved: boolean } | null>;
  }
): void {
  app.post("/api/forge/self/improve", async (req, res) => {
    const parsed = parseSelfOptions(req.body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const access = await deps.enforceForgeModuleAccess(req, res, "agent");
    if (!access) return;
    try {
      const result = await deps.startSelfImprovementOnce(deps.projectRoot, parsed.options);
      return res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Self improvement failed";
      return res.status(500).json({ error: message });
    }
  });

  app.get("/api/forge/agents/status", (_req, res) => {
    res.json(deps.coordinator.status());
  });

  app.post("/api/forge/agents/spawn", async (req, res) => {
    const body = isRecord(req.body) ? req.body : null;
    if (!body || !isRole(body.role) || !isTask(body.task)) {
      return res.status(400).json({
        error: "Invalid body: { role: coder|reviewer|tester|documenter|security-scanner, task: { id, title } }"
      });
    }
    const access = await deps.enforceForgeModuleAccess(req, res, "agent");
    if (!access) return;
    const handle = await deps.coordinator.spawn(body.role, { id: body.task.id, title: body.task.title });
    return res.json(handle);
  });

  app.post("/api/forge/agents/coordinate", async (req, res) => {
    const body = isRecord(req.body) ? req.body : null;
    const agents = body && Array.isArray(body.agents) ? body.agents : null;
    const graph = body && isRecord(body.graph) ? body.graph : null;
    const tasks = graph && Array.isArray(graph.tasks) ? graph.tasks : null;
    if (!agents || !tasks || agents.some((agent) => !isAgentHandle(agent)) || tasks.some((task) => !isTask(task))) {
      return res.status(400).json({
        error: "Invalid body: { agents: [{ id, role, task: { id, title } }], graph: { tasks: [{ id, title }] } }"
      });
    }
    const access = await deps.enforceForgeModuleAccess(req, res, "agent");
    if (!access) return;
    const result = await deps.coordinator.coordinate(agents, { tasks });
    return res.json(result);
  });
}
