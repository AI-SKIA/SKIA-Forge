import type { SkiarulesConfig } from "./skiarulesTypes.js";
import { fileMatchesPattern, importMatchesSpec } from "./pathMatch.js";
import { readImportsFromFile, extractImportSpecifiers } from "./importExtract.js";
import { securityAnalysisService } from "../security/SecurityAnalysisService.js";
import path from "node:path";

export type ArchitectureViolation = {
  filePath: string;
  importPath: string;
  rule: string;
  message: string;
  affectedLines?: number[];
};

export type CodeFix = {
  summary: string;
  fullDiff: string;
};

export type ViolationRecord = {
  violation: ArchitectureViolation;
  timestamp: string;
  resolved: boolean;
};

const violationHistoryStore = new Map<string, ViolationRecord[]>();

/**
 * D1-12: architecture boundaries from `.skiarules` vs resolved imports of one file.
 */
export async function checkArchitectureImports(
  projectRoot: string,
  fileRel: string,
  importPaths: string[] | null,
  config: SkiarulesConfig | null
): Promise<ArchitectureViolation[]> {
  if (!config?.architecture?.boundaries?.length) {
    return [];
  }
  const imports = importPaths ?? (await readImportsFromFile(projectRoot, fileRel));
  const f = fileRel.replace(/\\/g, "/");
  const violations: ArchitectureViolation[] = [];
  for (const b of config.architecture.boundaries) {
    if (!fileMatchesPattern(f, b.pathPattern)) {
      continue;
    }
    for (const imp of imports) {
      let hitCannot = false;
      if (b.cannotImportFrom) {
        for (const p of b.cannotImportFrom) {
          if (importMatchesSpec(imp, p) || imp === p) {
            hitCannot = true;
            const lineHint = Math.max(1, imports.indexOf(imp) + 1);
            violations.push({
              filePath: f,
              importPath: imp,
              rule: `cannotImportFrom: ${p}`,
              message: `Import "${imp}" is blocked by .skiarules for files matching ${b.pathPattern}.`,
              affectedLines: [lineHint]
            });
          }
        }
      }
      if (hitCannot) {
        continue;
      }
      if (b.canImportFrom?.length) {
        const ok = b.canImportFrom.some((a) => importMatchesSpec(imp, a) || imp === a);
        if (!ok) {
          const lineHint = Math.max(1, imports.indexOf(imp) + 1);
          violations.push({
            filePath: f,
            importPath: imp,
            rule: `canImportFrom whitelist`,
            message: `Import "${imp}" is not allowed; only: ${b.canImportFrom.join(", ")}.`,
            affectedLines: [lineHint]
          });
        }
      }
    }
  }
  return violations;
}

export async function suggest_fix(violation: ArchitectureViolation): Promise<CodeFix> {
  const replacement = violation.importPath.startsWith(".") ? "./allowed/module" : "allowed/module";
  return {
    summary: `Replace forbidden import with boundary-compliant module for ${violation.filePath}.`,
    fullDiff: [
      `*** ${violation.filePath}`,
      `- import ... from "${violation.importPath}"`,
      `+ import ... from "${replacement}"`,
      `# rule: ${violation.rule}`,
    ].join("\n"),
  };
}

export function violation_history(fileId: string): ViolationRecord[] {
  return violationHistoryStore.get(fileId) || [];
}

export function record_violation(fileId: string, violation: ArchitectureViolation): void {
  const prev = violationHistoryStore.get(fileId) || [];
  violationHistoryStore.set(
    fileId,
    [
      ...prev,
      {
        violation,
        timestamp: new Date().toISOString(),
        resolved: false,
      },
    ].slice(-200)
  );
}

export async function enforce_on_save(
  projectRoot: string,
  fileRel: string,
  importPaths: string[] | null,
  config: SkiarulesConfig | null
): Promise<{ blocked: boolean; violations: ArchitectureViolation[]; message: string }> {
  const violations = await checkArchitectureImports(projectRoot, fileRel, importPaths, config);
  violations.forEach((v) => record_violation(fileRel, v));
  const securityReport = await securityAnalysisService.scan_on_save(path.join(projectRoot, fileRel));
  const hasCriticalSecurity = securityReport.findings.some((f) => f.severity === "high");
  if (violations.length) {
    const first = violations[0];
    const lineText = first?.affectedLines?.length ? ` (lines: ${first.affectedLines.join(", ")})` : "";
    return {
      blocked: true,
      violations,
      message: `Save blocked by architecture rule "${first?.rule || "unknown"}"${lineText}. ${first?.message || "Architecture rule violation."}`,
    };
  }
  if (hasCriticalSecurity) {
    return {
      blocked: true,
      violations: [],
      message: `Save blocked by security scan: ${securityReport.findings[0]?.message || "critical finding detected."}`,
    };
  }
  return { blocked: false, violations: [], message: 'ok' };
}

export { extractImportSpecifiers, readImportsFromFile };
