import type { ArchitectureViolation } from "./architectureEnforcer.js";
import type { SkiarulesFileDiagnostics } from "./architectureDiagnostics.js";

/**
 * D1-15: stable, JSON-friendly diagnostics for a future LSP and internal consumers.
 * Version is fixed per schema; extend with optional fields in new v2 rather than in-place.
 */
export const FORGE_LSP_SKIARULES_DIAG_V = 1 as const;

export type LspSkiarulesFileDiagnosticsV1 = {
  schema: typeof FORGE_LSP_SKIARULES_DIAG_V;
  kind: "file";
  path: string;
  architecture: ArchitectureViolation[];
  naming: SkiarulesFileDiagnostics["naming"];
  antiPatterns: SkiarulesFileDiagnostics["antiPatterns"];
};

export type LspSkiarulesProjectArchitectureV1 = {
  schema: typeof FORGE_LSP_SKIARULES_DIAG_V;
  kind: "project_architecture";
  violationCount: number;
  sample: ArchitectureViolation[];
  sampledCap: number;
};

/**
 * One bundle per file request: file-level rules plus an optional project-wide sample.
 */
export type LspSkiarulesDiagnosticsBundleV1 = {
  schema: typeof FORGE_LSP_SKIARULES_DIAG_V;
  path: string;
  file: LspSkiarulesFileDiagnosticsV1;
  projectArchitecture?: LspSkiarulesProjectArchitectureV1;
};

export function toLspSkiarulesFileDiagnosticsV1(d: SkiarulesFileDiagnostics): LspSkiarulesFileDiagnosticsV1 {
  return {
    schema: FORGE_LSP_SKIARULES_DIAG_V,
    kind: "file",
    path: d.path,
    architecture: d.architecture,
    naming: d.naming,
    antiPatterns: d.antiPatterns
  };
}

/** Re-use L4 statistics helpers on an LSP file block. */
export function lspFileToSkiarulesDiagnostics(f: LspSkiarulesFileDiagnosticsV1): SkiarulesFileDiagnostics {
  return {
    path: f.path,
    architecture: f.architecture,
    naming: f.naming,
    antiPatterns: f.antiPatterns
  };
}

const PROJECT_ARCH_SAMPLE_MAX = 20;

export function toLspSkiarulesProjectArchitectureV1(
  violationCount: number,
  sample: ArchitectureViolation[]
): LspSkiarulesProjectArchitectureV1 {
  return {
    schema: FORGE_LSP_SKIARULES_DIAG_V,
    kind: "project_architecture",
    violationCount,
    sample: sample.slice(0, PROJECT_ARCH_SAMPLE_MAX),
    sampledCap: PROJECT_ARCH_SAMPLE_MAX
  };
}

export function buildLspSkiarulesDiagnosticsBundleV1(
  d: SkiarulesFileDiagnostics,
  project?: { violationCount: number; sample: ArchitectureViolation[] } | null
): LspSkiarulesDiagnosticsBundleV1 {
  const out: LspSkiarulesDiagnosticsBundleV1 = {
    schema: FORGE_LSP_SKIARULES_DIAG_V,
    path: d.path,
    file: toLspSkiarulesFileDiagnosticsV1(d)
  };
  if (project != null) {
    out.projectArchitecture = toLspSkiarulesProjectArchitectureV1(
      project.violationCount,
      project.sample
    );
  }
  return out;
}
