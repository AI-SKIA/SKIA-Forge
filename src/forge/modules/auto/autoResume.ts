import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { buildWorkDashboard } from "../work/workDashboard.js";
import { getAutoSession, listAutoSessions, type AutoExecutionSessionV1 } from "./autoSessionModel.js";
import { queryAutoMemory } from "./autoMemory.js";

export type AutoResumeResultV1 = {
  action: "resume" | "restart" | "abandon" | "escalate_to_human";
  session: AutoExecutionSessionV1 | null;
  reason: string;
};

export async function resumeAutoSession(
  projectRoot: string,
  sessionId?: string
): Promise<AutoResumeResultV1> {
  const target =
    (sessionId ? await getAutoSession(projectRoot, sessionId) : null) ??
    (await listAutoSessions(projectRoot, { limit: 1 }))[0] ??
    null;
  if (!target) {
    return { action: "restart", session: null, reason: "No prior session found." };
  }
  const dashboard = await buildWorkDashboard(projectRoot);
  const mem = await queryAutoMemory(projectRoot, { sessionId: target.id, limit: 300 });
  const failMem = mem.filter((m) => m.outcome === "failure").length;
  const recentCritical = target.steps.slice(-10).some((s) => /critical|halt|require_human_review/i.test(s.notes ?? ""));
  let action: AutoResumeResultV1["action"] = "resume";
  let reason = "Session appears resumable.";
  if (target.status === "completed") {
    action = "restart";
    reason = "Previous session completed.";
  } else if (recentCritical || dashboard.slaDrift.severity === "critical" || failMem >= 8) {
    action = "escalate_to_human";
    reason = "Critical pattern detected in previous session.";
  } else if (target.status === "aborted" && failMem >= 4) {
    action = "abandon";
    reason = "Repeated failure after abort.";
  } else if (target.status === "paused" || target.status === "running") {
    action = "resume";
    reason = "Session paused/running with acceptable safety signals.";
  }
  await appendAuditLog(projectRoot, {
    timestamp: new Date().toISOString(),
    action: "auto.session.resume",
    parameters: mergeForgeAuditParamsV1("auto_resume", {
      sessionId: target.id,
      priorStatus: target.status,
      action,
      reason
    }),
    result: action === "escalate_to_human" ? "failure" : "success"
  });
  return { action, session: target, reason };
}
