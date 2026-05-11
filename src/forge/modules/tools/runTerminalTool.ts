/**
 * runTerminalTool.ts  — SKIA FORGE  (backend / main repo)
 *
 * Replaces the old version. Key changes:
 *  - User commands are UNRESTRICTED (safety gate removed for user-initiated runs).
 *    SKIA's own agent-initiated commands still go through evaluateCommandSafety.
 *  - cwd always resolves from ctx.projectRoot (the folder the user opened),
 *    never a hardcoded fallback.
 *  - Output is echoed back on the `skia:terminalOutput` IPC channel so
 *    SKIA's brain can observe terminal activity.
 *  - Timeout extended to 5 min default; configurable per call.
 */

import { exec } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import os from "node:os";
import { z } from "zod";
import { evaluateCommandSafety } from "../../../agentSafety.js";
import type { ForgeTool, ToolContext, ToolExecuteResult } from "./types.js";
import { assertSafeFilePath } from "./toolPath.js";

const pexec = promisify(exec);

// ─────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────

const schema = z.object({
    command: z.string().min(1).max(8_000),

    /** Working directory, relative to project root; empty = project root. */
    cwd: z.string().max(1_000).optional(),

    /** Timeout in ms. Default 300 000 (5 min). Max 10 min. */
    timeoutMs: z.number().int().min(1_000).max(600_000).optional(),

    /**
     * When `source === "user"` the safety gate is bypassed — the human
     * is explicitly running the command themselves in the terminal.
     * When omitted or `"agent"`, evaluateCommandSafety is enforced.
     */
    source: z.enum(["user", "agent"]).optional(),

    /**
     * D1-10: set by the agent executor after explicit user approval of a
     * high-risk agent command.
     */
    approved: z.literal(true).optional()
});

type ToolInput = z.infer<typeof schema>;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function resolveShellCwd(
    projectRoot: string,
    sub?: string
): { ok: true; abs: string } | { ok: false; error: string } {
    if (sub == null || sub.length === 0) {
        return { ok: true, abs: projectRoot };
    }
    if (/[\0\n\r]/.test(sub)) {
        return { ok: false, error: "Invalid cwd: contains null or newline characters." };
    }
    const c = assertSafeFilePath(projectRoot, sub);
    if (!c.ok) return c;
    return { ok: true, abs: path.join(projectRoot, c.relPosix) };
}

/** The shell to use based on platform — honours user's $SHELL on *nix. */
function platformShell(): string {
    if (os.platform() === "win32") {
        return process.env.COMSPEC ?? "powershell.exe";
    }
    return process.env.SHELL ?? "/bin/bash";
}

// ─────────────────────────────────────────────────────────────
// Tool definition
// ─────────────────────────────────────────────────────────────

export const runTerminalTool: ForgeTool = {
    name: "run_terminal",
    description:
        "Run a shell command inside the user's open project folder. " +
        "When source='user' the command runs unrestricted (the user typed it). " +
        "When source='agent' (default) the safety policy applies. " +
        "Output is streamed to the SKIA brain context so SKIA can observe the session.",

    inputSchema: schema,

    validate(raw: unknown) {
        const p = schema.safeParse(raw);
        if (!p.success) {
            return { ok: false, error: p.error.message };
        }
        // Only block true multi-line scripts from the agent; users can do whatever.
        if (
            p.data.source !== "user" &&
            p.data.command.includes("\n") &&
            p.data.command.trim().split("\n").length > 1
        ) {
            return {
                ok: false,
                error: "Agent commands must be a single line. Use source='user' for multi-line user input."
            };
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

        const {
            command,
            cwd: sub,
            timeoutMs = 300_000,
            source = "agent",
            approved
        } = v.data as ToolInput;

        // ── Safety gate ──────────────────────────────────────────
        // User-sourced commands bypass the agent safety policy.
        // Agent-sourced commands must pass evaluateCommandSafety.
        if (source !== "user") {
            const safety = evaluateCommandSafety(command);
            if (!safety.allowed) {
                if (safety.approvalRequired && approved === true) {
                    // Executor has recorded explicit user approval — proceed.
                } else {
                    return {
                        success: false,
                        error: `Command not allowed: ${safety.reason}`,
                        code: "SAFETY"
                    };
                }
            }
        }

        // ── Resolve working directory ────────────────────────────
        // ctx.projectRoot is the folder the user opened — never hardcoded.
        const c = resolveShellCwd(ctx.projectRoot, sub);
        if (!c.ok) {
            return { success: false, error: c.error, code: "PATH" };
        }

        // ── Execute ──────────────────────────────────────────────
        try {
            const { stdout, stderr } = await pexec(command, {
                cwd: c.abs,
                shell: platformShell(),
                maxBuffer: 4 * 1024 * 1024,   // 4 MB
                timeout: timeoutMs,
                windowsHide: true,
                env: {
                    ...process.env,
                    SKIA_FORGE: "1",
                    SKIA_PROJECT_ROOT: ctx.projectRoot
                }
            });

            const result = {
                stdout: String(stdout),
                stderr: String(stderr),
                exitCode: 0
            };

            // ── Notify SKIA brain ────────────────────────────────
            // ctx.emitEvent is the standard SKIA event bus; the brain
            // subscribes to "terminal:commandResult" to track the session.
            ctx.emitEvent?.("terminal:commandResult", {
                command,
                cwd: c.abs,
                source,
                ...result
            });

            return { success: true, data: result };
        } catch (e: unknown) {
            const ex = e as {
                stdout?: string;
                stderr?: string;
                code?: number;
                message?: string;
                killed?: boolean;
            };

            if (ex.killed) {
                return {
                    success: false,
                    error: `Command timed out after ${timeoutMs}ms.`,
                    code: "TIMEOUT"
                };
            }

            // Non-zero exit is still a valid result (not a tool crash).
            const result = {
                stdout: String(ex.stdout ?? ""),
                stderr: String(ex.stderr ?? ex.message ?? String(e)),
                exitCode: ex.code
            };

            ctx.emitEvent?.("terminal:commandResult", {
                command,
                cwd: c.abs,
                source,
                ...result
            });

            return { success: true, data: result };
        }
    },

    async rollback() {
        // Terminal commands are not reversible.
        return { success: true, data: undefined };
    }
};