import type { SkiarulesConfig } from "./skiarulesTypes.js";
import { fileMatchesPattern, importMatchesSpec } from "./pathMatch.js";
import { readImportsFromFile, extractImportSpecifiers } from "./importExtract.js";

export type ArchitectureViolation = {
  filePath: string;
  importPath: string;
  rule: string;
  message: string;
};

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
            violations.push({
              filePath: f,
              importPath: imp,
              rule: `cannotImportFrom: ${p}`,
              message: `Import "${imp}" is blocked by .skiarules for files matching ${b.pathPattern}.`
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
          violations.push({
            filePath: f,
            importPath: imp,
            rule: `canImportFrom whitelist`,
            message: `Import "${imp}" is not allowed; only: ${b.canImportFrom.join(", ")}.`
          });
        }
      }
    }
  }
  return violations;
}

export { extractImportSpecifiers, readImportsFromFile };
