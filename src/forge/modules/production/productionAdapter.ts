import { ProductionStoreV1, type ServiceTelemetrySnapshotV1 } from "./productionStore.js";

export type DeploymentStatusV1 = {
  environment: string;
  status: "healthy" | "degraded" | "down";
  version: string;
  updatedAt: string;
};

export type RuntimeHealthV1 = {
  status: "healthy" | "degraded" | "down";
  checks: Array<{ name: string; status: "pass" | "warn" | "fail"; detail?: string }>;
  updatedAt: string;
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      return null;
    }
    return await res.json() as T;
  } catch {
    return null;
  }
}

export class ProductionAdapterV1 {
  readonly apiUrl: string;
  readonly store: ProductionStoreV1;

  constructor(options?: { apiUrl?: string; store?: ProductionStoreV1 }) {
    this.apiUrl = String(options?.apiUrl ?? process.env.PRODUCTION_API_URL ?? "http://localhost:8080").replace(/\/$/, "");
    this.store = options?.store ?? new ProductionStoreV1();
  }

  async getDeploymentStatus(): Promise<DeploymentStatusV1> {
    const upstream = await fetchJson<Partial<DeploymentStatusV1>>(`${this.apiUrl}/deployment/status`);
    return {
      environment: String(upstream?.environment ?? "unknown"),
      status: upstream?.status === "healthy" || upstream?.status === "degraded" || upstream?.status === "down"
        ? upstream.status
        : "degraded",
      version: String(upstream?.version ?? "unknown"),
      updatedAt: String(upstream?.updatedAt ?? new Date().toISOString())
    };
  }

  async getRuntimeHealth(): Promise<RuntimeHealthV1> {
    const upstream = await fetchJson<Partial<RuntimeHealthV1>>(`${this.apiUrl}/runtime/health`);
    return {
      status: upstream?.status === "healthy" || upstream?.status === "degraded" || upstream?.status === "down"
        ? upstream.status
        : "degraded",
      checks: Array.isArray(upstream?.checks)
        ? upstream.checks
            .map((c) => ({
              name: String((c as { name?: string }).name ?? "unknown"),
              status: (c as { status?: string }).status === "pass" || (c as { status?: string }).status === "warn" || (c as { status?: string }).status === "fail"
                ? ((c as { status: "pass" | "warn" | "fail" }).status)
                : "warn",
              detail: typeof (c as { detail?: unknown }).detail === "string" ? (c as { detail: string }).detail : undefined
            }))
        : [],
      updatedAt: String(upstream?.updatedAt ?? new Date().toISOString())
    };
  }

  async getServiceTelemetry(): Promise<ServiceTelemetrySnapshotV1[]> {
    const upstream = await fetchJson<Array<Partial<ServiceTelemetrySnapshotV1>>>(`${this.apiUrl}/services/telemetry`);
    const snapshots = Array.isArray(upstream)
      ? upstream.map((row) => ({
          service: String(row.service ?? "unknown"),
          timestamp: String(row.timestamp ?? new Date().toISOString()),
          errorRate: Number.isFinite(row.errorRate) ? Number(row.errorRate) : 0,
          latencyMs: Number.isFinite(row.latencyMs) ? Number(row.latencyMs) : 0,
          restartCount: Number.isFinite(row.restartCount) ? Number(row.restartCount) : 0,
          healthy: Boolean(row.healthy ?? true),
          ...(row.meta && typeof row.meta === "object" ? { meta: row.meta } : {})
        }))
      : [];
    this.store.upsertMany(snapshots);
    return this.store.getAll();
  }
}

