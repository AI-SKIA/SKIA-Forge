import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import express from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = "forge-loopback-auth-test-secret-32b";
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function boot(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  process.env.JWT_SECRET = JWT_SECRET;
  const { loopbackOrAuth } = await import("./loopbackOrAuth.js");
  const app = express();
  app.use("/api/local", loopbackOrAuth, (_req, res) => {
    res.json({ ok: true });
  });
  const server = await new Promise<http.Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not bind");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())))
  };
}

test("local-mode routes stay open to same-machine callers but reject forwarded anonymous requests", async () => {
  const ctx = await boot();
  try {
    const direct = await fetch(`${ctx.baseUrl}/api/local/services`);
    assert.equal(direct.status, 200);

    const forwarded = await fetch(`${ctx.baseUrl}/api/local/services`, {
      headers: { "x-forwarded-for": "203.0.113.9" }
    });
    assert.equal(forwarded.status, 401);

    const token = jwt.sign({ id: "1", role: "user" }, JWT_SECRET);
    const forwardedWithToken = await fetch(`${ctx.baseUrl}/api/local/services`, {
      headers: { "x-forwarded-for": "203.0.113.9", authorization: `Bearer ${token}` }
    });
    assert.equal(forwardedWithToken.status, 200);
  } finally {
    await ctx.close();
  }
});

test("server gates /diff/preview and /api/local, and the canned /stream route is gone", () => {
  const server = fs.readFileSync(path.join(srcDir, "server.ts"), "utf8");
  assert.match(server, /app\.post\("\/diff\/preview", requireAuth,/);
  assert.match(server, /app\.use\("\/api\/local", loopbackOrAuth, localHealthRoutes\)/);
  assert.doesNotMatch(server, /\/stream\/:method/);
  const rpc = fs.readFileSync(path.join(srcDir, "rpc.ts"), "utf8");
  assert.doesNotMatch(rpc, /streamSkiaMethod/);
});

test("the /chat console sends the session token on every authenticated call", () => {
  const html = fs.readFileSync(path.join(srcDir, "chatUi.ts"), "utf8");
  for (const route of ["/providers/status", "/rpc", "/diff/preview"]) {
    const call = html.slice(html.indexOf(`fetch("${route}"`), html.indexOf(`fetch("${route}"`) + 220);
    assert.match(call, /authHeaders\(/, `${route} must send authHeaders`);
  }
});
