/**
 * Pre-agent workspace checkpoint for the Forge IDE agent panel. Records each file's content
 * before the agent's first write to it, so the user can put the workspace back after a run.
 */

export type CheckpointIo = {
  readFile: (absPath: string) => Promise<string>;
  saveFile: (absPath: string, content: string) => Promise<boolean>;
  deleteFile: (absPath: string) => Promise<boolean>;
};

export type CheckpointEntry = {
  absPath: string;
  /** null = the agent created this file; restoring deletes it. */
  before: string | null;
};

export type CheckpointRestoreResult = {
  restored: string[];
  deleted: string[];
  failed: Array<{ absPath: string; error: string }>;
};

export class AgentWorkspaceCheckpoint {
  private readonly entriesByPath = new Map<string, CheckpointEntry>();

  constructor(
    readonly runId: string,
    private readonly io: CheckpointIo
  ) {}

  /** Snapshot the file once, before the first agent write in this run. */
  async captureBeforeWrite(absPath: string): Promise<void> {
    if (this.entriesByPath.has(absPath)) return;
    let before: string | null;
    try {
      before = await this.io.readFile(absPath);
    } catch {
      before = null;
    }
    this.entriesByPath.set(absPath, { absPath, before });
  }

  get size(): number {
    return this.entriesByPath.size;
  }

  entries(): CheckpointEntry[] {
    return [...this.entriesByPath.values()];
  }

  /** Writes every snapshot back (newest first) and deletes files the agent created. */
  async restore(): Promise<CheckpointRestoreResult> {
    const result: CheckpointRestoreResult = { restored: [], deleted: [], failed: [] };
    for (const entry of this.entries().reverse()) {
      try {
        const ok =
          entry.before === null
            ? await this.io.deleteFile(entry.absPath)
            : await this.io.saveFile(entry.absPath, entry.before);
        if (!ok) {
          result.failed.push({ absPath: entry.absPath, error: "write refused" });
          continue;
        }
        (entry.before === null ? result.deleted : result.restored).push(entry.absPath);
        this.entriesByPath.delete(entry.absPath);
      } catch (e) {
        result.failed.push({ absPath: entry.absPath, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return result;
  }
}
