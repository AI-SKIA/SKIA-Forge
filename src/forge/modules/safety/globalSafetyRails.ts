import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { getOperatorControlStateV1 } from "./operatorControls.js";
import { getGlobalStateSnapshot } from "../global/globalState.js";

export type GlobalSafetyStatusV1 = {
  safetyStatus: "allow" | "deny" | "analysisOnly" | "halted";
  violatedRules: string[];
  recommendedOperatorActions: string[];
};

export async function evaluateGlobalSafety(
  projectRoots: string[],
  options?: {
    globalKillSwitch?: boolean;
    repoKillSwitches?: Record<string, boolean>;
    denyPaths?: string[];
    denyFileTypes?: string[];
    maxChangeVolumePerCycle?: number;
    maxRiskThreshold?: number;
    maxDriftThreshold?: number;
    requestedChangeVolume?: number;
    enforceAnalysisOnly?: boolean;
  }
): Promise<GlobalSafetyStatusV1> {
  const state = getOperatorControlStateV1();
  const snapshot = await getGlobalStateSnapshot(projectRoots);
  const violatedRules: string[] = [];
  const recommendedOperatorActions: string[] = [];
  if (options?.globalKillSwitch) violatedRules.push("global_kill_switch");
  for (const root of projectRoots) {
    if (options?.repoKillSwitches?.[root]) violatedRules.push(`repo_kill_switch:${root}`);
  }
  const denyPaths = options?.denyPaths ?? [];
  if (
    denyPaths.length > 0 &&
    snapshot.latestGlobalContextGraph?.globalHotspotRanking.some((h) => denyPaths.some((d) => h.path.includes(d)))
  ) {
    violatedRules.push("deny_path_violation");
  }
  const denyFileTypes = options?.denyFileTypes ?? [];
  if (
    denyFileTypes.length > 0 &&
    snapshot.latestGlobalContextGraph?.globalHotspotRanking.some((h) =>
      denyFileTypes.some((ext) => h.path.toLowerCase().endsWith(ext.toLowerCase()))
    )
  ) {
    violatedRules.push("deny_filetype_violation");
  }
  if ((options?.requestedChangeVolume ?? 0) > (options?.maxChangeVolumePerCycle ?? 500)) {
    violatedRules.push("max_change_volume_exceeded");
  }
  if ((snapshot.latestGlobalContextGraph?.globalRiskPropagation ?? 0) > (options?.maxRiskThreshold ?? 85)) {
    violatedRules.push("max_global_risk_exceeded");
  }
  if ((snapshot.latestGlobalContextGraph?.globalDriftPropagation ?? 0) > (options?.maxDriftThreshold ?? 85)) {
    violatedRules.push("max_global_drift_exceeded");
  }
  const analysisOnly = state.analysisOnlyMode || Boolean(options?.enforceAnalysisOnly);
  let safetyStatus: GlobalSafetyStatusV1["safetyStatus"] = "allow";
  if (violatedRules.some((r) => /kill_switch/.test(r))) safetyStatus = "halted";
  else if (violatedRules.length > 0) safetyStatus = "deny";
  else if (analysisOnly) safetyStatus = "analysisOnly";
  if (safetyStatus !== "allow") {
    recommendedOperatorActions.push("review operator controls and risk thresholds");
  }
  const out: GlobalSafetyStatusV1 = { safetyStatus, violatedRules, recommendedOperatorActions };
  await appendAuditLog(projectRoots[0] ?? ".", {
    timestamp: new Date().toISOString(),
    action: "safety.global.check",
    parameters: mergeForgeAuditParamsV1("global_safety", out),
    result: safetyStatus === "allow" || safetyStatus === "analysisOnly" ? "success" : "failure"
  });
  if (safetyStatus === "halted") {
    await appendAuditLog(projectRoots[0] ?? ".", {
      timestamp: new Date().toISOString(),
      action: "safety.global.halt",
      parameters: mergeForgeAuditParamsV1("global_safety", out),
      result: "failure"
    });
  }
  return out;
}
