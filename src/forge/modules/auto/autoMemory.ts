import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";

export type AutoMemoryEventV1 = {
  v: 1;
  id: string;
  timestamp: string;
  sessionId?: string;
  workItemId?: string;
  category:
    | "planner_pattern"
    | "executor_pattern"
    | "self_correct_pattern"
    | "drift_risk_pattern"
    | "sla_pattern"
    | "workitem_history";
  outcome: "success" | "failure";
  details?: string;
  meta?: Record<string, unknown>;
};

const AUTO_DIR = ".skia/auto";
const MEMORY_FILE = "memory-v1.jsonl";
let q: Promise<void> = Promise.resolve();

function store(projectRoot: string) {
  const dir = path.join(projectRoot, AUTO_DIR);
  return { dir, file: path.join(dir, MEMORY_FILE) };
}

export async function recordAutoMemory(
  projectRoot: string,
  event: Omit<AutoMemoryEventV1, "v" | "id" | "timestamp"> & Partial<Pick<AutoMemoryEventV1, "id" | "timestamp">>
): Promise<AutoMemoryEventV1> {
  const row: AutoMemoryEventV1 = {
    v: 1,
    id: event.id ?? randomUUID(),
    timestamp: event.timestamp ?? new Date().toISOString(),
    ...event
  };
  const s = store(projectRoot);
  q = q.then(async () => {
    await fs.mkdir(s.dir, { recursive: true });
    await fs.appendFile(s.file, `${JSON.stringify(row)}\n`, "utf8");
  });
  await q;
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "auto.memory.record",
    parameters: mergeForgeAuditParamsV1("auto_memory", {
      sessionId: row.sessionId ?? null,
      workItemId: row.workItemId ?? null,
      category: row.category,
      outcome: row.outcome,
      details: row.details ?? null,
      meta: row.meta ?? null
    }),
    result: "success"
  });
  return row;
}

export async function queryAutoMemory(
  projectRoot: string,
  filters?: {
    sessionId?: string;
    workItemId?: string;
    category?: AutoMemoryEventV1["category"];
    outcome?: AutoMemoryEventV1["outcome"];
    limit?: number;
  }
): Promise<AutoMemoryEventV1[]> {
  const s = store(projectRoot);
  let raw: string;
  try {
    raw = await fs.readFile(s.file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  const rows = raw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      try {
        return JSON.parse(x) as AutoMemoryEventV1;
      } catch {
        return null;
      }
    })
    .filter((x): x is AutoMemoryEventV1 => Boolean(x) && x!.v === 1)
    .filter((x) => (filters?.sessionId ? x.sessionId === filters.sessionId : true))
    .filter((x) => (filters?.workItemId ? x.workItemId === filters.workItemId : true))
    .filter((x) => (filters?.category ? x.category === filters.category : true))
    .filter((x) => (filters?.outcome ? x.outcome === filters.outcome : true))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const lim = filters?.limit && filters.limit > 0 ? Math.floor(filters.limit) : 0;
  return lim ? rows.slice(-lim) : rows;
}
