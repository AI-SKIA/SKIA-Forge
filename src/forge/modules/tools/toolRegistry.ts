import type { ForgeTool } from "./types.js";
import { readFileTool } from "./readFileTool.js";
import { writeFileTool } from "./writeFileTool.js";
import { editFileTool } from "./editFileTool.js";
import { searchCodebaseTool } from "./searchCodebaseTool.js";
import { searchTextTool } from "./searchTextTool.js";
import { runTerminalTool } from "./runTerminalTool.js";
import { gitOperationsTool } from "./gitOperationsTool.js";
import { listFilesTool } from "./listFilesTool.js";

const DEFAULT_TOOLS: ForgeTool[] = [
  readFileTool,
  writeFileTool,
  editFileTool,
  searchCodebaseTool,
  searchTextTool,
  runTerminalTool,
  gitOperationsTool,
  listFilesTool
];

/**
 * D1-09: pluggable registry; default set includes all eight v1 tools.
 * Executor is not wired here.
 */
export class ToolRegistry {
  private readonly byName = new Map<string, ForgeTool>();
  private readonly health = new Map<string, boolean[]>();

  register(tool: ForgeTool) {
    this.byName.set(tool.name, tool);
  }

  /** Replace if same name. */
  registerAll(tools: readonly ForgeTool[]) {
    for (const t of tools) {
      this.register(t);
    }
  }

  get(name: string): ForgeTool | undefined {
    return this.byName.get(name);
  }

  listNames(): string[] {
    return [...this.byName.keys()].sort();
  }

  all(): ForgeTool[] {
    return [...this.byName.values()];
  }

  reliability_score(toolId: string): number {
    const rows = this.health.get(toolId) || [];
    if (!rows.length) return 1;
    const recent = rows.slice(-100);
    return recent.filter(Boolean).length / recent.length;
  }

  record_result(toolId: string, success: boolean): void {
    const rows = this.health.get(toolId) || [];
    this.health.set(toolId, [...rows.slice(-99), success]);
  }

  async parallel_dispatch(calls: Array<{ name: string; input: unknown; context: any }>): Promise<unknown[]> {
    return Promise.all(
      calls.map(async (c) => {
        const tool = this.get(c.name);
        if (!tool) return { error: "tool_not_found", name: c.name };
        try {
          const out = await tool.execute(c.context, c.input);
          this.record_result(c.name, true);
          return out;
        } catch (error: any) {
          this.record_result(c.name, false);
          return { error: error?.message || "tool_failed", name: c.name };
        }
      })
    );
  }
}

export function createDefaultToolRegistry(): ToolRegistry {
  const r = new ToolRegistry();
  r.registerAll(DEFAULT_TOOLS);
  return r;
}

export { DEFAULT_TOOLS };
