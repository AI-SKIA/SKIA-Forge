import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";
import { SkiaFullAdapter } from "./skiaFullAdapter.js";
import { registerForgeCodeIntelRoutes } from "./forgeCodeIntelRoutes.js";

type SkiaAdapterInstance = InstanceType<typeof SkiaFullAdapter>;

function listen(app: express.Express): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("expected tcp address"));
        return;
      }
      resolve({
        baseUrl: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise<void>((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          })
      });
    });
    server.on("error", reject);
  });
}

function pickFromReq(req: express.Request): Record<string, string> {
  const out: Record<string, string> = {};
  const auth = req.headers.authorization;
  const cookie = req.headers.cookie;
  if (typeof auth === "string") out.authorization = auth;
  if (typeof cookie === "string") out.cookie = cookie;
  return out;
}

test("SkiaFullAdapter.analyzeRepo posts /api/skia/code/analyze with payload and passthrough headers", async () => {
  const prev = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return Response.json({
      summary: "s",
      findings: [],
      suggestedRefactors: [],
      rationale: "r",
      governanceFlags: [],
      confidence: 1
    });
  };
  try {
    const adapter = new SkiaFullAdapter({
      enabled: true,
      baseUrl: "https://api.skia.ca",
      timeoutMs: 5000,
      allowLocalFallback: false,
      brainOnly: true
    });
    const payload = { fileList: ["a.ts"], analysisDepth: "shallow" as const, focusAreas: [] };
    await adapter.analyzeRepo(payload, { authorization: "Bearer tok", cookie: "sid=1" });
    assert.equal(calls.length, 1);
    assert.ok(calls[0].url.endsWith("/api/skia/code/analyze"));
    assert.equal(calls[0].init.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), payload);
    const hdrs = new Headers(calls[0].init.headers as Record<string, string>);
    assert.equal(hdrs.get("authorization"), "Bearer tok");
    assert.equal(hdrs.get("cookie"), "sid=1");
  } finally {
    globalThis.fetch = prev;
  }
});

test("SkiaFullAdapter.proposeEdit posts /api/skia/code/propose-edit", async () => {
  const prev = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return Response.json({
      filePath: "x.ts",
      change: {
        filePath: "x.ts",
        originalContent: "a",
        proposedContent: "b",
        hunks: [],
        rationale: "r",
        requiresApproval: true
      },
      rationale: "r",
      governanceFlags: [],
      confidence: 1,
      requiresApproval: true
    });
  };
  try {
    const adapter = new SkiaFullAdapter({
      enabled: true,
      baseUrl: "https://api.skia.ca",
      timeoutMs: 5000,
      allowLocalFallback: false,
      brainOnly: true
    });
    const payload = { filePath: "x.ts", originalContent: "a", instruction: "go" };
    await adapter.proposeEdit(payload, { authorization: "Bearer z" });
    assert.ok(calls[0].url.endsWith("/api/skia/code/propose-edit"));
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), payload);
  } finally {
    globalThis.fetch = prev;
  }
});

test("SkiaFullAdapter.proposeRefactor posts /api/skia/code/propose-refactor", async () => {
  const prev = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return Response.json({
      plan: { steps: [] },
      changes: [],
      rationale: "r",
      governanceFlags: [],
      confidence: 1,
      requiresApproval: false
    });
  };
  try {
    const adapter = new SkiaFullAdapter({
      enabled: true,
      baseUrl: "https://api.skia.ca",
      timeoutMs: 5000,
      allowLocalFallback: false,
      brainOnly: true
    });
    const payload = {
      files: [{ filePath: "a.ts", content: "//" }],
      goal: "g",
      constraints: ["c"]
    };
    await adapter.proposeRefactor(payload);
    assert.ok(calls[0].url.endsWith("/api/skia/code/propose-refactor"));
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), payload);
  } finally {
    globalThis.fetch = prev;
  }
});

test("SkiaFullAdapter.computeDiff posts /api/skia/code/diff", async () => {
  const prev = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} });
    return Response.json({
      filePath: "f",
      hunks: [],
      summary: "none",
      rationale: "r",
      governanceFlags: [],
      confidence: 1
    });
  };
  try {
    const adapter = new SkiaFullAdapter({
      enabled: true,
      baseUrl: "https://api.skia.ca",
      timeoutMs: 5000,
      allowLocalFallback: false,
      brainOnly: true
    });
    const payload = { original: "a", proposed: "b", filePath: "f.ts", options: { ignoreWhitespace: true } };
    await adapter.computeDiff(payload);
    assert.ok(calls[0].url.endsWith("/api/skia/code/diff"));
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), payload);
  } finally {
    globalThis.fetch = prev;
  }
});

test("forge code routes return upstream JSON on success", async () => {
  const app = express();
  app.use(express.json());
  const okAdapter = {
    analyzeRepo: async () => ({ summary: "up", findings: [], suggestedRefactors: [], rationale: "r", governanceFlags: [], confidence: 0.5 }),
    proposeEdit: async () => ({
      filePath: "p.ts",
      change: {
        filePath: "p.ts",
        originalContent: "",
        proposedContent: "",
        hunks: [],
        rationale: "",
        requiresApproval: false
      },
      rationale: "",
      governanceFlags: [],
      confidence: 1,
      requiresApproval: false
    }),
    proposeRefactor: async () => ({
      plan: { steps: [] },
      changes: [],
      rationale: "",
      governanceFlags: [],
      confidence: 1,
      requiresApproval: false
    }),
    computeDiff: async () => ({
      hunks: [],
      summary: "s",
      rationale: "",
      governanceFlags: [],
      confidence: 1
    })
  } as unknown as SkiaAdapterInstance;

  registerForgeCodeIntelRoutes(app, {
    skiaFullAdapter: okAdapter,
    enforceForgeModuleAccess: async () => ({ mode: "strict", approved: true }),
    pickSkiaHeaders: pickFromReq
  });

  const { baseUrl, close } = await listen(app);
  try {
    const analyzeRes = await fetch(`${baseUrl}/api/forge/code/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileList: ["a.ts"], analysisDepth: "shallow", focusAreas: [] })
    });
    assert.equal(analyzeRes.status, 200);
    assert.equal(((await analyzeRes.json()) as { summary: string }).summary, "up");

    const editRes = await fetch(`${baseUrl}/api/forge/code/propose-edit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filePath: "p.ts", originalContent: "x", instruction: "y" })
    });
    assert.equal(editRes.status, 200);

    const refRes = await fetch(`${baseUrl}/api/forge/code/propose-refactor`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ files: [{ filePath: "a.ts", content: "" }], goal: "g", constraints: [] })
    });
    assert.equal(refRes.status, 200);

    const diffRes = await fetch(`${baseUrl}/api/forge/code/diff`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ original: "a", proposed: "b" })
    });
    assert.equal(diffRes.status, 200);
    assert.equal(((await diffRes.json()) as { summary: string }).summary, "s");
  } finally {
    await close();
  }
});

test("forge code routes return 502 when adapter throws", async () => {
  const boom = () => {
    throw new Error("adapter boom");
  };
  const badAdapter = {
    analyzeRepo: boom,
    proposeEdit: boom,
    proposeRefactor: boom,
    computeDiff: boom
  } as unknown as SkiaAdapterInstance;

  const app = express();
  app.use(express.json());
  registerForgeCodeIntelRoutes(app, {
    skiaFullAdapter: badAdapter,
    enforceForgeModuleAccess: async () => ({ mode: "strict", approved: true }),
    pickSkiaHeaders: () => ({})
  });

  const { baseUrl, close } = await listen(app);
  try {
    for (const path of [
      "/api/forge/code/analyze",
      "/api/forge/code/propose-edit",
      "/api/forge/code/propose-refactor",
      "/api/forge/code/diff"
    ]) {
      const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          path.endsWith("analyze")
            ? { fileList: ["a.ts"], analysisDepth: "shallow", focusAreas: [] }
            : path.endsWith("propose-edit")
              ? { filePath: "x.ts", originalContent: "", instruction: "i" }
              : path.endsWith("propose-refactor")
                ? { files: [{ filePath: "x.ts", content: "" }], goal: "g", constraints: [] }
                : { original: "a", proposed: "b" }
        )
      });
      assert.equal(res.status, 502);
      const body = (await res.json()) as { error?: string };
      assert.match(String(body.error), /adapter boom/);
    }
  } finally {
    await close();
  }
});
