import { ProviderHealth, SkiaStatus } from "./types.js";

type ProviderName = "gemini" | "skia";
type ProviderSnapshot = {
  providerHealth: Record<ProviderName, ProviderHealth>;
  forcedProvider: ProviderName | null;
};

export class ProviderRouter {
  private providerHealth: Record<ProviderName, ProviderHealth> = {
    gemini: {
      name: "gemini",
      healthy: true,
      latencyMs: 120,
      checkedAt: new Date().toISOString(),
      failures: 0
    },
    skia: {
      name: "skia",
      healthy: true,
      latencyMs: 180,
      checkedAt: new Date().toISOString(),
      failures: 0
    }
  };

  private forcedProvider: ProviderName | null = null;

  getHealth(): ProviderHealth[] {
    return Object.values(this.providerHealth);
  }

  setProviderHealth(name: ProviderName, healthy: boolean, latencyMs = 150): void {
    const current = this.providerHealth[name];
    this.providerHealth[name] = {
      ...current,
      healthy,
      latencyMs,
      checkedAt: new Date().toISOString(),
      failures: healthy ? 0 : current.failures + 1
    };
  }

  forceProvider(name: ProviderName | null): void {
    this.forcedProvider = name;
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
    this.providerHealth = snapshot.providerHealth;
    this.forcedProvider = snapshot.forcedProvider;
  }

  routeForTask(_taskType: "chat" | "completion" | "review"): ProviderName {
    if (this.forcedProvider) {
      return this.forcedProvider;
    }
    if (this.providerHealth.gemini.healthy) {
      return "gemini";
    }
    return "skia";
  }

  getStatus(): SkiaStatus {
    if (this.routeForTask("chat") === "gemini") {
      return "Sovereign";
    }
    return "Adaptive";
  }
}
