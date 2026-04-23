import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type WorkItemTypeV1 = "feature" | "bug" | "refactor" | "test" | "infra" | "research";
export type WorkItemPriorityV1 = "P0" | "P1" | "P2" | "P3" | "P4";
export type WorkItemStatusV1 = "todo" | "in_progress" | "blocked" | "done";

export type WorkItemV1 = {
  v: 1;
  id: string;
  title: string;
  description: string;
  type: WorkItemTypeV1;
  priority: WorkItemPriorityV1;
  status: WorkItemStatusV1;
  createdAt: string;
  updatedAt: string;
  relatedFiles: string[];
  relatedTests: string[];
  sdlcSignals: { risk: number; drift: number; forecast: number; health: number };
  dependencies: string[];
  tags: string[];
};

export type QueryWorkItemsV1 = {
  type?: WorkItemTypeV1;
  status?: WorkItemStatusV1;
  priority?: WorkItemPriorityV1;
  tags?: string[];
  limit?: number;
};

const WORK_DIR = ".skia/work-items";
const WORK_FILE = "items-v1.jsonl";
let queue: Promise<void> = Promise.resolve();

function store(projectRoot: string) {
  const dir = path.join(projectRoot, WORK_DIR);
  return { dir, file: path.join(dir, WORK_FILE) };
}

async function readAll(projectRoot: string): Promise<WorkItemV1[]> {
  const s = store(projectRoot);
  let raw: string;
  try {
    raw = await fs.readFile(s.file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return raw
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      try {
        return JSON.parse(x) as WorkItemV1;
      } catch {
        return null;
      }
    })
    .filter((x): x is WorkItemV1 => x != null && x.v === 1);
}

async function append(projectRoot: string, item: WorkItemV1): Promise<void> {
  const s = store(projectRoot);
  queue = queue.then(async () => {
    await fs.mkdir(s.dir, { recursive: true });
    await fs.appendFile(s.file, `${JSON.stringify(item)}\n`, "utf8");
  });
  await queue;
}

function uniq(xs: string[]): string[] {
  return [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
}

export async function createWorkItem(
  projectRoot: string,
  data: Omit<WorkItemV1, "v" | "id" | "createdAt" | "updatedAt">
): Promise<WorkItemV1> {
  const now = new Date().toISOString();
  const item: WorkItemV1 = {
    v: 1,
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...data,
    relatedFiles: uniq(data.relatedFiles ?? []),
    relatedTests: uniq(data.relatedTests ?? []),
    dependencies: uniq(data.dependencies ?? []),
    tags: uniq(data.tags ?? [])
  };
  await append(projectRoot, item);
  return item;
}

export async function queryWorkItems(
  projectRoot: string,
  query: QueryWorkItemsV1 = {}
): Promise<WorkItemV1[]> {
  const all = await readAll(projectRoot);
  const tagSet = query.tags?.length ? new Set(query.tags) : null;
  const rows = all
    .filter((x) => (query.type ? x.type === query.type : true))
    .filter((x) => (query.status ? x.status === query.status : true))
    .filter((x) => (query.priority ? x.priority === query.priority : true))
    .filter((x) => (tagSet ? x.tags.some((t) => tagSet.has(t)) : true))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const lim = query.limit && query.limit > 0 ? Math.floor(query.limit) : 0;
  return lim ? rows.slice(0, lim) : rows;
}

async function latestById(projectRoot: string, id: string): Promise<WorkItemV1 | null> {
  const all = await readAll(projectRoot);
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i]!.id === id) return all[i]!;
  }
  return null;
}

export async function updateWorkItem(
  projectRoot: string,
  id: string,
  patch: Partial<Omit<WorkItemV1, "v" | "id" | "createdAt" | "updatedAt">>
): Promise<WorkItemV1 | null> {
  const prev = await latestById(projectRoot, id);
  if (!prev) return null;
  const next: WorkItemV1 = {
    ...prev,
    ...patch,
    relatedFiles: uniq([...(prev.relatedFiles ?? []), ...((patch.relatedFiles as string[] | undefined) ?? [])]),
    relatedTests: uniq([...(prev.relatedTests ?? []), ...((patch.relatedTests as string[] | undefined) ?? [])]),
    dependencies: uniq([...(prev.dependencies ?? []), ...((patch.dependencies as string[] | undefined) ?? [])]),
    tags: uniq([...(prev.tags ?? []), ...((patch.tags as string[] | undefined) ?? [])]),
    updatedAt: new Date().toISOString()
  };
  await append(projectRoot, next);
  return next;
}

export async function linkFilesToWorkItem(projectRoot: string, id: string, files: string[]): Promise<WorkItemV1 | null> {
  return updateWorkItem(projectRoot, id, { relatedFiles: files });
}

export async function linkTestsToWorkItem(projectRoot: string, id: string, tests: string[]): Promise<WorkItemV1 | null> {
  return updateWorkItem(projectRoot, id, { relatedTests: tests });
}

export async function ensureWorkItemForPlan(projectRoot: string, input: {
  title: string;
  description: string;
  relatedFiles: string[];
  sdlcSignals: { risk: number; drift: number; forecast: number; health: number };
  tags?: string[];
}): Promise<WorkItemV1> {
  const existing = (await queryWorkItems(projectRoot, { status: "in_progress", limit: 20 }))
    .find((w) => w.title.toLowerCase() === input.title.toLowerCase());
  if (existing) {
    return (await updateWorkItem(projectRoot, existing.id, {
      description: input.description,
      relatedFiles: input.relatedFiles,
      sdlcSignals: input.sdlcSignals,
      tags: input.tags ?? []
    }))!;
  }
  return createWorkItem(projectRoot, {
    title: input.title,
    description: input.description,
    type: "feature",
    priority: "P2",
    status: "in_progress",
    relatedFiles: input.relatedFiles,
    relatedTests: [],
    sdlcSignals: input.sdlcSignals,
    dependencies: [],
    tags: input.tags ?? []
  });
}

export async function autoTagWorkItemsFromSdlc(
  projectRoot: string,
  hotspotFiles: string[],
  driftScore: number
): Promise<void> {
  const open = await queryWorkItems(projectRoot, { limit: 200 });
  const driftTag = driftScore >= 60 ? ["drift-high"] : driftScore >= 35 ? ["drift-medium"] : [];
  for (const w of open) {
    const hit = w.relatedFiles.some((f) => hotspotFiles.includes(f));
    if (!hit && driftTag.length === 0) continue;
    await updateWorkItem(projectRoot, w.id, {
      tags: [...(hit ? ["hotspot"] : []), ...driftTag]
    });
  }
}
