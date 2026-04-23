export type ServiceTelemetrySnapshotV1 = {
  service: string;
  timestamp: string;
  errorRate: number;
  latencyMs: number;
  restartCount: number;
  healthy: boolean;
  meta?: Record<string, unknown>;
};

export class ProductionStoreV1 {
  private readonly byService = new Map<string, ServiceTelemetrySnapshotV1>();

  upsert(snapshot: ServiceTelemetrySnapshotV1): void {
    this.byService.set(snapshot.service, snapshot);
  }

  upsertMany(snapshots: ServiceTelemetrySnapshotV1[]): void {
    for (const snapshot of snapshots) {
      this.upsert(snapshot);
    }
  }

  get(service: string): ServiceTelemetrySnapshotV1 | null {
    return this.byService.get(service) ?? null;
  }

  getAll(): ServiceTelemetrySnapshotV1[] {
    return [...this.byService.values()].sort((a, b) => a.service.localeCompare(b.service));
  }
}

