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
}

export function createDefaultToolRegistry(): ToolRegistry {
  const r = new ToolRegistry();
  r.registerAll(DEFAULT_TOOLS);
  return r;
}

export { DEFAULT_TOOLS };
