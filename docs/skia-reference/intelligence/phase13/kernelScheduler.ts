import type { KernelTask } from "./kernelAbstractions";

/**
 * Highest numeric priority first (ties broken by lexicographic task id for stability).
 */
export function prioritizeTasks(tasks: KernelTask[]): KernelTask[] {
  if (!Array.isArray(tasks)) return [];
  return [...tasks].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Round-robin style pool bookkeeping — returns active agent slots capped at pool size.
 */
export function manageAgentPool(agentIds: string[], maxAgents = 8): string[] {
  if (!Array.isArray(agentIds)) return [];
  const deduped = [...new Set(agentIds.filter((id) => /^[a-z0-9._-]{1,64}$/i.test(id)))];
  return deduped.slice(0, maxAgents);
}

/**
 * Proportional CPU weight allocation based on priority scores.
 */
export function allocateResources(tasks: KernelTask[]): Record<string, number> {
  if (!Array.isArray(tasks) || tasks.length === 0) return {};
  const safe = tasks.filter((t) => t && typeof t.id === "string" && Number.isFinite(t.priority) && t.priority >= 0);
  const total = safe.reduce((sum, t) => sum + (t.priority + 1), 0);
  if (total <= 0) return {};
  const out: Record<string, number> = {};
  for (const t of safe) {
    out[t.id] = (t.priority + 1) / total;
  }
  return out;
}
