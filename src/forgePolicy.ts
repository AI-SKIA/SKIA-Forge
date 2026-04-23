import { SkiaRules } from "./rules.js";
import { ForgeModuleName } from "./forgeModuleExecutor.js";
import { SovereignExecutionMode } from "./forgeGovernance.js";

export type ForgeGovernancePolicy = {
  defaultMode: SovereignExecutionMode;
  approvalRequiredModules: ForgeModuleName[];
};

const DEFAULT_POLICY: ForgeGovernancePolicy = {
  defaultMode: "adaptive",
  approvalRequiredModules: ["agent", "production", "healing"]
};

function isModuleName(value: string): value is ForgeModuleName {
  return (
    value === "context" ||
    value === "agent" ||
    value === "sdlc" ||
    value === "production" ||
    value === "healing" ||
    value === "architecture"
  );
}

export function buildGovernancePolicy(rules: SkiaRules): ForgeGovernancePolicy {
  const mode = rules.governance?.default_mode;
  const defaultMode =
    mode === "strict" || mode === "adaptive" || mode === "autonomous"
      ? mode
      : DEFAULT_POLICY.defaultMode;
  const approvalRequiredModules =
    rules.governance?.approval_required_modules?.filter(isModuleName) ??
    DEFAULT_POLICY.approvalRequiredModules;
  return {
    defaultMode,
    approvalRequiredModules
  };
}
