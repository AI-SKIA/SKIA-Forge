import type { SkiarulesConfig } from "./skiarulesTypes.js";

const MAX = 3_000;

/**
 * Short text for agent planner / chat (injected server-side, not a request field).
 */
export function buildRulesContextSummary(config: SkiarulesConfig | null): string {
  if (!config) {
    return "";
  }
  const parts: string[] = [];
  if (config.project?.name) {
    parts.push(`Project: ${config.project.name}${config.project.language ? ` (${config.project.language})` : ""}.`);
  }
  if (config.conventions) {
    const c = config.conventions;
    if (c.naming) {
      parts.push(`Naming: ${c.naming}`);
    }
    if (c.anti_patterns?.length) {
      parts.push(`Avoid: ${c.anti_patterns.join("; ")}`);
    }
  }
  if (config.architecture?.structure) {
    parts.push(`Structure: ${config.architecture.structure.slice(0, 400)}`);
  }
  if (config.agent) {
    const a = config.agent;
    if (a.blocked_paths?.length) {
      parts.push(`Blocked paths: ${a.blocked_paths.join(", ")}`);
    }
    if (a.allowed_commands?.length) {
      parts.push(`Allowed command substrings: ${a.allowed_commands.join(", ")}`);
    }
  }
  if (config.skia?.personality) {
    parts.push(`SKIA voice: ${config.skia.personality.slice(0, 300)}`);
  }
  const t = parts.join(" ");
  return t.length > MAX ? `${t.slice(0, MAX)}…` : t;
}
