import crypto from "node:crypto";
import express from "express";

export type RequestWithContext = express.Request & {
  requestId?: string;
  startedAtMs?: number;
};

export function attachRequestContext(
  req: RequestWithContext,
  res: express.Response,
  next: express.NextFunction
): void {
  const headerId = req.header("x-request-id");
  req.requestId = headerId && headerId.trim() ? headerId : crypto.randomUUID();
  req.startedAtMs = Date.now();
  res.setHeader("x-request-id", req.requestId);
  next();
}

export function buildRequestLog(
  req: RequestWithContext,
  res: express.Response
): Record<string, unknown> {
  return {
    requestId: req.requestId ?? "unknown",
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    durationMs: typeof req.startedAtMs === "number" ? Date.now() - req.startedAtMs : 0
  };
}
