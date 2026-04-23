import express from "express";
import type { SovereignExecutionMode } from "../../../forgeGovernance.js";
import { detectAnomalies } from "./healingDetector.js";
import { chooseHealingAction } from "./healingPolicy.js";
import { HealingExecutorV1 } from "./healingExecutor.js";
import { ProductionAdapterV1 } from "../production/productionAdapter.js";

export function createHealingRouter(
  adapter: ProductionAdapterV1,
  executor: HealingExecutorV1,
  governance: { getMode: () => SovereignExecutionMode; isLockdown: () => boolean }
): express.Router {
  const router = express.Router();

  router.post("/scan", async (req, res) => {
    const telemetry = await adapter.getServiceTelemetry();
    const anomalies = detectAnomalies(telemetry, req.body && typeof req.body === "object" ? req.body as Record<string, number> : {});
    res.json({ count: anomalies.length, anomalies });
  });

  router.post("/remediate", async (req, res) => {
    const telemetry = await adapter.getServiceTelemetry();
    const anomalies = detectAnomalies(telemetry);
    const targetService = typeof req.body?.service === "string" ? req.body.service : undefined;
    const anomaly = targetService ? anomalies.find((x) => x.service === targetService) : anomalies[0];
    if (!anomaly) {
      return res.status(404).json({ error: "No anomaly available to remediate." });
    }
    const plan = chooseHealingAction(anomaly, governance.getMode());
    const approved = req.body?.approved === true;
    const result = await executor.execute(plan, {
      mode: governance.getMode(),
      lockdown: governance.isLockdown(),
      approved
    });
    res.status(result.status === "blocked" ? 403 : 200).json({ anomaly, plan, result });
  });

  router.get("/history", (_req, res) => {
    res.json({ count: executor.getHistory().length, history: executor.getHistory() });
  });

  return router;
}

