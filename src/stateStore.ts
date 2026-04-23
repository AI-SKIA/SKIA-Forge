import fs from "node:fs/promises";
import path from "node:path";
import { ProviderRouter } from "./providerRouter.js";
import { SovereignExecutionMode } from "./forgeGovernance.js";
import { GovernanceTelemetryStore } from "./governanceTelemetry.js";
import { TelemetryStore } from "./telemetry.js";

type RuntimeSnapshot = {
  savedAt: string;
  provider: ReturnType<ProviderRouter["toSnapshot"]>;
  telemetry: ReturnType<TelemetryStore["toSnapshot"]>;
  governance?: {
    mode: SovereignExecutionMode;
    lockdown?: boolean;
    telemetry: ReturnType<GovernanceTelemetryStore["toSnapshot"]>;
  };
};

const STATE_DIR = ".skia";
const STATE_FILE = "runtime-state.json";

export async function loadRuntimeState(
  projectRoot: string,
  providerRouter: ProviderRouter,
  telemetry: TelemetryStore,
  governance?: {
    setMode: (mode: SovereignExecutionMode) => void;
    setLockdown?: (enabled: boolean) => void;
    governanceTelemetry: GovernanceTelemetryStore;
  }
): Promise<void> {
  const filePath = path.join(projectRoot, STATE_DIR, STATE_FILE);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const snapshot = JSON.parse(raw) as RuntimeSnapshot;
    if (snapshot.provider) {
      providerRouter.restoreFromSnapshot(snapshot.provider);
    }
    if (snapshot.telemetry) {
      telemetry.restoreFromSnapshot(snapshot.telemetry);
    }
    if (governance && snapshot.governance) {
      if (
        snapshot.governance.mode === "strict" ||
        snapshot.governance.mode === "adaptive" ||
        snapshot.governance.mode === "autonomous"
      ) {
        governance.setMode(snapshot.governance.mode);
      }
      if (typeof snapshot.governance.lockdown === "boolean" && governance.setLockdown) {
        governance.setLockdown(snapshot.governance.lockdown);
      }
      governance.governanceTelemetry.restoreFromSnapshot(snapshot.governance.telemetry);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

export async function persistRuntimeState(
  projectRoot: string,
  providerRouter: ProviderRouter,
  telemetry: TelemetryStore,
  governance?: {
    getMode: () => SovereignExecutionMode;
    getLockdown?: () => boolean;
    governanceTelemetry: GovernanceTelemetryStore;
  }
): Promise<void> {
  const dir = path.join(projectRoot, STATE_DIR);
  const filePath = path.join(dir, STATE_FILE);
  const snapshot: RuntimeSnapshot = {
    savedAt: new Date().toISOString(),
    provider: providerRouter.toSnapshot(),
    telemetry: telemetry.toSnapshot()
  };
  if (governance) {
    snapshot.governance = {
      mode: governance.getMode(),
      lockdown: governance.getLockdown ? governance.getLockdown() : false,
      telemetry: governance.governanceTelemetry.toSnapshot()
    };
  }
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), "utf8");
}
