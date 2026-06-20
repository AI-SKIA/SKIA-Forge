/**
 * DependencyAuditTool — SKIA-Forge (repo: SKIA-Forge)
 *
 * Phase A2 of SECURITY_IMPLEMENTATION.md.
 *
 * Wraps the existing `runTerminalTool` to run real dependency scanners
 * (`npm audit --json`, falling back to `pip-audit --format json`) in the
 * project root and parse the output into structured findings.
 *
 * Type note (RULE 0/1): the existing `SecurityFinding` union in
 * SecurityAnalysisService is a CODE-finding taxonomy (`xss`, `sql-injection`,
 * `unsafe-eval`, …). A dependency CVE does not fit any of those members, and
 * extending that union would force a change to `SecurityAnalysisService.autofix`
 * (a B3-scoped file, out of A2 scope). So this module defines a dedicated
 * `DependencyVulnerabilityFinding` that MIRRORS the SecurityFinding field shape
 * (`severity` / `message` / `file` / `line`) plus dependency-specific fields.
 *
 * Safety:
 *  - The audit command is passed through `evaluateCommandSafety` before
 *    execution and is run with `source: 'agent'` so `runTerminalTool` enforces
 *    the same gate internally (RULE 6).
 *  - RULE 6 sandbox guard: auditing an UNTRUSTED project path on the host is
 *    refused unless a sandbox has been provisioned (SKIA_SANDBOX env). The
 *    Forge buildIndex caller opens a trusted project, so it passes
 *    `untrusted: false` and is never blocked.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { runTerminalTool } from "../tools/runTerminalTool.js";
import { evaluateCommandSafety } from "../../../agentSafety.js";
import type { DependencyVulnerabilityRecord } from "../../../types.js";

/** Canonical persisted shape lives in shared types (see ProjectIndex). */
export type DependencyVulnerabilityFinding = DependencyVulnerabilityRecord;

export type DependencyAuditResult = {
    manager: "npm" | "pip" | "none";
    findings: DependencyVulnerabilityFinding[];
    /** D2 fine-tune corpus: persisted on Skia-FULL brain via SecurityOrchestrator / full-audit. */
    analyst_feedback_pending?: true;
};

const CVE_RE = /CVE-\d{4}-\d{4,}/gi;

function extractCveIds(...sources: unknown[]): string[] {
    const found = new Set<string>();
    for (const src of sources) {
        if (src == null) continue;
        const text = typeof src === "string" ? src : JSON.stringify(src);
        const matches = text.match(CVE_RE);
        if (matches) for (const m of matches) found.add(m.toUpperCase());
    }
    return [...found];
}

/** npm/pip severities collapse onto the SecurityFinding 3-level scale. */
function mapNpmSeverity(raw: unknown): DependencyVulnerabilityFinding["severity"] {
    const s = String(raw ?? "").toLowerCase();
    if (s === "critical" || s === "high") return "high";
    if (s === "moderate" || s === "medium") return "medium";
    return "low";
}

function tryParseJson(text: string): unknown {
    const trimmed = (text || "").trim();
    if (!trimmed) return null;
    try {
        return JSON.parse(trimmed);
    } catch {
        const m = trimmed.match(/[[{][\s\S]*[\]}]/);
        if (m) {
            try {
                return JSON.parse(m[0]);
            } catch {
                return null;
            }
        }
        return null;
    }
}

function parseNpmAudit(json: Record<string, unknown>): DependencyVulnerabilityFinding[] {
    const out: DependencyVulnerabilityFinding[] = [];
    const vulns = json["vulnerabilities"];
    if (vulns && typeof vulns === "object" && !Array.isArray(vulns)) {
        for (const [pkgName, entryRaw] of Object.entries(vulns as Record<string, unknown>)) {
            if (!entryRaw || typeof entryRaw !== "object") continue;
            const entry = entryRaw as Record<string, unknown>;
            const via = Array.isArray(entry["via"]) ? (entry["via"] as unknown[]) : [];
            const advisories = via.filter((v) => v && typeof v === "object") as Record<string, unknown>[];
            const fixAvailable = entry["fixAvailable"] != null && entry["fixAvailable"] !== false;

            if (advisories.length === 0) {
                out.push({
                    type: "vulnerable-dependency",
                    severity: mapNpmSeverity(entry["severity"]),
                    message: `Vulnerable dependency: ${pkgName}`,
                    file: "package.json",
                    package: pkgName,
                    advisoryId: `npm-advisory:${pkgName}`,
                    cveIds: [],
                    fixAvailable
                });
                continue;
            }

            for (const adv of advisories) {
                const title = adv["title"] != null ? String(adv["title"]) : `Vulnerable dependency: ${pkgName}`;
                out.push({
                    type: "vulnerable-dependency",
                    severity: mapNpmSeverity(adv["severity"] ?? entry["severity"]),
                    message: title,
                    file: "package.json",
                    package: String(adv["name"] ?? pkgName),
                    advisoryId: String(adv["source"] ?? adv["url"] ?? `npm-advisory:${pkgName}`),
                    cveIds: extractCveIds(adv["cwe"], adv["url"], adv["title"], adv["source"]),
                    fixAvailable
                });
            }
        }
    }
    return out;
}

function parsePipAudit(json: unknown): DependencyVulnerabilityFinding[] {
    const out: DependencyVulnerabilityFinding[] = [];
    const deps = Array.isArray(json)
        ? json
        : json && typeof json === "object" && Array.isArray((json as Record<string, unknown>)["dependencies"])
          ? ((json as Record<string, unknown>)["dependencies"] as unknown[])
          : [];

    for (const depRaw of deps) {
        if (!depRaw || typeof depRaw !== "object") continue;
        const dep = depRaw as Record<string, unknown>;
        const name = String(dep["name"] ?? "unknown");
        const vulnList = Array.isArray(dep["vulns"]) ? (dep["vulns"] as unknown[]) : [];
        for (const vRaw of vulnList) {
            if (!vRaw || typeof vRaw !== "object") continue;
            const v = vRaw as Record<string, unknown>;
            const aliases = Array.isArray(v["aliases"]) ? (v["aliases"] as unknown[]) : [];
            out.push({
                type: "vulnerable-dependency",
                severity: "medium",
                message:
                    v["description"] != null
                        ? String(v["description"]).slice(0, 300)
                        : `Vulnerable dependency: ${name}`,
                file: "requirements.txt",
                package: name,
                advisoryId: String(v["id"] ?? `pysec:${name}`),
                cveIds: extractCveIds(v["id"], aliases, v["description"]),
                fixAvailable: Array.isArray(v["fix_versions"]) && (v["fix_versions"] as unknown[]).length > 0
            });
        }
    }
    return out;
}

async function exists(p: string): Promise<boolean> {
    try {
        await fs.access(p);
        return true;
    } catch {
        return false;
    }
}

async function runAuditCommand(projectRoot: string, command: string): Promise<string | null> {
    // RULE 6: agent-sourced command must pass the safety gate before execution.
    const safety = evaluateCommandSafety(command);
    if (!safety.allowed) return null;

    const result = await runTerminalTool.execute(
        { projectRoot },
        { command, source: "agent", timeoutMs: 60_000 }
    );
    if (!result.success) return null;
    // npm/pip audit exit non-zero when findings exist; runTerminalTool still
    // returns success:true with stdout captured. `runTerminalTool` is typed as
    // the generic ForgeTool, so narrow its opaque data payload here.
    const data = result.data as { stdout?: string };
    return data.stdout ?? "";
}

/**
 * Run a real dependency audit against an on-disk project root.
 *
 * @param projectRoot  The opened project's root directory.
 * @param opts.untrusted  When true the path holds untrusted third-party code;
 *   the RULE 6 sandbox guard throws unless a sandbox is provisioned.
 */
export async function runDependencyAudit(
    projectRoot: string,
    opts: { untrusted?: boolean } = {}
): Promise<DependencyAuditResult> {
    if (opts.untrusted) {
        const sandboxProvisioned =
            process.env.SKIA_SANDBOX === "provisioned" || !!process.env.SKIA_SANDBOX_URL;
        if (!sandboxProvisioned) {
            throw new Error(
                "SKIA_SANDBOX_NOT_PROVISIONED — cannot run untrusted code on host. Deploy skia-sandbox first."
            );
        }
    }

    if (await exists(path.join(projectRoot, "package.json"))) {
        const stdout = await runAuditCommand(projectRoot, "npm audit --json");
        const parsed = stdout ? tryParseJson(stdout) : null;
        if (parsed && !Array.isArray(parsed)) {
            return { manager: "npm", findings: parseNpmAudit(parsed as Record<string, unknown>) };
        }
    }

    const hasPython =
        (await exists(path.join(projectRoot, "requirements.txt"))) ||
        (await exists(path.join(projectRoot, "pyproject.toml"))) ||
        (await exists(path.join(projectRoot, "Pipfile")));
    if (hasPython) {
        const stdout = await runAuditCommand(projectRoot, "pip-audit --format json");
        const parsed = stdout ? tryParseJson(stdout) : null;
        if (parsed) {
            return { manager: "pip", findings: parsePipAudit(parsed) };
        }
    }

    return { manager: "none", findings: [], analyst_feedback_pending: true };
}
