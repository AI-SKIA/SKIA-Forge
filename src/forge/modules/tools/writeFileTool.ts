import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ForgeTool, ToolContext, ToolExecuteResult } from "./types.js";
import { assertSafeFilePath } from "./toolPath.js";

const schema = z.object({
  path: z.string().min(1).max(4_096),
  content: z.string(),
  createDirectories: z.boolean().optional()
});

type WriteHandle = { relPosix: string; absPath: string; previous: string | null };

export const writeFileTool: ForgeTool = {
  name: "write_file",
  description: "Create or replace a file under the project. Rollback restores previous bytes or removes created file.",
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
  ): Promise<ToolExecuteResult<{ path: string; bytesWritten: number }>> {
    const v = schema.safeParse(input);
    if (!v.success) {
      return { success: false, error: v.error.message, code: "VALIDATION" };
    }
    const check = assertSafeFilePath(ctx.projectRoot, v.data.path);
    if (!check.ok) {
      return { success: false, error: check.error, code: "PATH" };
    }
    let previous: string | null = null;
    try {
      previous = await fs.readFile(check.absPath, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
        return { success: false, error: (e as Error).message, code: "IO" };
      }
    }
    if (v.data.createDirectories) {
      await fs.mkdir(path.dirname(check.absPath), { recursive: true });
    }
    const buf = Buffer.from(v.data.content, "utf8");
    try {
      await fs.writeFile(check.absPath, buf, "utf8");
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "write failed", code: "IO" };
    }
    const handle: WriteHandle = {
      relPosix: check.relPosix,
      absPath: check.absPath,
      previous
    };
    return {
      success: true,
      data: { path: check.relPosix, bytesWritten: buf.length },
      rollbackHandle: handle
    };
  },
  async rollback(ctx, rollbackHandle) {
    const h = rollbackHandle as WriteHandle | null | undefined;
    if (!h) {
      return { success: true, data: undefined };
    }
    if (h.previous === null) {
      try {
        await fs.unlink(h.absPath);
      } catch {
        /* ignore */
      }
      return { success: true, data: undefined };
    }
    try {
      await fs.writeFile(h.absPath, h.previous, "utf8");
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "rollback write failed",
        code: "ROLLBACK"
      };
    }
    return { success: true, data: undefined };
  }
};
