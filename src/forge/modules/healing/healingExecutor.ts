import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import type { SovereignExecutionMode } from "../../../forgeGovernance.js";
import type { HealingActionPlanV1 } from "./healingPolicy.js";

export type HealingExecutionRecordV1 = {
  timestamp: string;
  service: string;
  action: HealingActionPlanV1["action"];
  mode: SovereignExecutionMode;
  status: "executed" | "blocked";
  reason: string;
};

export class HealingExecutorV1 {
  private readonly history: HealingExecutionRecordV1[] = [];

  constructor(private readonly projectRoot: string) {}

  async execute(
    plan: HealingActionPlanV1,
    governance: { mode: SovereignExecutionMode; lockdown: boolean; approved: boolean }
  ): Promise<HealingExecutionRecordV1> {
    const blocked =
      governance.lockdown || (plan.requiresApproval && !governance.approved) || plan.escalation === "human_review";
    const record: HealingExecutionRecordV1 = {
      timestamp: new Date().toISOString(),
      service: plan.service,
      action: plan.action,
      mode: governance.mode,
      status: blocked ? "blocked" : "executed",
      reason: blocked
        ? governance.lockdown
          ? "governance lockdown active"
          : plan.requiresApproval && !governance.approved
            ? "approval required"
            : "escalated to human review"
        : plan.reason
    };
    this.history.push(record);
    await appendAuditLog(this.projectRoot, {
      timestamp: record.timestamp,
      action: "healing.execute",
      parameters: mergeForgeAuditParamsV1("healing_engine", {
        plan,
        governance,
        record
      }),
      result: blocked ? "failure" : "success"
    });
    return record;
  }

  getHistory(): HealingExecutionRecordV1[] {
    return [...this.history];
  }
}

