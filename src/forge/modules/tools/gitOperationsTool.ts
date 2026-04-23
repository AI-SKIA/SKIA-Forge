import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import type { ForgeTool, ToolContext, ToolExecuteResult } from "./types.js";
import { assertSafeFilePath } from "./toolPath.js";

const pex = promisify(execFile);

const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("status") }),
  z.object({
    operation: z.literal("diff"),
    path: z.string().min(1).max(4_000).optional()
  }),
  z.object({
    operation: z.literal("log"),
    maxCount: z.number().int().min(1).max(100).optional()
  }),
  z.object({
    operation: z.literal("show"),
    object: z.string().regex(/^[0-9a-f]{7,50}$/i)
  })
]);

const GIT = "git" as const;

function gitBase(ctx: ToolContext) {
  return { cwd: ctx.projectRoot, maxBuffer: 4 * 1024 * 1024, timeout: 60_000, windowsHide: true };
}

export const gitOperationsTool: ForgeTool = {
  name: "git_operations",
  description: "Run a vetted read-only git command: status, diff, log, or show a commit; args are whitelisted, no arbitrary free-form command.",
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
  ): Promise<ToolExecuteResult<{ operation: string; output: string }>> {
    const v = schema.safeParse(input);
    if (!v.success) {
      return { success: false, error: v.error.message, code: "VALIDATION" };
    }
    const b = gitBase(ctx);
    try {
      let out: string;
      switch (v.data.operation) {
        case "status": {
          const { stdout } = await pex(GIT, ["status", "--porcelain", "-b"], b);
          out = stdout;
          break;
        }
        case "diff": {
          const args = ["diff", "HEAD", "--no-color"];
          if (v.data.path) {
            const c = assertSafeFilePath(ctx.projectRoot, v.data.path);
            if (!c.ok) {
              return { success: false, error: c.error, code: "PATH" };
            }
            args.push("--", c.relPosix);
          }
          const { stdout } = await pex(GIT, args, b);
          out = stdout;
          break;
        }
        case "log": {
          const n = v.data.maxCount ?? 20;
          const { stdout } = await pex(
            GIT,
            ["log", `-${n}`, "--oneline", "--no-color", "--decorate=short"],
            b
          );
          out = stdout;
          break;
        }
        case "show": {
          const { stdout } = await pex(
            GIT,
            ["show", "--stat", "--oneline", "--no-color", v.data.object],
            b
          );
          out = stdout;
          break;
        }
        default: {
          return { success: false, error: "Unknown operation", code: "OP" };
        }
      }
      return { success: true, data: { operation: v.data.operation, output: out } };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : "git failed",
        code: "GIT"
      };
    }
  },
  async rollback() {
    return { success: true, data: undefined };
  }
};
