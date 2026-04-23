import assert from "node:assert/strict";
import test from "node:test";
import type express from "express";
import { attachRequestContext, buildRequestLog } from "./requestContext.js";

test("attachRequestContext sets request id and header", () => {
  const req = {
    header: () => undefined,
    method: "GET",
    path: "/health"
  } as unknown as express.Request;
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    statusCode: 200
  } as unknown as express.Response;

  attachRequestContext(req, res, () => undefined);
  assert.ok((req as any).requestId);
  assert.equal(headers["x-request-id"].length > 0, true);
});

test("buildRequestLog includes request metadata", () => {
  const req = {
    requestId: "r1",
    method: "POST",
    path: "/rpc",
    startedAtMs: Date.now() - 20
  } as unknown as express.Request;
  const res = { statusCode: 200 } as express.Response;
  const row = buildRequestLog(req as any, res);
  assert.equal(row.requestId, "r1");
  assert.equal(row.path, "/rpc");
  assert.equal(row.statusCode, 200);
});
