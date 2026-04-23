import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { evaluateGlobalSafety, type GlobalSafetyStatusV1 } from "./globalSafetyRails.js";
import { evaluateGlobalPolicy, type GlobalPolicyDecisionV1 } from "./globalPolicyEngine.js";
import type { GlobalStateSnapshotV1 } from "../global/globalState.js";

export type GlobalSafetyGatewayResultV1 = {
  gatewayStatus: "allow" | "allowWithRestrictions" | "analysisOnly" | "halt";
  violatedSafetyRules: string[];
  violatedPolicies: string[];
  requiredApprovals: string[];
  recommendedOperatorActions: string[];
  safety: GlobalSafetyStatusV1;
  policy: GlobalPolicyDecisionV1;
};

export async function runGlobalSafetyGateway(
  projectRoots: string[],
  globalStateSnapshot: GlobalStateSnapshotV1,
  options?: {
    safety?: Parameters<typeof evaluateGlobalSafety>[1];
    policy?: Parameters<typeof evaluateGlobalPolicy>[2];
  }
): Promise<GlobalSafetyGatewayResultV1> {
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "safety.gateway.start",
    parameters: mergeForgeAuditParamsV1("global_safety_gateway", { repoCount: projectRoots.length }),
    result: "success"
  });
  const [safety, policy] = await Promise.all([
    evaluateGlobalSafety(projectRoots, options?.safety),
    evaluateGlobalPolicy(projectRoots, globalStateSnapshot, options?.policy)
  ]);
  let gatewayStatus: GlobalSafetyGatewayResultV1["gatewayStatus"] = "allow";
  if (safety.safetyStatus === "halted" || safety.safetyStatus === "deny" || policy.policyStatus === "blocked") {
    gatewayStatus = "halt";
  }
  else if (safety.safetyStatus === "analysisOnly") gatewayStatus = "analysisOnly";
  else if (policy.policyStatus === "warning") gatewayStatus = "allowWithRestrictions";
  const out: GlobalSafetyGatewayResultV1 = {
    gatewayStatus,
    violatedSafetyRules: safety.violatedRules,
    violatedPolicies: policy.blockedActions,
    requiredApprovals: policy.requiredApprovals,
    recommendedOperatorActions: [...safety.recommendedOperatorActions, ...policy.policyNotes],
    safety,
    policy
  };
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "safety.gateway.decision",
    parameters: mergeForgeAuditParamsV1("global_safety_gateway", out),
    result: gatewayStatus === "halt" ? "failure" : "success"
  });
  if (gatewayStatus === "halt") {
    await appendAuditLog(projectRoots[0] ?? ".", {
      timestamp: new Date().toISOString(),
      action: "safety.gateway.halt",
      parameters: mergeForgeAuditParamsV1("global_safety_gateway", out),
      result: "failure"
    });
  }
  return out;
}
