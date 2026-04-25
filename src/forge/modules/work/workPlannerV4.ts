import type { WorkItemV1 } from "./workItemModel.js";
import type { WorkImpactV1 } from "./workImpact.js";
import type { WorkSlaDriftV1 } from "./workSlaDrift.js";
import type { WorkGovernanceStatusV1 } from "./workGovernance.js";
import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";
import { promises as fs } from "node:fs";
import path from "node:path";

export type WorkPlanV4Task = {
  id: string;
  title: string;
  detail: string;
  tool: string;
  input: unknown;
  dependsOn?: string[];
  risk: number;
  rationale: string;
};

export type WorkPlanV4 = {
  version: "4";
  title: string;
  tasks: WorkPlanV4Task[];
  rationale: string[];
  governanceWarnings: string[];
  slaDriftWarnings: string[];
  impactSummary: string[];
};

export type CheckpointId = string;
export type TaskBudget = {
  estimatedTokens: number;
  estimatedMs: number;
  estimatedSteps: number;
  confidenceScore: number;
};

type FileChangeLogEntry = {
  path: string;
  previousContent?: string;
  deleted?: boolean;
};

type PlannerCheckpointState = {
  taskId: string;
  createdAt: string;
  history?: unknown[];
  reasoningTrace?: unknown;
  toolCallLog?: unknown[];
  fileChangeLog?: FileChangeLogEntry[];
};

const checkpointStore = new Map<string, PlannerCheckpointState>();
const checkpointDir = path.join(process.cwd(), ".skia", "checkpoints");

async function ensureCheckpointDir(): Promise<void> {
  await fs.mkdir(checkpointDir, { recursive: true });
}

export function buildWorkPlanV4(input: {
  workItem: WorkItemV1;
  impact: WorkImpactV1;
  slaDrift: WorkSlaDriftV1;
  governance: WorkGovernanceStatusV1;
  insights: SdlcInsightsBundleV2;
}): WorkPlanV4 {
  const tasks: WorkPlanV4Task[] = [
    {
      id: `w4-impact-${input.workItem.id}`,
      title: "Impact mitigation pass",
      detail: "Mitigate high blast-radius and dependency propagation before core change.",
      tool: "search_codebase",
      input: { query: input.workItem.title, path: input.workItem.relatedFiles[0] ?? "" },
      risk: Math.max(input.impact.riskPropagation, input.impact.driftPropagation),
      rationale: "Impact-aware preflight reduces downstream regression risk."
    },
    {
      id: `w4-sla-${input.workItem.id}`,
      title: "SLA recovery and stabilization",
      detail: "Apply stabilization and completion-recovery tasks aligned with governance policy.",
      tool: "run_terminal",
      input: { command: "npm run test" },
      dependsOn: [`w4-impact-${input.workItem.id}`],
      risk: input.insights.forecast.globalNextFailureProbability,
      rationale: "SLA drift requires explicit recovery steps before expansion."
    },
    {
      id: `w4-core-${input.workItem.id}`,
      title: input.workItem.title,
      detail: input.workItem.description,
      tool: input.workItem.type === "test" || input.workItem.type === "infra" ? "run_terminal" : "search_codebase",
      input:
        input.workItem.type === "test" || input.workItem.type === "infra"
          ? { command: "npm run lint" }
          : { query: input.workItem.title, path: input.workItem.relatedFiles[0] ?? "" },
      dependsOn: [`w4-sla-${input.workItem.id}`],
      risk: input.workItem.sdlcSignals.risk,
      rationale: "Risk-first ordering schedules core task after mitigation and SLA recovery."
    }
  ];
  return {
    version: "4",
    title: `Impact-aware plan: ${input.workItem.title}`,
    tasks,
    rationale: [
      `Impact riskPropagation=${input.impact.riskPropagation}, driftPropagation=${input.impact.driftPropagation}.`,
      `SLA severity=${input.slaDrift.severity}.`,
      `SDLC riskClass=${input.insights.risk.project.class}.`
    ],
    governanceWarnings: [...input.governance.violations, ...input.governance.warnings],
    slaDriftWarnings: [...input.slaDrift.notes],
    impactSummary: [
      `blastRadius files=${input.impact.blastRadius.files} tests=${input.impact.blastRadius.tests} modules=${input.impact.blastRadius.modules}`,
      `dependency upstream=${input.impact.dependencyImpact.upstream.length} downstream=${input.impact.dependencyImpact.downstream.length}`,
      `forecastedRegressionImpact=${input.impact.forecastedRegressionImpact}`
    ]
  };
}

export async function checkpoint(taskId: string, state?: unknown): Promise<CheckpointId> {
  const id = `${taskId}-${Date.now()}`;
  const typed = (state || {}) as PlannerCheckpointState;
  const payload: PlannerCheckpointState = {
    taskId,
    createdAt: new Date().toISOString(),
    history: typed.history || [],
    reasoningTrace: typed.reasoningTrace ?? null,
    toolCallLog: typed.toolCallLog || [],
    fileChangeLog: typed.fileChangeLog || [],
  };
  checkpointStore.set(id, payload);
  await ensureCheckpointDir();
  await fs.writeFile(path.join(checkpointDir, `${id}.json`), JSON.stringify(payload, null, 2), "utf8");
  return id;
}

export async function resume(checkpointId: string): Promise<unknown> {
  const mem = checkpointStore.get(checkpointId);
  if (mem) return mem;
  try {
    await ensureCheckpointDir();
    const raw = await fs.readFile(path.join(checkpointDir, `${checkpointId}.json`), "utf8");
    const parsed = JSON.parse(raw) as PlannerCheckpointState;
    checkpointStore.set(checkpointId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function rollback(taskId: string, checkpointId: string): Promise<void> {
  const state = (await resume(checkpointId)) as PlannerCheckpointState | null;
  if (!state || !checkpointId.startsWith(taskId)) return;
  const changes = state.fileChangeLog || [];
  for (const change of changes) {
    if (!change.path) continue;
    if (change.deleted) {
      await fs.rm(change.path, { force: true });
      continue;
    }
    await fs.mkdir(path.dirname(change.path), { recursive: true });
    await fs.writeFile(change.path, change.previousContent ?? "", "utf8");
  }
  checkpointStore.delete(checkpointId);
}

export async function estimateBudget(task: { title: string; detail?: string }): Promise<TaskBudget> {
  const chars = `${task.title} ${task.detail || ''}`.length;
  const estimatedSteps = Math.max(1, Math.ceil(chars / 180));
  const estimatedTokens = Math.max(256, Math.ceil(chars / 3));
  const estimatedMs = Math.max(500, chars * 4);
  const confidenceScore = Number(Math.max(0.4, Math.min(0.95, 1 - estimatedSteps * 0.04)).toFixed(3));
  return {
    estimatedTokens,
    estimatedMs,
    estimatedSteps,
    confidenceScore,
  };
}
