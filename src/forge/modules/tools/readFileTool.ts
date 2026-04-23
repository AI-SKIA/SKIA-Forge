import fs from "node:fs/promises";
import { z } from "zod";
import type { ForgeTool, ToolContext, ToolExecuteResult } from "./types.js";
import { assertSafeFilePath } from "./toolPath.js";

const MAX_READ_BYTES = 2_000_000;

const schema = z.object({
  path: z.string().min(1).max(4_096)
});

export const readFileTool: ForgeTool = {
  name: "read_file",
  description: "Read a UTF-8 file under the project root (refuses .env*).",
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
  ): Promise<ToolExecuteResult<{ path: string; content: string; truncated: boolean }>> {
    const v = schema.safeParse(input);
    if (!v.success) {
      return { success: false, error: v.error.message, code: "VALIDATION" };
    }
    const check = assertSafeFilePath(ctx.projectRoot, v.data.path);
    if (!check.ok) {
      return { success: false, error: check.error, code: "PATH" };
    }
    try {
      const buf = await fs.readFile(check.absPath);
      const truncated = buf.length > MAX_READ_BYTES;
      const slice = truncated ? buf.subarray(0, MAX_READ_BYTES) : buf;
      return {
        success: true,
        data: {
          path: check.relPosix,
          content: slice.toString("utf8"),
          truncated
        }
      };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        return { success: false, error: "File not found.", code: "ENOENT" };
      }
      return { success: false, error: e instanceof Error ? e.message : "read failed", code: "IO" };
    }
  },
  async rollback() {
    return { success: true, data: undefined };
  }
};
