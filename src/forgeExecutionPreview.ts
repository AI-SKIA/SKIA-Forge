import { ForgeModuleName } from "./forgeModuleExecutor.js";
import { evaluateForgeModuleAccess, SovereignExecutionMode } from "./forgeGovernance.js";
import { ForgeGovernancePolicy } from "./forgePolicy.js";

type ForgeStage = "context" | "architecture" | "sdlc" | "production" | "healing";

const ORDERED_STAGES: ForgeStage[] = ["context", "architecture", "sdlc", "production", "healing"];

export function previewModuleDecision(
  mode: SovereignExecutionMode,
  module: ForgeModuleName,
  approved: boolean,
  policy: ForgeGovernancePolicy
) {
  const decision = evaluateForgeModuleAccess(mode, module, approved, policy);
  return {
    module,
    mode,
    approved,
    allowed: decision.allowed,
    reason: decision.reason
  };
}

export function previewOrchestrationDecisions(
  mode: SovereignExecutionMode,
  approved: boolean,
  includeHealing: boolean,
  policy: ForgeGovernancePolicy
) {
  const stages = ORDERED_STAGES.filter((stage) => includeHealing || stage !== "healing").map((stage) => {
    const decision = evaluateForgeModuleAccess(mode, stage, approved, policy);
    return {
      stage,
      allowed: decision.allowed,
      reason: decision.reason
    };
  });
  return {
    mode,
    approved,
    includeHealing,
    stages
  };
}
