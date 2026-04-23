import type { AgentTaskPlanV1 } from "../agent-planner/agentPlannerRequest.js";

type StepAction = { stepId: string; tool: string; input: unknown };

export const DEFAULT_AGENT_GOVERNANCE = {
  maxSteps: 20,
  maxWriteOps: 10,
  maxTerminalOps: 5,
  maxRetries: 3
} as const;

export type GovernanceLimitsV1 = {
  maxSteps: number;
  maxWriteOps: number;
  maxTerminalOps: number;
  maxRetries: number;
};

export function governanceLimitsV1(
  l: typeof DEFAULT_AGENT_GOVERNANCE = DEFAULT_AGENT_GOVERNANCE
): GovernanceLimitsV1 {
  return { ...l };
}

const M = new Set(["write_file", "edit_file"]);
const T = "run_terminal";

/**
 * Counts tool usage in the action list (not plan step count) for executor limits.
 */
export function countActionUsage(actions: readonly StepAction[]): {
  writeOps: number;
  terminalOps: number;
} {
  let writeOps = 0;
  let terminalOps = 0;
  for (const a of actions) {
    if (M.has(a.tool)) {
      writeOps += 1;
    }
    if (a.tool === T) {
      terminalOps += 1;
    }
  }
  return { writeOps, terminalOps };
}

export function validateExecutorGovernance(
  plan: AgentTaskPlanV1,
  actions: readonly StepAction[],
  limits: GovernanceLimitsV1 = DEFAULT_AGENT_GOVERNANCE
): { ok: true } | { ok: false; reason: string; code: string } {
  if (plan.steps.length > limits.maxSteps) {
    return { ok: false, reason: `Plan exceeds maxSteps (${limits.maxSteps}).`, code: "max_steps" };
  }
  if (actions.length > limits.maxSteps) {
    return { ok: false, reason: `Action list exceeds maxSteps (${limits.maxSteps}).`, code: "max_steps" };
  }
  const { writeOps, terminalOps } = countActionUsage(actions);
  if (writeOps > limits.maxWriteOps) {
    return { ok: false, reason: `Too many file write/edit steps (${writeOps} > ${limits.maxWriteOps}).`, code: "max_write" };
  }
  if (terminalOps > limits.maxTerminalOps) {
    return { ok: false, reason: `Too many run_terminal steps (${terminalOps} > ${limits.maxTerminalOps}).`, code: "max_terminal" };
  }
  return { ok: true };
}

export function warnPlannerStepCount(
  plan: AgentTaskPlanV1,
  maxSteps: number = DEFAULT_AGENT_GOVERNANCE.maxSteps
): string | null {
  if (plan.steps.length > maxSteps) {
    return `Plan has ${plan.steps.length} steps; recommended max is ${maxSteps}.`;
  }
  return null;
}

/** Cumulative plan-level usage for executor step records and audit. */
export type RunGovernanceUsageV1 = {
  writeOps: number;
  terminalOps: number;
  toolKindSteps: number;
};

/**
 * D1-15: per-step snapshot after a step is recorded (matches validateExecutorGovernance counting rules).
 */
export type StepGovernanceMetadataV1 = {
  limits: GovernanceLimitsV1;
  plan: { planStepCount: number; actionCount: number };
  usage: RunGovernanceUsageV1;
  withinPolicy: true;
};

export function initialRunGovernanceUsageV1(): RunGovernanceUsageV1 {
  return { writeOps: 0, terminalOps: 0, toolKindSteps: 0 };
}

export function advanceRunGovernanceUsageV1(
  u: RunGovernanceUsageV1,
  tool: string
): RunGovernanceUsageV1 {
  const next: RunGovernanceUsageV1 = { ...u, toolKindSteps: u.toolKindSteps + 1 };
  if (M.has(tool)) {
    next.writeOps = u.writeOps + 1;
  }
  if (tool === T) {
    next.terminalOps = u.terminalOps + 1;
  }
  return next;
}

export function buildStepGovernanceMetadataV1(
  plan: AgentTaskPlanV1,
  actions: readonly StepAction[],
  usageAfterStep: RunGovernanceUsageV1,
  limits: GovernanceLimitsV1
): StepGovernanceMetadataV1 {
  return {
    limits: { ...limits },
    plan: { planStepCount: plan.steps.length, actionCount: actions.length },
    usage: { ...usageAfterStep },
    withinPolicy: true
  };
}
