type MetricPoint = {
  value: number;
  at: number;
};

type MetricName =
  | "chat_first_token_latency_ms"
  | "inline_completion_latency_ms"
  | "index_build_duration_ms";

export class TelemetryStore {
  private readonly metrics = new Map<MetricName, MetricPoint[]>();
  private readonly maxPointsPerMetric = 500;

  record(metric: MetricName, value: number): void {
    const points = this.metrics.get(metric) ?? [];
    points.push({ value, at: Date.now() });
    if (points.length > this.maxPointsPerMetric) {
      points.splice(0, points.length - this.maxPointsPerMetric);
    }
    this.metrics.set(metric, points);
  }

  getSummary() {
    const summary: Record<string, { count: number; p50: number; p95: number }> = {};
    for (const [metric, points] of this.metrics.entries()) {
      const sorted = points.map((p) => p.value).sort((a, b) => a - b);
      summary[metric] = {
        count: sorted.length,
        p50: percentile(sorted, 0.5),
        p95: percentile(sorted, 0.95)
      };
    }
    return summary;
  }

  toSnapshot(): Partial<Record<MetricName, MetricPoint[]>> {
    const out: Partial<Record<MetricName, MetricPoint[]>> = {};
    for (const [metric, points] of this.metrics.entries()) {
      out[metric] = points;
    }
    return out;
  }

  restoreFromSnapshot(snapshot: Partial<Record<MetricName, MetricPoint[]>>): void {
    this.metrics.clear();
    for (const [metric, points] of Object.entries(snapshot)) {
      if (!Array.isArray(points)) continue;
      const valid = points
        .filter(
          (p): p is MetricPoint =>
            typeof p?.value === "number" && Number.isFinite(p.value) && typeof p?.at === "number"
        )
        .slice(-this.maxPointsPerMetric);
      this.metrics.set(metric as MetricName, valid);
    }
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const idx = Math.floor((values.length - 1) * p);
  return values[idx];
}
