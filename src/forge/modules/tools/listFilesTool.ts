import fg from "fast-glob";
import { z } from "zod";
import type { ForgeTool, ToolContext, ToolExecuteResult } from "./types.js";
import { DEFAULT_IGNORE } from "./searchShared.js";

const schema = z.object({
  pattern: z.string().min(1).max(500).optional(),
  maxFiles: z.number().int().min(1).max(10_000).optional()
});

export const listFilesTool: ForgeTool = {
  name: "list_files",
  description: "List files under the project (fast-glob) excluding node_modules, .git, and build dirs.",
  inputSchema: schema,
  validate(raw) {
    const p = schema.safeParse(raw);
    if (!p.success) {
      return { ok: false, error: p.error.message };
    }
    return { ok: true, data: p.data };
  },
  async execute(
    ctx: ToolContext,
    input: unknown
  ): Promise<ToolExecuteResult<{ files: string[]; truncated: boolean; pattern: string }>> {
    const v = schema.safeParse(input);
    if (!v.success) {
      return { success: false, error: v.error.message, code: "VALIDATION" };
    }
    const pattern = v.data.pattern ?? "**/*";
    const cap = v.data.maxFiles ?? 1_000;
    const all = await fg(pattern, {
      cwd: ctx.projectRoot,
      ignore: DEFAULT_IGNORE,
      onlyFiles: true,
      dot: true
    });
    all.sort();
    const truncated = all.length > cap;
    const files = (truncated ? all.slice(0, cap) : all).map((f) => f.split(/[/\\]/g).join("/"));
    return { success: true, data: { files, truncated, pattern } };
  },
  async rollback() {
    return { success: true, data: undefined };
  }
};
