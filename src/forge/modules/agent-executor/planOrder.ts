import type { AgentTaskPlanV1 } from "../agent-planner/agentPlannerRequest.js";

export type ToposortResult = { ok: true; orderedIds: string[] } | { ok: false; error: string };

/**
 * Kahn on plan steps. Detects missing deps and cycles.
 */
export function toposortPlanStepIds(plan: AgentTaskPlanV1): ToposortResult {
  const ids = new Set(plan.steps.map((s) => s.id));
  for (const s of plan.steps) {
    for (const d of s.dependsOn ?? []) {
      if (!ids.has(d)) {
        return {
          ok: false,
          error: `Step ${s.id} depends on unknown step id: ${d}.`
        };
      }
    }
  }

  const incoming = new Map<string, number>();
  const edges = new Map<string, string[]>();
  for (const s of plan.steps) {
    if (!incoming.has(s.id)) {
      incoming.set(s.id, 0);
    }
  }
  for (const s of plan.steps) {
    for (const d of s.dependsOn ?? []) {
      if (!edges.has(d)) {
        edges.set(d, []);
      }
      edges.get(d)!.push(s.id);
      incoming.set(s.id, (incoming.get(s.id) ?? 0) + 1);
    }
  }

  const ready: string[] = [];
  for (const s of plan.steps) {
    if (incoming.get(s.id) === 0) {
      ready.push(s.id);
    }
  }
  const ordered: string[] = [];
  while (ready.length) {
    const id = ready.pop()!;
    ordered.push(id);
    for (const t of edges.get(id) ?? []) {
      const n = (incoming.get(t) ?? 0) - 1;
      incoming.set(t, n);
      if (n === 0) {
        ready.push(t);
      }
    }
  }
  if (ordered.length !== plan.steps.length) {
    return { ok: false, error: "Plan has a cyclic or inconsistent dependency order." };
  }
  return { ok: true, orderedIds: ordered };
}

/**
 * `actionIds` in plan top order, intersected with the provided set, preserving toposort.
 */
export function orderActionsForPlan(
  plan: AgentTaskPlanV1,
  actionIds: readonly string[]
): ToposortResult {
  const ts = toposortPlanStepIds(plan);
  if (!ts.ok) {
    return ts;
  }
  const want = new Set(actionIds);
  const ordered = ts.orderedIds.filter((id) => want.has(id));
  if (ordered.length !== actionIds.length) {
    const fromPlan = new Set(ts.orderedIds);
    const missing = actionIds.find((id) => !fromPlan.has(id));
    if (missing) {
      return { ok: false, error: `Step id not in plan: ${missing}.` };
    }
    return { ok: false, error: "Action list does not match plan (duplicate or inconsistent step ids)." };
  }
  return { ok: true, orderedIds: ordered };
}

/** Every dependsOn in the plan for steps that appear in `actionIds` must be covered by `actionIds` when that dep exists in the same plan. */
export function assertActionDependentsCovered(
  plan: AgentTaskPlanV1,
  actionIds: Set<string>
): { ok: true } | { ok: false; error: string } {
  const byId = new Map(plan.steps.map((s) => [s.id, s]));
  for (const id of actionIds) {
    const s = byId.get(id);
    if (!s) {
      return { ok: false, error: `Unknown step: ${id}.` };
    }
    for (const d of s.dependsOn ?? []) {
      if (!actionIds.has(d)) {
        return {
          ok: false,
          error: `Step ${id} depends on ${d}, but no tool action is provided for ${d}.`
        };
      }
    }
  }
  return { ok: true };
}
