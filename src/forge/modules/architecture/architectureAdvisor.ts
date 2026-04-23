import type { ArchitectureGraphV1 } from "./architectureGraph.js";
import type { ArchitectureDriftV1 } from "./driftDetector.js";
import type { SkiarulesFileDiagnostics } from "../skiarules/architectureDiagnostics.js";

export type ArchitectureAdviceV1 = {
  type: "dependency_drift" | "coupling_regression" | "skiarules_violation";
  severity: "low" | "medium" | "high";
  title: string;
  rationale: string;
  adrRecommendation: string;
  affectedModules: string[];
};

export function buildArchitectureAdvice(
  graph: ArchitectureGraphV1,
  drift: ArchitectureDriftV1,
  skiarulesDiagnostics: SkiarulesFileDiagnostics[]
): ArchitectureAdviceV1[] {
  const advice: ArchitectureAdviceV1[] = [];
  if (drift.addedDependencies.length > 0 || drift.removedDependencies.length > 0) {
    advice.push({
      type: "dependency_drift",
      severity: drift.addedDependencies.length > 3 ? "high" : "medium",
      title: "Dependency graph drift detected",
      rationale: `Added=${drift.addedDependencies.length}, removed=${drift.removedDependencies.length}.`,
      adrRecommendation: "Create ADR documenting dependency boundary changes and rollback options.",
      affectedModules: [...new Set(drift.addedDependencies.map((x) => x.from))]
    });
  }
  if (drift.couplingRegressions.length > 0) {
    advice.push({
      type: "coupling_regression",
      severity: "high",
      title: "Coupling regression detected",
      rationale: `${drift.couplingRegressions.length} modules increased coupling score.`,
      adrRecommendation: "Create ADR proposing boundary extraction and interface stabilization.",
      affectedModules: drift.couplingRegressions.map((x) => x.module)
    });
  }
  const violationModules = skiarulesDiagnostics
    .filter((x) => x.architecture.length > 0)
    .map((x) => x.path);
  if (violationModules.length > 0) {
    advice.push({
      type: "skiarules_violation",
      severity: "high",
      title: "Skiarules architecture violations present",
      rationale: `${violationModules.length} files currently violate .skiarules architecture constraints.`,
      adrRecommendation: "Create ADR to codify corrected import boundaries and phased remediation.",
      affectedModules: violationModules
    });
  }
  if (advice.length === 0) {
    const top = graph.nodes.slice(0, 3).map((x) => x.module);
    advice.push({
      type: "coupling_regression",
      severity: "low",
      title: "Architecture stable",
      rationale: "No drift or active skiarules architecture violations detected.",
      adrRecommendation: "Capture current architecture as baseline ADR for future drift checks.",
      affectedModules: top
    });
  }
  return advice;
}

