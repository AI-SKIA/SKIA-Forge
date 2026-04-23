import path from "node:path";
import { checkArchitectureImports, type ArchitectureViolation } from "./architectureEnforcer.js";
import { extractImportSpecifiers } from "./importExtract.js";
import type { SkiarulesConfig } from "./skiarulesTypes.js";

export type NamingViolation = {
  kind: "naming";
  filePath: string;
  message: string;
  pattern?: string;
};

export type AntiPatternMatch = {
  kind: "anti_pattern";
  filePath: string;
  pattern: string;
  line?: number;
  snippet: string;
};

export type SkiarulesFileDiagnostics = {
  path: string;
  architecture: ArchitectureViolation[];
  naming: NamingViolation[];
  antiPatterns: AntiPatternMatch[];
};

function safeRegex(source: string): RegExp | null {
  try {
    return new RegExp(source);
  } catch {
    return null;
  }
}

function checkFilenameNaming(relPath: string, namingRule: string | undefined): NamingViolation[] {
  if (!namingRule?.trim()) {
    return [];
  }
  const base = path.posix.basename(relPath);
  const rule = namingRule.trim();
  const re = safeRegex(rule);
  if (re) {
    if (!re.test(base)) {
      return [
        {
          kind: "naming",
          filePath: relPath,
          message: `File name "${base}" does not match naming pattern.`,
          pattern: rule
        }
      ];
    }
    return [];
  }
  if (base.includes(rule)) {
    return [];
  }
  return [
    {
      kind: "naming",
      filePath: relPath,
      message: `File name "${base}" should reflect naming: ${rule}.`,
      pattern: rule
    }
  ];
}

function antiPatternScan(content: string, patterns: string[], filePath: string): AntiPatternMatch[] {
  const out: AntiPatternMatch[] = [];
  const lines = content.split(/\r?\n/);
  for (const p of patterns) {
    if (!p.trim()) {
      continue;
    }
    const re = safeRegex(p) ?? safeRegex(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (!re) {
      continue;
    }
    re.lastIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (re.test(line)) {
        out.push({
          kind: "anti_pattern",
          filePath,
          pattern: p,
          line: i + 1,
          snippet: line.slice(0, 200)
        });
        re.lastIndex = 0;
      }
    }
  }
  return out;
}

/**
 * D1-12: full per-file diagnostics (imports, naming, anti-patterns) for a path.
 */
export async function getDiagnosticsForFile(
  projectRoot: string,
  relPathPosix: string,
  content: string,
  config: SkiarulesConfig | null
): Promise<SkiarulesFileDiagnostics> {
  const architecture = config
    ? await checkArchitectureImports(
        projectRoot,
        relPathPosix,
        extractImportSpecifiers(content),
        config
      )
    : [];
  const naming =
    config?.conventions?.naming != null
      ? checkFilenameNaming(relPathPosix, config.conventions.naming)
      : [];
  const antiPatterns =
    config?.conventions?.anti_patterns?.length
      ? antiPatternScan(content, config.conventions.anti_patterns, relPathPosix)
      : [];
  return { path: relPathPosix, architecture, naming, antiPatterns };
}

/**
 * D1-12: architecture import violations only (lightweight, for L4 / path-only).
 */
export async function getArchitectureDiagnosticsForPath(
  projectRoot: string,
  relPathPosix: string,
  config: SkiarulesConfig | null
): Promise<ArchitectureViolation[]> {
  if (!config) {
    return [];
  }
  return checkArchitectureImports(projectRoot, relPathPosix, null, config);
}

export function countSkiarulesL4Stats(
  d: SkiarulesFileDiagnostics,
  config: SkiarulesConfig | null
): {
  violationsCount: number;
  blockedPathsCount: number;
  antiPatternsCount: number;
} {
  return {
    violationsCount: d.architecture.length + d.naming.length,
    blockedPathsCount: config?.agent?.blocked_paths?.length ?? 0,
    antiPatternsCount: d.antiPatterns.length
  };
}
