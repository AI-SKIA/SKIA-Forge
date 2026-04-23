import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { evaluateCommandSafety } from "../../../agentSafety.js";
import type { ForgeTool, ToolContext, ToolExecuteResult } from "./types.js";
import { assertSafeFilePath } from "./toolPath.js";

const pexec = promisify(exec);

const schema = z.object({
  command: z.string().min(1).max(8_000),
  /** Working directory, relative to project; empty = project root. */
  cwd: z.string().max(1_000).optional(),
  timeoutMs: z.number().int().min(1_000).max(300_000).optional(),
  /**
   * D1-10: set by the agent executor only after `highRiskCommandApprovals[stepId]`
   * (matches destructive / approval-gated `evaluateCommandSafety` cases).
   */
  approved: z.literal(true).optional()
});

function resolveShellCwd(projectRoot: string, sub?: string) {
  if (sub == null || sub.length === 0) {
    return { ok: true as const, abs: projectRoot };
  }
  if (/[\0\n\r]/.test(sub)) {
    return { ok: false as const, error: "Invalid cwd." };
  }
  const c = assertSafeFilePath(projectRoot, sub);
  if (!c.ok) {
    return c;
  }
  return { ok: true as const, abs: path.join(projectRoot, c.relPosix) };
}

export const runTerminalTool: ForgeTool = {
  name: "run_terminal",
  description: "Run a one-line shell command in the project (or a subpath). Blocked for clearly destructive patterns; no rollback.",
  inputSchema: schema,
  validate(raw) {
    const p = schema.safeParse(raw);
    if (!p.success) {
      return { ok: false, error: p.error.message };
    }
    if (p.data.command.includes("\n") && p.data.command.trim().split("\n").length > 1) {
      return { ok: false, error: "Only a single line command is allowed (no scripts)." };
    }
    return { ok: true, data: p.data };
  },
  async execute(
    ctx: ToolContext,
    input: unknown
  ): Promise<ToolExecuteResult<{ stdout: string; stderr: string; exitCode?: number }>> {
    const v = schema.safeParse(input);
    if (!v.success) {
      return { success: false, error: v.error.message, code: "VALIDATION" };
    }
    const { command, cwd: sub, timeoutMs = 60_000, approved } = v.data;
    const safety = evaluateCommandSafety(command);
    if (!safety.allowed) {
      if (safety.approvalRequired && approved === true) {
        // proceed: executor has recorded explicit user approval
      } else {
        return {
          success: false,
          error: `Command not allowed: ${safety.reason}`,
          code: "SAFETY"
        };
      }
    }
    const c = resolveShellCwd(ctx.projectRoot, sub);
    if (!c.ok) {
      return { success: false, error: c.error, code: "PATH" };
    }
    try {
      const { stdout, stderr } = await pexec(command, {
        cwd: c.abs,
        maxBuffer: 2 * 1024 * 1024,
        timeout: timeoutMs,
        windowsHide: true
      });
      return { success: true, data: { stdout: String(stdout), stderr: String(stderr), exitCode: 0 } };
    } catch (e: unknown) {
      const ex = e as { stdout?: string; stderr?: string; code?: number; message?: string; killed?: boolean };
      if (ex.killed) {
        return { success: false, error: "Command timed out or was killed.", code: "TIMEOUT" };
      }
      return {
        success: true,
        data: {
          stdout: String(ex.stdout ?? ""),
          stderr: String(ex.stderr ?? ex.message ?? e),
          exitCode: ex.code
        }
      };
    }
  },
  async rollback() {
    return { success: true, data: undefined };
  }
};
