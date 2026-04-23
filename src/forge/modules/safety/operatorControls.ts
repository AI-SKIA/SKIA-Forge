import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { runGlobalBaselineConsolidation } from "../global/globalBaselineConsolidation.js";

export type GlobalRiskProfileV1 = "conservative" | "balanced" | "aggressive";

type OperatorStateV1 = {
  globalEvolutionPaused: boolean;
  analysisOnlyMode: boolean;
  freezeAllHeuristics: boolean;
  freezeAllStrategyProfiles: boolean;
  globalRiskProfile: GlobalRiskProfileV1;
};

const operatorState: OperatorStateV1 = {
  globalEvolutionPaused: false,
  analysisOnlyMode: false,
  freezeAllHeuristics: false,
  freezeAllStrategyProfiles: false,
  globalRiskProfile: "balanced"
};

export function getOperatorControlStateV1(): OperatorStateV1 {
  return { ...operatorState };
}

export function resetOperatorControlStateV1(): void {
  operatorState.globalEvolutionPaused = false;
  operatorState.analysisOnlyMode = false;
  operatorState.freezeAllHeuristics = false;
  operatorState.freezeAllStrategyProfiles = false;
  operatorState.globalRiskProfile = "balanced";
}

async function appendOperatorActionStart(
  projectRoot: string,
  actionName: string,
  previousState: OperatorStateV1,
  newState: OperatorStateV1,
  payload?: Record<string, unknown>
): Promise<void> {
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "operator.action.start",
    parameters: mergeForgeAuditParamsV1("operator_controls", {
      actionName,
      previousState,
      newState,
      ...(payload ?? {})
    }),
    result: "success"
  });
}

async function appendOperatorActionComplete(
  projectRoot: string,
  actionName: string,
  previousState: OperatorStateV1,
  newState: OperatorStateV1,
  payload?: Record<string, unknown>
): Promise<void> {
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "operator.action.complete",
    parameters: mergeForgeAuditParamsV1("operator_controls", {
      actionName,
      previousState,
      newState,
      ...(payload ?? {})
    }),
    result: "success"
  });
}

export async function pauseGlobalEvolution(projectRoots: string[]): Promise<void> {
  const previousState = getOperatorControlStateV1();
  const nextState = { ...previousState, globalEvolutionPaused: true };
  await appendOperatorActionStart(projectRoots[0] ?? ".", "pauseGlobalEvolution", previousState, nextState, {
    projectRoots
  });
  operatorState.globalEvolutionPaused = true;
  await appendOperatorActionComplete(projectRoots[0] ?? ".", "pauseGlobalEvolution", previousState, nextState, {
    projectRoots
  });
}

export async function resumeGlobalEvolution(projectRoots: string[]): Promise<void> {
  const previousState = getOperatorControlStateV1();
  const nextState = { ...previousState, globalEvolutionPaused: false };
  await appendOperatorActionStart(projectRoots[0] ?? ".", "resumeGlobalEvolution", previousState, nextState, {
    projectRoots
  });
  operatorState.globalEvolutionPaused = false;
  await appendOperatorActionComplete(projectRoots[0] ?? ".", "resumeGlobalEvolution", previousState, nextState, {
    projectRoots
  });
}

export async function freezeAllHeuristics(projectRoots: string[]): Promise<void> {
  const previousState = getOperatorControlStateV1();
  const nextState = { ...previousState, freezeAllHeuristics: true };
  await appendOperatorActionStart(projectRoots[0] ?? ".", "freezeAllHeuristics", previousState, nextState, {
    projectRoots
  });
  operatorState.freezeAllHeuristics = true;
  await appendOperatorActionComplete(projectRoots[0] ?? ".", "freezeAllHeuristics", previousState, nextState, {
    projectRoots
  });
}

export async function freezeAllStrategyProfiles(projectRoots: string[]): Promise<void> {
  const previousState = getOperatorControlStateV1();
  const nextState = { ...previousState, freezeAllStrategyProfiles: true };
  await appendOperatorActionStart(projectRoots[0] ?? ".", "freezeAllStrategyProfiles", previousState, nextState, {
    projectRoots
  });
  operatorState.freezeAllStrategyProfiles = true;
  await appendOperatorActionComplete(projectRoots[0] ?? ".", "freezeAllStrategyProfiles", previousState, nextState, {
    projectRoots
  });
}

export async function enableAnalysisOnlyMode(projectRoots: string[]): Promise<void> {
  const previousState = getOperatorControlStateV1();
  const nextState = { ...previousState, analysisOnlyMode: true };
  await appendOperatorActionStart(projectRoots[0] ?? ".", "enableAnalysisOnlyMode", previousState, nextState, {
    projectRoots
  });
  operatorState.analysisOnlyMode = true;
  await appendOperatorActionComplete(projectRoots[0] ?? ".", "enableAnalysisOnlyMode", previousState, nextState, {
    projectRoots
  });
}

export async function disableAnalysisOnlyMode(projectRoots: string[]): Promise<void> {
  const previousState = getOperatorControlStateV1();
  const nextState = { ...previousState, analysisOnlyMode: false };
  await appendOperatorActionStart(projectRoots[0] ?? ".", "disableAnalysisOnlyMode", previousState, nextState, {
    projectRoots
  });
  operatorState.analysisOnlyMode = false;
  await appendOperatorActionComplete(projectRoots[0] ?? ".", "disableAnalysisOnlyMode", previousState, nextState, {
    projectRoots
  });
}

export async function triggerGlobalBaselineConsolidation(projectRoots: string[]): Promise<void> {
  const previousState = getOperatorControlStateV1();
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "operator.action.start",
    parameters: mergeForgeAuditParamsV1("operator_controls", {
      actionName: "triggerGlobalBaselineConsolidation",
      previousState,
      newState: previousState,
      projectRoots
    }),
    result: "success"
  });
  await runGlobalBaselineConsolidation(projectRoots);
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "operator.action.complete",
    parameters: mergeForgeAuditParamsV1("operator_controls", {
      actionName: "triggerGlobalBaselineConsolidation",
      previousState,
      newState: getOperatorControlStateV1(),
      projectRoots
    }),
    result: "success"
  });
}

export async function setGlobalRiskProfile(
  projectRoots: string[],
  profile: GlobalRiskProfileV1
): Promise<void> {
  const previousState = getOperatorControlStateV1();
  const nextState = { ...previousState, globalRiskProfile: profile };
  await appendOperatorActionStart(projectRoots[0] ?? ".", "setGlobalRiskProfile", previousState, nextState, {
    profile,
    projectRoots
  });
  operatorState.globalRiskProfile = profile;
  await appendOperatorActionComplete(projectRoots[0] ?? ".", "setGlobalRiskProfile", previousState, nextState, {
    profile,
    projectRoots
  });
}
