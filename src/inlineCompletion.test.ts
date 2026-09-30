import assert from "node:assert/strict";
import http from "node:http";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import jwt from "jsonwebtoken";
import WebSocket from "ws";

const JWT_SECRET = "inline-completion-test-secret-32bytes";
process.env.JWT_SECRET = JWT_SECRET;

type Harness = { url: string; prompts: string[]; headers: Array<Record<string, string> | undefined>; close: () => void };

async function startServer(projectRoot: string): Promise<Harness> {
  const { attachInlineCompletionServer } = await import("./inlineCompletion.js");
  const prompts: string[] = [];
  const headers: Array<Record<string, string> | undefined> = [];
  const server = http.createServer();
  attachInlineCompletionServer(server, {
    providerRouter: { routeForTask: () => "skia" } as never,
    getStatus: () => "Ready" as never,
    skia: {
      getStatus: () => ({ enabled: true }),
      intelligence: async (prompt: string, _mode: string, h?: Record<string, string>) => {
        prompts.push(prompt);
        headers.push(h);
        return { response: "done()" };
      }
    } as never,
    contextEngine: { search: async () => [] } as never,
    projectRoot
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return { url: `ws://127.0.0.1:${port}/inline-completion`, prompts, headers, close: () => server.close() };
}

function connect(url: string, protocols?: string[], opts?: WebSocket.ClientOptions): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, protocols, opts);
    ws.once("open", () => resolve(ws));
    ws.once("unexpected-response", (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
    ws.once("error", reject);
  });
}

function nextMessage(ws: WebSocket, type: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const on = (raw: WebSocket.RawData) => {
      const msg = JSON.parse(String(raw)) as Record<string, unknown>;
      if (msg.type === type) {
        ws.off("message", on);
        resolve(msg);
      }
    };
    ws.on("message", on);
  });
}

test("inline completion WebSocket rejects connections without a valid login token", async (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "forge-inline-"));
  const h = await startServer(root);
  t.after(() => {
    h.close();
    rmSync(root, { recursive: true, force: true });
  });
  await assert.rejects(connect(h.url), /HTTP 401/);
  await assert.rejects(connect(h.url, ["skia.bearer", "not-a-jwt"]), /HTTP 401/);
  const forged = jwt.sign({ id: "1" }, "some-other-secret-that-is-32-bytes!");
  await assert.rejects(connect(h.url, undefined, { headers: { authorization: `Bearer ${forged}` } }), /HTTP 401/);
});

test("inline completion accepts the login JWT and forwards it upstream", async (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "forge-inline-"));
  const h = await startServer(root);
  t.after(() => {
    h.close();
    rmSync(root, { recursive: true, force: true });
  });
  const token = jwt.sign({ id: "u1", role: "user" }, JWT_SECRET);
  const ws = await connect(h.url, ["skia.bearer", token]);
  t.after(() => ws.close());
  assert.equal(ws.protocol, "skia.bearer");
  const done = nextMessage(ws, "completion");
  ws.send(JSON.stringify({ prefix: "function f() {\n  " }));
  const msg = await done;
  assert.equal(msg.text, "done()");
  assert.equal(h.headers[0]?.authorization, `Bearer ${token}`);
});

test("inline completion does not read files outside the project root", async (t) => {
  const base = mkdtempSync(path.join(os.tmpdir(), "forge-inline-"));
  const root = path.join(base, "project");
  mkdirSync(root);
  writeFileSync(path.join(base, "outside-secret.txt"), "OUTSIDE_SENTINEL");
  writeFileSync(path.join(root, "inside.ts"), "INSIDE_SENTINEL");
  const h = await startServer(root);
  t.after(() => {
    h.close();
    rmSync(base, { recursive: true, force: true });
  });
  const token = jwt.sign({ id: "u1", role: "user" }, JWT_SECRET);
  const ws = await connect(h.url, ["skia.bearer", token]);
  t.after(() => ws.close());

  let done = nextMessage(ws, "completion");
  ws.send(JSON.stringify({ prefix: "const a = ", filePath: "../outside-secret.txt" }));
  await done;
  assert.ok(!h.prompts[0]?.includes("OUTSIDE_SENTINEL"), "file outside project root reached the prompt");

  done = nextMessage(ws, "completion");
  ws.send(JSON.stringify({ prefix: "const a = ", filePath: "inside.ts" }));
  await done;
  assert.ok(h.prompts[1]?.includes("INSIDE_SENTINEL"));
});
