import fs from "node:fs/promises";
import path from "node:path";
import type { ForgeAuditV1 } from "./types.js";
import { AgentAuditLogRecord } from "./types.js";

const AUDIT_DIR = ".skia";
const AUDIT_FILE = "agent-log.json";
let auditWriteQueue: Promise<void> = Promise.resolve();

export async function appendAuditLog(
  projectRoot: string,
  record: AgentAuditLogRecord
): Promise<void> {
  auditWriteQueue = auditWriteQueue.then(async () => {
    const dir = path.join(projectRoot, AUDIT_DIR);
    const filePath = path.join(dir, AUDIT_FILE);

    await fs.mkdir(dir, { recursive: true });
    const existing = await readAuditLog(projectRoot);
    existing.push(record);
    await fs.writeFile(filePath, JSON.stringify(existing, null, 2), "utf8");
  });
  await auditWriteQueue;
}

type ForgeAuditOptionalFields = {
  rulesContext: string | null;
  vectorSearchMeta: unknown | null;
  lspSkiarules: unknown | null;
  diagnostics: unknown | null;
  governance: unknown | null;
  contextRetrievalMeta: unknown | null;
  retrievalWarnings: unknown | null;
};

const NULL_AUDIT: ForgeAuditOptionalFields = {
  rulesContext: null,
  vectorSearchMeta: null,
  lspSkiarules: null,
  diagnostics: null,
  governance: null,
  contextRetrievalMeta: null,
  retrievalWarnings: null
};

/**
 * D1-15: consistent `parameters` keys for planner, executor, retrieval, self-correct.
 * Omitted fields are not merged; use null entries from NULL_AUDIT for full coverage.
 */
export function mergeForgeAuditParamsV1(
  source: string,
  partial: Partial<ForgeAuditOptionalFields> & Record<string, unknown>
): Record<string, unknown> {
  const forgeAudit: ForgeAuditV1 = { v: 1, source };
  return {
    ...NULL_AUDIT,
    ...partial,
    forgeAudit
  };
}

export async function readAuditLog(
  projectRoot: string
): Promise<AgentAuditLogRecord[]> {
  const filePath = path.join(projectRoot, AUDIT_DIR, AUDIT_FILE);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as AgentAuditLogRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
