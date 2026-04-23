// Extracted reference types from upstream orchestrator engine.

export type OrchestrationStep = {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  input: Record<string, any>;
  output: Record<string, any> | null;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  requiresHumanCheckpoint: boolean;
};

export type OrchestrationPlan = {
  id: string;
  name: string;
  userId: number;
  status: "pending" | "running" | "paused" | "completed" | "failed" | "rolled_back";
  steps: OrchestrationStep[];
  currentStepIndex: number;
  createdAt: Date;
  pausedAt: Date | null;
  completedAt: Date | null;
  checkpointData: Record<string, any>;
  rollbackLog: string[];
};

