/**
 * runSemgrepTool — SKIA-Forge (repo: SKIA-Forge)
 *
 * Phase B3 of SECURITY_IMPLEMENTATION.md. The 9th agent tool ("run_semgrep").
 *
 * Wraps the existing runTerminalTool to invoke:
 *     semgrep --config=auto --json .
 * in the opened project root (cwd = ctx.projectRoot, so the path is not
 * interpolated — no injection surface). Findings are parsed into the existing
 * SecurityAnalysisService `SecurityFinding[]` shape.
 *
 * Safety (RULE 6):
 *  - Commands pass through agentSafety.evaluateCommandSafety before execution
 *    (and again inside runTerminalTool via source:'agent').
 *  - Untrusted targets are gated by the sandbox guard.
 *  - Missing-binary and guard failures return a STRUCTURED error result (never
 *    throw) so the agent loop can handle them gracefully.
 */

import { z } from "zod";
import { runTerminalTool } from "./runTerminalTool.js";
import { evaluateCommandSafety } from "../../../agentSafety.js";
import type { ForgeTool, ToolContext, ToolExecuteResult } from "./types.js";
import type { SecurityFinding } from "../security/SecurityAnalysisService.js";

const schema = z.object({
    /** Set true when the project holds untrusted third-party code (RULE 6 guard). */
    untrusted: z.boolean().optional()
});

const CWE_TYPE: Record<string, SecurityFinding["type"]> = {
    "79": "xss",
    "89": "sql-injection",
    "94": "unsafe-eval",
    "95": "unsafe-eval",
    "502": "insecure-deserialization",
    "918": "ssrf",
    "798": "hardcoded-secrets"
};

function mapType(cweId?: string): SecurityFinding["type"] {
    if (cweId) {
        const n = cweId.match(/CWE-(\d+)/i)?.[1];
        if (n && CWE_TYPE[n]) return CWE_TYPE[n];
    }
    return "sast";
}

function mapSeverity(s: string): SecurityFinding["severity"] {
    const x = (s || "").toUpperCase();
    if (x === "ERROR") return "high";
    if (x === "WARNING") return "medium";
    return "low";
}

function parseSemgrepJson(stdout: string): SecurityFinding[] {
    let parsed: { results?: unknown[] };
    try {
        parsed = JSON.parse(stdout) as { results?: unknown[] };
    } catch {
        return [];
    }
    const results = Array.isArray(parsed?.results) ? parsed.results : [];
    const findings: SecurityFinding[] = [];
    for (const r of results) {
        if (!r || typeof r !== "object") continue;
        const result = r as Record<string, unknown>;
        const extra = (result.extra as Record<string, unknown> | undefined) ?? {};
        const meta = (extra.metadata as Record<string, unknown> | undefined) ?? {};
        const cweRaw = Array.isArray(meta.cwe) ? (meta.cwe as unknown[])[0] : meta.cwe;
        const cweId = typeof cweRaw === "string" ? cweRaw.match(/CWE-\d+/i)?.[0] : undefined;
        const start = (result.start as Record<string, unknown> | undefined) ?? {};
        const line = Number(start.line ?? 0);
        findings.push({
            type: mapType(cweId),
            severity: mapSeverity(String(extra.severity ?? "")),
            message: String(extra.message ?? meta.message ?? result.check_id ?? "semgrep finding"),
            file: String(result.path ?? ""),
            line: line > 0 ? line : undefined
        });
    }
    return findings;
}

export const runSemgrepTool: ForgeTool = {
    name: "run_semgrep",
    description:
        "Run Semgrep SAST (--config=auto) on the open project and return structured security findings. " +
        "Returns a structured error result (does not throw) when semgrep is missing or a sandbox is required.",

    inputSchema: schema,

    validate(raw: unknown) {
        const p = schema.safeParse(raw ?? {});
        if (!p.success) return { ok: false, error: p.error.message };
        return { ok: true, data: p.data };
    },

    async execute(
        ctx: ToolContext,
        input: unknown
    ): Promise<ToolExecuteResult<{ findings: SecurityFinding[] }>> {
        const parsed = schema.safeParse(input ?? {});
        const untrusted = parsed.success ? Boolean(parsed.data.untrusted) : false;

        // ── RULE 6 sandbox guard (structured error, no throw) ────────────
        if (untrusted && process.env.SKIA_SANDBOX !== "provisioned") {
            return {
                success: false,
                error: "SKIA_SANDBOX_NOT_PROVISIONED — cannot run untrusted code on host. Deploy skia-sandbox first.",
                code: "SANDBOX"
            };
        }

        // ── Confirm semgrep is installed ─────────────────────────────────
        const whichCmd = process.platform === "win32" ? "where semgrep" : "which semgrep";
        const whichSafety = evaluateCommandSafety(whichCmd);
        if (!whichSafety.allowed) {
            return { success: false, error: `Command not allowed: ${whichSafety.reason}`, code: "SAFETY" };
        }
        const whichRes = await runTerminalTool.execute(ctx, { command: whichCmd, source: "agent" });
        const whichData = whichRes.success
            ? (whichRes.data as { stdout?: string; exitCode?: number })
            : undefined;
        const semgrepFound =
            !!whichData && whichData.exitCode === 0 && /semgrep/i.test(whichData.stdout ?? "");
        if (!semgrepFound) {
            return {
                success: false,
                error: "SEMGREP_NOT_INSTALLED — add semgrep to the project environment/image before using this tool",
                code: "SEMGREP_MISSING"
            };
        }

        // ── Run the scan (cwd = ctx.projectRoot; path not interpolated) ──
        const scanCmd = "semgrep --config=auto --json .";
        const scanSafety = evaluateCommandSafety(scanCmd);
        if (!scanSafety.allowed) {
            return { success: false, error: `Command not allowed: ${scanSafety.reason}`, code: "SAFETY" };
        }
        const scanRes = await runTerminalTool.execute(ctx, {
            command: scanCmd,
            source: "agent",
            timeoutMs: 120_000
        });
        if (!scanRes.success) {
            return { success: false, error: scanRes.error, code: scanRes.code ?? "SEMGREP_FAILED" };
        }

        const stdout = (scanRes.data as { stdout?: string }).stdout ?? "";
        return { success: true, data: { findings: parseSemgrepJson(stdout) } };
    },

    async rollback() {
        // Read-only scan; nothing to roll back.
        return { success: true, data: undefined };
    }
};
