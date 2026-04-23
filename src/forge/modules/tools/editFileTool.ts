import fs from "node:fs/promises";
import { z } from "zod";
import type { ForgeTool, ToolContext, ToolExecuteResult } from "./types.js";
import { assertSafeFilePath } from "./toolPath.js";

const schema = z.object({
  path: z.string().min(1).max(4_096),
  oldText: z.string().min(1).max(2_000_000),
  newText: z.string().max(2_000_000),
  replaceAll: z.boolean().optional()
});

type EditHandle = { absPath: string; previous: string };

export const editFileTool: ForgeTool = {
  name: "edit_file",
  description: "Replace one or all occurrences of oldText with newText in a UTF-8 file.",
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
  ): Promise<ToolExecuteResult<{ path: string; replacements: number }>> {
    const v = schema.safeParse(input);
    if (!v.success) {
      return { success: false, error: v.error.message, code: "VALIDATION" };
    }
    const check = assertSafeFilePath(ctx.projectRoot, v.data.path);
    if (!check.ok) {
      return { success: false, error: check.error, code: "PATH" };
    }
    let before: string;
    try {
      before = await fs.readFile(check.absPath, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") {
        return { success: false, error: "File not found.", code: "ENOENT" };
      }
      return { success: false, error: (e as Error).message, code: "IO" };
    }
    const { oldText, newText, replaceAll } = v.data;
    if (!before.includes(oldText) && !replaceAll) {
      return { success: false, error: "oldText not found in file.", code: "NO_MATCH" };
    }
    let after: string;
    let n: number;
    if (replaceAll) {
      const parts = before.split(oldText);
      n = parts.length - 1;
      if (n === 0) {
        return { success: false, error: "oldText not found in file.", code: "NO_MATCH" };
      }
      after = parts.join(newText);
    } else {
      const i = before.indexOf(oldText);
      n = 1;
      after = before.slice(0, i) + newText + before.slice(i + oldText.length);
    }
    const handle: EditHandle = { absPath: check.absPath, previous: before };
    try {
      await fs.writeFile(check.absPath, after, "utf8");
    } catch (e) {
      return { success: false, error: (e as Error).message, code: "IO" };
    }
    return {
      success: true,
      data: { path: check.relPosix, replacements: n },
      rollbackHandle: handle
    };
  },
  async rollback(_ctx, rollbackHandle) {
    const h = rollbackHandle as EditHandle | null | undefined;
    if (!h) {
      return { success: true, data: undefined };
    }
    try {
      await fs.writeFile(h.absPath, h.previous, "utf8");
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "rollback failed",
        code: "ROLLBACK"
      };
    }
    return { success: true, data: undefined };
  }
};
