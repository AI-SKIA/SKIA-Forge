import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import type { ContextRetrievalStructureSource, ForgeContextSkiarulesContext } from "../context-engine/contextRetrievalRequest.js";
import type { SkiaFullAdapter } from "../../../skiaFullAdapter.js";
import { buildWorkDashboard } from "../work/workDashboard.js";
import { buildSdlcInsightsBundle } from "../sdlc/sdlcInsights.js";
import { listAutoSessions } from "./autoSessionModel.js";
import { evaluateAutoStability } from "./autoStability.js";
import { queryAutoMemory } from "./autoMemory.js";
import { runAutoExecutionSession } from "./autoOrchestrator.js";
import { resumeAutoSession } from "./autoResume.js";
import { evaluateAutoSafety } from "./autoSafety.js";

export type AutoHeartbeatResultV1 = {
  ticks: number;
  status: "started_session" | "continued_session" | "paused" | "halted" | "human_review";
  sessionId: string | null;
  reason: string;
};

export async function runAutoHeartbeat(
  projectRoot: string,
  options: {
    skia: SkiaFullAdapter;
    env: NodeJS.ProcessEnv;
    structure: ContextRetrievalStructureSource;
    skiarulesContext?: ForgeContextSkiarulesContext;
    passthroughHeaders?: Record<string, string>;
    intervalMs?: number;
    maxContinuousSessions?: number;
    stabilityThreshold?: "stable" | "unstable" | "degraded" | "critical";
    slaThreshold?: "none" | "mild" | "moderate" | "severe" | "critical";
  }
): Promise<AutoHeartbeatResultV1> {
  const intervalMs = Math.max(1000, options.intervalMs ?? 30_000);
  const maxContinuous = Math.max(1, options.maxContinuousSessions ?? 1);
  let ticks = 0;
  let lastStatus: AutoHeartbeatResultV1["status"] = "paused";
  let sessionId: string | null = null;
  let reason = "No work executed.";
  for (let i = 0; i < maxContinuous; i++) {
    ticks += 1;
    const [dashboard, sdlc, sessions, mem] = await Promise.all([
      buildWorkDashboard(projectRoot),
      buildSdlcInsightsBundle(projectRoot),
      listAutoSessions(projectRoot, { limit: 1 }),
      queryAutoMemory(projectRoot, { limit: 300 })
    ]);
    const current = sessions[0] ?? null;
    const adaptationStub = {
      updatedStrategy: {
        plannerPreference: "v4" as const,
        selectionWeights: { risk: 0.45, drift: 0.25, forecast: 0.2, stability: 0.1 },
        correctionBudget: 2,
        driftMitigationMode: "normal" as const,
        stabilityMode: "normal" as const
      },
      notes: []
    };
    const stability = current
      ? evaluateAutoStability(current, adaptationStub, mem, sdlc)
      : { stabilityStatus: "stable" as const, recommendedAction: "continue" as const, notes: ["no current session"] };
    const safety = current
      ? evaluateAutoSafety(current, stability, dashboard.governance, dashboard.slaDrift)
      : { safetyStatus: "safe" as const, recommendedAction: "continue" as const, notes: ["no current session"] };
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action: "auto.heartbeat.tick",
      parameters: mergeForgeAuditParamsV1("auto_heartbeat", {
        tick: ticks,
        intervalMs,
        sessionId: current?.id ?? null,
        stability,
        safety,
        slaSeverity: dashboard.slaDrift.severity
      }),
      result: "success"
    });
    const thresholdMap = { stable: 0, unstable: 1, degraded: 2, critical: 3 };
    const slaMap = { none: 0, mild: 1, moderate: 2, severe: 3, critical: 4 };
    const stabilityGate =
      thresholdMap[stability.stabilityStatus] <= thresholdMap[options.stabilityThreshold ?? "degraded"];
    const slaGate = slaMap[dashboard.slaDrift.severity] <= slaMap[options.slaThreshold ?? "severe"];
    if (safety.recommendedAction === "require_human_review" || safety.recommendedAction === "halt") {
      lastStatus = "human_review";
      reason = `safety=${safety.recommendedAction}`;
      sessionId = current?.id ?? null;
      break;
    }
    if (!stabilityGate || !slaGate) {
      lastStatus = "paused";
      reason = "stability/SLA threshold exceeded";
      sessionId = current?.id ?? null;
      break;
    }
    const resume = await resumeAutoSession(projectRoot, current?.id);
    if (resume.action === "escalate_to_human") {
      lastStatus = "human_review";
      reason = resume.reason;
      sessionId = resume.session?.id ?? null;
      break;
    }
    const run = await runAutoExecutionSession(projectRoot, {
      skia: options.skia,
      env: options.env,
      structure: options.structure,
      skiarulesContext: options.skiarulesContext,
      passthroughHeaders: options.passthroughHeaders,
      maxSessionSteps: 8,
      ...(resume.action === "resume" && resume.session ? { resumeSessionId: resume.session.id } : {})
    });
    sessionId = run.sessionId;
    lastStatus = resume.action === "resume" ? "continued_session" : "started_session";
    reason = run.reason ?? "heartbeat cycle executed";
    if (i < maxContinuous - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return { ticks, status: lastStatus, sessionId, reason };
}
