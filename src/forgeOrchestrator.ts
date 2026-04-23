import { SkiaFullAdapter } from "./skiaFullAdapter.js";
import { evaluateForgeModuleAccess, SovereignExecutionMode } from "./forgeGovernance.js";
import { ForgeGovernancePolicy } from "./forgePolicy.js";

type ForgeStage = "context" | "architecture" | "sdlc" | "production" | "healing";
type ForgeStageStatus = "success" | "failed" | "blocked";

export type ForgeOrchestrateInput = {
  intent: string;
  includeHealing?: boolean;
  productionPayload?: Record<string, unknown>;
  mode?: SovereignExecutionMode;
  approved?: boolean;
  policy?: ForgeGovernancePolicy;
  onStageDecision?: (stage: ForgeStage, status: "allowed" | "blocked", mode: SovereignExecutionMode) => void;
};

export async function runForgeOrchestration(
  adapter: SkiaFullAdapter,
  input: ForgeOrchestrateInput,
  headers?: Record<string, string>
) {
  const stages: Array<{
    stage: ForgeStage;
    status: ForgeStageStatus;
    output?: Record<string, unknown>;
    error?: string;
  }> = [];

  const runStage = async (
    stage: ForgeStage,
    fn: () => Promise<Record<string, unknown>>
  ): Promise<void> => {
    const mode = input.mode ?? "adaptive";
    const decision = evaluateForgeModuleAccess(mode, stage, input.approved === true, input.policy);
    if (!decision.allowed) {
      input.onStageDecision?.(stage, "blocked", mode);
      stages.push({ stage, status: "blocked", error: decision.reason });
      return;
    }
    input.onStageDecision?.(stage, "allowed", mode);
    try {
      const output = await fn();
      stages.push({ stage, status: "success", output });
    } catch (error) {
      const message = error instanceof Error ? error.message : `${stage} failed`;
      stages.push({ stage, status: "failed", error: message });
    }
  };

  await runStage("context", () => adapter.routeReasoning(input.intent, "context", headers));
  await runStage("architecture", () => adapter.routeReasoning(input.intent, "architecture", headers));
  await runStage("sdlc", () => adapter.intelligence(input.intent, "sdlc", headers));
  await runStage("production", () =>
    adapter.routingEstimate(input.productionPayload ?? { task: "deploy-plan", intent: input.intent }, headers)
  );

  if (input.includeHealing !== false) {
    await runStage("healing", () => adapter.routeReasoning(input.intent, "healing", headers));
  }

  const successCount = stages.filter((s) => s.status === "success").length;
  const failedCount = stages.length - successCount;

  return {
    intent: input.intent,
    mode: input.mode ?? "adaptive",
    status: failedCount === 0 ? "success" : successCount > 0 ? "partial_success" : "failed",
    summary: {
      total: stages.length,
      successCount,
      failedCount
    },
    stages
  };
}
