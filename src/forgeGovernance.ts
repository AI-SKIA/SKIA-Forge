import { ForgeModuleName } from "./forgeModuleExecutor.js";
import { ForgeGovernancePolicy } from "./forgePolicy.js";

export type SovereignExecutionMode = "strict" | "adaptive" | "autonomous";

export type GovernanceDecision = {
  allowed: boolean;
  reason: string;
};

export function evaluateForgeModuleAccess(
  mode: SovereignExecutionMode,
  module: ForgeModuleName,
  approved: boolean,
  policy?: ForgeGovernancePolicy
): GovernanceDecision {
  const approvalRequiredModules = policy?.approvalRequiredModules ?? ["agent", "production", "healing"];
  const needsApproval = approvalRequiredModules.includes(module);
  if (mode === "autonomous") {
    return { allowed: true, reason: "Autonomous mode permits all forge modules." };
  }
  if (mode === "adaptive") {
    if (needsApproval && !approved) {
      return { allowed: false, reason: `Adaptive mode requires approval for ${module}.` };
    }
    return { allowed: true, reason: "Adaptive mode policy satisfied." };
  }
  if (needsApproval && !approved) {
    return { allowed: false, reason: `Strict mode blocks ${module} without approval.` };
  }
  return { allowed: true, reason: "Strict mode policy satisfied." };
}
