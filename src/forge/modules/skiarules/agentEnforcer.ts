import type { SkiarulesConfig } from "./skiarulesTypes.js";
import { assertSafeFilePath } from "../tools/toolPath.js";
import { isPlainObject } from "./agentEnforcerUtils.js";
import { getDiagnosticsForFile, type SkiarulesFileDiagnostics } from "./architectureDiagnostics.js";
import { computeFileMutationDiffPreview } from "../agent-executor/fileMutationPreview.js";

export type SkiarulesViolationItem = {
  code: string;
  message: string;
  path?: string;
  rule?: string;
};

export type AgentToolEnforcement =
  | { state: "allow" }
  | {
      state: "block";
      message: string;
      rule: string;
      blockedBy?: "skiarules";
      path?: string;
      skiarulesViolations?: SkiarulesViolationItem[];
    }
  | { state: "auto_approve" };

const PATH_KEYS = new Set([
  "path",
  "file",
  "filePath"
]);

/**
 * D1-12: agent permissions from `.skiarules` before a tool runs.
 * `auto_apply` in config is exposed as `auto_approve` (executor skips gating for those tool names).
 */
export function enforceAgentTool(
  projectRoot: string,
  config: SkiarulesConfig | null,
  tool: string,
  input: unknown
): AgentToolEnforcement {
  const agent = config?.agent;
  if (!agent) {
    return { state: "allow" };
  }

  const approvers = new Set(
    (agent.auto_approve ?? []).map((s) => s.trim().toLowerCase())
  );
  if (approvers.size && approvers.has(tool.toLowerCase())) {
    return { state: "auto_approve" };
  }

  const rel = extractPrimaryRelativePath(projectRoot, tool, input);
  for (const block of agent.blocked_paths ?? []) {
    if (rel && (rel === block || rel.startsWith(block + "/") || rel.includes("/" + block + "/") || rel.startsWith(block))) {
      return {
        state: "block",
        message: `Path is blocked by .skiarules (blocked_paths).`,
        rule: `blocked_paths: ${block}`,
        blockedBy: "skiarules",
        path: rel
      };
    }
  }

  if (tool === "run_terminal") {
    const cmds = agent.allowed_commands;
    if (cmds?.length) {
      const commandStr = extractCommand(input, "run_terminal");
      if (commandStr != null) {
        const hit = cmds.some(
          (c) => commandStr.includes(c) || commandStr.trim().startsWith(c.trim())
        );
        if (!hit) {
          return {
            state: "block",
            message: "Command is not in allowed_commands for this project.",
            rule: "agent.allowed_commands",
            blockedBy: "skiarules",
            path: rel ?? undefined
          };
        }
      }
    }
  }

  return { state: "allow" };
}

function extractCommand(input: unknown, tool: string): string | null {
  if (!isPlainObject(input)) {
    return null;
  }
  if (tool === "run_terminal" && typeof input["command"] === "string") {
    return input["command"];
  }
  return null;
}

function extractPrimaryRelativePath(
  projectRoot: string,
  tool: string,
  input: unknown
): string | null {
  if (!isPlainObject(input)) {
    return null;
  }
  for (const k of PATH_KEYS) {
    const v = input[k];
    if (typeof v === "string" && v.length) {
      const c = assertSafeFilePath(projectRoot, v);
      if (c.ok) {
        return c.relPosix;
      }
    }
  }
  if (typeof input["path"] === "string") {
    const c = assertSafeFilePath(projectRoot, input["path"] as string);
    return c.ok ? c.relPosix : null;
  }
  return null;
}

function flattenDiagnostics(d: SkiarulesFileDiagnostics): SkiarulesViolationItem[] {
  const out: SkiarulesViolationItem[] = [];
  for (const a of d.architecture) {
    out.push({
      code: "architecture.import",
      message: a.message,
      path: a.filePath,
      rule: a.rule
    });
  }
  for (const n of d.naming) {
    out.push({ code: "naming", message: n.message, path: n.filePath, rule: n.pattern });
  }
  for (const ap of d.antiPatterns) {
    out.push({
      code: "anti_pattern",
      message: `Line ${ap.line ?? "?"}: ${ap.snippet}`,
      path: ap.filePath,
      rule: ap.pattern
    });
  }
  return out;
}

/**
 * D1-12: content/boundary/naming checks for write_file / edit_file (post-preview “after” text).
 */
export async function collectWriteEditSkiarulesViolations(
  projectRoot: string,
  config: SkiarulesConfig | null,
  tool: "write_file" | "edit_file",
  input: unknown
): Promise<SkiarulesViolationItem[]> {
  const p = await computeFileMutationDiffPreview(projectRoot, tool, input);
  if (!p.ok) {
    return [];
  }
  const d = await getDiagnosticsForFile(projectRoot, p.path, p.after, config);
  return flattenDiagnostics(d);
}
