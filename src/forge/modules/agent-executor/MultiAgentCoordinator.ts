export type AgentRole = 'coder' | 'reviewer' | 'tester' | 'documenter' | 'security-scanner';
export type Task = { id: string; title: string };
export type AgentHandle = { id: string; role: AgentRole; task: Task };
export type WorkGraph = { tasks: Task[] };
export type FileConflict = { file: string; leftAgentId: string; rightAgentId: string };
export type Resolution = { winnerAgentId: string; reason: string };
export type CoordinationResult = { assignments: AgentHandle[]; conflicts: FileConflict[] };
export type AgentCoordinationStatus = {
  activeAgents: AgentHandle[];
  queuedTasks: Task[];
  lastUpdated: string;
};

const ROLE_PRIORITY: Record<AgentRole, number> = {
  'security-scanner': 5,
  reviewer: 4,
  tester: 3,
  coder: 2,
  documenter: 1,
};

export class MultiAgentCoordinator {
  private readonly active = new Map<string, AgentHandle>();
  private readonly queue: Task[] = [];

  async spawn(role: AgentRole, task: Task): Promise<AgentHandle> {
    const handle = { id: `${role}-${Date.now()}-${task.id}`, role, task };
    this.active.set(handle.id, handle);
    return handle;
  }

  async coordinate(agents: AgentHandle[], graph: WorkGraph): Promise<CoordinationResult> {
    const conflicts: FileConflict[] = [];
    const assignedTaskIds = new Set<string>();
    const assignments: AgentHandle[] = [];
    for (const agent of agents) {
      if (!assignedTaskIds.has(agent.task.id)) {
        assignedTaskIds.add(agent.task.id);
        assignments.push(agent);
      } else {
        conflicts.push({ file: `task:${agent.task.id}`, leftAgentId: assignments[0]?.id || agent.id, rightAgentId: agent.id });
      }
    }
    for (const task of graph.tasks) {
      if (!assignedTaskIds.has(task.id)) this.queue.push(task);
    }
    return { assignments, conflicts };
  }

  async conflict_resolve(agents: AgentHandle[], conflict: FileConflict): Promise<Resolution> {
    const left = agents.find((a) => a.id === conflict.leftAgentId);
    const right = agents.find((a) => a.id === conflict.rightAgentId);
    const winner =
      !right || (left && ROLE_PRIORITY[left.role] >= ROLE_PRIORITY[right.role]) ? left : right;
    return {
      winnerAgentId: winner?.id || conflict.leftAgentId,
      reason: `priority-based resolution (${winner?.role || 'unknown'} retains ${conflict.file})`,
    };
  }

  status(): AgentCoordinationStatus {
    return {
      activeAgents: Array.from(this.active.values()),
      queuedTasks: [...this.queue],
      lastUpdated: new Date().toISOString(),
    };
  }
}
