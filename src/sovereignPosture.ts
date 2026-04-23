import { SkiaStatus } from "./types.js";

export function buildSovereignPosture(input: {
  skiaStatus: SkiaStatus;
  ready: boolean;
  mode: "strict" | "adaptive" | "autonomous";
  lockdown: boolean;
  integration: { enabled: boolean; brainOnly: boolean };
  controlPlane: {
    alerts?: Array<{ level?: string }>;
    recommendations?: Array<{ code?: string }>;
    intents?: { enabled?: boolean };
  };
}) {
  const alerts = Array.isArray(input.controlPlane.alerts) ? input.controlPlane.alerts : [];
  const warnings = alerts.filter((a) => a.level === "warning").length;
  return {
    updatedAt: new Date().toISOString(),
    status: warnings > 0 || !input.ready ? "attention" : "healthy",
    runtime: {
      ready: input.ready,
      skiaStatus: input.skiaStatus,
      mode: input.mode,
      lockdown: input.lockdown
    },
    integration: input.integration,
    governance: {
      warningCount: warnings,
      recommendationCount: Array.isArray(input.controlPlane.recommendations)
        ? input.controlPlane.recommendations.length
        : 0,
      intentsEnabled: input.controlPlane.intents?.enabled === true
    },
    controlPlane: input.controlPlane
  };
}
