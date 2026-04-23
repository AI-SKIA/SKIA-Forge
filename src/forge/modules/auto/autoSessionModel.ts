import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type AutoExecutionSessionStatusV1 = "idle" | "running" | "paused" | "completed" | "aborted";
export type AutoExecutionPlanVersionV1 = "v1" | "v2" | "v3" | "v4";

export type AutoExecutionSessionStepV1 = {
  timestamp: string;
  type:
    | "plan"
    | "execute"
    | "selfCorrect"
    | "governanceCheck"
    | "slaCheck"
    | "failureRecovery"
    | "adaptation"
    | "stabilityCheck"
    | "memoryRecord";
  workItemId?: string;
  planId?: string;
  executorRunId?: string;
  outcome: "success" | "failure";
  notes?: string;
};

export type AutoExecutionSessionV1 = {
  v: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  status: AutoExecutionSessionStatusV1;
  workItemIds: string[];
  planVersionUsed: AutoExecutionPlanVersionV1;
  governanceSnapshot: unknown;
  sdlcSnapshot: unknown;
  orchestrationSnapshot: unknown;
  steps: AutoExecutionSessionStepV1[];
};

const AUTO_DIR = ".skia/auto";
const AUTO_FILE = "sessions-v1.jsonl";
let queue: Promise<void> = Promise.resolve();

function store(projectRoot: string) {
  const dir = path.join(projectRoot, AUTO_DIR);
  return { dir, file: path.join(dir, AUTO_FILE) };
}

async function readAll(projectRoot: string): Promise<AutoExecutionSessionV1[]> {
  const s = store(projectRoot);
  let raw: string;
  try {
    raw = await fs.readFile(s.file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  return raw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      try {
        return JSON.parse(x) as AutoExecutionSessionV1;
      } catch {
        return null;
      }
    })
    .filter((x): x is AutoExecutionSessionV1 => Boolean(x) && x!.v === 1);
}

async function append(projectRoot: string, row: AutoExecutionSessionV1): Promise<void> {
  const s = store(projectRoot);
  queue = queue.then(async () => {
    await fs.mkdir(s.dir, { recursive: true });
    await fs.appendFile(s.file, `${JSON.stringify(row)}\n`, "utf8");
  });
  await queue;
}

export async function createAutoSession(
  projectRoot: string,
  workItemIds: string[],
  context: {
    planVersionUsed: AutoExecutionPlanVersionV1;
    governanceSnapshot: unknown;
    sdlcSnapshot: unknown;
    orchestrationSnapshot: unknown;
  }
): Promise<AutoExecutionSessionV1> {
  const now = new Date().toISOString();
  const row: AutoExecutionSessionV1 = {
    v: 1,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: "running",
    workItemIds,
    planVersionUsed: context.planVersionUsed,
    governanceSnapshot: context.governanceSnapshot,
    sdlcSnapshot: context.sdlcSnapshot,
    orchestrationSnapshot: context.orchestrationSnapshot,
    steps: []
  };
  await append(projectRoot, row);
  return row;
}

async function latestById(projectRoot: string, sessionId: string): Promise<AutoExecutionSessionV1 | null> {
  const all = await readAll(projectRoot);
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i]!.id === sessionId) return all[i]!;
  }
  return null;
}

export async function appendAutoSessionStep(
  projectRoot: string,
  sessionId: string,
  step: Omit<AutoExecutionSessionStepV1, "timestamp"> & { timestamp?: string }
): Promise<AutoExecutionSessionV1 | null> {
  const prev = await latestById(projectRoot, sessionId);
  if (!prev) return null;
  const next: AutoExecutionSessionV1 = {
    ...prev,
    updatedAt: new Date().toISOString(),
    steps: [...prev.steps, { ...step, timestamp: step.timestamp ?? new Date().toISOString() }]
  };
  await append(projectRoot, next);
  return next;
}

export async function updateAutoSessionStatus(
  projectRoot: string,
  sessionId: string,
  status: AutoExecutionSessionStatusV1,
  notes?: string
): Promise<AutoExecutionSessionV1 | null> {
  const prev = await latestById(projectRoot, sessionId);
  if (!prev) return null;
  const next: AutoExecutionSessionV1 = {
    ...prev,
    updatedAt: new Date().toISOString(),
    status,
    ...(notes
      ? {
          steps: [
            ...prev.steps,
            {
              timestamp: new Date().toISOString(),
              type: "governanceCheck",
              outcome: status === "completed" ? "success" : "failure",
              notes
            }
          ]
        }
      : {})
  };
  await append(projectRoot, next);
  return next;
}

export async function getAutoSession(
  projectRoot: string,
  sessionId: string
): Promise<AutoExecutionSessionV1 | null> {
  return latestById(projectRoot, sessionId);
}

export async function listAutoSessions(
  projectRoot: string,
  options?: { status?: AutoExecutionSessionStatusV1; limit?: number }
): Promise<AutoExecutionSessionV1[]> {
  const all = await readAll(projectRoot);
  const rows = all
    .filter((s) => (options?.status ? s.status === options.status : true))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const lim = options?.limit && options.limit > 0 ? Math.floor(options.limit) : 0;
  return lim ? rows.slice(0, lim) : rows;
}
