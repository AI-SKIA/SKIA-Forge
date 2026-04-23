import type { ServiceTelemetrySnapshotV1 } from "../production/productionStore.js";

export type AnomalyTypeV1 = "error_rate" | "latency" | "restarts";

export type AnomalyReportV1 = {
  id: string;
  service: string;
  type: AnomalyTypeV1;
  severity: "low" | "medium" | "high" | "critical";
  observedValue: number;
  threshold: number;
  detectedAt: string;
};

export type HealingThresholdsV1 = {
  maxErrorRate: number;
  maxLatencyMs: number;
  maxRestartCount: number;
};

export function detectAnomalies(
  telemetry: ServiceTelemetrySnapshotV1[],
  thresholds?: Partial<HealingThresholdsV1>
): AnomalyReportV1[] {
  const t: HealingThresholdsV1 = {
    maxErrorRate: Number.isFinite(thresholds?.maxErrorRate) ? Number(thresholds?.maxErrorRate) : 0.1,
    maxLatencyMs: Number.isFinite(thresholds?.maxLatencyMs) ? Number(thresholds?.maxLatencyMs) : 1500,
    maxRestartCount: Number.isFinite(thresholds?.maxRestartCount) ? Number(thresholds?.maxRestartCount) : 3
  };
  const out: AnomalyReportV1[] = [];
  for (const row of telemetry) {
    const detectedAt = new Date().toISOString();
    if (row.errorRate > t.maxErrorRate) {
      out.push({
        id: `${row.service}:error_rate:${detectedAt}`,
        service: row.service,
        type: "error_rate",
        severity: row.errorRate > t.maxErrorRate * 2 ? "critical" : "high",
        observedValue: row.errorRate,
        threshold: t.maxErrorRate,
        detectedAt
      });
    }
    if (row.latencyMs > t.maxLatencyMs) {
      out.push({
        id: `${row.service}:latency:${detectedAt}`,
        service: row.service,
        type: "latency",
        severity: row.latencyMs > t.maxLatencyMs * 2 ? "critical" : "medium",
        observedValue: row.latencyMs,
        threshold: t.maxLatencyMs,
        detectedAt
      });
    }
    if (row.restartCount > t.maxRestartCount) {
      out.push({
        id: `${row.service}:restarts:${detectedAt}`,
        service: row.service,
        type: "restarts",
        severity: row.restartCount > t.maxRestartCount * 2 ? "high" : "medium",
        observedValue: row.restartCount,
        threshold: t.maxRestartCount,
        detectedAt
      });
    }
  }
  return out;
}

