import { AgentAuditLogRecord } from "./types.js";
import { ForgeModuleName } from "./forgeModuleExecutor.js";
import { SovereignExecutionMode } from "./forgeGovernance.js";

export function buildGovernanceAuditRecord(input: {
  action:
    | "forge.mode.set"
    | "forge.module.decision"
    | "forge.module.execute"
    | "forge.orchestration.execute"
    | "forge.control_plane.remediate";
  mode: SovereignExecutionMode;
  approved: boolean;
  result: "success" | "failure";
  module?: ForgeModuleName;
  details: string;
  extra?: Record<string, unknown>;
}): AgentAuditLogRecord {
  return {
    timestamp: new Date().toISOString(),
    action: input.action,
    parameters: {
      mode: input.mode,
      approved: input.approved,
      module: input.module,
      ...(input.extra ?? {})
    },
    result: input.result,
    details: input.details
  };
}
