export interface McpEndpoint {
  name: string;
  path: string;
}

const ALLOWED_TOOLS = new Set(
  (process.env.SKIA_MCP_TOOL_ALLOWLIST || "search,read_file,health")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

export function exposeSkiaToolsAsEndpoints(tools: string[]): McpEndpoint[] {
  if (!Array.isArray(tools)) return [];
  return tools
    .filter((t) => typeof t === "string" && ALLOWED_TOOLS.has(t))
    .map((name) => ({ name, path: `/mcp/tools/${encodeURIComponent(name)}` }));
}

export function handleRemoteRequest(endpoint: string, payload: string): string {
  if (!endpoint.startsWith("/mcp/")) {
    return JSON.stringify({ ok: false, error: "invalid_endpoint_prefix" });
  }
  let body: unknown;
  try {
    body = JSON.parse(payload);
  } catch {
    return JSON.stringify({ ok: false, error: "invalid_json" });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return JSON.stringify({ ok: false, error: "payload_must_be_object" });
  }
  return JSON.stringify({ ok: true, endpoint, accepted: true });
}
