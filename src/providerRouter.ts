import { resolveSkiaFullApiUrl } from "./config/localBackend.js";
import { ProviderHealth, SkiaStatus } from "./types.js";

/**
 * Same cadence as Skia-FULL `HealthMonitorService.startProviderProbes`
 * (`HEALTH_PROVIDER_PROBE_INTERVAL_MS`, floor 15s). Not per `/providers/status` request.
 */
const PROVIDER_PROBE_INTERVAL_MS = Math.max(
  15_000,
  Number(process.env.HEALTH_PROVIDER_PROBE_INTERVAL_MS || 15_000) || 15_000
);
/** Same abort budget as `HealthMonitorService.runProviderProbes` fetch. */
const PROVIDER_PROBE_TIMEOUT_MS = 5_000;

export type ProviderName = "google" | "skia-serve";

/** API / persisted legacy ids (`gemini` / `skia`) plus canonical `ProviderName`. */
export type ProviderNameInput = ProviderName | "gemini" | "skia";

type ProviderSnapshot = {
  providerHealth: Record<ProviderName, ProviderHealth>;
  forcedProvider: ProviderName | null;
};

function normalizeProviderName(name: string | null | undefined): ProviderName | null {
  if (name == null || name === "") {
    return null;
  }
  if (name === "google" || name === "skia-serve") {
    return name;
  }
  if (name === "gemini") {
    return "google";
  }
  if (name === "skia") {
    return "skia-serve";
  }
  return null;
}

const defaultGoogleHealth = (): ProviderHealth => ({
  name: "google",
  healthy: true,
  latencyMs: 120,
  checkedAt: new Date().toISOString(),
  failures: 0
});

const unprobedSkiaServeHealth = (): ProviderHealth => ({
  name: "skia-serve",
  healthy: false,
  latencyMs: 0,
  checkedAt: new Date().toISOString(),
  failures: 0,
  error: "not probed yet"
});

type RawSnapshotHealth = Partial<
  Record<ProviderName | "gemini" | "skia", ProviderHealth | undefined>
>;

function mergePickedHealth(
  row: ProviderHealth | undefined,
  canonical: ProviderName,
  defaults: ProviderHealth
): ProviderHealth {
  if (!row) {
    return { ...defaults };
  }
  return {
    ...row,
    name: canonical
  };
}

type UpstreamServiceRow = {
  service?: string;
  status?: string;
  responseTimeMs?: number;
  checkedAt?: string;
  error?: string;
};

export class ProviderRouter {
  private providerHealth: Record<ProviderName, ProviderHealth> = {
    google: defaultGoogleHealth(),
    "skia-serve": unprobedSkiaServeHealth()
  };

  private forcedProvider: ProviderName | null = null;
  /** Names written by `setProviderHealth` (POST /providers/health). The probe does not overwrite them. */
  private readonly adminPinned = new Set<ProviderName>();
  private probeTimer: ReturnType<typeof setInterval> | null = null;
  private probeInFlight = false;

  getHealth(): ProviderHealth[] {
    return Object.values(this.providerHealth);
  }

  setProviderHealth(name: ProviderNameInput, healthy: boolean, latencyMs = 150): void {
    const n = normalizeProviderName(name);
    if (!n) {
      return;
    }
    const current = this.providerHealth[n];
    this.adminPinned.add(n);
    const next: ProviderHealth = {
      ...current,
      healthy,
      latencyMs,
      checkedAt: new Date().toISOString(),
      failures: healthy ? 0 : current.failures + 1
    };
    delete next.error;
    this.providerHealth[n] = next;
  }

  /**
   * Poll `GET {SKIA_FULL_API_URL}/api/health` (production: https://api.skia.ca/api/health).
   * Does not run on each `/providers/status` read; callers use the cached snapshot.
   */
  startUpstreamHealthProbe(): void {
    if (this.probeTimer) {
      return;
    }
    void this.refreshUpstreamHealth();
    this.probeTimer = setInterval(() => {
      void this.refreshUpstreamHealth();
    }, PROVIDER_PROBE_INTERVAL_MS);
    this.probeTimer.unref?.();
  }

  async refreshUpstreamHealth(): Promise<void> {
    if (this.probeInFlight) {
      return;
    }
    this.probeInFlight = true;
    const url = `${resolveSkiaFullApiUrl().replace(/\/+$/, "")}/api/health`;
    try {
      // Healthy skia_serve here is login's maintenance short-circuit (SKIA_SERVE_ENABLED=false, SKIA_DISABLE_LLM_FALLBACK=true, SKIA_PROVIDER_PROBES_ENABLED=false), not Serve answering /api/health.
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(PROVIDER_PROBE_TIMEOUT_MS)
      });
      if (!response.ok) {
        this.markProbeFailure("skia-serve", `HTTP ${response.status} from ${url}`);
        this.markProbeFailure("google", `HTTP ${response.status} from ${url}`);
        return;
      }
      const body = (await response.json()) as { services?: UpstreamServiceRow[] };
      this.ingestHealthBody(body);
    } catch (error) {
      const message = error instanceof Error ? error.message : "health fetch failed";
      this.markProbeFailure("skia-serve", message);
      this.markProbeFailure("google", message);
    } finally {
      this.probeInFlight = false;
    }
  }

  /** Apply a `/api/health` JSON body. Missing `google_llm` leaves the google snapshot unchanged. */
  ingestHealthBody(body: { services?: UpstreamServiceRow[] }): void {
    const services = Array.isArray(body?.services) ? body.services : [];
    const skia = services.find((row) => row?.service === "skia_serve");
    if (!skia) {
      this.markProbeFailure("skia-serve", "skia_serve row missing");
    } else {
      this.applyServiceRow("skia-serve", skia);
    }
    const google = services.find((row) => row?.service === "google_llm");
    if (google) {
      this.applyServiceRow("google", google);
    }
  }

  private applyServiceRow(name: ProviderName, row: UpstreamServiceRow): void {
    if (this.adminPinned.has(name)) {
      return;
    }
    const status = String(row.status || "").toLowerCase();
    const healthy = status === "healthy";
    const latency = Number(row.responseTimeMs);
    const current = this.providerHealth[name];
    const next: ProviderHealth = {
      name,
      healthy,
      latencyMs: Number.isFinite(latency) && latency >= 0 ? latency : 0,
      checkedAt: typeof row.checkedAt === "string" && row.checkedAt ? row.checkedAt : new Date().toISOString(),
      failures: healthy ? 0 : current.failures + 1
    };
    if (!healthy) {
      next.error = row.error || `status ${status || "unknown"}`;
    }
    this.providerHealth[name] = next;
  }

  private markProbeFailure(name: ProviderName, error: string): void {
    if (this.adminPinned.has(name)) {
      return;
    }
    const current = this.providerHealth[name];
    this.providerHealth[name] = {
      ...current,
      name,
      healthy: false,
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
      failures: current.failures + 1,
      error
    };
  }

  forceProvider(name: ProviderNameInput | null): void {
    if (name === null) {
      this.forcedProvider = null;
      return;
    }
    this.forcedProvider = normalizeProviderName(name);
  }

  getForcedProvider(): ProviderName | null {
    return this.forcedProvider;
  }

  toSnapshot(): ProviderSnapshot {
    return {
      providerHealth: this.providerHealth,
      forcedProvider: this.forcedProvider
    };
  }

  restoreFromSnapshot(snapshot: ProviderSnapshot): void {
    const raw = snapshot.providerHealth as RawSnapshotHealth;
    this.providerHealth = {
      google: mergePickedHealth(raw.google ?? raw.gemini, "google", defaultGoogleHealth()),
      "skia-serve": mergePickedHealth(raw["skia-serve"] ?? raw.skia, "skia-serve", unprobedSkiaServeHealth())
    };
    this.forcedProvider =
      snapshot.forcedProvider === null
        ? null
        : normalizeProviderName(snapshot.forcedProvider) ?? null;
  }

  routeForTask(_taskType: "chat" | "completion" | "review"): ProviderName {
    if (this.forcedProvider) {
      return this.forcedProvider;
    }
    if (this.providerHealth["skia-serve"].healthy) {
      return "skia-serve";
    }
    return "google";
  }

  getStatus(): SkiaStatus {
    if (this.routeForTask("chat") === "skia-serve") {
      return "Sovereign";
    }
    return "Adaptive";
  }
}
