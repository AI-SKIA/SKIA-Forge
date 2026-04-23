import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type SdlcEventTypeV1 =
  | "commit"
  | "test_run"
  | "lint_run"
  | "typecheck_run"
  | "build_run"
  | "agent_run"
  | "planner_run"
  | "context_retrieval";

export type SdlcEventStatusV1 = "success" | "failure";

export type SdlcEventV1 = {
  v: 1;
  id: string;
  timestamp: string;
  projectRoot: string;
  type: SdlcEventTypeV1;
  status: SdlcEventStatusV1;
  durationMs?: number;
  path?: string;
  details?: string;
  meta?: Record<string, unknown>;
};

export type SdlcEventStoreV1 = {
  dirPath: string;
  filePath: string;
};

export type QuerySdlcEventsV1 = {
  since?: string;
  types?: SdlcEventTypeV1[];
  limit?: number;
  path?: string;
};

const SDLC_EVENTS_DIR = ".skia/sdlc-events";
const SDLC_EVENTS_FILE = "events-v1.jsonl";
let sdlcQueue: Promise<void> = Promise.resolve();

export function getSdlcEventStoreV1(projectRoot: string): SdlcEventStoreV1 {
  const dirPath = path.join(projectRoot, SDLC_EVENTS_DIR);
  return {
    dirPath,
    filePath: path.join(dirPath, SDLC_EVENTS_FILE)
  };
}

export async function recordSdlcEvent(
  event: Omit<SdlcEventV1, "v" | "id" | "timestamp"> & Partial<Pick<SdlcEventV1, "id" | "timestamp">>
): Promise<SdlcEventV1> {
  const normalized: SdlcEventV1 = {
    v: 1,
    id: event.id ?? randomUUID(),
    timestamp: event.timestamp ?? new Date().toISOString(),
    projectRoot: event.projectRoot,
    type: event.type,
    status: event.status,
    ...(typeof event.durationMs === "number" ? { durationMs: event.durationMs } : {}),
    ...(event.path ? { path: event.path } : {}),
    ...(event.details ? { details: event.details } : {}),
    ...(event.meta ? { meta: event.meta } : {})
  };
  const store = getSdlcEventStoreV1(normalized.projectRoot);
  sdlcQueue = sdlcQueue.then(async () => {
    await fs.mkdir(store.dirPath, { recursive: true });
    await fs.appendFile(store.filePath, `${JSON.stringify(normalized)}\n`, "utf8");
  }).catch((error) => {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[sdlc] failed to record event: ${msg}`);
  });
  await sdlcQueue;
  return normalized;
}

export async function querySdlcEvents(
  projectRoot: string,
  query: QuerySdlcEventsV1 = {}
): Promise<SdlcEventV1[]> {
  const { filePath } = getSdlcEventStoreV1(projectRoot);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
  const sinceMs = query.since ? Date.parse(query.since) : NaN;
  const typeSet = query.types?.length ? new Set(query.types) : null;
  const pathPrefix = query.path?.trim();
  const rows = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as SdlcEventV1;
      } catch {
        return null;
      }
    })
    .filter((x): x is SdlcEventV1 => x != null && x.v === 1)
    .filter((x) => (Number.isFinite(sinceMs) ? Date.parse(x.timestamp) >= sinceMs : true))
    .filter((x) => (typeSet ? typeSet.has(x.type) : true))
    .filter((x) => (pathPrefix ? x.path?.startsWith(pathPrefix) : true))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const lim = query.limit && query.limit > 0 ? Math.floor(query.limit) : 0;
  return lim > 0 ? rows.slice(-lim) : rows;
}
