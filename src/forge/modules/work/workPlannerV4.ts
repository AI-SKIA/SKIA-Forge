import type { WorkItemV1 } from "./workItemModel.js";
import type { WorkImpactV1 } from "./workImpact.js";
import type { WorkSlaDriftV1 } from "./workSlaDrift.js";
import type { WorkGovernanceStatusV1 } from "./workGovernance.js";
import type { SdlcInsightsBundleV2 } from "../sdlc/sdlcInsights.js";

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
