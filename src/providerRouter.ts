import { ProviderHealth, SkiaStatus } from "./types.js";

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

const defaultSkiaServeHealth = (): ProviderHealth => ({
  name: "skia-serve",
  healthy: true,
  latencyMs: 180,
  checkedAt: new Date().toISOString(),
  failures: 0
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

export class ProviderRouter {
  private providerHealth: Record<ProviderName, ProviderHealth> = {
    google: defaultGoogleHealth(),
    "skia-serve": defaultSkiaServeHealth()
  };

  private forcedProvider: ProviderName | null = null;

  getHealth(): ProviderHealth[] {
    return Object.values(this.providerHealth);
  }

  setProviderHealth(name: ProviderNameInput, healthy: boolean, latencyMs = 150): void {
    const n = normalizeProviderName(name);
    if (!n) {
      return;
    }
    const current = this.providerHealth[n];
    this.providerHealth[n] = {
      ...current,
      healthy,
      latencyMs,
      checkedAt: new Date().toISOString(),
      failures: healthy ? 0 : current.failures + 1
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
      "skia-serve": mergePickedHealth(raw["skia-serve"] ?? raw.skia, "skia-serve", defaultSkiaServeHealth())
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
