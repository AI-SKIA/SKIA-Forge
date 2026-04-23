import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import type { GlobalStateSnapshotV1 } from "../global/globalState.js";
import { getOperatorControlStateV1, type GlobalRiskProfileV1 } from "./operatorControls.js";

export type GlobalPolicyDecisionV1 = {
  policyStatus: "compliant" | "warning" | "blocked";
  blockedActions: string[];
  requiredApprovals: string[];
  policyNotes: string[];
};

export async function evaluateGlobalPolicy(
  projectRoots: string[],
  globalStateSnapshot: GlobalStateSnapshotV1,
  options?: {
    riskProfile?: GlobalRiskProfileV1;
    allowedOperationsPerRepo?: Record<string, string[]>;
    allowedDirectories?: string[];
    forbiddenDirectories?: string[];
    maxAllowedStrategyAggressiveness?: "low" | "medium" | "high";
    requiredConvergenceThreshold?: number;
    humanApprovalRequired?: boolean;
  }
): Promise<GlobalPolicyDecisionV1> {
  const control = getOperatorControlStateV1();
  const riskProfile = options?.riskProfile ?? control.globalRiskProfile;
  const blockedActions: string[] = [];
  const requiredApprovals: string[] = [];
  const policyNotes: string[] = [];
  const convergence = globalStateSnapshot.latestGlobalHeuristicConvergence?.globalConvergenceScore ?? 50;
  if (riskProfile === "conservative" && (globalStateSnapshot.latestGlobalContextGraph?.globalRiskPropagation ?? 0) > 65) {
    blockedActions.push("high_risk_global_execution");
  }
  const forbidden = options?.forbiddenDirectories ?? [];
  if (
    forbidden.length > 0 &&
    globalStateSnapshot.latestGlobalContextGraph?.globalHotspotRanking.some((x) => forbidden.some((d) => x.path.includes(d)))
  ) {
    blockedActions.push("forbidden_directory_touched");
  }
  if (convergence < (options?.requiredConvergenceThreshold ?? 55)) {
    blockedActions.push("insufficient_global_convergence");
  }
  if (options?.humanApprovalRequired) {
    requiredApprovals.push("operator_approval_required");
  }
  if (control.globalEvolutionPaused) {
    blockedActions.push("global_evolution_paused");
  }
  policyNotes.push(`riskProfile=${riskProfile}`);
  policyNotes.push(`convergence=${convergence}`);
  const policyStatus: GlobalPolicyDecisionV1["policyStatus"] =
    blockedActions.length > 0 ? "blocked" : requiredApprovals.length > 0 ? "warning" : "compliant";
  const out: GlobalPolicyDecisionV1 = { policyStatus, blockedActions, requiredApprovals, policyNotes };
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "policy.global.evaluate",
    parameters: mergeForgeAuditParamsV1("global_policy", out),
    result: policyStatus === "blocked" ? "failure" : "success"
  });
  return out;
}
