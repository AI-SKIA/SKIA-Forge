import express from "express";
import { appendAuditLog, mergeForgeAuditParamsV1 } from "../../../auditLog.js";
import { ProductionAdapterV1 } from "./productionAdapter.js";

export function createProductionRouter(projectRoot: string, adapter: ProductionAdapterV1): express.Router {
  const router = express.Router();

  router.get("/status", async (_req, res) => {
    const status = await adapter.getDeploymentStatus();
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action: "production.status",
      parameters: mergeForgeAuditParamsV1("production_connector", status),
      result: "success"
    });
    res.json(status);
  });

  router.get("/health", async (_req, res) => {
    const health = await adapter.getRuntimeHealth();
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action: "production.health",
      parameters: mergeForgeAuditParamsV1("production_connector", health),
      result: health.status === "healthy" ? "success" : "failure"
    });
    res.json(health);
  });

  router.get("/telemetry", async (_req, res) => {
    const telemetry = await adapter.getServiceTelemetry();
    await appendAuditLog(projectRoot, {
      timestamp: new Date().toISOString(),
      action: "production.telemetry",
      parameters: mergeForgeAuditParamsV1("production_connector", {
        count: telemetry.length,
        services: telemetry.map((x) => x.service)
      }),
      result: "success"
    });
    res.json({ count: telemetry.length, telemetry });
  });

  return router;
}

