import { ForgeModuleName } from "./forgeModuleExecutor.js";
import { SovereignExecutionMode } from "./forgeGovernance.js";

type Decision = "allowed" | "blocked";

export class GovernanceTelemetryStore {
  private total = 0;

  private readonly byDecision = new Map<Decision, number>();

  private readonly byMode = new Map<SovereignExecutionMode, number>();

  private readonly byModule = new Map<ForgeModuleName, { allowed: number; blocked: number }>();

  record(mode: SovereignExecutionMode, module: ForgeModuleName, decision: Decision): void {
    this.total += 1;
    this.byDecision.set(decision, (this.byDecision.get(decision) ?? 0) + 1);
    this.byMode.set(mode, (this.byMode.get(mode) ?? 0) + 1);
    const row = this.byModule.get(module) ?? { allowed: 0, blocked: 0 };
    row[decision] += 1;
    this.byModule.set(module, row);
  }

  getSummary() {
    const modules = Array.from(this.byModule.entries()).map(([module, row]) => ({
      module,
      allowed: row.allowed,
      blocked: row.blocked
    }));
    modules.sort((a, b) => a.module.localeCompare(b.module));
    return {
      totalDecisions: this.total,
      byDecision: {
        allowed: this.byDecision.get("allowed") ?? 0,
        blocked: this.byDecision.get("blocked") ?? 0
      },
      byMode: {
        strict: this.byMode.get("strict") ?? 0,
        adaptive: this.byMode.get("adaptive") ?? 0,
        autonomous: this.byMode.get("autonomous") ?? 0
      },
      byModule: modules
    };
  }

  toSnapshot() {
    return {
      total: this.total,
      byDecision: {
        allowed: this.byDecision.get("allowed") ?? 0,
        blocked: this.byDecision.get("blocked") ?? 0
      },
      byMode: {
        strict: this.byMode.get("strict") ?? 0,
        adaptive: this.byMode.get("adaptive") ?? 0,
        autonomous: this.byMode.get("autonomous") ?? 0
      },
      byModule: Array.from(this.byModule.entries()).map(([module, row]) => ({
        module,
        allowed: row.allowed,
        blocked: row.blocked
      }))
    };
  }

  restoreFromSnapshot(snapshot: unknown): void {
    if (!snapshot || typeof snapshot !== "object") return;
    const source = snapshot as {
      total?: unknown;
      byDecision?: { allowed?: unknown; blocked?: unknown };
      byMode?: { strict?: unknown; adaptive?: unknown; autonomous?: unknown };
      byModule?: Array<{ module?: unknown; allowed?: unknown; blocked?: unknown }>;
    };
    this.total = typeof source.total === "number" && Number.isFinite(source.total) ? source.total : 0;
    this.byDecision.clear();
    this.byMode.clear();
    this.byModule.clear();
    if (typeof source.byDecision?.allowed === "number") {
      this.byDecision.set("allowed", source.byDecision.allowed);
    }
    if (typeof source.byDecision?.blocked === "number") {
      this.byDecision.set("blocked", source.byDecision.blocked);
    }
    if (typeof source.byMode?.strict === "number") this.byMode.set("strict", source.byMode.strict);
    if (typeof source.byMode?.adaptive === "number") this.byMode.set("adaptive", source.byMode.adaptive);
    if (typeof source.byMode?.autonomous === "number") {
      this.byMode.set("autonomous", source.byMode.autonomous);
    }
    for (const row of source.byModule ?? []) {
      if (
        row &&
        (row.module === "context" ||
          row.module === "agent" ||
          row.module === "sdlc" ||
          row.module === "production" ||
          row.module === "healing" ||
          row.module === "architecture") &&
        typeof row.allowed === "number" &&
        typeof row.blocked === "number"
      ) {
        this.byModule.set(row.module, { allowed: row.allowed, blocked: row.blocked });
      }
    }
  }
}
