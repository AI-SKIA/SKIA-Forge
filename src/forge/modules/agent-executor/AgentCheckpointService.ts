import { promises as fs } from 'node:fs';
import path from 'node:path';

export type AgentState = Record<string, unknown>;
export type CheckpointMeta = { id: string; filePath: string };

const baseDir = path.join(process.cwd(), '.skia', 'checkpoints');

export class AgentCheckpointService {
  private async ensureDir(): Promise<void> {
    await fs.mkdir(baseDir, { recursive: true });
  }

  async save(agentId: string, state: AgentState): Promise<string> {
    await this.ensureDir();
    const checkpointId = `${agentId}-${Date.now()}`;
    const filePath = path.join(baseDir, `${checkpointId}.json`);
    await fs.writeFile(filePath, JSON.stringify(state, null, 2), 'utf8');
    return checkpointId;
  }

  async load(checkpointId: string): Promise<AgentState> {
    const filePath = path.join(baseDir, `${checkpointId}.json`);
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as AgentState;
  }

  async list(): Promise<CheckpointMeta[]> {
    await this.ensureDir();
    const files = await fs.readdir(baseDir);
    return files.filter((f) => f.endsWith('.json')).map((f) => ({ id: f.replace(/\.json$/, ''), filePath: path.join(baseDir, f) }));
  }

  async cleanup(olderThanMs = 14 * 24 * 60 * 60 * 1000): Promise<number> {
    await this.ensureDir();
    const files = await fs.readdir(baseDir);
    const now = Date.now();
    let removed = 0;
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const filePath = path.join(baseDir, file);
      const stats = await fs.stat(filePath);
      if (now - stats.mtimeMs > olderThanMs) {
        await fs.rm(filePath, { force: true });
        removed += 1;
      }
    }
    return removed;
  }
}
