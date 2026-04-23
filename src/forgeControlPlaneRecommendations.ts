import { ControlPlaneAlert } from "./forgeControlPlaneAlerts.js";
import { ForgeGovernancePolicy } from "./forgePolicy.js";
import { SovereignExecutionMode } from "./forgeGovernance.js";

export type ControlPlaneRecommendation = {
  code:
    | "align_mode"
    | "reduce_block_pressure"
    | "rotate_intent_key_cleanup"
    | "healthy_posture";
  action: string;
  endpoint?: string;
};

export function buildControlPlaneRecommendations(
  mode: SovereignExecutionMode,
  policy: ForgeGovernancePolicy,
  alerts: ControlPlaneAlert[]
): ControlPlaneRecommendation[] {
  const out: ControlPlaneRecommendation[] = [];
  if (alerts.some((a) => a.code === "mode_drift" && a.level === "warning")) {
    out.push({
      code: "align_mode",
      action: `Align runtime mode (${mode}) with policy default (${policy.defaultMode}).`,
      endpoint: "/api/forge/mode"
    });
  }
  if (alerts.some((a) => a.code === "block_pressure" && a.level === "warning")) {
    out.push({
      code: "reduce_block_pressure",
      action: "Use preflight preview, then add explicit approvals for intended sensitive runs.",
      endpoint: "/api/forge/orchestrate/preview"
    });
  }
  if (
    alerts.some(
      (a) =>
        (a.code === "intent_rotation_grace_window" || a.code === "intent_rotation_stale_previous_key") &&
        a.level === "warning"
    )
  ) {
    out.push({
      code: "rotate_intent_key_cleanup",
      action:
        "Complete signed-intent key rotation by removing previous key env or extending grace only for planned overlap.",
      endpoint: "/api/forge/governance/intents/status"
    });
  }
  if (out.length === 0) {
    out.push({
      code: "healthy_posture",
      action: "Keep current governance posture and continue monitoring control-plane telemetry."
    });
  }
  return out;
}
