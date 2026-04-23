import type { ContextEngine } from "./contextEngine.js";
import { loadSkiaRules } from "./rules.js";
import { jsonRpcRequestSchema } from "./contracts.js";
import { SkiaFullAdapter } from "./skiaFullAdapter.js";

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

type JsonRpcSuccess = {
  jsonrpc: "2.0";
  id: string | number | null;
  result: unknown;
};

type JsonRpcError = {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
  };
};

export async function handleRpcRequest(
  projectRoot: string,
  contextEngine: ContextEngine,
  payload: JsonRpcRequest,
  skiaFullAdapter?: SkiaFullAdapter
): Promise<JsonRpcSuccess | JsonRpcError> {
  const id = payload.id ?? null;
  const parsed = jsonRpcRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonRpcError(id, -32600, "Invalid Request");
  }
  const method = parsed.data.method;
  const params = parsed.data.params ?? {};

  try {
    switch (method) {
      case "skia/explain": {
        const code = String(params.code ?? "");
        if (skiaFullAdapter?.getStatus().enabled && code.trim()) {
          try {
            const upstream = await skiaFullAdapter.intelligence(code, "explain");
            return jsonRpcResult(id, upstream);
          } catch {
            if (!skiaFullAdapter.getStatus().allowLocalFallback) {
              return jsonRpcError(id, -32050, "SKIA-FULL upstream unavailable for skia/explain");
            }
          }
        }
        const maxLines = Number(params.maxLines ?? 8);
        const lines = code.split(/\r?\n/).filter(Boolean);
        return jsonRpcResult(id, {
          summary: `Selection has ${lines.length} non-empty lines.`,
          preview: lines.slice(0, maxLines)
        });
      }
      case "skia/generate": {
        const prompt = String(params.prompt ?? params.description ?? "");
        if (skiaFullAdapter?.getStatus().enabled && prompt.trim()) {
          try {
            const upstream = await skiaFullAdapter.intelligence(prompt, "generate");
            return jsonRpcResult(id, upstream);
          } catch {
            if (!skiaFullAdapter.getStatus().allowLocalFallback) {
              return jsonRpcError(id, -32050, "SKIA-FULL upstream unavailable for skia/generate");
            }
          }
        }
        return jsonRpcResult(id, {
          generated: `// Local fallback generated from prompt:\n${prompt}`
        });
      }
      case "skia/architect": {
        const query = String(params.query ?? params.prompt ?? "");
        if (skiaFullAdapter?.getStatus().enabled && query.trim()) {
          try {
            const upstream = await skiaFullAdapter.routeReasoning(query, "architecture");
            return jsonRpcResult(id, upstream);
          } catch {
            if (!skiaFullAdapter.getStatus().allowLocalFallback) {
              return jsonRpcError(id, -32050, "SKIA-FULL upstream unavailable for skia/architect");
            }
          }
        }
        return jsonRpcResult(id, {
          architectureNotes: ["Local fallback path active.", "Provide SKIA-FULL connectivity for full reasoning."]
        });
      }
      case "skia/route": {
        const query = String(params.query ?? "");
        const intent = typeof params.intent === "string" ? params.intent : "analysis";
        if (skiaFullAdapter?.getStatus().enabled && query.trim()) {
          try {
            const upstream = await skiaFullAdapter.routeReasoning(query, intent);
            return jsonRpcResult(id, upstream);
          } catch {
            return jsonRpcError(id, -32050, "SKIA-FULL upstream unavailable for skia/route");
          }
        }
        return jsonRpcError(id, -32040, "SKIA-FULL integration disabled");
      }
      case "skia/review": {
        const code = String(params.code ?? "");
        if (skiaFullAdapter?.getStatus().enabled && code.trim()) {
          try {
            const upstream = await skiaFullAdapter.intelligence(code, "review");
            return jsonRpcResult(id, upstream);
          } catch {
            if (!skiaFullAdapter.getStatus().allowLocalFallback) {
              return jsonRpcError(id, -32050, "SKIA-FULL upstream unavailable for skia/review");
            }
          }
        }
        const findings = buildSimpleReview(code);
        return jsonRpcResult(id, { findings });
      }
      case "skia/enforce": {
        const rules = await loadSkiaRules(projectRoot);
        const filePath = String(params.filePath ?? "");
        const content = String(params.content ?? "");
        const violations = runSimpleRuleChecks(filePath, content, rules);
        return jsonRpcResult(id, { violations });
      }
      case "skia/search": {
        const query = String(params.query ?? "");
        if (skiaFullAdapter?.getStatus().enabled && query.trim()) {
          try {
            const upstream = await skiaFullAdapter.search(query);
            return jsonRpcResult(id, upstream);
          } catch {
            if (!skiaFullAdapter.getStatus().allowLocalFallback) {
              return jsonRpcError(id, -32050, "SKIA-FULL upstream unavailable for skia/search");
            }
          }
        }
        const topK = Number(params.topK ?? 10);
        const results = await contextEngine.search(query, topK);
        return jsonRpcResult(id, { results });
      }
      default:
        return jsonRpcError(id, -32601, "Method not found");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return jsonRpcError(id, -32603, message);
  }
}

export function streamSkiaMethod(method: string, params: Record<string, unknown>): string[] {
  switch (method) {
    case "skia/explain": {
      const code = String(params.code ?? "");
      const lines = code.split(/\r?\n/).filter(Boolean);
      return [
        "Starting explanation stream.",
        `Detected ${lines.length} non-empty lines.`,
        "Explanation stream complete."
      ];
    }
    case "skia/review":
      return [
        "Starting review stream.",
        "Scanning for anti-patterns.",
        "Review stream complete."
      ];
    default:
      return [`Unsupported stream method: ${method}`];
  }
}

function jsonRpcResult(id: string | number | null, result: unknown): JsonRpcSuccess {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string
): JsonRpcError {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message }
  };
}

function buildSimpleReview(code: string): Array<{ severity: string; message: string }> {
  const findings: Array<{ severity: string; message: string }> = [];
  if (code.includes(" any")) {
    findings.push({
      severity: "warning",
      message: "Potential weak typing: found 'any' usage."
    });
  }
  if (code.includes("console.log")) {
    findings.push({
      severity: "info",
      message: "Detected console logging; consider structured logger."
    });
  }
  return findings;
}

function runSimpleRuleChecks(
  filePath: string,
  content: string,
  rules: Awaited<ReturnType<typeof loadSkiaRules>>
): Array<{ severity: "warning" | "error"; message: string }> {
  const violations: Array<{ severity: "warning" | "error"; message: string }> = [];
  const blocked = rules.agent?.blocked_paths ?? [];
  for (const pattern of blocked) {
    if (filePath.includes(pattern.replace("*", ""))) {
      violations.push({
        severity: "error",
        message: `Path violates blocked_paths rule: ${pattern}`
      });
    }
  }
  if (content.includes(" any")) {
    violations.push({
      severity: "warning",
      message: "Code contains 'any'. Review conventions."
    });
  }
  return violations;
}
