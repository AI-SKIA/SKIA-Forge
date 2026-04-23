import { ForgeGovernancePolicy } from "./forgePolicy.js";
import { SovereignExecutionMode } from "./forgeGovernance.js";

type GovernanceTelemetryShape = {
  totalDecisions: number;
  byDecision?: {
    allowed?: number;
    blocked?: number;
  };
};

type IntentStatusShape = {
  enabled?: boolean;
  keyRotation?: {
    secondaryConfigured?: boolean;
    secondaryGraceActive?: boolean;
    secondaryGraceUntil?: string | null;
  };
};

export type ControlPlaneAlert = {
  level: "info" | "warning";
  code:
    | "mode_drift"
    | "block_pressure"
    | "intent_rotation_grace_window"
    | "intent_rotation_stale_previous_key";
  message: string;
};

export function buildControlPlaneAlerts(
  mode: SovereignExecutionMode,
  policy: ForgeGovernancePolicy,
  telemetry: GovernanceTelemetryShape,
  intents?: IntentStatusShape,
  nowMs?: number
): ControlPlaneAlert[] {
  const now = nowMs ?? Date.now();
  const alerts: ControlPlaneAlert[] = [];
  if (mode !== policy.defaultMode) {
    alerts.push({
      level: "warning",
      code: "mode_drift",
      message: `Runtime mode ${mode} differs from policy default ${policy.defaultMode}.`
    });
  }
  const total = telemetry.totalDecisions;
  const blocked = telemetry.byDecision?.blocked ?? 0;
  if (total >= 5 && blocked / total >= 0.5) {
    alerts.push({
      level: "warning",
      code: "block_pressure",
      message: `Blocked governance decisions are high (${blocked}/${total}).`
    });
  }
  const rotation = intents?.keyRotation;
  if (intents?.enabled && rotation?.secondaryConfigured) {
    if (rotation.secondaryGraceActive && typeof rotation.secondaryGraceUntil === "string") {
      const graceUntilMs = Date.parse(rotation.secondaryGraceUntil);
      if (Number.isFinite(graceUntilMs) && graceUntilMs - now <= 24 * 60 * 60 * 1000) {
        alerts.push({
          level: "warning",
          code: "intent_rotation_grace_window",
          message: `Intent signing previous-key grace window ends soon (${rotation.secondaryGraceUntil}).`
        });
      }
    }
    if (!rotation.secondaryGraceActive) {
      alerts.push({
        level: "warning",
        code: "intent_rotation_stale_previous_key",
        message: "Intent signing previous key is still configured after grace expiry."
      });
    }
  }
  if (alerts.length === 0) {
    alerts.push({
      level: "info",
      code: "mode_drift",
      message: "Governance operating within expected thresholds."
    });
  }
  return alerts;
}
